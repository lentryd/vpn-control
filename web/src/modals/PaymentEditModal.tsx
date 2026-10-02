import { Alert, NumberInput, Select, SimpleGrid, TextInput } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import dayjs from 'dayjs'
import { PiBank, PiCalendarDuotone, PiCoinsDuotone, PiCreditCardDuotone, PiInfo, PiNotePencil } from 'react-icons/pi'

import { api } from '@/api/client'
import { useApiMutation } from '@/api/hooks'
import type { Payment } from '@/api/types'
import { fmtMoney, currencySymbol } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { FormFooter, FormSection, FormStack } from '@shared/ui/forms/form-section'

import { openModal } from './open'

export const paymentMethods = ['Перевод', 'СБП', 'Наличные', 'Крипта', 'Другое']

export function openPaymentEdit(p: Payment) {
    openModal(
        { icon: PiCreditCardDuotone, color: 'teal', title: 'Платёж', subtitle: `${p.customer_name} · ${fmtMoney(p.amount, 2)}` },
        (close) => <PaymentEditForm onDone={close} payment={p} />,
        'lg'
    )
}

function PaymentEditForm({ payment, onDone }: { payment: Payment; onDone: () => void }) {
    const form = useForm({
        initialValues: {
            amount: payment.amount as number | string,
            date: dayjs(payment.date).format('YYYY-MM-DD'),
            method: payment.method || null,
            note: payment.note
        },
        validate: {
            amount: (v) => (Number(v) > 0 ? null : 'Сумма должна быть больше нуля'),
            date: (v) => (v ? null : 'Укажите дату')
        }
    })
    const m = useApiMutation((v: typeof form.values) =>
        api.put(`payments/${payment.id}`, { ...v, amount: Number(v.amount), method: v.method ?? '' })
    )
    const methods = payment.method && !paymentMethods.includes(payment.method) ? [...paymentMethods, payment.method] : paymentMethods

    return (
        <form
            onSubmit={form.onSubmit((v) =>
                m.mutate(v, {
                    onSuccess: () => {
                        notifyOk('Платёж сохранён')
                        onDone()
                    },
                    onError: (e) => notifyError(e)
                })
            )}
        >
            <FormStack>
                <FormSection color="teal" description="Сумма, дата и способ оплаты" icon={PiCreditCardDuotone} title="Поступление">
                    <SimpleGrid cols={{ base: 1, xs: 2 }}>
                        <NumberInput
                            data-autofocus
                            decimalScale={2}
                            label={`Сумма, ${currencySymbol()}`}
                            leftSection={<PiCoinsDuotone size={16} />}
                            min={0}
                            {...form.getInputProps('amount')}
                        />
                        <DateInput label="Дата" leftSection={<PiCalendarDuotone size={16} />} valueFormat="DD.MM.YYYY" {...form.getInputProps('date')} />
                        <Select data={methods} label="Способ" leftSection={<PiBank size={16} />} {...form.getInputProps('method')} />
                        <TextInput label="Комментарий" leftSection={<PiNotePencil size={16} />} {...form.getInputProps('note')} />
                    </SimpleGrid>
                    <Alert color="gray" icon={<PiInfo size={18} />} variant="soft">
                        {payment.historical
                            ? 'Платёж из импорта: на баланс клиента не влияет.'
                            : 'Изменится и зачисление на баланс клиента. Реферальное начисление пересчитается, если ещё не выплачено. Уже сделанные продления останутся как есть.'}
                    </Alert>
                </FormSection>
                <FormFooter loading={m.isPending} onCancel={onDone} />
            </FormStack>
        </form>
    )
}
