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
import i18n from '@/app/i18n/i18n'
import { useTranslation } from 'react-i18next'

const SCOPES = ['addons:read', 'backups:read', 'backups:write'] as const
const scopeHelp = (s: string) =>
    (SCOPES as readonly string[]).includes(s) ? i18n.t(`tokens.scope.${s.replace(':', '_') as 'addons_read'}`) : ''


const useTokens = () =>
    useQuery({ queryKey: ['api-tokens'], queryFn: () => api.get<{ tokens: ApiToken[]; scopes: string[] }>('api-tokens') })

// ApiTokensPanel manages tokens other services use for /api/v1, like the
// panel's own API tokens: the secret is shown once, on creation.
export function ApiTokensPanel() {
    const { t } = useTranslation()
    const q = useTokens()
    const invalidate = useInvalidateAll()
    const remove = (tok: ApiToken) =>
        confirmDanger(t('tokens.delete', { name: tok.name }), t('tokens.delete_hint'), async () => {
            try {
                await api.del(`api-tokens/${tok.id}`)
                await invalidate()
            } catch (e) {
                notifyError(e)
            }
        })
    const columns = useMemo<MRT_ColumnDef<ApiToken>[]>(
        () => [
            { accessorKey: 'name', header: t('tariffs.col_name') },
            {
                accessorKey: 'prefix',
                header: t('tokens.token'),
                Cell: ({ cell }) => <Code>{cell.getValue<string>()}…</Code>
            },
            {
                accessorKey: 'scopes',
                header: t('tokens.access'),
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
            { accessorKey: 'created_at', header: t('backup.col_created'), Cell: ({ cell }) => fmtDateTime(cell.getValue<string>()) },
            {
                accessorKey: 'last_used_at',
                header: t('tokens.used'),
                Cell: ({ cell }) => (cell.getValue<string | null>() ? fromNow(cell.getValue<string>()) : t('common.never'))
            }
        ],
        [t]
    )
    return (
        <DataTableCard
            actions={
                <Button
                    color="teal"
                    leftSection={<PiPlus size={14} />}
                    onClick={() => openModal({ icon: PiKeyDuotone, title: t('tokens.new') }, (close) => <CreateTokenForm onDone={close} scopes={q.data?.scopes ?? []} />, 'lg')}
                    size="xs"
                    variant="soft"
                >
                    {t('tokens.token')}
                </Button>
            }
            columns={columns}
            data={q.data?.tokens ?? []}
            description={t('tokens.description', { url: `${API_BASE}v1/` })}
            enableRowActions
            icon={<PiKeyDuotone size={24} />}
            renderRowActions={({ row }) => (
                <ActionIcon color="red" onClick={() => remove(row.original)} variant="subtle">
                    <PiTrash size={16} />
                </ActionIcon>
            )}
            state={{ isLoading: q.isPending }}
            storageKey="api-tokens"
            title={t('settings.tokens')}
        />
    )
}

function CreateTokenForm({ scopes, onDone }: { scopes: string[]; onDone: () => void }) {
    const { t } = useTranslation()
    const form = useForm({
        initialValues: { name: '', scopes: [] as string[] },
        validate: {
            name: (v) => (v.trim() ? null : t('tariffs.name_required')),
            scopes: (v) => (v.length ? null : t('errors.token.scope_required'))
        }
    })
    const m = useApiMutation((v: typeof form.values) => api.post<{ token: string }>('api-tokens', v))
    if (m.data) {
        return (
            <Stack>
                <Alert color="yellow" variant="soft">
                    {t('tokens.copy_now')}
                </Alert>
                <Group gap="xs" wrap="nowrap">
                    <Code block style={{ flex: 1, wordBreak: 'break-all' }}>
                        {m.data.token}
                    </Code>
                    <CopyButton value={m.data.token}>
                        {({ copied, copy }) => (
                            <Tooltip label={copied ? t('common.copied') : t('common.copy')}>
                                <ActionIcon color={copied ? 'teal' : 'gray'} onClick={copy} size="lg" variant="soft">
                                    {copied ? <PiCheck size={18} /> : <PiCopy size={18} />}
                                </ActionIcon>
                            </Tooltip>
                        )}
                    </CopyButton>
                </Group>
                <FormFooter inline onSubmit={onDone} submitLabel={t('common.done')} />
            </Stack>
        )
    }
    return (
        <form onSubmit={form.onSubmit((v) => m.mutate(v, { onError: (e) => notifyError(e) }))}>
            <Stack gap="md">
                <FormSection icon={PiKeyDuotone} title={t('tokens.token')} description={t('tokens.name_hint')}>
                    <TextInput label={t('tariffs.col_name')} leftSection={<PiTextAa size={16} />} placeholder="subpage" {...form.getInputProps('name')} />
                    <Checkbox.Group label={t('tokens.access')} {...form.getInputProps('scopes')}>
                        <Stack gap="xs" mt="xs">
                            {scopes.map((s) => (
                                <Checkbox
                                    description={<Text size="xs">{scopeHelp(s)}</Text>}
                                    key={s}
                                    label={s}
                                    value={s}
                                />
                            ))}
                        </Stack>
                    </Checkbox.Group>
                </FormSection>
                <FormFooter inline loading={m.isPending} onCancel={onDone} submitLabel={t('common.create')} />
            </Stack>
        </form>
    )
}
