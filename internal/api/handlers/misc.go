package handlers

import (
	"encoding/json"
	"log/slog"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"vpn-control/ent"
	"vpn-control/ent/auditlog"
	"vpn-control/internal/remnawave"
	"vpn-control/internal/rwsync"
	"vpn-control/internal/settings"
)

func (h *Handlers) GetSettings(c *fiber.Ctx) error {
	all, err := h.Settings.All(c.UserContext())
	if err != nil {
		return err
	}
	return c.JSON(all)
}

func (h *Handlers) UpdateSettings(c *fiber.Ctx) error {
	var in map[string]string
	if err := bind(c, &in); err != nil {
		return err
	}
	for k, v := range in {
		if _, known := settings.Defaults[k]; !known {
			return fiber.NewError(fiber.StatusBadRequest, "неизвестная настройка "+k)
		}
		if _, err := strconv.ParseFloat(v, 64); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, k+": нужно число")
		}
		if err := h.Settings.Set(c.UserContext(), k, v); err != nil {
			return err
		}
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handlers) ListAudit(c *fiber.Ctx) error {
	rows, err := h.DB.AuditLog.Query().Order(ent.Desc(auditlog.FieldID)).Limit(500).All(c.UserContext())
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

type webhookPayload struct {
	Scope string          `json:"scope"`
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

// RemnawaveWebhook keeps the user cache fresh between full syncs. Signed
// with X-Remnawave-Signature (HMAC-SHA256 of the body).
func (h *Handlers) RemnawaveWebhook(c *fiber.Ctx) error {
	if h.Config.WebhookSecret == "" {
		return fiber.NewError(fiber.StatusNotFound, "webhook disabled")
	}
	body := c.Body()
	if !rwsync.VerifySignature(h.Config.WebhookSecret, body, c.Get("X-Remnawave-Signature")) {
		return fiber.NewError(fiber.StatusUnauthorized, "bad signature")
	}
	var p webhookPayload
	if err := json.Unmarshal(body, &p); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "bad payload")
	}
	if p.Scope != "user" {
		return c.SendStatus(fiber.StatusNoContent)
	}
	var u remnawave.User
	if err := json.Unmarshal(p.Data, &u); err != nil || u.ID == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "bad user payload")
	}
	ctx := c.UserContext()
	var err error
	if p.Event == "user.deleted" {
		err = rwsync.MarkDeleted(ctx, h.DB, u.ID)
	} else {
		err = rwsync.Upsert(ctx, h.DB, &u)
	}
	if err != nil {
		slog.Error("webhook upsert failed", "event", p.Event, "user", u.ID, "error", err)
		return err
	}
	slog.Debug("webhook", "event", p.Event, "user", u.Username)
	return c.SendStatus(fiber.StatusNoContent)
}
