import { Alert, Badge, Button, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Switch, Text, TextInput, ThemeIcon } from '@mantine/core'
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
    PiCurrencyRub,
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
import { durationLabel, fmtDate, fmtMoney } from '@/components/format'
import { notifyError } from '@/components/notify'
import { periodCost } from '@/components/pricing'
import { StatCard } from '@/components/ui'
import { FormFooter, FormSection, FormStack } from '@shared/ui/forms/form-section'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'

import { openModal } from './open'

export function openPaymentModal(p: { customerId: number; name: string }) {
    openModal({ icon: PiCreditCardDuotone, color: 'teal', title: 'Платёж', subtitle: p.name }, (close) => <PaymentForm customerId={p.customerId} onDone={close} />, 'xl')
}

interface Row {
    key: string
    item: PlanItem
    months: number
    days: number
    amount: number
}

function PaymentForm({ customerId, onDone }: { customerId: number; onDone: () => void }) {
    const [amount, setAmount] = useState<number>(0)
    const [date, setDate] = useState<string | null>(dayjs().format('YYYY-MM-DD'))
    const [method, setMethod] = useState<string | null>('Перевод')
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
                <FormSection icon={PiCheckCircleDuotone} color="teal" title="Платёж записан" description={`Баланс клиента: ${fmtMoney(results.balance, 2)}`}>
                    {results.ref && (
                        <Badge color="grape" leftSection={<PiTreeStructure size={14} />} size="lg" variant="soft">
                            {results.ref.referrer_name}: +{fmtMoney(results.ref.amount, 2)} ({results.ref.percent}%) — учётно
                        </Badge>
                    )}
                    {results.ext.length === 0 && (
                        <Text c="dimmed" size="sm">
                            Продлений не было — сумма осталась на балансе.
                        </Text>
                    )}
                    {results.ext.map((e) => (
                        <Group gap="xs" key={`${e.kind}-${e.id}`} wrap="nowrap">
                            <ThemeIcon color={e.ok ? 'teal' : 'red'} size="md" variant="soft">
                                {e.ok ? <PiCheck size={14} /> : <PiX size={14} />}
                            </ThemeIcon>
                            <Text size="sm">
                                {e.title}: {durationLabel(e.months, e.days)}
                                {e.ok ? ` → до ${fmtDate(e.to)}` : ` — ошибка: ${e.error} (списание отменено)`}
                            </Text>
                        </Group>
                    ))}
                </FormSection>
                <FormFooter onSubmit={onDone} submitIcon={<PiCheck size={16} />} submitLabel="Готово" />
            </FormStack>
        )
    }

    if (!preview) {
        return (
            <FormStack>
                <FormSection icon={PiCreditCardDuotone} color="teal" title="Поступление" description="Деньги зачислятся на баланс, затем продлятся подписки">
                    <SimpleGrid cols={{ base: 1, xs: 2 }}>
                        <NumberInput
                            label="Сумма, ₽"
                            leftSection={<PiCurrencyRub size={16} />}
                            min={0}
                            decimalScale={2}
                            value={amount || ''}
                            onChange={(v) => setAmount(Number(v) || 0)}
                            data-autofocus
                        />
                        <DateInput label="Дата" leftSection={<PiCalendarDuotone size={16} />} value={date} onChange={setDate} valueFormat="DD.MM.YYYY" />
                        <Select
                            label="Способ"
                            leftSection={<PiBank size={16} />}
                            data={['Перевод', 'СБП', 'Наличные', 'Крипта', 'Другое']}
                            value={method}
                            onChange={setMethod}
                        />
                        <TextInput label="Комментарий" leftSection={<PiNotePencil size={16} />} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
                    </SimpleGrid>
                    <Switch
                        label="Остаток — в дни"
                        description="Сумму, которой не хватает на целый месяц, превратить в дни подписки"
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
                    submitLabel="Рассчитать продление"
                />
            </FormStack>
        )
    }

    const allocated = rows.reduce((s, r) => s + r.amount, 0)
    const rest = Math.round((preview.balance_after_payment - allocated) * 100) / 100

    return (
        <FormStack>
            <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
                <StatCard icon={PiWalletDuotone} color="gray" title="Баланс до" value={fmtMoney(preview.balance_before, 2)} />
                <StatCard icon={PiCreditCardDuotone} color="teal" title="После платежа" value={fmtMoney(preview.balance_after_payment, 2)} />
                <StatCard icon={PiCoinsDuotone} color={rest < 0 ? 'red' : 'cyan'} title="Останется" value={fmtMoney(rest, 2)} />
            </SimpleGrid>
            {preview.referral && (
                <Badge color="grape" leftSection={<PiTreeStructure size={14} />} size="lg" variant="soft">
                    {preview.referral.referrer_name} получит {fmtMoney(preview.referral.amount, 2)} ({preview.referral.percent}%) — учётно
                </Badge>
            )}
            <FormSection icon={PiCalendarPlusDuotone} color="teal" title="Продление" description="Можно поправить месяцы, дни и сумму по каждой позиции">
                {rows.length === 0 && (
                    <Alert color="yellow" variant="soft">
                        У клиента нет привязанных подписок с автопродлением — платёж просто зачислится на баланс.
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
                                        subtitle={`${fmtMoney(r.item.monthly)}/мес · сейчас до ${fmtDate(r.item.expire_at)}`}
                                        title={r.item.title}
                                        titleOrder={6}
                                    />
                                    <Badge color={active ? 'teal' : 'gray'} leftSection={<TbCalendar size={14} />} size="lg" variant="soft">
                                        {active ? fmtDate(base.add(r.months, 'month').add(r.days, 'day').toISOString()) : 'без продления'}
                                    </Badge>
                                </Group>
                                <SimpleGrid cols={3} spacing="xs">
                                    <NumberInput
                                        label="Месяцев"
                                        leftSection={<PiCalendarDuotone size={14} />}
                                        min={0}
                                        max={36}
                                        size="xs"
                                        value={r.months}
                                        onChange={(v) => update(r.key, { months: Number(v) || 0 })}
                                    />
                                    <NumberInput
                                        label="Дней"
                                        leftSection={<PiClockDuotone size={14} />}
                                        min={0}
                                        max={365}
                                        size="xs"
                                        value={r.days}
                                        onChange={(v) => update(r.key, { days: Number(v) || 0 })}
                                    />
                                    <NumberInput
                                        label="Сумма, ₽"
                                        leftSection={<PiCurrencyRub size={14} />}
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
                        Распределено больше, чем есть на балансе — клиент уйдёт в долг на {fmtMoney(-rest, 2)}.
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
                submitLabel="Записать и продлить"
            >
                <Button color="gray" leftSection={<PiArrowLeft size={16} />} mr="auto" onClick={() => setPreview(null)} size="md" variant="subtle">
                    Назад
                </Button>
            </FormFooter>
        </FormStack>
    )
}
