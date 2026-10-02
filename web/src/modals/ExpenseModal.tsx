import { Alert, Group, NumberInput, Paper, Select, SimpleGrid, Text, TextInput } from '@mantine/core'
import {
    PiArrowUDownLeft,
    PiArrowUpRight,
    PiBuildingsDuotone,
    PiCalendarDuotone,
    PiCoinsDuotone,
    PiCurrencyCircleDollar,
    PiCurrencyRub,
    PiNotePencil,
    PiPercent,
    PiReceiptDuotone
} from 'react-icons/pi'
import { DateInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useEffect } from 'react'

import { api } from '@/api/client'
import { useApiMutation, useExpenseItems, useExpenses, useSettings } from '@/api/hooks'
import type { Expense } from '@/api/types'
import { fmtMoney } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { FormColumns, FormFooter, FormSection } from '@shared/ui/forms/form-section'
import { ProviderInput } from '@shared/ui/infra/provider'

import { openModal } from './open'

const currencies = ['RUB', 'EUR', 'USD', 'GBP', 'CHF', 'CNY', 'TRY', 'KZT', 'BYN', 'UAH', 'AMD', 'GEL']

export function openExpenseForm(p: { expense?: Expense; refundOf?: Expense }) {
    const title = p.expense ? 'Трата' : p.refundOf ? 'Возврат средств' : 'Новая трата'
    const subtitle = p.expense ? `${p.expense.provider} · ${dayjs(p.expense.date).format('DD.MM.YYYY')}` : p.refundOf?.provider
    openModal({ icon: PiReceiptDuotone, color: 'orange', title, subtitle }, (close) => <ExpenseForm {...p} onDone={close} />, '1000px')
}

