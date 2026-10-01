// Package rwsync keeps the local Remnawave user cache (RwUser) and the
// add-on catalog in step with the panel and addons.yml.
package rwsync

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"vpn-control/ent"
	"vpn-control/ent/addon"
	"vpn-control/ent/rwuser"
	"vpn-control/ent/subscriptionaddon"
	"vpn-control/internal/addons"
	"vpn-control/internal/remnawave"
)

type Service struct {
	db         *ent.Client
	rw         *remnawave.Client
	addonsPath string

	mu       sync.Mutex
	lastSync time.Time
	lastErr  error
}

func New(db *ent.Client, rw *remnawave.Client, addonsPath string) *Service {
	return &Service{db: db, rw: rw, addonsPath: addonsPath}
}

// Status returns when the last full sync finished and its error.
func (s *Service) Status() (time.Time, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.lastSync, s.lastErr
}

// Run syncs immediately, then every interval until ctx is done.
func (s *Service) Run(ctx context.Context, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		if err := s.SyncAll(ctx); err != nil && ctx.Err() == nil {
			slog.Error("remnawave sync failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// SyncAll refreshes the add-on catalog and every user.
func (s *Service) SyncAll(ctx context.Context) error {
	err := s.syncAll(ctx)
	s.mu.Lock()
	s.lastSync, s.lastErr = time.Now(), err
	s.mu.Unlock()
	return err
}

func (s *Service) syncAll(ctx context.Context) error {
	if err := s.SyncAddons(ctx); err != nil {
		return fmt.Errorf("sync addons: %w", err)
	}
	users, err := s.rw.AllUsers(ctx)
	if err != nil {
		return err
	}
	seen := make([]int, 0, len(users))
	for i := range users {
		if err := Upsert(ctx, s.db, &users[i]); err != nil {
			return err
		}
		seen = append(seen, users[i].ID)
	}
	if _, err := s.db.RwUser.Update().
		Where(rwuser.IDNotIn(seen...), rwuser.Deleted(false)).
		SetDeleted(true).Save(ctx); err != nil {
		return fmt.Errorf("mark deleted users: %w", err)
	}
	if err := s.linkAddonUsers(ctx); err != nil {
		return fmt.Errorf("link addon users: %w", err)
	}
	slog.Debug("remnawave sync done", "users", len(users))
	return nil
}

// SyncAddons mirrors addons.yml into the Addon table (matched by name).
func (s *Service) SyncAddons(ctx context.Context) error {
	list, err := addons.Load(s.addonsPath)
	if err != nil {
		return err
	}
	names := make([]string, 0, len(list))
	for _, a := range list {
		name := a.DisplayName()
		names = append(names, name)
		if err := s.db.Addon.Create().
			SetName(name).SetPrefix(a.Prefix).SetSuffix(a.Suffix).SetInConfig(true).
			OnConflictColumns(addon.FieldName).
			UpdatePrefix().UpdateSuffix().UpdateInConfig().UpdateUpdatedAt().
			Exec(ctx); err != nil {
			return err
		}
	}
	_, err = s.db.Addon.Update().Where(addon.NameNotIn(names...)).SetInConfig(false).Save(ctx)
	return err
}

// linkAddonUsers attaches panel users named like an add-on of a linked
// subscription (prefix+<main username>+suffix) to that subscription, so
// add-ons created by hand in the panel show up too.
func (s *Service) linkAddonUsers(ctx context.Context) error {
	addonList, err := s.db.Addon.Query().All(ctx)
	if err != nil || len(addonList) == 0 {
		return err
	}
	users, err := s.db.RwUser.Query().
		Where(rwuser.Deleted(false)).
		WithSubscription().WithSubscriptionAddon().
		All(ctx)
	if err != nil {
		return err
	}
	byName := make(map[string]*ent.RwUser, len(users))
	for _, u := range users {
		byName[u.Username] = u
	}
	for _, u := range users {
		if u.Edges.Subscription != nil || u.Edges.SubscriptionAddon != nil {
			continue
		}
		for _, a := range addonList {
			main, ok := MainUsername(u.Username, a.Prefix, a.Suffix)
			if !ok {
				continue
			}
			mainUser := byName[main]
			if mainUser == nil || mainUser.Edges.Subscription == nil {
				continue
			}
			sub := mainUser.Edges.Subscription
			exists, err := s.db.SubscriptionAddon.Query().
				Where(subscriptionaddon.SubscriptionID(sub.ID), subscriptionaddon.AddonID(a.ID)).
				Exist(ctx)
			if err != nil {
				return err
			}
			if exists {
				continue
			}
			if err := s.db.SubscriptionAddon.Create().
				SetSubscriptionID(sub.ID).SetAddonID(a.ID).SetRwUserID(u.ID).
				Exec(ctx); err != nil {
				return err
			}
			slog.Info("linked add-on user", "username", u.Username, "subscription", sub.ID, "addon", a.Name)
			break
		}
	}
	return nil
}

// MainUsername strips an add-on's prefix/suffix; ok is false if username
// isn't shaped like that add-on's user.
func MainUsername(username, prefix, suffix string) (string, bool) {
	if prefix == "" && suffix == "" {
		return "", false
	}
	if !strings.HasPrefix(username, prefix) || !strings.HasSuffix(username, suffix) {
		return "", false
	}
	main := strings.TrimSuffix(strings.TrimPrefix(username, prefix), suffix)
	return main, main != "" && len(main) < len(username)
}

// Upsert stores a panel user in the cache.
func Upsert(ctx context.Context, db *ent.Client, u *remnawave.User) error {
	q := db.RwUser.Create().
		SetID(u.ID).
		SetUsername(u.Username).
		SetShortUUID(u.ShortUUID).
		SetStatus(u.Status).
		SetExpireAt(u.ExpireAt).
		SetUsedTrafficBytes(u.UserTraffic.UsedTrafficBytes).
		SetTrafficLimitBytes(u.TrafficLimitBytes).
		SetTrafficLimitStrategy(u.TrafficLimitStrategy).
		SetNillableHwidDeviceLimit(u.HwidDeviceLimit).
		SetNillableOnlineAt(u.UserTraffic.OnlineAt).
		SetDescription(deref(u.Description)).
		SetTag(deref(u.Tag)).
		SetNillableTelegramID(u.TelegramID).
		SetSubscriptionURL(u.SubscriptionURL).
		SetSquadUuids(u.SquadUUIDs()).
		SetDeleted(false).
		SetSyncedAt(time.Now())
	err := q.OnConflictColumns(rwuser.FieldID).
		UpdateNewValues().
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("upsert rw user %d: %w", u.ID, err)
	}
	// UpdateNewValues doesn't null out fields that became nil.
	upd := db.RwUser.UpdateOneID(u.ID)
	if u.HwidDeviceLimit == nil {
		upd.ClearHwidDeviceLimit()
	}
	if u.UserTraffic.OnlineAt == nil {
		upd.ClearOnlineAt()
	}
	if u.TelegramID == nil {
		upd.ClearTelegramID()
	}
	return upd.Exec(ctx)
}

// MarkDeleted flags a cached user as gone from the panel.
func MarkDeleted(ctx context.Context, db *ent.Client, id int) error {
	_, err := db.RwUser.Update().Where(rwuser.ID(id)).SetDeleted(true).Save(ctx)
	return err
}

// VerifySignature checks X-Remnawave-Signature: hex HMAC-SHA256 of the raw
// body keyed with the panel's WEBHOOK_SECRET_HEADER.
func VerifySignature(secret string, body []byte, signature string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	want := mac.Sum(nil)
	got, err := hex.DecodeString(strings.TrimSpace(signature))
	return err == nil && hmac.Equal(want, got)
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
