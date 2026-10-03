package remnawave

import "time"

// Traffic reset strategies of the panel.
const (
	StrategyNoReset      = "NO_RESET"
	StrategyDay          = "DAY"
	StrategyWeek         = "WEEK"
	StrategyMonth        = "MONTH"
	StrategyMonthRolling = "MONTH_ROLLING"
)

// NextTrafficReset predicts when the panel's reset jobs zero a user's
// traffic next: DAY at midnight, WEEK on Monday, MONTH on the 1st and
// MONTH_ROLLING on the day of month the user was created (the last day of
// shorter months). The panel runs its jobs in its own timezone, which is
// UTC in the stock docker image. nil means traffic is never reset.
func NextTrafficReset(strategy string, createdAt *time.Time, now time.Time) *time.Time {
	now = now.UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	var next time.Time
	switch strategy {
	case StrategyDay:
		next = today.AddDate(0, 0, 1)
	case StrategyWeek:
		days := (8 - int(today.Weekday())) % 7
		if days == 0 {
			days = 7
		}
		next = today.AddDate(0, 0, days)
	case StrategyMonth:
		next = time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, time.UTC)
	case StrategyMonthRolling:
		if createdAt == nil {
			return nil
		}
		day := createdAt.UTC().Day()
		next = monthDay(now.Year(), now.Month(), day)
		if !next.After(now) {
			next = monthDay(now.Year(), now.Month()+1, day)
		}
	default:
		return nil
	}
	return &next
}

// monthDay is day of the given month, clamped to the month's last day.
func monthDay(year int, month time.Month, day int) time.Time {
	first := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
	if last := first.AddDate(0, 1, -1).Day(); day > last {
		day = last
	}
	return first.AddDate(0, 0, day-1)
}
