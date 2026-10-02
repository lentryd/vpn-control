// Package metered prices traffic the way CDN and transit providers bill it:
// per GB (binary or decimal), with a minimum charge or a free allowance, and
// optionally graduated tiers. Amounts are minor units of the item currency.
package metered

import (
	"math"
	"sort"
)

// Unit is how a provider counts a gigabyte.
type Unit string

const (
	// Binary: 1 GB = 1024³ bytes (e.g. Yandex Cloud).
	Binary Unit = "binary"
	// Decimal: 1 GB = 10⁹ bytes (most CDNs: Bunny, Gcore, Cloudflare…).
	Decimal Unit = "decimal"
)

// BytesPerGB returns the size of one gigabyte in u.
func (u Unit) BytesPerGB() float64 {
	if u == Decimal {
		return 1e9
	}
	return 1 << 30
}

// GB converts bytes to gigabytes of unit u.
func GB(bytes int64, u Unit) float64 { return float64(bytes) / u.BytesPerGB() }

// MinMode is how MinCharge applies.
type MinMode string

const (
	// Floor: cost = max(MinCharge, usage) — the minimum covers the first
	// MinCharge/price GB.
	Floor MinMode = "floor"
	// Free: cost = MinCharge + usage beyond FreeGB — a fixed fee with a
	// free allowance, overage billed per GB.
	Free MinMode = "free"
)

// Tier is a graduated price step: every GB up to UpToGB (cumulative; 0 =
// unlimited) costs PricePerGB.
type Tier struct {
	UpToGB     float64 `json:"up_to_gb"`
	PricePerGB int64   `json:"price_per_gb"`
}

// Pricing describes how a metered item is billed.
type Pricing struct {
	Unit       Unit
	MinMode    MinMode
	PricePerGB int64
	MinCharge  int64
	FreeGB     float64
	// Tiers, when set, replace PricePerGB.
	Tiers []Tier
}

// Cost is the period's charge for bytes of traffic.
func (p Pricing) Cost(bytes int64) int64 {
	gb := GB(bytes, p.Unit)
	if p.MinMode == Free {
		return p.MinCharge + p.usage(math.Max(0, gb-p.FreeGB))
	}
	return max(p.MinCharge, p.usage(gb))
}

// IncludedGB is how many GB the minimum charge (Floor) or the free
// allowance (Free) covers.
func (p Pricing) IncludedGB() float64 {
	if p.MinMode == Free {
		return p.FreeGB
	}
	// Invert usage(): walk the tiers until MinCharge is spent.
	left := float64(p.MinCharge)
	var gb, prev float64
	for _, t := range p.tiers() {
		if t.PricePerGB <= 0 {
			return gb
		}
		span := math.Inf(1)
		if t.UpToGB > 0 {
			span = t.UpToGB - prev
		}
		if cost := span * float64(t.PricePerGB); cost < left {
			gb += span
			left -= cost
			prev = t.UpToGB
			continue
		}
		return gb + left/float64(t.PricePerGB)
	}
	return gb
}

// usage prices gb through the tiers (or the flat price).
func (p Pricing) usage(gb float64) int64 {
	var cost, prev float64
	for _, t := range p.tiers() {
		if gb <= prev {
			break
		}
		upper := gb
		if t.UpToGB > 0 && t.UpToGB < gb {
			upper = t.UpToGB
		}
		cost += (upper - prev) * float64(t.PricePerGB)
		if t.UpToGB <= 0 {
			break
		}
		prev = t.UpToGB
	}
	return int64(math.Round(cost))
}

// tiers returns the steps sorted, with an unlimited last step; a flat
// price is a single unlimited step.
func (p Pricing) tiers() []Tier {
	if len(p.Tiers) == 0 {
		return []Tier{{PricePerGB: p.PricePerGB}}
	}
	ts := NormalizeTiers(p.Tiers)
	if last := ts[len(ts)-1]; last.UpToGB > 0 {
		// Past the last bound keep its price.
		ts = append(ts, Tier{PricePerGB: last.PricePerGB})
	}
	return ts
}

// NormalizeTiers sorts tiers by bound with the unlimited (0) step last and
// drops steps after it.
func NormalizeTiers(in []Tier) []Tier {
	ts := append([]Tier(nil), in...)
	sort.SliceStable(ts, func(i, j int) bool {
		a, b := ts[i].UpToGB, ts[j].UpToGB
		if a <= 0 || b <= 0 {
			return b <= 0 && a > 0
		}
		return a < b
	})
	for i, t := range ts {
		if t.UpToGB <= 0 {
			return ts[:i+1]
		}
	}
	return ts
}
