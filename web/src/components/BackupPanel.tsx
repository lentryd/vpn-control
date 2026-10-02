import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import { ActionIcon, Alert, Anchor, Badge, Button, Checkbox, FileButton, Group, NumberInput, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState, useCallback } from 'react'
import {
    PiArchiveDuotone,
    PiArrowCounterClockwise,
    PiCameraDuotone,
    PiDownloadSimple,
    PiDownloadSimpleDuotone,
    PiFloppyDiskDuotone,
    PiPlus,
    PiTrash,
    PiUploadSimpleDuotone,
    PiWarningDuotone
} from 'react-icons/pi'

import { api } from '@/api/client'
import { useApiMutation, useInvalidateAll, useSettings } from '@/api/hooks'
import { fmtBytes, fmtDateTime } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { confirmDanger, openModal } from '@/modals/open'
import { FormFooter } from '@shared/ui/forms/form-section'
import { DataTableCard } from '@shared/ui/table'
import { SettingsCardShared } from '@shared/ui/settings-card'
import { useTranslation } from 'react-i18next'

interface BackupCategory {
    key: string
    title: string
    description: string
    tables: string[]
    depends_on?: string[]
}

interface Manifest {
    app_version: string
    created_at: string
    categories: string[]
    tables: Record<string, number>
}

interface Inspected {
    manifest: Manifest
    available: string[]
}

interface ImportResult {
    report: { tables: Record<string, number>; skipped: string[] }
    snapshot: string
}

const CATEGORY_KEYS = ['customers', 'tariffs', 'subscriptions', 'payments', 'expenses', 'settings', 'stats', 'audit'] as const

// useBackupCategories loads the categories with titles in the UI language
// (the server's English ones are the fallback for unknown keys).
function useBackupCategories() {
    const { t } = useTranslation()
    const select = useCallback(
        (d: { categories: BackupCategory[]; counts: Record<string, number> }) => ({
            ...d,
            categories: d.categories.map((c) =>
                (CATEGORY_KEYS as readonly string[]).includes(c.key)
                    ? {
                          ...c,
                          title: t(`backup.cat.${c.key as (typeof CATEGORY_KEYS)[number]}.title`),
                          description: t(`backup.cat.${c.key as (typeof CATEGORY_KEYS)[number]}.description`)
                      }
                    : c
            )
        }),
        [t]
    )
    return useQuery({
        queryKey: ['backup', 'categories'],
        queryFn: () => api.get<{ categories: BackupCategory[]; counts: Record<string, number> }>('backup/categories'),
        select
    })
}

const rowsOf = (c: BackupCategory, tables: Record<string, number>) => c.tables.reduce((n, t) => n + (tables[t] ?? 0), 0)

// CategoryPicker is a checkbox list of backup categories with row counts.
function CategoryPicker({
    categories,
    counts,
    value,
    onChange
}: {
    categories: BackupCategory[]
    counts: (c: BackupCategory) => number
    value: string[]
    onChange: (v: string[]) => void
}) {
    const { t } = useTranslation()
    const allKeys = categories.map((c) => c.key)
    const titleOf = (key: string) => categories.find((c) => c.key === key)?.title ?? key
    return (
        <Stack gap="xs">
            <Group gap="xs">
                <Anchor component="button" size="sm" onClick={() => onChange(allKeys)}>
                    {t('backup.select_all')}
                </Anchor>
                <Text c="dimmed" size="sm">
                    ·
                </Text>
                <Anchor component="button" size="sm" onClick={() => onChange([])}>
                    {t('backup.select_none')}
                </Anchor>
            </Group>
            <Checkbox.Group value={value} onChange={onChange}>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    {categories.map((c) => {
                        const missing = value.includes(c.key) ? (c.depends_on ?? []).filter((d) => !value.includes(d)) : []
                        return (
                            <Checkbox
                                key={c.key}
                                value={c.key}
                                label={
                                    <Group gap={6} wrap="nowrap">
                                        <span>{c.title}</span>
                                        <Badge color="gray" size="xs" variant="soft">
                                            {counts(c)}
                                        </Badge>
                                    </Group>
                                }
                                description={
                                    <>
                                        {c.description}
                                        {missing.length > 0 && (
                                            <Text c="yellow" component="span" display="block" size="xs">
                                                {t('backup.references', { list: missing.map(titleOf).join(', ') })}
                                            </Text>
                                        )}
                                    </>
                                }
                            />
                        )
                    })}
                </SimpleGrid>
            </Checkbox.Group>
        </Stack>
    )
}

