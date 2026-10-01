import { NumberInput, Select, Stack, Switch, Textarea, TextInput } from '@mantine/core'
import {
    PiCurrencyRub,
    PiNotePencil,
    PiPercent,
    PiScalesDuotone,
    PiTelegramLogo,
    PiTreeStructureDuotone,
    PiUser,
    PiUserDuotone,
    PiUserPlusDuotone,
    PiUsersThree
} from 'react-icons/pi'
import { useForm } from '@mantine/form'
import { useNavigate } from 'react-router'

import { api } from '@/api/client'
import { useApiMutation, useCustomers } from '@/api/hooks'
import type { Customer } from '@/api/types'
import { notifyError, notifyOk } from '@/components/notify'
import { FormFooter, FormSection } from '@shared/ui/forms/form-section'

import { openModal } from './open'

export function openCustomerForm(customer?: Customer, onCreated?: (id: number) => void) {
    openModal(customer ? { icon: PiUserDuotone, title: 'Клиент', subtitle: customer.name } : { icon: PiUserPlusDuotone, title: 'Новый клиент' }, (close) => (
        <CustomerForm customer={customer} onDone={close} onCreated={onCreated} />
    ))
}

function CustomerForm({ customer, onDone, onCreated }: { customer?: Customer; onDone: () => void; onCreated?: (id: number) => void }) {
    const customers = useCustomers()
    const navigate = useNavigate()
    const form = useForm({
        initialValues: {
            name: customer?.name ?? '',
            contact: customer?.contact ?? '',
            notes: customer?.notes ?? '',
            referrer_id: customer?.referrer_id ? String(customer.referrer_id) : null,
            referral_percent: customer?.referral_percent ?? ('' as number | ''),
            archived: customer?.archived ?? false
        },
        validate: { name: (v) => (v.trim() ? null : 'Введите имя') }
    })
    const m = useApiMutation((v: typeof form.values) => {
        const body = {
            ...v,
            name: v.name.trim(),
            referrer_id: v.referrer_id ? Number(v.referrer_id) : null,
            referral_percent: v.referral_percent === '' ? null : Number(v.referral_percent)
        }
        return customer ? api.put(`customers/${customer.id}`, body) : api.post<{ id: number }>('customers', body)
    })

    return (
        <form
            onSubmit={form.onSubmit((v) =>
                m.mutate(v, {
                    onSuccess: (res) => {
                        notifyOk(customer ? 'Клиент сохранён' : 'Клиент создан')
                        onDone()
                        const id = (res as { id?: number } | undefined)?.id
                        if (!customer && id) {
                            if (onCreated) onCreated(id)
                            else navigate(`/customers/${id}`)
                        }
                    },
                    onError: (e) => notifyError(e)
                })
            )}
        >
            <Stack gap="md">
                <FormSection icon={PiUserDuotone} title="Клиент" description="Кто платит">
                    <TextInput label="Имя" leftSection={<PiUser size={16} />} required data-autofocus {...form.getInputProps('name')} />
                    <TextInput
                        label="Контакт"
                        leftSection={<PiTelegramLogo size={16} />}
                        placeholder="@telegram, телефон"
                        {...form.getInputProps('contact')}
                    />
                    <Switch label="В архиве" description="Клиент ушёл: не попадает в активные" {...form.getInputProps('archived', { type: 'checkbox' })} />
                </FormSection>
                <FormSection icon={PiTreeStructureDuotone} color="indigo" title="Рефералка" description="Только учёт, без списаний">
                    <Select
                        label="Кто привёл"
                        leftSection={<PiUsersThree size={16} />}
                        placeholder="Никто, пришёл сам"
                        searchable
                        clearable
                        allowDeselect
                        data={(customers.data ?? [])
                            .filter((c) => c.id !== customer?.id)
                            .map((c) => ({ value: String(c.id), label: c.name }))}
                        {...form.getInputProps('referrer_id')}
                    />
                    <NumberInput
                        label="Процент для приглашённых этим клиентом"
                        description="Пусто — глобальное значение из настроек"
                        leftSection={<PiPercent size={16} />}
                        min={0}
                        max={100}
                        decimalScale={2}
                        {...form.getInputProps('referral_percent')}
                    />
                </FormSection>
                <FormSection icon={PiNotePencil} color="gray" title="Заметки">
                    <Textarea autosize minRows={2} {...form.getInputProps('notes')} />
                </FormSection>
                <FormFooter loading={m.isPending} onCancel={onDone} />
            </Stack>
        </form>
    )
}

export function openAdjustModal(customer: { id: number; name: string }) {
    openModal({ icon: PiScalesDuotone, color: 'yellow', title: 'Корректировка баланса', subtitle: customer.name }, (close) => <AdjustForm id={customer.id} onDone={close} />)
}

function AdjustForm({ id, onDone }: { id: number; onDone: () => void }) {
    const form = useForm({ initialValues: { amount: 0, note: '' } })
    const m = useApiMutation((v: typeof form.values) => api.post(`customers/${id}/adjust`, v))
    return (
        <form
            onSubmit={form.onSubmit((v) =>
                m.mutate(v, {
                    onSuccess: () => {
                        notifyOk('Баланс скорректирован')
                        onDone()
                    },
                    onError: (e) => notifyError(e)
                })
            )}
        >
            <Stack gap="md">
                <FormSection icon={PiScalesDuotone} color="yellow" title="Корректировка" description="Положительная сумма — зачислить, отрицательная — списать">
                    <NumberInput label="Сумма, ₽" leftSection={<PiCurrencyRub size={16} />} decimalScale={2} {...form.getInputProps('amount')} />
                    <TextInput label="Причина" leftSection={<PiNotePencil size={16} />} required {...form.getInputProps('note')} />
                </FormSection>
                <FormFooter loading={m.isPending} onCancel={onDone} submitLabel="Применить" />
            </Stack>
        </form>
    )
}
