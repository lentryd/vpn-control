// Create/edit layout follows remnawave/frontend (AGPL-3.0):
// shared/_modals/users/create-user-modal and its forms-components cards.
import { Button, Group, NumberInput, Select, Stack, Switch, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { HiIdentification } from 'react-icons/hi'
import {
    PiArchiveDuotone,
    PiCurrencyRub,
    PiFloppyDiskDuotone,
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
import { FormFooter, FormSection } from '@shared/ui/forms/form-section'
import { ModalFooter } from '@shared/ui/modal-footer'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { SectionCard } from '@shared/ui/section-card'

import { openModal } from './open'

const MotionStack = motion.create(Stack)
const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }
const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

export function openCustomerForm(customer?: Customer, onCreated?: (id: number) => void) {
    openModal(
        customer
            ? { icon: TbUser, color: 'teal', title: 'Клиент', subtitle: customer.name }
            : { icon: TbUserPlus, color: 'teal', title: 'Новый клиент' },
        (close) => <CustomerForm customer={customer} onCreated={onCreated} onDone={close} />,
        '1000px'
    )
}

function Card({ icon, color, title, children }: { icon: React.ComponentType<{ size: number }>; color: string; title: string; children: ReactNode }) {
    return (
        <motion.div variants={cardVariants}>
            <SectionCard.Root>
                <SectionCard.Section>
                    <BaseOverlayHeader iconColor={color} IconComponent={icon} title={title} titleOrder={5} />
                </SectionCard.Section>
                <SectionCard.Section>
                    <Stack gap="md">{children}</Stack>
                </SectionCard.Section>
            </SectionCard.Root>
        </motion.div>
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
            <Group align="flex-start" gap="md" wrap="wrap">
                <MotionStack animate="visible" gap="md" initial="hidden" style={{ flex: '1 1 400px' }} variants={containerVariants}>
                    <Card color="blue" icon={HiIdentification} title="Клиент">
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
                    </Card>
                    <Card color="teal" icon={TbMail} title="Контакты">
                        <TextInput
                            label="Контакт"
                            leftSection={<PiTelegramLogoDuotone size={16} />}
                            placeholder="@telegram, телефон (необязательно)"
                            {...form.getInputProps('contact')}
                        />
                    </Card>
                </MotionStack>
                <MotionStack animate="visible" gap="md" initial="hidden" style={{ flex: '1 1 400px' }} variants={containerVariants}>
                    <Card color="indigo" icon={TbAffiliate} title="Рефералка">
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
                    </Card>
                    <Card color="orange" icon={TbNotes} title="Заметки">
                        <Textarea
                            label="Описание"
                            minRows={3}
                            placeholder="Что важно помнить про клиента"
                            resize="vertical"
                            {...form.getInputProps('notes')}
                        />
                    </Card>
                </MotionStack>
            </Group>
            <ModalFooter isMobile={window.matchMedia('(max-width: 40em)').matches}>
                <Button color="teal" leftSection={<PiFloppyDiskDuotone size={16} />} loading={m.isPending} size="md" type="submit" variant="light">
                    {customer ? 'Сохранить' : 'Создать'}
                </Button>
            </ModalFooter>
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