function ExportCard({ categories, counts }: { categories: BackupCategory[]; counts: Record<string, number> }) {
    const { t } = useTranslation()
    const [selected, setSelected] = useState(() => categories.map((c) => c.key))
    const [busy, setBusy] = useState(false)

    const run = async () => {
        setBusy(true)
        try {
            await api.download(`backup/export?categories=${selected.join(',')}`, 'vpn-control-backup.zip')
        } catch (e) {
            notifyError(e)
        } finally {
            setBusy(false)
        }
    }

    return (
        <SettingsCardShared.Container>
            <SettingsCardShared.Header
                description={t('backup.export_hint')}
                icon={<PiDownloadSimpleDuotone size={24} />}
                iconColor="teal"
                iconVariant="soft"
                title={t('backup.export')}
            />
            <SettingsCardShared.Content>
                <CategoryPicker categories={categories} counts={(c) => counts[c.key] ?? 0} value={selected} onChange={setSelected} />
            </SettingsCardShared.Content>
            <SettingsCardShared.Bottom>
                <Group justify="flex-end">
                    <Button
                        color="teal"
                        disabled={selected.length === 0}
                        leftSection={<PiArchiveDuotone size={16} />}
                        loading={busy}
                        mt="md"
                        variant="soft"
                        onClick={run}
                    >
                        {t('backup.download_archive')}
                    </Button>
                </Group>
            </SettingsCardShared.Bottom>
        </SettingsCardShared.Container>
    )
}

function ImportCard({ categories }: { categories: BackupCategory[] }) {
    const { t } = useTranslation()
    const [file, setFile] = useState<File | null>(null)
    const [info, setInfo] = useState<Inspected | null>(null)
    const [selected, setSelected] = useState<string[]>([])
    const [inspecting, setInspecting] = useState(false)

    const importMut = useApiMutation((v: { file: File; categories: string[] }) => {
        const form = new FormData()
        form.append('file', v.file)
        form.append('categories', v.categories.join(','))
        return api.upload<ImportResult>('backup/import', form)
    })

    const pick = async (f: File | null) => {
        setFile(f)
        setInfo(null)
        if (!f) return
        setInspecting(true)
        try {
            const form = new FormData()
            form.append('file', f)
            const res = await api.upload<Inspected>('backup/inspect', form)
            setInfo(res)
            setSelected(res.available)
        } catch (e) {
            setFile(null)
            notifyError(e)
        } finally {
            setInspecting(false)
        }
    }

    const available = categories.filter((c) => info?.available.includes(c.key))
    const titles = available.filter((c) => selected.includes(c.key)).map((c) => c.title)

    const run = () => {
        if (!file) return
        confirmDanger(
            t('backup.import_title'),
            <Text size="sm">{t('backup.import_confirm', { list: titles.join(', ') })}</Text>,
            () =>
                importMut.mutate(
                    { file, categories: selected },
                    {
                        onSuccess: (res) => {
                            const rows = Object.values(res.report.tables).reduce((a, b) => a + b, 0)
                            notifyOk(t('backup.imported', { rows, snapshot: res.snapshot }))
                            setFile(null)
                            setInfo(null)
                        },
                        onError: (e) => notifyError(e)
                    }
                ),
            t('backup.import_action')
        )
    }

    return (
        <SettingsCardShared.Container>
            <SettingsCardShared.Header
                description={t('backup.import_hint')}
                icon={<PiUploadSimpleDuotone size={24} />}
                iconColor="orange"
                iconVariant="soft"
                title={t('backup.import')}
            />
            <SettingsCardShared.Content>
                <Stack>
                    <Group>
                        <FileButton accept=".zip,application/zip" onChange={pick}>
                            {(props) => (
                                <Button {...props} color="gray" leftSection={<PiArchiveDuotone size={16} />} loading={inspecting} variant="soft">
                                    {t('backup.choose_archive')}
                                </Button>
                            )}
                        </FileButton>
                        {file && (
                            <Text c="dimmed" size="sm" truncate maw={320}>
                                {file.name}
                            </Text>
                        )}
                    </Group>
                    {info && (
                        <>
                            <Text c="dimmed" size="sm">
                                {t('backup.created_at', { date: fmtDateTime(info.manifest.created_at) })}
                                {info.manifest.app_version && t('backup.version', { version: info.manifest.app_version })}
                            </Text>
                            <CategoryPicker
                                categories={available}
                                counts={(c) => rowsOf(c, info.manifest.tables)}
                                value={selected}
                                onChange={setSelected}
                            />
                            <Alert color="yellow" icon={<PiWarningDuotone />} variant="soft">
                                {t('backup.import_warning')}
                            </Alert>
                        </>
                    )}
                </Stack>
            </SettingsCardShared.Content>
            <SettingsCardShared.Bottom>
                <Group justify="flex-end">
                    <Button
                        color="orange"
                        disabled={!info || selected.length === 0}
                        leftSection={<PiUploadSimpleDuotone size={16} />}
                        loading={importMut.isPending}
                        mt="md"
                        variant="soft"
                        onClick={run}
                    >
                        {t('backup.import_action')}
                    </Button>
                </Group>
            </SettingsCardShared.Bottom>
        </SettingsCardShared.Container>
    )
}

