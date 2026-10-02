package expenses

import (
	"testing"
	"time"
)

func TestToBase(t *testing.T) {
	// 3.90 EUR at 93.5 with 3.5% fee, full share.
	if got := ToBase(390, 93.5, 3.5, 100); got != 37741 {
		t.Errorf("EUR = %d", got)
	}
	// Domain 460 RUB, 30% share.
	if got := ToBase(46000, 1, 0, 30); got != 13800 {
		t.Errorf("share = %d", got)
	}
}

func TestForecast(t *testing.T) {
	loc := time.UTC
	today := time.Date(2026, 9, 10, 15, 0, 0, 0, loc)
	_, end := MonthBounds(today)
	gb := int64(1 << 30)
	// 9 complete days of 10 GB, today 4 GB so far.
	daily := []int64{10 * gb, 10 * gb, 10 * gb, 10 * gb, 10 * gb, 10 * gb, 10 * gb, 10 * gb, 10 * gb, 4 * gb}
	// used 94 + avg 10 × 21 days left (10th..30th) − 4 already today = 300.
	if got := Forecast(daily, today, end); got != 300*gb {
		t.Errorf("forecast = %v GB", got/gb)
	}
	// First day of the month: nothing to average, forecast = used.
	if got := Forecast([]int64{3 * gb}, time.Date(2026, 9, 1, 12, 0, 0, 0, loc), end); got != 3*gb {
		t.Errorf("day one = %v GB", got/gb)
	}
}

func TestPeriodBounds(t *testing.T) {
	loc := time.UTC
	d := func(y int, m time.Month, day int) time.Time { return time.Date(y, m, day, 0, 0, 0, 0, loc) }
	cases := []struct {
		t          time.Time
		day        int
		start, end time.Time
	}{
		{d(2026, 9, 10), 1, d(2026, 9, 1), d(2026, 9, 30)},
		{d(2026, 9, 10), 15, d(2026, 8, 15), d(2026, 9, 14)},
		{d(2026, 9, 15), 15, d(2026, 9, 15), d(2026, 10, 14)},
		{d(2027, 1, 3), 28, d(2026, 12, 28), d(2027, 1, 27)},
	}
	for _, c := range cases {
		s, e := PeriodBounds(c.t, c.day)
		if !s.Equal(c.start) || !e.Equal(c.end) {
			t.Errorf("%s day %d = %s..%s", c.t.Format("2006-01-02"), c.day, s.Format("2006-01-02"), e.Format("2006-01-02"))
		}
	}
	if s, _ := PeriodStart("2026-08", 15, loc); !s.Equal(d(2026, 8, 15)) {
		t.Errorf("PeriodStart = %s", s)
	}
}
