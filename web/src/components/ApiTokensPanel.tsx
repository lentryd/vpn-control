import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import { ActionIcon, Alert, Badge, Button, Checkbox, Code, CopyButton, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { PiCheck, PiCopy, PiKeyDuotone, PiPlus, PiTextAa, PiTrash } from 'react-icons/pi'

import { API_BASE, api } from '@/api/client'
import { useApiMutation, useInvalidateAll } from '@/api/hooks'
import type { ApiToken } from '@/api/types'
import { fmtDateTime, fromNow } from '@/components/format'
import { notifyError } from '@/components/notify'
import { confirmDanger, openModal } from '@/modals/open'
import { FormFooter, FormSection } from '@shared/ui/forms/form-section'
import { DataTableCard } from '@shared/ui/table'

const scopeHelp: Record<string, string> = {
    'addons:read': 'GET /api/v1/addons — каталог аддонов (JSON или ?format=yaml для subpage)',
    'backups:read': 'GET /api/v1/backups — список и скачивание снапшотов',
    'backups:write': 'POST /api/v1/backups — создать снапшот и сразу получить его'
}

const useTokens = () =>
    useQuery({ queryKey: ['api-tokens'], queryFn: () => api.get<{ tokens: ApiToken[]; scopes: string[] }>('api-tokens') })

// ApiTokensPanel manages tokens other services use for /api/v1, like the
// panel's own API tokens: the secret is shown once, on creation.
export function ApiTokensPanel() {
    const q = useTokens()
    const invalidate = useInvalidateAll()
    const remove = (t: ApiToken) =>
        confirmDanger(`Удалить токен «${t.name}»?`, 'Сервисы с этим токеном потеряют доступ.', async () => {
            try {
                await api.del(`api-tokens/${t.id}`)
                await invalidate()
            } catch (e) {
                notifyError(e)
            }
        })
    const columns = useMemo<MRT_ColumnDef<ApiToken>[]>(
        () => [
            { accessorKey: 'name', header: 'Название' },
            {
                accessorKey: 'prefix',
                header: 'Токен',
                Cell: ({ cell }) => <Code>{cell.getValue<string>()}…</Code>
            },
            {
                accessorKey: 'scopes',
                header: 'Доступ',
                enableSorting: false,
                Cell: ({ row }) => (
                    <Group gap={4}>
                        {row.original.scopes.map((s) => (
                            <Badge color="cyan" key={s} variant="soft">
                                {s}
                            </Badge>
                        ))}
                    </Group>
                )
            },
            { accessorKey: 'created_at', header: 'Создан', Cell: ({ cell }) => fmtDateTime(cell.getValue<string>()) },
            {
                accessorKey: 'last_used_at',
                header: 'Использован',
                Cell: ({ cell }) => (cell.getValue<string | null>() ? fromNow(cell.getValue<string>()) : 'никогда')
            }
        ],
        []
    )
    return (
        <DataTableCard
            actions={
                <Button
                    color="teal"
                    leftSection={<PiPlus size={14} />}
                    onClick={() => openModal({ icon: PiKeyDuotone, title: 'Новый API-токен' }, (close) => <CreateTokenForm onDone={close} scopes={q.data?.scopes ?? []} />, 'lg')}
                    size="xs"
                    variant="soft"
                >
                    Токен
                </Button>
            }
            columns={columns}
            data={q.data?.tokens ?? []}
            description={`Для других сервисов: Authorization: Bearer <токен>, адрес ${API_BASE}v1/`}
            enableRowActions
            icon={<PiKeyDuotone size={24} />}
            renderRowActions={({ row }) => (
                <ActionIcon color="red" onClick={() => remove(row.original)} variant="subtle">
                    <PiTrash size={16} />
                </ActionIcon>
            )}
            state={{ isLoading: q.isPending }}
            storageKey="api-tokens"
            title="API-токены"
        />
    )
}

function CreateTokenForm({ scopes, onDone }: { scopes: string[]; onDone: () => void }) {
    const form = useForm({
        initialValues: { name: '', scopes: [] as string[] },
        validate: {
            name: (v) => (v.trim() ? null : 'Введите название'),
            scopes: (v) => (v.length ? null : 'Выберите доступ')
        }
    })
    const m = useApiMutation((v: typeof form.values) => api.post<{ token: string }>('api-tokens', v))
    if (m.data) {
        return (
            <Stack>
                <Alert color="yellow" variant="soft">
                    Скопируйте токен сейчас — больше его показать не получится.
                </Alert>
                <Group gap="xs" wrap="nowrap">
                    <Code block style={{ flex: 1, wordBreak: 'break-all' }}>
                        {m.data.token}
                    </Code>
                    <CopyButton value={m.data.token}>
                        {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Скопировано' : 'Копировать'}>
                                <ActionIcon color={copied ? 'teal' : 'gray'} onClick={copy} size="lg" variant="soft">
                                    {copied ? <PiCheck size={18} /> : <PiCopy size={18} />}
                                </ActionIcon>
                            </Tooltip>
                        )}
                    </CopyButton>
                </Group>
                <FormFooter inline onSubmit={onDone} submitLabel="Готово" />
            </Stack>
        )
    }
    return (
        <form onSubmit={form.onSubmit((v) => m.mutate(v, { onError: (e) => notifyError(e) }))}>
            <Stack gap="md">
                <FormSection icon={PiKeyDuotone} title="Токен" description="Название — чтобы понимать, кто им пользуется">
                    <TextInput label="Название" leftSection={<PiTextAa size={16} />} placeholder="subpage" {...form.getInputProps('name')} />
                    <Checkbox.Group label="Доступ" {...form.getInputProps('scopes')}>
                        <Stack gap="xs" mt="xs">
                            {scopes.map((s) => (
                                <Checkbox
                                    description={<Text size="xs">{scopeHelp[s]}</Text>}
                                    key={s}
                                    label={s}
                                    value={s}
                                />
                            ))}
                        </Stack>
                    </Checkbox.Group>
                </FormSection>
                <FormFooter inline loading={m.isPending} onCancel={onDone} submitLabel="Создать" />
            </Stack>
        </form>
    )
}