interface Snapshot {
    name: string
    kind: 'auto' | 'manual' | 'pre-import'
    size: number
    created_at: string
    app_version: string
    categories: string[]
}

const kindColor: Record<Snapshot['kind'], string> = { auto: 'cyan', manual: 'teal', 'pre-import': 'orange' }

const useSnapshots = () =>
    useQuery({ queryKey: ['backup', 'snapshots'], queryFn: () => api.get<{ snapshots: Snapshot[] }>('backup/snapshots') })

// SnapshotsCard lists the full backups kept on the server (scheduled,
// manual and pre-import ones) with download, restore and delete.
function SnapshotsCard({ categories }: { categories: BackupCategory[] }) {
    const { t } = useTranslation()
    const q = useSnapshots()
    const invalidate = useInvalidateAll()
    const create = useApiMutation(() => api.post<Snapshot>('backup/snapshots'))
    const remove = (sn: Snapshot) =>
        confirmDanger(t('backup.delete_snapshot', { name: sn.name }), t('backup.delete_snapshot_hint'), async () => {
            try {
                await api.del(`backup/snapshots/${sn.name}`)
                await invalidate()
            } catch (e) {
                notifyError(e)
            }
        })
    const columns = useMemo<MRT_ColumnDef<Snapshot>[]>(
        () => [
            { accessorKey: 'created_at', header: t('backup.col_created'), Cell: ({ cell }) => fmtDateTime(cell.getValue<string>()) },
            {
                accessorKey: 'kind',
                header: t('backup.col_kind'),
                filterVariant: 'multi-select',
                Cell: ({ row }) => (
                    <Badge color={kindColor[row.original.kind]} variant="soft">
                        {t(`backup.kind.${row.original.kind}`)}
                    </Badge>
                )
            },
            { accessorKey: 'size', header: t('backup.col_size'), enableColumnFilter: false, Cell: ({ cell }) => fmtBytes(cell.getValue<number>()) },
            {
                id: 'categories',
                header: t('backup.col_data'),
                enableSorting: false,
                accessorFn: (r) => r.categories.length,
                Cell: ({ row }) =>
                    row.original.categories.length === categories.length ? (
                        <Text size="sm">{t('backup.everything')}</Text>
                    ) : (
                        <Text size="sm">
                            {row.original.categories.map((k) => categories.find((c) => c.key === k)?.title ?? k).join(', ')}
                        </Text>
                    )
            }
        ],
        [categories, t]
    )
    return (
        <DataTableCard
            actions={
                <Button
                    color="teal"
                    leftSection={<PiPlus size={14} />}
                    loading={create.isPending}
                    onClick={() => create.mutate(undefined, { onSuccess: (sn) => notifyOk(t('backup.snapshot_created', { name: sn.name })), onError: (e) => notifyError(e) })}
                    size="xs"
                    variant="soft"
                >
                    {t('backup.snapshot')}
                </Button>
            }
            columns={columns}
            data={q.data?.snapshots ?? []}
            description={t('backup.snapshots_hint')}
            enableRowActions
            icon={<PiCameraDuotone size={24} />}
            initialState={{ sorting: [{ id: 'created_at', desc: true }] }}
            renderRowActions={({ row }) => (
                <Group gap={4} wrap="nowrap">
                    <Tooltip label={t('backup.download')}>
                        <ActionIcon
                            color="gray"
                            onClick={() => api.download(`backup/snapshots/${row.original.name}`, row.original.name).catch(notifyError)}
                            variant="subtle"
                        >
                            <PiDownloadSimple size={16} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('backup.restore')}>
                        <ActionIcon
                            color="orange"
                            onClick={() =>
                                openModal(
                                    { icon: PiArrowCounterClockwise, color: 'orange', title: t('backup.restore'), subtitle: row.original.name },
                                    (close) => <RestoreSnapshotForm categories={categories} name={row.original.name} onDone={close} />,
                                    'lg'
                                )
                            }
                            variant="subtle"
                        >
                            <PiArrowCounterClockwise size={16} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('common.delete')}>
                        <ActionIcon color="red" onClick={() => remove(row.original)} variant="subtle">
                            <PiTrash size={16} />
                        </ActionIcon>
                    </Tooltip>
                </Group>
            )}
            displayColumnDefOptions={{ 'mrt-row-actions': { header: '', size: 120 } }}
            state={{ isLoading: q.isPending }}
            storageKey="snapshots"
            title={t('backup.snapshots')}
        />
    )
}

