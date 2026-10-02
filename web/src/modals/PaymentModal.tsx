import { Alert, Badge, Button, Group, NumberInput, Paper, SimpleGrid, Stack, Switch, Text, TextInput, ThemeIcon, Autocomplete } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import {
    PiArrowLeft,
    PiBank,
    PiCalculator,
    PiCalendarDuotone,
    PiCalendarPlusDuotone,
    PiCheck,
    PiCheckCircleDuotone,
    PiClockDuotone,
    PiCoinsDuotone,
    PiCreditCardDuotone,
    PiHexagonDuotone,
    PiNotePencil,
    PiPuzzlePieceDuotone,
    PiTreeStructure,
    PiWalletDuotone,
    PiX
} from 'react-icons/pi'
import { TbCalendar } from 'react-icons/tb'
import dayjs from 'dayjs'
import { useState } from 'react'

import { api } from '@/api/client'
import { useApiMutation } from '@/api/hooks'
import type { ExtensionResult, PaymentPreview, PlanItem, ReferralInfo } from '@/api/types'
import { durationLabel, fmtDate, fmtMoney, currencySymbol, dateLayout } from '@/components/format'
import { notifyError } from '@/components/notify'
import { periodCost } from '@/components/pricing'
import { StatCard } from '@/components/ui'
import { FormFooter, FormSection, FormStack } from '@shared/ui/forms/form-section'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'

import { openModal } from './open'
import { CurrencyIcon } from '@shared/currencies'
import i18n from '@/app/i18n/i18n'
import { paymentMethods } from '@/modals/PaymentEditModal'
import { useTranslation } from 'react-i18next'

export function openPaymentModal(p: { customerId: number; name: string }) {
    openModal({ icon: PiCreditCardDuotone, color: 'teal', title: i18n.t('payment.title'), subtitle: p.name }, (close) => <PaymentForm customerId={p.customerId} onDone={close} />, 'xl')
}

interface Row {
    key: string
    item: PlanItem
    months: number
    days: number
    amount: number
}