function ExpenseForm({ expense, refundOf, onDone }: { expense?: Expense; refundOf?: Expense; onDone: () => void }) {
    const items = useExpenseItems()
    const all = useExpenses()
    const settings = useSettings()
    const src = expense ?? refundOf
    const form = useForm({
        initialValues: {
            date: expense ? dayjs(expense.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
            provider: src?.provider ?? '',
            provider_uuid: src?.provider_uuid ?? '',
            expense_item_id: src?.expense_item_id ? String(src.expense_item_id) : null,
            kind: expense?.kind ?? (refundOf ? 'refund' : 'charge'),
            orig_amount: expense?.orig_amount ?? 0,
            orig_currency: src?.orig_currency ?? 'RUB',
            fx_rate: expense?.fx_rate ?? (1 as number | ''),
            fee_percent: src?.fee_percent ?? 0,
            share_percent: src?.share_percent ?? 100,
            refund_of_id: expense?.refund_of_id ?? refundOf?.id ?? null,
            note: expense?.note ?? ''
        }
    })
    const v = form.values
    const rate = useQuery({
        queryKey: ['fx', v.orig_currency, v.date],
        enabled: v.orig_currency !== 'RUB' && !!v.date,
        queryFn: () => api.get<{ rate: number }>(`fx/rate?currency=${v.orig_currency}&date=${v.date}`)
    })
    useEffect(() => {
        if (v.orig_currency === 'RUB') form.setFieldValue('fx_rate', 1)
        else if (rate.data && !expense) form.setFieldValue('fx_rate', rate.data.rate)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rate.data, v.orig_currency])
    useEffect(() => {
        if (!expense && v.orig_currency !== 'RUB' && v.fee_percent === 0 && settings.data) {
            form.setFieldValue('fee_percent', Number(settings.data.default_fee_percent) || 0)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [v.orig_currency, settings.data])

    const rub = (Number(v.orig_amount) || 0) * (Number(v.fx_rate) || 0) * (1 + (Number(v.fee_percent) || 0) / 100) * ((Number(v.share_percent) || 0) / 100)
    const providers = Array.from(new Set((all.data ?? []).map((e) => e.provider).filter(Boolean))).sort()

    const m = useApiMutation((vals: typeof form.values) => {
        const body = {
            ...vals,
            expense_item_id: vals.expense_item_id ? Number(vals.expense_item_id) : null,
            fx_rate: vals.fx_rate === '' ? null : Number(vals.fx_rate)
        }
        return expense ? api.put(`expenses/${expense.id}`, body) : api.post('expenses', body)
    })

    return (
        <form
            onSubmit={form.onSubmit((vals) =>
                m.mutate(vals, {
                    onSuccess: () => {
                        notifyOk('Сохранено')
                        onDone()
                    },
                    onError: (e) => notifyError(e)
                })
            )}
        >
            <FormColumns
                left={
                    <FormSection icon={PiReceiptDuotone} color="orange" title="Платёж" description="Когда, кому и по какой статье">
                        <SimpleGrid cols={{ base: 1, xs: 2 }}>
                            <DateInput label="Дата" leftSection={<PiCalendarDuotone size={16} />} valueFormat="DD.MM.YYYY" {...form.getInputProps('date')} />
                            <Select
                                label="Тип"
                                leftSection={v.kind === 'refund' ? <PiArrowUDownLeft size={16} /> : <PiArrowUpRight size={16} />}
                                data={[
                                    { value: 'charge', label: 'Списание' },
                                    { value: 'refund', label: 'Возврат средств' }
                                ]}
                                {...form.getInputProps('kind')}
                            />
                        </SimpleGrid>
                        <ProviderInput
                            label="Провайдер"
                            placeholder="Из Infra Billing панели или любой другой"
                            extra={providers}
                            value={v.provider}
                            onChange={(name, uuid) => form.setValues({ provider: name, provider_uuid: uuid })}
                        />
                        <Select
                            label="Статья расходов"
                            leftSection={<PiBuildingsDuotone size={16} />}
                            placeholder="Без статьи"
                            clearable
                            allowDeselect
                            data={(items.data?.items ?? []).map((i) => ({ value: String(i.id), label: i.name }))}
                            {...form.getInputProps('expense_item_id')}
                            onChange={(val) => {
                                form.setFieldValue('expense_item_id', val)
                                const it = items.data?.items.find((i) => String(i.id) === val)
                                if (it && !expense) {
                                    form.setValues({
                                        orig_currency: it.currency,
                                        fee_percent: it.fee_percent,
                                        share_percent: it.share_percent,
                                        provider: v.provider || it.provider,
                                        provider_uuid: v.provider ? v.provider_uuid : it.provider_uuid,
                                        orig_amount: v.orig_amount || it.amount
                                    })
                                }
                            }}
                        />
                        {v.kind === 'refund' && (
                            <Select
                                label="Возврат по трате"
                                description="Необязательно: свяжите возврат с исходным платежом"
                                leftSection={<PiArrowUDownLeft size={16} />}
                                clearable
                                allowDeselect
                                searchable
                                data={(all.data ?? [])
                                    .filter((e) => e.kind === 'charge')
                                    .map((e) => ({
                                        value: String(e.id),
                                        label: `${dayjs(e.date).format('DD.MM.YY')} · ${e.provider} · ${fmtMoney(e.rub_amount, 2)}`
                                    }))}
                                value={v.refund_of_id ? String(v.refund_of_id) : null}
                                onChange={(val) => form.setFieldValue('refund_of_id', val ? Number(val) : null)}
                            />
                        )}
                    </FormSection>
                }
                right={
                    <>
                        <FormSection icon={PiCoinsDuotone} color="teal" title="Сумма" description="Рубли считаются по курсу ЦБ на дату и фиксируются">
                            <SimpleGrid cols={{ base: 1, xs: 2 }}>
                                <NumberInput label="Сумма" leftSection={<PiCoinsDuotone size={16} />} min={0} decimalScale={2} {...form.getInputProps('orig_amount')} />
                                <Select
                                    label="Валюта"
                                    leftSection={<PiCurrencyCircleDollar size={16} />}
                                    data={currencies}
                                    searchable
                                    {...form.getInputProps('orig_currency')}
                                />
                            </SimpleGrid>
                            {v.orig_currency !== 'RUB' && (
                                <SimpleGrid cols={{ base: 1, xs: 2 }}>
                                    <NumberInput
                                        label="Курс ЦБ"
                                        description={rate.isFetching ? 'загрузка…' : 'на дату, можно изменить'}
                                        leftSection={<PiCurrencyRub size={16} />}
                                        decimalScale={4}
                                        min={0}
                                        {...form.getInputProps('fx_rate')}
                                    />
                                    <NumberInput
                                        label="Комиссия банка, %"
                                        description="Наценка карты за валюту"
                                        leftSection={<PiPercent size={16} />}
                                        decimalScale={2}
                                        {...form.getInputProps('fee_percent')}
                                    />
                                </SimpleGrid>
                            )}
                            <NumberInput
                                label="Наша доля, %"
                                description="Например, домен на троих — 30%"
                                leftSection={<PiPercent size={16} />}
                                min={0}
                                max={100}
                                decimalScale={2}
                                {...form.getInputProps('share_percent')}
                            />
                            {rate.error && (
                                <Alert color="red" variant="soft">
                                    {rate.error.message}
                                </Alert>
                            )}
                            <Paper bd="1px solid rgba(251, 146, 60, 0.25)" bg="rgba(251, 146, 60, 0.08)" p="sm" radius="md">
                                <Group justify="space-between">
                                    <Text c="dimmed" size="sm">
                                        Итого в рублях (зафиксируется)
                                    </Text>
                                    <Text c={v.kind === 'refund' ? 'teal' : 'orange'} ff="monospace" fw={700}>
                                        {v.kind === 'refund' ? '−' : ''}
                                        {fmtMoney(rub, 2)}
                                    </Text>
                                </Group>
                            </Paper>
                        </FormSection>
                        <FormSection icon={PiNotePencil} color="gray" title="Комментарий">
                            <TextInput placeholder="Например, номер счёта" {...form.getInputProps('note')} />
                        </FormSection>
                    </>
                }
            />
            <FormFooter loading={m.isPending} onCancel={onDone} />
        </form>
    )
}
