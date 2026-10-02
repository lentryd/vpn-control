// Term and payment cards shared by the extend, provision and add-on
// modals, styled after the panel's access-settings card (date + presets).
import { Button, Group, NumberInput, Paper, SimpleGrid, Stack, Switch, Text } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import dayjs, { type Dayjs } from 'dayjs'
import type { ReactNode } from 'react'
import { PiCalendarDuotone, PiCalendarPlusDuotone, PiClockDuotone, PiWalletDuotone } from 'react-icons/pi'
import { TbArrowRight, TbCalendar } from 'react-icons/tb'

import type { Period } from '@/api/types'
import { durationLabel, fmtDate, fmtMoney, currencySymbol } from '@/components/format'
import { periodCost } from '@/components/pricing'
import { FormSection } from '@shared/ui/forms/form-section'
import { CurrencyIcon } from '@shared/currencies'

// Term is months+days from the base date; until pins the exact end (e.g.
// "to the end of the subscription"), months/days then only price it.
export interface Term {
    months: number
    days: number
    until: string | null
}

export interface TermPreset {
    label: string
    hint?: string
    term: Term
}

// termTo is where the term ends.
export function termTo(from: Dayjs, t: Term) {
    return t.until ? dayjs(t.until) : from.add(t.months, 'month').add(t.days, 'day')
}

// termBetween is the months+days from `from` to `to`, days rounded up.
export function termBetween(from: Dayjs, to: Dayjs): Term {
    const months = Math.max(0, to.diff(from, 'month'))
    const days = Math.max(0, Math.ceil(to.diff(from.add(months, 'month'), 'day', true) - 1e-6))
    return { months, days, until: null }
}

// tariffPresets offers a plain month and every tariff period, with prices.
export function tariffPresets(monthly: number | undefined, periods: Period[] | null | undefined): TermPreset[] {
    const terms = [{ months: 1, days: 0 }, ...(periods ?? [])]
    const seen = new Set<string>()
    return terms
        .filter((t) => {
            const k = `${t.months}:${t.days ?? 0}`
            return !seen.has(k) && seen.add(k)
        })
        .sort((a, b) => a.months * 31 + (a.days ?? 0) - (b.months * 31 + (b.days ?? 0)))
        .map((t) => ({
            label: durationLabel(t.months, t.days ?? 0),
            hint: monthly === undefined ? undefined : fmtMoney(periodCost(monthly, periods, t.months, t.days ?? 0)),
            term: { months: t.months, days: t.days ?? 0, until: null }
        }))
}

const sameTerm = (a: Term, b: Term) => a.months === b.months && a.days === b.days && (a.until ?? null) === (b.until ?? null)

