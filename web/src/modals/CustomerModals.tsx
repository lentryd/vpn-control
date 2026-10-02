// Create/edit layout follows remnawave/frontend (AGPL-3.0):
// shared/_modals/users/create-user-modal and its forms-components cards.
import { NumberInput, Select, Switch, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { HiIdentification } from 'react-icons/hi'
import {
    PiArchiveDuotone,
    PiCurrencyRub,
    PiNotePencil,
    PiPercentDuotone,
    PiScalesDuotone,
    PiTelegramLogoDuotone,
    PiUserDuotone,
    PiUsersThreeDuotone
} from 'react-icons/pi'
import { TbAffiliate, TbMail, TbNotes, TbUser, TbUserPlus } from 'react-icons/tb'
import { useNavigate } from 'react-router'

import { api } from '@/api/client'
import { useApiMutation, useCustomers } from '@/api/hooks'
import type { Customer } from '@/api/types'
import { notifyError, notifyOk } from '@/components/notify'
import { FormColumns, FormFooter, FormSection, FormStack } from '@shared/ui/forms/form-section'

import { openModal } from './open'

export function openCustomerForm(customer?: Customer, onCreated?: (id: number) => void) {
    openModal(
        customer
            ? { icon: TbUser, color: 'teal', title: 'Клиент', subtitle: customer.name }
            : { icon: TbUserPlus, color: 'teal', title: 'Новый клиент' },
        (close) => <CustomerForm customer={customer} onCreated={onCreated} onDone={close} />,
        '1000px'
    )
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
            <FormColumns
                left={
                    <>
                        <FormSection color="blue" icon={HiIdentification} title="Клиент">
                            <TextInput
                                data-autofocus
                                description="Как клиент будет называться в списках и отчётах"
                                label="Имя"
                                leftSection={<PiUserDuotone size={16} />}
                                required
                                {...form.getInputProps('name')}
                            />
                            {customer && (
                                <Switch
                                    description="Клиент ушёл: не попадает в активные"
                                    label="В архиве"
                                    thumbIcon={<PiArchiveDuotone size={10} />}
                                    {...form.getInputProps('archived', { type: 'checkbox' })}
                                />
                            )}
                        </FormSection>
                        <FormSection color="teal" icon={TbMail} title="Контакты">
                            <TextInput
                                label="Контакт"
                                leftSection={<PiTelegramLogoDuotone size={16} />}
                                placeholder="@telegram, телефон (необязательно)"
                                {...form.getInputProps('contact')}
                            />
                        </FormSection>
                    </>
                }
                right={
                    <>
                        <FormSection color="indigo" icon={TbAffiliate} title="Рефералка">
                            <Select
                                allowDeselect
                                clearable
                                data={(customers.data ?? []).filter((c) => c.id !== customer?.id).map((c) => ({ value: String(c.id), label: c.name }))}
                                description="Только учёт, без списаний"
                                label="Кто привёл"
                                leftSection={<PiUsersThreeDuotone size={16} />}
                                placeholder="Никто, пришёл сам"
                                searchable
                                {...form.getInputProps('referrer_id')}
                            />
                            <NumberInput
                                decimalScale={2}
                                description="Пусто — глобальное значение из настроек"
                                label="Процент для приглашённых этим клиентом"
                                leftSection={<PiPercentDuotone size={16} />}
                                max={100}
                                min={0}
                                {...form.getInputProps('referral_percent')}
                            />
                        </FormSection>
                        <FormSection color="orange" icon={TbNotes} title="Заметки">
                            <Textarea
                                label="Описание"
                                minRows={3}
                                placeholder="Что важно помнить про клиента"
                                resize="vertical"
                                {...form.getInputProps('notes')}
                            />
                        </FormSection>
                    </>
                }
            />
            <FormFooter loading={m.isPending} submitLabel={customer ? 'Сохранить' : 'Создать'} />
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
            <FormStack>
                <FormSection icon={PiScalesDuotone} color="yellow" title="Корректировка" description="Положительная сумма — зачислить, отрицательная — списать">
                    <NumberInput label="Сумма, ₽" leftSection={<PiCurrencyRub size={16} />} decimalScale={2} {...form.getInputProps('amount')} />
                    <TextInput label="Причина" leftSection={<PiNotePencil size={16} />} required {...form.getInputProps('note')} />
                </FormSection>
            </FormStack>
            <FormFooter loading={m.isPending} onCancel={onDone} submitLabel="Применить" />
        </form>
    )
}