function RestoreSnapshotForm({ name, categories, onDone }: { name: string; categories: BackupCategory[]; onDone: () => void }) {
    const { t } = useTranslation()
    const info = useQuery({ queryKey: ['backup', 'inspect', name], queryFn: () => api.get<Inspected>(`backup/snapshots/${name}/inspect`) })
    const [selected, setSelected] = useState<string[]>([])
    useEffect(() => {
        if (info.data) setSelected(info.data.available)
    }, [info.data])
    const m = useApiMutation(() => api.post<ImportResult>(`backup/snapshots/${name}/restore`, { categories: selected }))
    const available = categories.filter((c) => info.data?.available.includes(c.key))
    return (
        <Stack>
            {info.data && (
                <CategoryPicker
                    categories={available}
                    counts={(c) => rowsOf(c, info.data.manifest.tables)}
                    value={selected}
                    onChange={setSelected}
                />
            )}
            <Alert color="yellow" icon={<PiWarningDuotone />} variant="soft">
                {t('backup.restore_warning')}
            </Alert>
            <FormFooter
                disabled={!selected.length}
                inline
                loading={m.isPending}
                onCancel={onDone}
                onSubmit={() =>
                    m.mutate(undefined, {
                        onSuccess: (res) => {
                            notifyOk(t('backup.restored', { snapshot: res.snapshot }))
                            onDone()
                        },
                        onError: (e) => notifyError(e)
                    })
                }
                submitIcon={<PiArrowCounterClockwise size={16} />}
                submitLabel={t('backup.restore')}
            />
        </Stack>
    )
}

// ScheduleCard sets how often automatic snapshots are taken and kept.
function ScheduleCard() {
    const { t } = useTranslation()
    const settings = useSettings()
    const [hours, setHours] = useState<number | string>('')
    const [keep, setKeep] = useState<number | string>('')
    useEffect(() => {
        if (!settings.data) return
        setHours(Number(settings.data.snapshot_interval_hours))
        setKeep(Number(settings.data.snapshot_keep))
    }, [settings.data])
    const save = useApiMutation(() => api.put('settings', { snapshot_interval_hours: String(hours), snapshot_keep: String(keep) }))
    return (
        <SettingsCardShared.Container>
            <SettingsCardShared.Header
                description={t('backup.schedule_hint')}
                icon={<PiCameraDuotone size={24} />}
                iconColor="cyan"
                iconVariant="soft"
                title={t('backup.schedule')}
            />
            <SettingsCardShared.Content>
                <SimpleGrid cols={{ base: 1, xs: 2 }}>
                    <NumberInput label={t('backup.every_hours')} description={t('backup.every_hours_hint')} min={0} value={hours} onChange={setHours} />
                    <NumberInput label={t('backup.keep')} description={t('backup.keep_hint')} min={1} value={keep} onChange={setKeep} />
                </SimpleGrid>
            </SettingsCardShared.Content>
            <SettingsCardShared.Bottom>
                <Group justify="flex-end">
                    <Button
                        color="teal"
                        leftSection={<PiFloppyDiskDuotone size={16} />}
                        loading={save.isPending}
                        mt="md"
                        onClick={() => save.mutate(undefined, { onSuccess: () => notifyOk(t('common.saved')), onError: (e) => notifyError(e) })}
                        variant="soft"
                    >
                        {t('common.save')}
                    </Button>
                </Group>
            </SettingsCardShared.Bottom>
        </SettingsCardShared.Container>
    )
}

export function BackupPanel() {
    const q = useBackupCategories()
    if (!q.data) return null
    return (
        <Stack gap="md">
            <SnapshotsCard categories={q.data.categories} />
            <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
                <ScheduleCard />
                <ExportCard categories={q.data.categories} counts={q.data.counts} />
                <ImportCard categories={q.data.categories} />
            </SimpleGrid>
        </Stack>
    )
}
