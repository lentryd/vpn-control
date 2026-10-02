package expenses

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"vpn-control/ent"
	"vpn-control/ent/expenseitem"
	"vpn-control/ent/inboundcounter"
	"vpn-control/ent/inboundtraffic"
	"vpn-control/internal/remnawave"
)

// InboundSource reads cumulative per-inbound counters from the panel.
type InboundSource interface {
	InboundCounters(ctx context.Context) (remnawave.InboundCounters, error)
}

// InboundStatus describes the inbound traffic collector for the UI.
type InboundStatus struct {
	Enabled   bool       `json:"enabled"` // REMNAWAVE_METRICS_URL is set
	LastPoll  *time.Time `json:"last_poll"`
	LastError string     `json:"last_error,omitempty"`
	Since     *time.Time `json:"since"` // first counter ever seen = start of history
}

type inboundCollector struct {
	src     InboundSource
	mu      sync.Mutex
	last    *time.Time
	lastErr error
}

// UseMetricsScraper enables per-inbound metering from the panel's
// Prometheus endpoint. Without it items can't count a single inbound.
func (s *Service) UseMetricsScraper(m *remnawave.MetricsScraper) {
	s.inbound = &inboundCollector{src: m}
}

// InboundsEnabled reports whether per-inbound counters are collected.
func (s *Service) InboundsEnabled() bool { return s.inbound != nil }

// CounterDelta is how much a cumulative counter grew since the previous
// reading: nothing on the first reading (no baseline), the full value after
// a reset (panel restarted, counter started from zero).
func CounterDelta(prev float64, havePrev bool, cur float64) float64 {
	switch {
	case !havePrev:
		return 0
	case cur >= prev:
		return cur - prev
	default:
		return cur
	}
}

// PollInbounds reads the counters once and adds the growth to today's
// per-inbound traffic.
func (s *Service) PollInbounds(ctx context.Context) error {
	c := s.inbound
	if c == nil {
		return nil
	}
	counters, err := c.src.InboundCounters(ctx)
	now := time.Now().In(s.loc)
	c.mu.Lock()
	c.last, c.lastErr = &now, err
	c.mu.Unlock()
	if err != nil {
		return err
	}

	prev, err := s.db.InboundCounter.Query().All(ctx)
	if err != nil {
		return err
	}
	last := make(map[remnawave.InboundKey]float64, len(prev))
	for _, p := range prev {
		last[remnawave.InboundKey{NodeUUID: p.NodeUUID, Tag: p.Tag}] = p.Value
	}
	day := now.Format("2006-01-02")
	for key, value := range counters {
		old, ok := last[key]
		delta := int64(CounterDelta(old, ok, value))
		if err := s.db.InboundCounter.Create().
			SetNodeUUID(key.NodeUUID).SetTag(key.Tag).SetValue(value).SetObservedAt(now).
			OnConflictColumns(inboundcounter.FieldNodeUUID, inboundcounter.FieldTag).
			UpdateValue().UpdateObservedAt().
			Exec(ctx); err != nil {
			return fmt.Errorf("save counter: %w", err)
		}
		if delta <= 0 {
			continue
		}
		if err := s.db.InboundTraffic.Create().
			SetDate(day).SetNodeUUID(key.NodeUUID).SetTag(key.Tag).SetBytes(delta).SetUpdatedAt(now).
			OnConflictColumns(inboundtraffic.FieldDate, inboundtraffic.FieldNodeUUID, inboundtraffic.FieldTag).
			AddBytes(delta).UpdateUpdatedAt().
			Exec(ctx); err != nil {
			return fmt.Errorf("save inbound traffic: %w", err)
		}
	}
	return nil
}

// PollInboundsIfUsed polls only while an active item counts one inbound.
func (s *Service) PollInboundsIfUsed(ctx context.Context) error {
	if !s.InboundsEnabled() {
		return nil
	}
	used, err := s.db.ExpenseItem.Query().
		Where(expenseitem.Active(true), expenseitem.RwInboundTagNEQ("")).Exist(ctx)
	if err != nil || !used {
		return err
	}
	return s.PollInbounds(ctx)
}

// RunInboundPolling polls the counters every interval. The panel refreshes
// them every 30 s; a short interval also limits what's lost when the panel
// restarts between two readings.
func (s *Service) RunInboundPolling(ctx context.Context, interval time.Duration) {
	if !s.InboundsEnabled() {
		return
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		if err := s.PollInboundsIfUsed(ctx); err != nil && ctx.Err() == nil {
			slog.Warn("inbound counters poll failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

func (s *Service) InboundStatus(ctx context.Context) InboundStatus {
	c := s.inbound
	if c == nil {
		return InboundStatus{}
	}
	c.mu.Lock()
	st := InboundStatus{Enabled: true, LastPoll: c.last}
	if c.lastErr != nil {
		st.LastError = c.lastErr.Error()
	}
	c.mu.Unlock()
	if first, err := s.db.InboundTraffic.Query().Order(ent.Asc(inboundtraffic.FieldDate)).First(ctx); err == nil {
		if d, err := time.ParseInLocation("2006-01-02", first.Date, s.loc); err == nil {
			st.Since = &d
		}
	}
	return st
}

// inboundDaily returns bytes per day of one inbound between two dates.
func (s *Service) inboundDaily(ctx context.Context, node, tag, from, to string) (map[string]int64, error) {
	rows, err := s.db.InboundTraffic.Query().
		Where(inboundtraffic.NodeUUID(node), inboundtraffic.Tag(tag),
			inboundtraffic.DateGTE(from), inboundtraffic.DateLTE(to)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make(map[string]int64, len(rows))
	for _, r := range rows {
		out[r.Date] = r.Bytes
	}
	return out, nil
}
