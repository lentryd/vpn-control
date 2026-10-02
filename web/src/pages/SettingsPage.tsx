import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import { Badge, Button, Group, NumberInput, Select, Stack, Tabs, Text } from '@mantine/core'
import { PiFloppyDiskDuotone, PiListMagnifyingGlassDuotone, PiSlidersDuotone } from 'react-icons/pi'
import { TbSettings } from 'react-icons/tb'
import { useEffect, useMemo, useState } from 'react'

import { api } from '@/api/client'
import { ApiTokensPanel } from '@/components/ApiTokensPanel'
import { BackupPanel } from '@/components/BackupPanel'
import { useApiMutation, useAudit, useSettings } from '@/api/hooks'
import type { AuditRow } from '@/api/types'
import { fmtDateTime } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { PageHeader } from '@/components/ui'
import { BASE_CURRENCIES, CurrencyIcon } from '@shared/currencies'
import { Page } from '@shared/ui/page'
import { SettingsCardShared } from '@shared/ui/settings-card'
import { DataTableCard } from '@shared/ui/table'
import { useTranslation } from 'react-i18next'

// Numeric settings; labels are locale keys under settings.fields.
const fields = [
    { key: 'referral_percent', suffix: '%' },
    { key: 'expiring_window_days', suffix: 'days' },
    { key: 'default_fee_percent', suffix: '%' }
] as const

export function SettingsPage() {
    const { t } = useTranslation()
    const settings = useSettings()
    const audit = useAudit()
    const [values, setValues] = useState<Record<string, string>>({})
    useEffect(() => {
        if (settings.data) setValues(settings.data)
    }, [settings.data])
    const save = useApiMutation((v: Record<string, string>) => api.put('settings', v))

    const columns = useMemo<MRT_ColumnDef<AuditRow>[]>(
        () => [
            { id: 'at', header: t('customer.col_when'), sortingFn: 'datetime', accessorFn: (r) => new Date(r.at), enableColumnFilter: false, Cell: ({ row }) => fmtDateTime(row.original.at) },
            { accessorKey: 'actor', header: t('customer.col_actor'), filterVariant: 'multi-select' },
            { accessorKey: 'action', header: t('customer.col_action'), filterVariant: 'multi-select' },
            { id: 'entity', header: t('settings.col_entity'), accessorFn: (r) => `${r.entity} #${r.entity_id}` },
            {
                accessorKey: 'ok',
                header: t('settings.col_result'),
                Cell: ({ row }) =>
                    row.original.ok ? (
                        <Badge color="teal" variant="soft">
                            ok
                        </Badge>
                    ) : (
                        <Badge color="red" variant="soft" title={row.original.error}>
                            {t('common.error')}
                        </Badge>
                    )
            },
            {
                accessorKey: 'payload',
                header: t('backup.col_data'),
                Cell: ({ row }) => (
                    <Text size="xs" ff="monospace" truncate maw={420} title={row.original.error || row.original.payload}>
                        {row.original.error || row.original.payload}
                    </Text>
                )
            }
        ],
        [t]
    )

    return (
        <Page title={t('menu.settings')}>
            <PageHeader icon={<TbSettings size={24} />} title={t('menu.settings')} description={t('settings.description')} />
            <Tabs defaultValue="settings">
                <Tabs.List mb="md">
                    <Tabs.Tab value="settings">{t('settings.params')}</Tabs.Tab>
                    <Tabs.Tab value="backup">{t('settings.backups')}</Tabs.Tab>
                    <Tabs.Tab value="tokens">{t('settings.tokens')}</Tabs.Tab>
                    <Tabs.Tab value="audit">{t('backup.cat.audit.title')}</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="settings">
                    <SettingsCardShared.Container maw={720}>
                        <SettingsCardShared.Header
                            description={t('settings.params_hint')}
                            icon={<PiSlidersDuotone size={24} />}
                            iconColor="cyan"
                            iconVariant="soft"
                            title={t('settings.params')}
                        />
                        <SettingsCardShared.Content>
                            <Stack>
                                <Select
                                    label={t('settings.base_currency')}
                                    description={
                                        values._base_locked === 'true'
                                            ? t('settings.base_locked')
                                            : t('settings.base_hint')
                                    }
                                    leftSection={<CurrencyIcon currency={values.base_currency} size={16} />}
                                    data={BASE_CURRENCIES}
                                    disabled={values._base_locked === 'true'}
                                    searchable
                                    allowDeselect={false}
                                    value={values.base_currency ?? null}
                                    onChange={(v) => v && setValues((s) => ({ ...s, base_currency: v }))}
                                />
                                {fields.map((f) => (
                                    <NumberInput
                                        key={f.key}
                                        label={t(`settings.fields.${f.key}.label`)}
                                        description={t(`settings.fields.${f.key}.description`)}
                                        suffix={f.suffix === 'days' ? ` ${t('settings.days_suffix')}` : f.suffix}
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
                                        save.mutate(values, { onSuccess: () => notifyOk(t('settings.saved')), onError: (e) => notifyError(e) })
                                    }
                                >
                                    {t('common.save')}
                            </Button>
                            </Group>
                        </SettingsCardShared.Bottom>
                    </SettingsCardShared.Container>
                </Tabs.Panel>
                <Tabs.Panel value="backup">
                    <BackupPanel />
                </Tabs.Panel>
                <Tabs.Panel value="tokens">
                    <ApiTokensPanel />
                </Tabs.Panel>
                <Tabs.Panel value="audit">
                    <DataTableCard
                        storageKey="audit"
                        icon={<PiListMagnifyingGlassDuotone size={24} />}
                        title={t('backup.cat.audit.title')}
                        description={t('settings.audit_hint')}
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
