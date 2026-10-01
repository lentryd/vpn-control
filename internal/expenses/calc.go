// Package expenses books infrastructure costs in any currency (frozen in
// RUB at the date's CBR rate, with bank fee and cost-share), refunds, and
// traffic-metered items like a CDN billed per GB with a minimum charge.
package expenses

import (
	"math"
	"time"
)

// bytesPerGB: providers bill "ГБ" as GiB (Yandex Cloud: 1 ГБ = 1024 МБ).
const bytesPerGB = 1 << 30

// ToRub converts minor units of a currency to kopecks:
// orig × rate × (1 + fee%) × share%.
func ToRub(orig int64, rate, feePercent, sharePercent float64) int64 {
	return int64(math.Round(float64(orig) * rate * (1 + feePercent/100) * sharePercent / 100))
}

// GB converts bytes to (binary) gigabytes.
func GB(bytes int64) float64 { return float64(bytes) / bytesPerGB }

// MeteredCost is max(minCharge, GB × pricePerGB) in the item's minor units:
// the minimum covers the first minCharge/pricePerGB GB, the rest is billed
// per GB.
func MeteredCost(bytes, pricePerGB, minCharge int64) int64 {
	cost := int64(math.Round(GB(bytes) * float64(pricePerGB)))
	if cost < minCharge {
		return minCharge
	}
	return cost
}

// IncludedGB is how many GB the minimum charge covers.
func IncludedGB(pricePerGB, minCharge int64) float64 {
	if pricePerGB <= 0 {
		return 0
	}
	return float64(minCharge) / float64(pricePerGB)
}

// Forecast extrapolates a period's traffic: used so far plus the average of
// the last (up to) 7 complete days times the days left, today included.
// daily holds bytes per day of the period up to and including today.
func Forecast(daily []int64, today, periodEnd time.Time) int64 {
	var used int64
	for _, b := range daily {
		used += b
	}
	complete := daily
	if len(complete) > 0 {
		complete = complete[:len(complete)-1] // today is partial
	}
	if len(complete) > 7 {
		complete = complete[len(complete)-7:]
	}
	if len(complete) == 0 {
		return used
	}
	var sum int64
	for _, b := range complete {
		sum += b
	}
	avg := float64(sum) / float64(len(complete))

	todayDate := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	daysLeft := int(periodEnd.Sub(todayDate).Hours()/24) + 1 // incl. today
	var todaySoFar int64
	if len(daily) > 0 {
		todaySoFar = daily[len(daily)-1]
	}
	rest := avg*float64(daysLeft) - float64(todaySoFar)
	if rest < 0 {
		rest = 0
	}
	return used + int64(rest)
}

// MonthBounds returns the first and last day of t's month.
func MonthBounds(t time.Time) (time.Time, time.Time) {
	start := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
	return start, start.AddDate(0, 1, -1)
}
