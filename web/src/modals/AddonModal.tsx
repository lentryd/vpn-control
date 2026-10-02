import { SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { PiChatTextDuotone, PiPuzzlePieceDuotone, PiTextAa, PiWarningDuotone } from 'react-icons/pi'

import { api } from '@/api/client'
import { useApiMutation } from '@/api/hooks'
import type { Addon } from '@/api/types'
import { notifyError, notifyOk } from '@/components/notify'
import { FormFooter, FormSection } from '@shared/ui/forms/form-section'

import { openModal } from './open'

const STUB_STATUSES = ['LIMITED', 'EXPIRED', 'DISABLED'] as const

export function openAddonModal(addon?: Addon) {
    openModal(
        { icon: PiPuzzlePieceDuotone, color: 'grape', title: addon ? 'Аддон' : 'Новый аддон', subtitle: addon?.name },
        (close) => <AddonForm addon={addon} onDone={close} />,
        'lg'
    )
}

function AddonForm({ addon, onDone }: { addon?: Addon; onDone: () => void }) {
    const form = useForm({
        initialValues: {
            name: addon?.name ?? '',
            prefix: addon?.prefix ?? '',
            suffix: addon?.suffix ?? '',
            remark: addon?.remark ?? '',
            remark_unlimited: addon?.remark_unlimited ?? '',
            stubs: Object.fromEntries(STUB_STATUSES.map((s) => [s, addon?.stubs?.[s] ?? ''])) as Record<string, string>
        },
        validate: {
            prefix: (v, vals) => (v.trim() || vals.suffix.trim() ? null : 'Нужен префикс или суффикс')
        }
    })
    const m = useApiMutation((v: typeof form.values) => (addon ? api.put(`addons/${addon.id}`, v) : api.post('addons', v)))
    const v = form.values
    return (
        <form
            onSubmit={form.onSubmit((vals) =>
                m.mutate(vals, {
                    onSuccess: () => {
                        notifyOk('Аддон сохранён')
                        onDone()
                    },
                    onError: (e) => notifyError(e)
                })
            )}
        >
            <Stack gap="md">
                <FormSection
                    icon={PiPuzzlePieceDuotone}
                    color="grape"
                    title="Пользователь аддона"
                    description="Отдельный пользователь панели, чьи конфиги добавляются в подписку основного"
                >
                    <TextInput label="Название" leftSection={<PiTextAa size={16} />} placeholder="premium" {...form.getInputProps('name')} />
                    <SimpleGrid cols={2}>
                        <TextInput label="Префикс" placeholder="premium_" {...form.getInputProps('prefix')} />
                        <TextInput label="Суффикс" placeholder="_premium" {...form.getInputProps('suffix')} />
                    </SimpleGrid>
                    <Text c="dimmed" size="xs">
                        Имя пользователя: <b>{`${v.prefix}<username>${v.suffix}`}</b>
                    </Text>
                </FormSection>
                <FormSection
                    icon={PiChatTextDuotone}
                    color="cyan"
                    title="Названия конфигов"
                    description="Для subpage: {remark} — исходное имя, {remaining}, {limit}, {used} — ГБ"
                >
                    <TextInput label="Название" placeholder="⭐ {remark} · {remaining} из {limit} GB" {...form.getInputProps('remark')} />
                    <TextInput label="Без лимита трафика" placeholder="⭐ {remark} · безлимит" {...form.getInputProps('remark_unlimited')} />
                </FormSection>
                <FormSection
                    icon={PiWarningDuotone}
                    color="orange"
                    title="Заглушки"
                    description="Имя нерабочего конфига, который показывается вместо аддона в этом статусе. Пусто — ничего"
                >
                    {STUB_STATUSES.map((s) => (
                        <TextInput key={s} label={s} {...form.getInputProps(`stubs.${s}`)} />
                    ))}
                </FormSection>
                <FormFooter inline loading={m.isPending} onCancel={onDone} />
            </Stack>
        </form>
    )
}
