// Package money converts between minor units (kopecks, cents) stored in the
// database and the decimal amounts the API and UI work with.
package money

import "math"

// FromMajor converts a decimal amount (e.g. 123.45) to minor units.
func FromMajor(v float64) int64 {
	return int64(math.Round(v * 100))
}

// ToMajor converts minor units to a decimal amount.
func ToMajor(v int64) float64 {
	return float64(v) / 100
}

// ToMajorPtr is ToMajor for optional values.
func ToMajorPtr(v *int64) *float64 {
	if v == nil {
		return nil
	}
	f := ToMajor(*v)
	return &f
}

// FromMajorPtr is FromMajor for optional values.
func FromMajorPtr(v *float64) *int64 {
	if v == nil {
		return nil
	}
	m := FromMajor(*v)
	return &m
}
