package expenses

import (
	"testing"
	"time"
)

func TestToRub(t *testing.T) {
	// 3.90 EUR at 93.5 with 3.5% fee, full share.
	if got := ToRub(390, 93.5, 3.5, 100); got != 37741 {
		t.Errorf("EUR = %d", got)
	}
	// Domain 460 RUB, 30% share.
	if got := ToRub(46000, 1, 0, 30); got != 13800 {
		t.Errorf("share = %d", got)
	}
}

func TestMeteredCost(t *testing.T) {
	const price, min = 100, 15000 // 1 ₽/GB, 150 ₽ minimum
	cases := []struct {
		gb   int64
		want int64
	}{{0, 15000}, {80, 15000}, {150, 15000}, {151, 15100}, {420, 42000}}
	for _, c := range cases {
		if got := MeteredCost(c.gb*bytesPerGB, price, min); got != c.want {
			t.Errorf("%d GB = %d, want %d", c.gb, got, c.want)
		}
	}
	if got := IncludedGB(price, min); got != 150 {
		t.Errorf("included = %v", got)
	}
}

func TestForecast(t *testing.T) {
	loc := time.UTC
	today := time.Date(2026, 9, 10, 15, 0, 0, 0, loc)
	_, end := MonthBounds(today)
	gb := int64(bytesPerGB)
	// 9 complete days of 10 GB, today 4 GB so far.
	daily := []int64{10 * gb, 10 * gb, 10 * gb, 10 * gb, 10 * gb, 10 * gb, 10 * gb, 10 * gb, 10 * gb, 4 * gb}
	// used 94 + avg 10 × 21 days left (10th..30th) − 4 already today = 300.
	if got := Forecast(daily, today, end); got != 300*gb {
		t.Errorf("forecast = %v GB", GB(got))
	}
	// First day of the month: nothing to average, forecast = used.
	if got := Forecast([]int64{3 * gb}, time.Date(2026, 9, 1, 12, 0, 0, 0, loc), end); got != 3*gb {
		t.Errorf("day one = %v GB", GB(got))
	}
}