function PaymentForm({ customerId, onDone }: { customerId: number; onDone: () => void }) {
    const { t } = useTranslation()
    const [amount, setAmount] = useState<number>(0)
    const [date, setDate] = useState<string | null>(dayjs().format('YYYY-MM-DD'))
    const [method, setMethod] = useState<string>(() => paymentMethods()[0])
    const [note, setNote] = useState('')
    const [toDays, setToDays] = useState(false)
    const [preview, setPreview] = useState<PaymentPreview | null>(null)
    const [rows, setRows] = useState<Row[]>([])
    const [results, setResults] = useState<{ ext: ExtensionResult[]; balance: number; ref: ReferralInfo | null } | null>(null)
    const [loading, setLoading] = useState(false)

    const loadPreview = async () => {
        setLoading(true)
        try {
            const p = await api.post<PaymentPreview>(`customers/${customerId}/payments/preview`, {
                amount,
                remainder_to_days: toDays
            })
            setPreview(p)
            setRows(
                p.items.map((it) => {
                    const a = p.allocations.find((x) => x.kind === it.kind && x.id === it.id)
                    return {
                        key: `${it.kind}-${it.id}`,
                        item: it,
                        months: a?.months ?? 0,
                        days: a?.days ?? 0,
                        amount: a?.amount ?? 0
                    }
                })
            )
        } catch (e) {
            notifyError(e)
        } finally {
            setLoading(false)
        }
    }

    const commit = useApiMutation(() =>
        api.post<{ extensions: ExtensionResult[]; balance: number; referral: ReferralInfo | null }>(
            `customers/${customerId}/payments`,
            {
                amount,
                date,
                method: method ?? '',
                note,
                allocations: rows
                    .filter((r) => r.months + r.days > 0)
                    .map((r) => ({ kind: r.item.kind, id: r.item.id, months: r.months, days: r.days, amount: r.amount }))
            }
        )
    )

    const update = (key: string, patch: Partial<Row>) =>
        setRows((rs) =>
            rs.map((r) => {
                if (r.key !== key) return r
                const next = { ...r, ...patch }
                if (patch.months !== undefined || patch.days !== undefined) next.amount = periodCost(next.item.monthly, next.item.periods, next.months, next.days)
                return next
            })
        )

    if (results) {
        return (
            <FormStack>
                <FormSection icon={PiCheckCircleDuotone} color="teal" title={t('payment.recorded')} description={t('payment.balance', { amount: fmtMoney(results.balance, 2) })}>
                    {results.ref && (
                        <Badge color="grape" leftSection={<PiTreeStructure size={14} />} size="lg" variant="soft">
                            {t('payment.ref_result', { name: results.ref.referrer_name, amount: fmtMoney(results.ref.amount, 2), pct: results.ref.percent })}
                        </Badge>
                    )}
                    {results.ext.length === 0 && (
                        <Text c="dimmed" size="sm">
                            {t('payment.no_extensions')}
                        </Text>
                    )}
                    {results.ext.map((e) => (
                        <Group gap="xs" key={`${e.kind}-${e.id}`} wrap="nowrap">
                            <ThemeIcon color={e.ok ? 'teal' : 'red'} size="md" variant="soft">
                                {e.ok ? <PiCheck size={14} /> : <PiX size={14} />}
                            </ThemeIcon>
                            <Text size="sm">
                                {e.title}: {durationLabel(e.months, e.days)}
                                {e.ok ? ` → ${t('view.until', { date: fmtDate(e.to) })}` : ` — ${t('payment.ext_failed', { error: e.error })}`}
                            </Text>
                        </Group>
                    ))}
                </FormSection>
                <FormFooter onSubmit={onDone} submitIcon={<PiCheck size={16} />} submitLabel={t('common.done')} />
            </FormStack>
        )
    }

    if (!preview) {
        return (
            <FormStack>
                <FormSection icon={PiCreditCardDuotone} color="teal" title={t('payment.income')} description={t('payment.income_hint')}>
                    <SimpleGrid cols={{ base: 1, xs: 2 }}>
                        <NumberInput
                            label={t('common.amount_in', { currency: currencySymbol() })}
                            leftSection={<CurrencyIcon size={16} />}
                            min={0}
                            decimalScale={2}
                            value={amount || ''}
                            onChange={(v) => setAmount(Number(v) || 0)}
                            data-autofocus
                        />
                        <DateInput label={t('customer.col_date')} leftSection={<PiCalendarDuotone size={16} />} value={date} onChange={setDate} valueFormat={dateLayout()} />
                        <Autocomplete
                            label={t('payment.method')}
                            leftSection={<PiBank size={16} />}
                            data={paymentMethods()}
                            value={method}
                            onChange={setMethod}
                        />
                        <TextInput label={t('payment.comment')} leftSection={<PiNotePencil size={16} />} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
                    </SimpleGrid>
                    <Switch
                        label={t('payment.rest_to_days')}
                        description={t('payment.rest_to_days_hint')}
                        checked={toDays}
                        onChange={(e) => setToDays(e.currentTarget.checked)}
                    />
                </FormSection>
                <FormFooter
                    disabled={amount <= 0}
                    loading={loading}
                    onCancel={onDone}
                    onSubmit={loadPreview}
                    submitIcon={<PiCalculator size={16} />}
                    submitLabel={t('payment.calculate')}
                />
            </FormStack>
        )
    }

    const allocated = rows.reduce((s, r) => s + r.amount, 0)
    const rest = Math.round((preview.balance_after_payment - allocated) * 100) / 100

    return (
        <FormStack>
            <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
                <StatCard icon={PiWalletDuotone} color="gray" title={t('payment.balance_before')} value={fmtMoney(preview.balance_before, 2)} />
                <StatCard icon={PiCreditCardDuotone} color="teal" title={t('payment.after_payment')} value={fmtMoney(preview.balance_after_payment, 2)} />
                <StatCard icon={PiCoinsDuotone} color={rest < 0 ? 'red' : 'cyan'} title={t('payment.remains')} value={fmtMoney(rest, 2)} />
            </SimpleGrid>
            {preview.referral && (
                <Badge color="grape" leftSection={<PiTreeStructure size={14} />} size="lg" variant="soft">
                    {t('payment.ref_preview', { name: preview.referral.referrer_name, amount: fmtMoney(preview.referral.amount, 2), pct: preview.referral.percent })}
                </Badge>
            )}
            <FormSection icon={PiCalendarPlusDuotone} color="teal" title={t('sub.renewal')} description={t('payment.renewal_hint')}>
                {rows.length === 0 && (
                    <Alert color="yellow" variant="soft">
                        {t('payment.no_items')}
                    </Alert>
                )}
                {rows.map((r) => {
                    const base = r.item.expire_at && dayjs(r.item.expire_at).isAfter(dayjs()) ? dayjs(r.item.expire_at) : dayjs()
                    const active = r.months + r.days > 0
                    return (
                        <Paper bd="1px solid rgba(255,255,255,0.08)" bg="rgba(255,255,255,0.02)" key={r.key} p="sm" radius="md">
                            <Stack gap="xs">
                                <Group justify="space-between" wrap="nowrap">
                                    <BaseOverlayHeader
                                        iconColor={r.item.kind === 'addon' ? 'grape' : 'cyan'}
                                        IconComponent={r.item.kind === 'addon' ? PiPuzzlePieceDuotone : PiHexagonDuotone}
                                        subtitle={t('payment.item_subtitle', { monthly: fmtMoney(r.item.monthly), date: fmtDate(r.item.expire_at) })}
                                        title={r.item.title}
                                        titleOrder={6}
                                    />
                                    <Badge color={active ? 'teal' : 'gray'} leftSection={<TbCalendar size={14} />} size="lg" variant="soft">
                                        {active ? fmtDate(base.add(r.months, 'month').add(r.days, 'day').toISOString()) : t('payment.no_extension')}
                                    </Badge>
                                </Group>
                                <SimpleGrid cols={3} spacing="xs">
                                    <NumberInput
                                        label={t('tariffs.months')}
                                        leftSection={<PiCalendarDuotone size={14} />}
                                        min={0}
                                        max={36}
                                        size="xs"
                                        value={r.months}
                                        onChange={(v) => update(r.key, { months: Number(v) || 0 })}
                                    />
                                    <NumberInput
                                        label={t('tariffs.days')}
                                        leftSection={<PiClockDuotone size={14} />}
                                        min={0}
                                        max={365}
                                        size="xs"
                                        value={r.days}
                                        onChange={(v) => update(r.key, { days: Number(v) || 0 })}
                                    />
                                    <NumberInput
                                        label={t('common.amount_in', { currency: currencySymbol() })}
                                        leftSection={<CurrencyIcon size={14} />}
                                        min={0}
                                        decimalScale={2}
                                        size="xs"
                                        value={r.amount}
                                        onChange={(v) => update(r.key, { amount: Number(v) || 0 })}
                                    />
                                </SimpleGrid>
                            </Stack>
                        </Paper>
                    )
                })}
                {rest < 0 && (
                    <Alert color="orange" variant="soft">
                        {t('payment.debt_warning', { amount: fmtMoney(-rest, 2) })}
                    </Alert>
                )}
            </FormSection>
            <FormFooter
                loading={commit.isPending}
                onSubmit={() =>
                    commit.mutate(undefined, {
                        onSuccess: (r) => setResults({ ext: r.extensions, balance: r.balance, ref: r.referral }),
                        onError: (e) => notifyError(e)
                    })
                }
                submitIcon={<PiCheck size={16} />}
                submitLabel={t('payment.commit')}
            >
                <Button color="gray" leftSection={<PiArrowLeft size={16} />} mr="auto" onClick={() => setPreview(null)} size="md" variant="subtle">
                    {t('payment.back')}
                </Button>
            </FormFooter>
        </FormStack>
    )
}
