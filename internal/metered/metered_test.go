package metered

import (
	"math"
	"testing"
)

const gib = 1 << 30

func TestFloor(t *testing.T) {
	p := Pricing{Unit: Binary, MinMode: Floor, PricePerGB: 100, MinCharge: 15000} // 1/GB, 150 minimum
	cases := []struct {
		gb   int64
		want int64
	}{{0, 15000}, {80, 15000}, {150, 15000}, {151, 15100}, {420, 42000}}
	for _, c := range cases {
		if got := p.Cost(c.gb * gib); got != c.want {
			t.Errorf("%d GB = %d, want %d", c.gb, got, c.want)
		}
	}
	if got := p.IncludedGB(); got != 150 {
		t.Errorf("included = %v", got)
	}
}

func TestDecimalUnit(t *testing.T) {
	p := Pricing{Unit: Decimal, PricePerGB: 100}
	if got := p.Cost(10 * gib); got != 1074 { // 10 GiB = 10.737 GB
		t.Errorf("decimal = %d", got)
	}
	if got := GB(2e9, Decimal); got != 2 {
		t.Errorf("GB = %v", got)
	}
}

func TestFree(t *testing.T) {
	p := Pricing{Unit: Binary, MinMode: Free, PricePerGB: 50, MinCharge: 1000, FreeGB: 100}
	if got := p.Cost(80 * gib); got != 1000 {
		t.Errorf("under allowance = %d", got)
	}
	if got := p.Cost(130 * gib); got != 1000+30*50 {
		t.Errorf("overage = %d", got)
	}
	if got := p.IncludedGB(); got != 100 {
		t.Errorf("included = %v", got)
	}
}

func TestTiers(t *testing.T) {
	// 0–10 GB at 10, 10–50 at 5, then 2 (given out of order).
	p := Pricing{Unit: Binary, Tiers: []Tier{{0, 2}, {10, 10}, {50, 5}}}
	cases := []struct {
		gb   int64
		want int64
	}{{0, 0}, {5, 50}, {10, 100}, {30, 100 + 20*5}, {50, 300}, {80, 300 + 30*2}}
	for _, c := range cases {
		if got := p.Cost(c.gb * gib); got != c.want {
			t.Errorf("%d GB = %d, want %d", c.gb, got, c.want)
		}
	}
	// Without an unlimited step the last price continues.
	p.Tiers = []Tier{{10, 10}, {50, 5}}
	if got := p.Cost(60 * gib); got != 100+40*5+10*5 {
		t.Errorf("open end = %d", got)
	}
	// A 200 minimum covers 10 GB at 10 + 20 GB at 5.
	p = Pricing{Unit: Binary, MinCharge: 200, Tiers: []Tier{{10, 10}, {0, 5}}}
	if got := p.IncludedGB(); math.Abs(got-30) > 1e-9 {
		t.Errorf("included = %v", got)
	}
}
