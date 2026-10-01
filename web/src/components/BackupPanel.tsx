import { Alert, Anchor, Badge, Button, Checkbox, FileButton, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { PiArchiveDuotone, PiDownloadSimpleDuotone, PiUploadSimpleDuotone, PiWarningDuotone } from 'react-icons/pi'

import { api } from '@/api/client'
import { useApiMutation } from '@/api/hooks'
import { fmtDateTime } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { confirmDanger } from '@/modals/open'
import { SettingsCardShared } from '@shared/ui/settings-card'

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

const useBackupCategories = () =>
    useQuery({
        queryKey: ['backup', 'categories'],
        queryFn: () => api.get<{ categories: BackupCategory[]; counts: Record<string, number> }>('backup/categories')
    })

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
    const allKeys = categories.map((c) => c.key)
    const titleOf = (key: string) => categories.find((c) => c.key === key)?.title ?? key
    return (
        <Stack gap="xs">
            <Group gap="xs">
                <Anchor component="button" size="sm" onClick={() => onChange(allKeys)}>
                    Выбрать всё
                </Anchor>
                <Text c="dimmed" size="sm">
                    ·
                </Text>
                <Anchor component="button" size="sm" onClick={() => onChange([])}>
                    Снять всё
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
                                                Ссылается на: {missing.map(titleOf).join(', ')}
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
                description="Скачайте zip-архив с выбранными данными — для бэкапа или переноса на другую установку"
                icon={<PiDownloadSimpleDuotone size={24} />}
                iconColor="teal"
                iconVariant="soft"
                title="Экспорт"
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
                        Скачать архив
                    </Button>
                </Group>
            </SettingsCardShared.Bottom>
        </SettingsCardShared.Container>
    )
}

function ImportCard({ categories }: { categories: BackupCategory[] }) {
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
            'Импорт данных',
            <Text size="sm">
                Данные в категориях <b>{titles.join(', ')}</b> будут полностью заменены содержимым архива. Текущие данные этих категорий
                сохранятся на сервере в <Text span ff="monospace">data/backups/</Text>.
            </Text>,
            () =>
                importMut.mutate(
                    { file, categories: selected },
                    {
                        onSuccess: (res) => {
                            const rows = Object.values(res.report.tables).reduce((a, b) => a + b, 0)
                            notifyOk(`Импортировано записей: ${rows}. Снимок до импорта: ${res.snapshot}`)
                            setFile(null)
                            setInfo(null)
                        },
                        onError: (e) => notifyError(e)
                    }
                ),
            'Импортировать'
        )
    }

    return (
        <SettingsCardShared.Container>
            <SettingsCardShared.Header
                description="Загрузите архив, созданный экспортом, и выберите, что из него восстановить"
                icon={<PiUploadSimpleDuotone size={24} />}
                iconColor="orange"
                iconVariant="soft"
                title="Импорт"
            />
            <SettingsCardShared.Content>
                <Stack>
                    <Group>
                        <FileButton accept=".zip,application/zip" onChange={pick}>
                            {(props) => (
                                <Button {...props} color="gray" leftSection={<PiArchiveDuotone size={16} />} loading={inspecting} variant="soft">
                                    Выбрать архив
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
                                Создан {fmtDateTime(info.manifest.created_at)}
                                {info.manifest.app_version && `, версия ${info.manifest.app_version}`}
                            </Text>
                            <CategoryPicker
                                categories={available}
                                counts={(c) => rowsOf(c, info.manifest.tables)}
                                value={selected}
                                onChange={setSelected}
                            />
                            <Alert color="yellow" icon={<PiWarningDuotone />} variant="soft">
                                Выбранные категории заменяются целиком. Если в архиве есть записи, ссылающиеся на отсутствующие данные (например,
                                подписки без клиентов), импорт будет отменён без изменений.
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
                        Импортировать
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
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <ExportCard categories={q.data.categories} counts={q.data.counts} />
            <ImportCard categories={q.data.categories} />
        </SimpleGrid>
    )
}
