import dayjs from 'dayjs'

const rub = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
const rub2 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export const fmtMoney = (v: number | null | undefined, digits: 0 | 2 = 0) =>
    v === null || v === undefined ? '—' : `${(digits ? rub2 : rub).format(v)} ₽`

export const fmtNum = (v: number, digits = 2) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(v)

export const fmtCurrency = (v: number, cur: string) =>
    cur === 'RUB' ? fmtMoney(v, 2) : `${fmtNum(v)} ${cur}`

export function fmtBytes(b: number | null | undefined): string {
    if (!b) return '0'
    const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
    let i = 0
    let v = b
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024
        i++
    }
    return `${fmtNum(v, v < 10 ? 2 : 1)} ${units[i]}`
}

export const fmtDate = (d: string | null | undefined) => (d ? dayjs(d).format('DD.MM.YYYY') : '—')
export const fmtDateTime = (d: string | null | undefined) => (d ? dayjs(d).format('DD.MM.YYYY HH:mm') : '—')
export const fromNow = (d: string | null | undefined) => (d ? dayjs(d).fromNow() : '—')

export function daysLeft(d: string | null | undefined): number | null {
    if (!d) return null
    return Math.floor(dayjs(d).diff(dayjs(), 'hour') / 24)
}

export function plural(n: number, one: string, few: string, many: string) {
    const a = Math.abs(n) % 100
    const b = a % 10
    if (a > 10 && a < 20) return many
    if (b > 1 && b < 5) return few
    if (b === 1) return one
    return many
}

export const durationLabel = (months: number, days: number) =>
    [months ? `${months} мес.` : '', days ? `${days} дн.` : ''].filter(Boolean).join(' ') || '—'

export const GB = 1024 ** 3

export const strategyLabel: Record<string, string> = {
    NO_RESET: 'Без сброса',
    DAY: 'Каждый день',
    WEEK: 'Каждую неделю',
    MONTH: 'Каждый месяц',
    MONTH_ROLLING: 'Месяц от создания'
}
