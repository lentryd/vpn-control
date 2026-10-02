import type { IconBaseProps } from 'react-icons'
import { PiCoins, PiCurrencyBtc, PiCurrencyCny, PiCurrencyDollar, PiCurrencyEur, PiCurrencyGbp, PiCurrencyInr, PiCurrencyJpy, PiCurrencyKrw, PiCurrencyKzt, PiCurrencyRub } from 'react-icons/pi'

import { baseCurrency } from '@/components/format'

// Currencies offered for expenses; any other ISO code can be typed in.
export const CURRENCIES = ['RUB', 'EUR', 'USD', 'GBP', 'CHF', 'CNY', 'JPY', 'TRY', 'KZT', 'BYN', 'UAH', 'AMD', 'GEL', 'PLN', 'CZK', 'INR', 'KRW']

// Base currencies need published rates: CBR for RUB, ECB for the rest.
export const BASE_CURRENCIES = ['RUB', 'EUR', 'USD', 'GBP', 'CHF', 'PLN', 'CZK', 'SEK', 'NOK', 'DKK', 'TRY', 'CNY', 'JPY', 'INR', 'KRW', 'BRL', 'CAD', 'AUD']

const icons: Record<string, typeof PiCoins> = {
    RUB: PiCurrencyRub,
    EUR: PiCurrencyEur,
    USD: PiCurrencyDollar,
    GBP: PiCurrencyGbp,
    CNY: PiCurrencyCny,
    JPY: PiCurrencyJpy,
    INR: PiCurrencyInr,
    KRW: PiCurrencyKrw,
    KZT: PiCurrencyKzt,
    BTC: PiCurrencyBtc
}

// CurrencyIcon is the sign of a currency (the base one by default).
export function CurrencyIcon({ currency, ...props }: IconBaseProps & { currency?: string }) {
    const Icon = icons[currency ?? baseCurrency()] ?? PiCoins
    return <Icon {...props} />
}
