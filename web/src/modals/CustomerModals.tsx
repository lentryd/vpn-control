// Create/edit layout follows remnawave/frontend (AGPL-3.0):
// shared/_modals/users/create-user-modal and its forms-components cards.
import { NumberInput, Switch, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { HiIdentification } from 'react-icons/hi'
import {
    PiArchiveDuotone,
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
import { SearchSelect } from '@shared/ui/forms/search-select'
import { CurrencyIcon } from '@shared/currencies'
import { currencySymbol } from '@/components/format'
import i18n from '@/app/i18n/i18n'
import { useTranslation } from 'react-i18next'

export function openCustomerForm(customer?: Customer, onCreated?: (id: number) => void) {
    openModal(
        customer
            ? { icon: TbUser, color: 'teal', title: i18n.t('sub.customer'), subtitle: customer.name }
            : { icon: TbUserPlus, color: 'teal', title: i18n.t('customers.new') },
        (close) => <CustomerForm customer={customer} onCreated={onCreated} onDone={close} />,
        '1000px'
    )
}

function CustomerForm({ customer, onDone, onCreated }: { customer?: Customer; onDone: () => void; onCreated?: (id: number) => void }) {
    const { t } = useTranslation()
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
        validate: { name: (v) => (v.trim() ? null : t('customers.name_required')) }
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
                        notifyOk(customer ? t('customers.saved') : t('customers.created'))
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
                        <FormSection color="blue" icon={HiIdentification} title={t('sub.customer')}>
                            <TextInput
                                data-autofocus
                                description={t('customers.name_hint')}
                                label={t('customers.name')}
                                leftSection={<PiUserDuotone size={16} />}
                                required
                                {...form.getInputProps('name')}
                            />
                            {customer && (
                                <Switch
                                    description={t('customers.archived_hint')}
                                    label={t('customers.archived')}
                                    thumbIcon={<PiArchiveDuotone size={10} />}
                                    {...form.getInputProps('archived', { type: 'checkbox' })}
                                />
                            )}
                        </FormSection>
                        <FormSection color="teal" icon={TbMail} title={t('customers.contacts')}>
                            <TextInput
                                label={t('customers.contact')}
                                leftSection={<PiTelegramLogoDuotone size={16} />}
                                placeholder={t('customers.contact_placeholder')}
                                {...form.getInputProps('contact')}
                            />
                        </FormSection>
                    </>
                }
                right={
                    <>
                        <FormSection color="indigo" icon={TbAffiliate} title={t('dashboard.referrals')}>
                            <SearchSelect
                                allowDeselect
                                clearable
                                data={(customers.data ?? []).filter((c) => c.id !== customer?.id).map((c) => ({ value: String(c.id), label: c.name }))}
                                description={t('dashboard.referrals_hint')}
                                label={t('customers.referrer')}
                                leftSection={<PiUsersThreeDuotone size={16} />}
                                placeholder={t('customers.no_referrer')}
                                {...form.getInputProps('referrer_id')}
                            />
                            <NumberInput
                                decimalScale={2}
                                description={t('customers.ref_percent_hint')}
                                label={t('customers.ref_percent')}
                                leftSection={<PiPercentDuotone size={16} />}
                                max={100}
                                min={0}
                                {...form.getInputProps('referral_percent')}
                            />
                        </FormSection>
                        <FormSection color="orange" icon={TbNotes} title={t('expense_items.notes')}>
                            <Textarea
                                label={t('tariffs.description_label')}
                                minRows={3}
                                placeholder={t('customers.notes_placeholder')}
                                resize="vertical"
                                {...form.getInputProps('notes')}
                            />
                        </FormSection>
                    </>
                }
            />
            <FormFooter loading={m.isPending} submitLabel={customer ? t('common.save') : t('common.create')} />
        </form>
    )
}

export function openAdjustModal(customer: { id: number; name: string }) {
    openModal({ icon: PiScalesDuotone, color: 'yellow', title: i18n.t('customer.adjust_balance'), subtitle: customer.name }, (close) => <AdjustForm id={customer.id} onDone={close} />)
}

function AdjustForm({ id, onDone }: { id: number; onDone: () => void }) {
    const { t } = useTranslation()
    const form = useForm({ initialValues: { amount: 0, note: '' } })
    const m = useApiMutation((v: typeof form.values) => api.post(`customers/${id}/adjust`, v))
    return (
        <form
            onSubmit={form.onSubmit((v) =>
                m.mutate(v, {
                    onSuccess: () => {
                        notifyOk(t('customers.adjusted'))
                        onDone()
                    },
                    onError: (e) => notifyError(e)
                })
            )}
        >
            <FormStack>
                <FormSection icon={PiScalesDuotone} color="yellow" title={t('customer.ledger.adjustment')} description={t('customers.adjust_hint')}>
                    <NumberInput label={t('common.amount_in', { currency: currencySymbol() })} leftSection={<CurrencyIcon size={16} />} decimalScale={2} {...form.getInputProps('amount')} />
                    <TextInput label={t('customers.reason')} leftSection={<PiNotePencil size={16} />} required {...form.getInputProps('note')} />
                </FormSection>
            </FormStack>
            <FormFooter loading={m.isPending} onCancel={onDone} submitLabel={t('customers.apply')} />
        </form>
    )
}
