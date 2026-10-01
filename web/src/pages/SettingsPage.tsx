import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import { Badge, Button, Group, NumberInput, Stack, Tabs, Text } from '@mantine/core'
import { PiFloppyDiskDuotone, PiListMagnifyingGlassDuotone, PiSlidersDuotone } from 'react-icons/pi'
import { TbSettings } from 'react-icons/tb'
import { useEffect, useMemo, useState } from 'react'

import { api } from '@/api/client'
import { BackupPanel } from '@/components/BackupPanel'
import { useApiMutation, useAudit, useSettings } from '@/api/hooks'
import type { AuditRow } from '@/api/types'
import { fmtDateTime } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { PageHeader } from '@/components/ui'
import { Page } from '@shared/ui/page'
import { SettingsCardShared } from '@shared/ui/settings-card'
import { DataTableCard } from '@shared/ui/table'

const fields: { key: string; label: string; description: string; suffix?: string }[] = [
    {
        key: 'referral_percent',
        label: 'Реферальный процент',
        description: 'Сколько % от платежа приглашённого учитывается пригласившему (переопределяется у клиента)',
        suffix: '%'
    },
    { key: 'expiring_window_days', label: 'Окно «скоро истекает»', description: 'На сколько дней вперёд дашборд показывает истечения', suffix: ' дн.' },
    {
        key: 'default_fee_percent',
        label: 'Комиссия за валюту по умолчанию',
        description: 'Подставляется в траты в иностранной валюте (наценка банка/карты)',
        suffix: '%'
    }
]

export function SettingsPage() {
    const settings = useSettings()
    const audit = useAudit()
    const [values, setValues] = useState<Record<string, string>>({})
    useEffect(() => {
        if (settings.data) setValues(settings.data)
    }, [settings.data])
    const save = useApiMutation((v: Record<string, string>) => api.put('settings', v))

    const columns = useMemo<MRT_ColumnDef<AuditRow>[]>(
        () => [
            { id: 'at', header: 'Когда', sortingFn: 'datetime', accessorFn: (r) => new Date(r.at), enableColumnFilter: false, Cell: ({ row }) => fmtDateTime(row.original.at) },
            { accessorKey: 'actor', header: 'Кто', filterVariant: 'multi-select' },
            { accessorKey: 'action', header: 'Действие', filterVariant: 'multi-select' },
            { id: 'entity', header: 'Объект', accessorFn: (r) => `${r.entity} #${r.entity_id}` },
            {
                accessorKey: 'ok',
                header: 'Результат',
                Cell: ({ row }) =>
                    row.original.ok ? (
                        <Badge color="teal" variant="soft">
                            ok
                        </Badge>
                    ) : (
                        <Badge color="red" variant="soft" title={row.original.error}>
                            ошибка
                        </Badge>
                    )
            },
            {
                accessorKey: 'payload',
                header: 'Данные',
                Cell: ({ row }) => (
                    <Text size="xs" ff="monospace" truncate maw={420} title={row.original.error || row.original.payload}>
                        {row.original.error || row.original.payload}
                    </Text>
                )
            }
        ],
        []
    )

    return (
        <Page title="Настройки">
            <PageHeader icon={<TbSettings size={24} />} title="Настройки" description="Параметры учёта, резервные копии и журнал действий" />
            <Tabs defaultValue="settings">
                <Tabs.List mb="md">
                    <Tabs.Tab value="settings">Параметры</Tabs.Tab>
                    <Tabs.Tab value="backup">Резервные копии</Tabs.Tab>
                    <Tabs.Tab value="audit">Журнал действий</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="settings">
                    <SettingsCardShared.Container maw={720}>
                        <SettingsCardShared.Header
                            description="Значения по умолчанию для рефералки, дашборда и трат"
                            icon={<PiSlidersDuotone size={24} />}
                            iconColor="cyan"
                            iconVariant="soft"
                            title="Параметры"
                        />
                        <SettingsCardShared.Content>
                            <Stack>
                                {fields.map((f) => (
                                    <NumberInput
                                        key={f.key}
                                        label={f.label}
                                        description={f.description}
                                        suffix={f.suffix}
                                        decimalScale={2}
                                        value={values[f.key] ?? ''}
                                        onChange={(v) => setValues((s) => ({ ...s, [f.key]: String(v) }))}
                                    />
                                ))}
                            </Stack>
                        </SettingsCardShared.Content>
                        <SettingsCardShared.Bottom>
                            <Group justify="flex-end">
                            <Button
                                    color="teal"
                                    leftSection={<PiFloppyDiskDuotone size={16} />}
                                    mt="md"
                                    variant="soft"
                                    loading={save.isPending}
                                    onClick={() =>
                                        save.mutate(values, { onSuccess: () => notifyOk('Настройки сохранены'), onError: (e) => notifyError(e) })
                                    }
                                >
                                    Сохранить
                            </Button>
                            </Group>
                        </SettingsCardShared.Bottom>
                    </SettingsCardShared.Container>
                </Tabs.Panel>
                <Tabs.Panel value="backup">
                    <BackupPanel />
                </Tabs.Panel>
                <Tabs.Panel value="audit">
                    <DataTableCard
                        storageKey="audit"
                        icon={<PiListMagnifyingGlassDuotone size={24} />}
                        title="Журнал действий"
                        description="Кто что менял и как ответила панель"
                        columns={columns}
                        data={audit.data ?? []}
                        state={{ isLoading: !audit.data }}
                        initialState={{ sorting: [{ id: 'at', desc: true }] }}
                    />
                </Tabs.Panel>
            </Tabs>
        </Page>
    )
}
