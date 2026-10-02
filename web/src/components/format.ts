import dayjs from 'dayjs'

// Money is shown in the base currency (a setting) with the UI locale; the
// app root calls setFormat as soon as both are known, before any page
// renders, so the plain functions below can stay synchronous.
let base = 'RUB'
let locale = 'ru-RU'
let money0: Intl.NumberFormat
let money2: Intl.NumberFormat

function build() {
    const opts = { style: 'currency', currency: base, currencyDisplay: 'narrowSymbol' } as const
    money0 = new Intl.NumberFormat(locale, { ...opts, maximumFractionDigits: 2, minimumFractionDigits: 0 })
    money2 = new Intl.NumberFormat(locale, { ...opts, maximumFractionDigits: 2, minimumFractionDigits: 2 })
}
build()

export function setFormat(opts: { base?: string; locale?: string }) {
    const b = opts.base || base
    const l = opts.locale || locale
    if (b === base && l === locale) return
    base = b
    locale = l
    build()
}

export const baseCurrency = () => base
export const fmtLocale = () => locale

// currencySymbol is the short sign of a currency (₽, €, $), or its code.
export const currencySymbol = (cur = base) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? cur

export const fmtMoney = (v: number | null | undefined, digits: 0 | 2 = 0) =>
    v === null || v === undefined ? '—' : (digits ? money2 : money0).format(v)

export const fmtNum = (v: number, digits = 2) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v)

export const fmtCurrency = (v: number, cur: string) => (cur === base ? fmtMoney(v, 2) : `${fmtNum(v)} ${cur}`)

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

// The panel's "forever" is an expiry in 2099; like the server (billing
// .UnlimitedYear) anything from 2090 on is an unlimited user.
export const UNLIMITED_YEAR = 2090
export const isUnlimited = (d: string | null | undefined) => !!d && dayjs(d).year() >= UNLIMITED_YEAR

export const fmtDate = (d: string | null | undefined) => (!d ? '—' : isUnlimited(d) ? '∞' : dayjs(d).format('DD.MM.YYYY'))
export const fmtDateTime = (d: string | null | undefined) => (!d ? '—' : isUnlimited(d) ? '∞' : dayjs(d).format('DD.MM.YYYY HH:mm'))
export const fromNow = (d: string | null | undefined) => (d ? dayjs(d).fromNow() : '—')

export function daysLeft(d: string | null | undefined): number | null {
    if (!d) return null
    if (isUnlimited(d)) return Infinity
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
