package remnawave

import (
	"testing"
	"time"
)

func TestNextTrafficReset(t *testing.T) {
	at := func(s string) time.Time {
		v, err := time.Parse(time.RFC3339, s)
		if err != nil {
			t.Fatal(err)
		}
		return v
	}
	created := at("2025-01-31T15:00:00Z")
	created15 := at("2025-03-15T08:00:00Z")
	cases := []struct {
		name     string
		strategy string
		created  *time.Time
		now      string
		want     string // "" = no reset
	}{
		{"no reset", StrategyNoReset, nil, "2026-10-03T12:00:00Z", ""},
		{"unknown", "", nil, "2026-10-03T12:00:00Z", ""},
		{"day", StrategyDay, nil, "2026-10-03T12:00:00Z", "2026-10-04T00:00:00Z"},
		{"week on saturday", StrategyWeek, nil, "2026-10-03T12:00:00Z", "2026-10-05T00:00:00Z"},
		{"week on monday", StrategyWeek, nil, "2026-10-05T00:00:01Z", "2026-10-12T00:00:00Z"},
		{"week on sunday", StrategyWeek, nil, "2026-10-04T23:00:00Z", "2026-10-05T00:00:00Z"},
		{"month", StrategyMonth, nil, "2026-12-15T12:00:00Z", "2027-01-01T00:00:00Z"},
		{"rolling later this month", StrategyMonthRolling, &created15, "2026-10-03T12:00:00Z", "2026-10-15T00:00:00Z"},
		{"rolling next month", StrategyMonthRolling, &created15, "2026-10-15T00:00:00Z", "2026-11-15T00:00:00Z"},
		{"rolling clamps to short month", StrategyMonthRolling, &created, "2027-02-10T00:00:00Z", "2027-02-28T00:00:00Z"},
		{"rolling after clamp", StrategyMonthRolling, &created, "2026-09-30T10:00:00Z", "2026-10-31T00:00:00Z"},
		{"rolling without created", StrategyMonthRolling, nil, "2026-10-03T12:00:00Z", ""},
	}
	for _, c := range cases {
		got := NextTrafficReset(c.strategy, c.created, at(c.now))
		switch {
		case c.want == "" && got != nil:
			t.Errorf("%s: got %v, want nil", c.name, got)
		case c.want != "" && (got == nil || !got.Equal(at(c.want))):
			t.Errorf("%s: got %v, want %s", c.name, got, c.want)
		}
	}
}
