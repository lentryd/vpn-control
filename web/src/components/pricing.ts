import type { Period } from '@/api/types'

// periodCost mirrors billing.Cost on the server: the cheapest mix of
// discounted periods and plain months, plus extra days at monthly/30.
export function periodCost(monthly: number, periods: Period[] | null | undefined, months: number, days = 0) {
    const best = [0]
    for (let m = 1; m <= months; m++) {
        best[m] = best[m - 1] + monthly
        for (const p of periods ?? []) {
            if (p.months <= m) best[m] = Math.min(best[m], best[m - p.months] + p.price)
        }
    }
    return Math.round((best[months] + (monthly * days) / 30) * 100) / 100
}