export function TermSection({
    from,
    value,
    onChange,
    presets,
    description = 'Считается от текущей даты окончания (или от сегодня, если уже истекла)',
    children
}: {
    from: string | null | undefined
    value: Term
    onChange: (t: Term) => void
    presets: TermPreset[]
    description?: ReactNode
    children?: ReactNode
}) {
    const base = from ? dayjs(from) : dayjs()
    const to = termTo(base, value)
    const empty = value.months + value.days <= 0 && !value.until

    return (
        <FormSection color="teal" description={description} icon={PiCalendarPlusDuotone} title="Срок">
            {presets.length > 0 && (
                <Group gap={6}>
                    {presets.map((p) => {
                        const active = sameTerm(p.term, value)
                        return (
                            <Button
                                color={active ? 'teal' : 'gray'}
                                key={p.label}
                                onClick={() => onChange(p.term)}
                                radius="md"
                                rightSection={
                                    p.hint && (
                                        <Text c={active ? 'teal.3' : 'dimmed'} ff="monospace" size="xs">
                                            {p.hint}
                                        </Text>
                                    )
                                }
                                size="xs"
                                variant={active ? 'light' : 'default'}
                            >
                                {p.label}
                            </Button>
                        )
                    })}
                </Group>
            )}
            <SimpleGrid cols={{ base: 1, xs: 2 }}>
                <NumberInput
                    label="Месяцев"
                    leftSection={<PiCalendarDuotone size={16} />}
                    max={36}
                    min={0}
                    onChange={(v) => onChange({ months: Number(v) || 0, days: value.days, until: null })}
                    value={value.months}
                />
                <NumberInput
                    label="Дней"
                    leftSection={<PiClockDuotone size={16} />}
                    max={365}
                    min={0}
                    onChange={(v) => onChange({ months: value.months, days: Number(v) || 0, until: null })}
                    value={value.days}
                />
            </SimpleGrid>
            <DatePickerInput
                description="Или выберите дату — срок пересчитается"
                label="Дата окончания"
                leftSection={<PiCalendarDuotone size={16} />}
                minDate={base.add(1, 'day').format('YYYY-MM-DD')}
                onChange={(d) => {
                    if (!d) return
                    const target = dayjs(d).hour(base.hour()).minute(base.minute()).second(base.second())
                    onChange(termBetween(base, target))
                }}
                value={empty ? null : to.format('YYYY-MM-DD')}
                valueFormat="DD.MM.YYYY"
            />
            <Group gap="xs" grow wrap="nowrap">
                <Paper bd="1px solid rgba(255,255,255,0.08)" bg="rgba(255,255,255,0.02)" p="xs" radius="md">
                    <Group gap="xs" justify="center" wrap="nowrap">
                        <TbCalendar color="var(--mantine-color-dimmed)" size={18} />
                        <Text c="dimmed" fw={600} size="sm">
                            {fmtDate(base.toISOString())}
                        </Text>
                    </Group>
                </Paper>
                <TbArrowRight color="var(--mantine-color-dimmed)" size={18} style={{ flex: '0 0 auto' }} />
                <Paper bd="1px solid rgba(45, 212, 191, 0.2)" bg="rgba(45, 212, 191, 0.08)" p="xs" radius="md">
                    <Group gap="xs" justify="center" wrap="nowrap">
                        <TbCalendar color="var(--mantine-color-teal-5)" size={18} />
                        <Text c="teal.5" fw={600} size="sm">
                            {empty ? '—' : fmtDate(to.toISOString())}
                        </Text>
                    </Group>
                </Paper>
            </Group>
            {children}
        </FormSection>
    )
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <Group justify="space-between" wrap="nowrap">
            <Text c="dimmed" size="sm">
                {label}
            </Text>
            <Text component="div" ff="monospace" fw={600} size="sm">
                {children}
            </Text>
        </Group>
    )
}

export function PaymentSection({
    amount,
    onAmount,
    allowDebt,
    onAllowDebt,
    balance,
    monthly,
    description = 'По тарифу с учётом скидок за период; можно изменить (0 — бесплатно)'
}: {
    amount: number | null
    onAmount: (v: number) => void
    allowDebt: boolean
    onAllowDebt: (v: boolean) => void
    balance?: number
    monthly?: number
    description?: string
}) {
    const after = balance === undefined ? undefined : balance - (amount ?? 0)
    const short = after !== undefined && after < 0 && !allowDebt
    return (
        <FormSection color="orange" description="Списывается с баланса клиента" icon={PiWalletDuotone} title="Оплата">
            <NumberInput
                decimalScale={2}
                description={description}
                label={`Списать с баланса, ${currencySymbol()}`}
                leftSection={<CurrencyIcon size={16} />}
                min={0}
                onChange={(v) => onAmount(Number(v) || 0)}
                value={amount ?? ''}
            />
            {(balance !== undefined || monthly !== undefined) && (
                <Paper bd="1px solid rgba(255,255,255,0.08)" bg="rgba(255,255,255,0.02)" p="sm" radius="md">
                    <Stack gap={6}>
                        {monthly !== undefined && <SummaryRow label="Цена в месяц">{fmtMoney(monthly)}</SummaryRow>}
                        {balance !== undefined && <SummaryRow label="Баланс сейчас">{fmtMoney(balance, 2)}</SummaryRow>}
                        {after !== undefined && (
                            <SummaryRow label="После списания">
                                <Text c={after < 0 ? 'red.5' : 'teal.5'} ff="monospace" fw={600} size="sm">
                                    {fmtMoney(after, 2)}
                                </Text>
                            </SummaryRow>
                        )}
                    </Stack>
                </Paper>
            )}
            <Switch
                checked={allowDebt}
                description={short ? `Не хватает ${fmtMoney(-after!, 2)} — без этого операция не пройдёт` : 'Баланс клиента станет отрицательным (долг)'}
                label="Разрешить уход в минус"
                onChange={(e) => onAllowDebt(e.currentTarget.checked)}
                styles={short ? { description: { color: 'var(--mantine-color-red-5)' } } : undefined}
            />
        </FormSection>
    )
}
