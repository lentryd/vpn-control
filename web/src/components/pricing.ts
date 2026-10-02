import type { Period } from '@/api/types'

// periodCost mirrors billing.TermCost on the server: a package with exactly
// this term (one with days, e.g. a trial week) costs its own price;
// otherwise the cheapest mix of whole-month periods and plain months, plus
// extra days at monthly/30.
export function periodCost(monthly: number, periods: Period[] | null | undefined, months: number, days = 0) {
    if (days > 0) {
        const pkg = periods?.find((p) => p.months === months && p.days === days)
        if (pkg) return pkg.price
    }
    const best = [0]
    for (let m = 1; m <= months; m++) {
        best[m] = best[m - 1] + monthly
        for (const p of periods ?? []) {
            if (!p.days && p.months > 0 && p.months <= m) best[m] = Math.min(best[m], best[m - p.months] + p.price)
        }
    }
    return Math.round((best[months] + (monthly * days) / 30) * 100) / 100
}
