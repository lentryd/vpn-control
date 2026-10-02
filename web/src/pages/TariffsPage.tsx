import {
    ActionIcon,
    ActionIconGroup,
    Box,
    Indicator,
    Alert,
    Badge,
    Button,
    Switch,
    Drawer,
    Group,
    MultiSelect,
    NumberInput,
    Radio,
    Select,
    SimpleGrid,
    Stack,
    Tabs,
    Text,
    Textarea,
    TextInput
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
    PiCalendarDuotone,
    PiClockDuotone,
    PiPencilSimple,
    PiPlus,
    PiPuzzlePieceDuotone,
    PiSortAscending,
    PiStackDuotone,
    PiTagDuotone,
    PiTextAa,
    PiTrash
} from 'react-icons/pi'
import { TbChartLine, TbCirclesRelation, TbDevices, TbTags } from 'react-icons/tb'
import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import { useMemo, useState } from 'react'

import { api } from '@/api/client'
import { useAddons, useApiMutation, useInvalidateAll, useSquads, useTariffs } from '@/api/hooks'
import type { Addon, Tariff } from '@/api/types'
import { durationLabel, fmtBytes, fmtMoney, GB, STRATEGIES, strategyLabel } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { PageHeader } from '@/components/ui'
import { openAddonModal } from '@/modals/AddonModal'
import { confirmDanger } from '@/modals/open'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { Page } from '@shared/ui/page'
import { FormFooter, FormSection } from '@shared/ui/forms/form-section'
import { DataTableCard } from '@shared/ui/table'
import { CurrencyIcon } from '@shared/currencies'
import { useTranslation } from 'react-i18next'

type Draft = Partial<Tariff> & { kind: 'base' | 'addon' }

export function TariffsPage() {
    const { t } = useTranslation()
    const tariffs = useTariffs()
    const addons = useAddons()
    const [draft, setDraft] = useState<Draft | null>(null)
    const base = (tariffs.data ?? []).filter((t) => t.kind === 'base')
    const addonTariffs = (tariffs.data ?? []).filter((t) => t.kind === 'addon')
    const invalidate = useInvalidateAll()
    const deleteAddon = (a: Addon) =>
        confirmDanger(t('tariffs.delete_addon', { name: a.name }), t('tariffs.delete_addon_hint'), async () => {
            try {
                await api.del(`addons/${a.id}`)
                await invalidate()
            } catch (e) {
                notifyError(e)
            }
        })

    return (
        <Page title={t('menu.tariffs_addons')}>
            <PageHeader
                icon={<TbTags size={24} />}
                title={t('menu.tariffs_addons')}
                description={t('tariffs.description')}
                actions={
                    <Group gap="xs">
                        <Button color="grape" leftSection={<PiPlus size={16} />} onClick={() => openAddonModal()} variant="soft">
                            {t('tariffs.addon')}
                        </Button>
                        <Button color="teal" leftSection={<PiPlus size={16} />} onClick={() => setDraft({ kind: 'base', active: true })} variant="soft">
                            {t('tariffs.tariff')}
                        </Button>
                    </Group>
                }
            />
            <Tabs defaultValue="base">
                <Tabs.List mb="md">
                    <Tabs.Tab value="base">{t('tariffs.tab_base', { count: base.length })}</Tabs.Tab>
                    <Tabs.Tab value="addons">{t('tariffs.tab_addons', { count: addonTariffs.length })}</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="base">
                    <TariffTable
                        description={t('tariffs.base_hint')}
                        icon={<PiTagDuotone size={24} />}
                        loading={!tariffs.data}
                        onEdit={(t) => setDraft(t)}
                        rows={base}
                        storageKey="tariffs-base"
                        title={t('tariffs.base_title')}
                    />
                </Tabs.Panel>
                <Tabs.Panel value="addons">
                    <Stack>
                        {(addons.data ?? []).length === 0 && (
                            <Alert color="gray">
                                {t('tariffs.no_addons')}
                            </Alert>
                        )}
                        {(addons.data ?? []).map((a) => (
                            <TariffTable
                                key={a.id}
                                actions={
                                    <Group gap="xs">
                                        {a.source === 'ui' && (
                                            <>
                                                <ActionIcon color="gray" onClick={() => openAddonModal(a)} variant="subtle">
                                                    <PiPencilSimple size={16} />
                                                </ActionIcon>
                                                <ActionIcon color="red" onClick={() => deleteAddon(a)} variant="subtle">
                                                    <PiTrash size={16} />
                                                </ActionIcon>
                                            </>
                                        )}
                                        <Button
                                            color="grape"
                                            leftSection={<PiPlus size={14} />}
                                            onClick={() => setDraft({ kind: 'addon', addon_id: a.id, active: true, manage_rw: true })}
                                            size="xs"
                                            variant="soft"
                                        >
                                            {t('tariffs.addon_tariff')}
                                        </Button>
                                    </Group>
                                }
                                description={t('tariffs.addon_user', { name: `${a.prefix}<username>${a.suffix}` })}
                                icon={<PiPuzzlePieceDuotone size={24} />}
                                onEdit={(t) => setDraft(t)}
                                rows={addonTariffs.filter((t) => t.addon_id === a.id)}
                                storageKey="tariffs-addon"
                                title={
                                    <Group gap="xs">
                                        {a.name}
                                        {a.source === 'file' && (
                                            <Badge color="gray" variant="soft">
                                                {a.in_config ? t('tariffs.from_file') : t('tariffs.removed_from_file')}
                                            </Badge>
                                        )}
                                    </Group>
                                }
                            />
                        ))}
                    </Stack>
                </Tabs.Panel>
            </Tabs>
            <Drawer
                opened={!!draft}
                onClose={() => setDraft(null)}
                position="right"
                size="lg"
                title={
                    <BaseOverlayHeader
                        IconComponent={PiTagDuotone}
                        subtitle={draft?.id ? draft.name : undefined}
                        title={draft?.id ? t('tariffs.tariff') : t('tariffs.new_tariff')}
                    />
                }
            >
                {draft && <TariffForm draft={draft} addons={addons.data ?? []} onDone={() => setDraft(null)} />}
            </Drawer>
        </Page>
    )
}

function TariffTable({
    rows,
    onEdit,
    storageKey,
    icon,
    title,
    description,
    actions,
    loading
}: {
    rows: Tariff[]
    onEdit: (t: Tariff) => void
    storageKey: string
    icon: React.ReactNode
    title: React.ReactNode
    description?: string
    actions?: React.ReactNode
    loading?: boolean
}) {
    const { t } = useTranslation()
    const invalidate = useInvalidateAll()
    const remove = (tf: Tariff) =>
        confirmDanger(t('tariffs.delete', { name: tf.name }), t('tariffs.delete_hint'), async () => {
            try {
                await api.del(`tariffs/${tf.id}`)
                await invalidate()
            } catch (e) {
                notifyError(e)
            }
        })

    const columns = useMemo<MRT_ColumnDef<Tariff>[]>(
        () => [
            {
                accessorKey: 'name',
                header: t('tariffs.col_name'),
                size: 220,
                Cell: ({ row }) => (
                    <Group gap="md" pl={10} wrap="nowrap">
                        <Indicator color={row.original.active ? 'teal' : 'gray'} inline size={10} zIndex={0} />
                        <Box miw={0}>
                            <Text fw={500} size="sm" truncate="end">
                                {row.original.name}
                            </Text>
                            <Text c="dimmed" fw={600} size="xs" truncate="end">
                                {row.original.description || (row.original.active ? t('tariffs.active') : t('tariffs.hidden'))}
                            </Text>
                            {row.original.included_addon_tariff_ids?.length > 0 && (
                                <Badge color="grape" leftSection={<PiPuzzlePieceDuotone size={12} />} mt={2} size="xs" variant="soft">
                                    {t('tariffs.plus_addons', { count: row.original.included_addon_tariff_ids.length })}
                                </Badge>
                            )}
                        </Box>
                    </Group>
                )
            },
            {
                accessorKey: 'monthly_price',
                header: t('tariffs.col_price'),
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ cell }) => (
                    <Text ff="monospace" fw={600} size="sm">
                        {fmtMoney(cell.getValue<number>())}
                    </Text>
                )
            },
            {
                id: 'periods',
                header: t('tariffs.col_periods'),
                enableSorting: false,
                accessorFn: (t) => t.periods.length,
                Cell: ({ row }) =>
                    row.original.periods.length ? (
                        <Group gap={4}>
                            {row.original.periods.map((p) => (
                                <Badge key={`${p.months}:${p.days}`} variant="soft">
                                    {durationLabel(p.months, p.days)} · {fmtMoney(p.price)}
                                </Badge>
                            ))}
                        </Group>
                    ) : (
                        <Text c="dimmed">–</Text>
                    )
            },
            {
                id: 'rw',
                header: t('tariffs.col_panel'),
                size: 280,
                enableSorting: false,
                accessorFn: (t) => t.manage_rw,
                Cell: ({ row }) => {
                    const tf = row.original
                    if (!tf.manage_rw) return <Text c="dimmed" size="xs">{t('tariffs.not_managed')}</Text>
                    return (
                        <Group gap={4}>
                            <Badge color="violet" variant="soft">
                                {tf.traffic_limit_bytes ? fmtBytes(tf.traffic_limit_bytes) : '∞'}
                            </Badge>
                            <Badge color="gray" variant="soft">
                                {strategyLabel(tf.traffic_strategy)}
                            </Badge>
                            {tf.hwid_limit !== null && (
                                <Badge color="indigo" variant="soft">
                                    {t('tariffs.devices', { count: tf.hwid_limit })}
                                </Badge>
                            )}
                            <Badge variant="soft">{t('tariffs.squads', { count: tf.squad_uuids.length })}</Badge>
                        </Group>
                    )
                }
            },
            {
                accessorKey: 'subscribers',
                header: t('tariffs.col_subscribers'),
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ row }) => (
                    <Text fw={600} size="sm">
                        {row.original.subscribers}
                        {row.original.overridden > 0 && (
                            <Text c="yellow" component="span" size="xs">{` ${t('tariffs.overridden', { count: row.original.overridden })}`}</Text>
                        )}
                    </Text>
                )
            },
            {
                accessorKey: 'mrr',
                header: 'MRR',
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ cell }) => (
                    <Text ff="monospace" fw={600} size="sm">
                        {fmtMoney(cell.getValue<number>())}
                    </Text>
                )
            }
        ],
        [t]
    )

    return (
        <DataTableCard
            actions={actions}
            columns={columns}
            compact
            data={rows}
            description={description}
            enableRowActions
            icon={icon}
            onRowClick={onEdit}
            renderRowActions={({ row }) => (
                <ActionIconGroup>
                    <ActionIcon color="cyan" onClick={() => onEdit(row.original)} size="lg" variant="soft">
                        <PiPencilSimple size={18} />
                    </ActionIcon>
                    <ActionIcon color="red" onClick={() => remove(row.original)} size="lg" variant="soft">
                        <PiTrash size={18} />
                    </ActionIcon>
                </ActionIconGroup>
            )}
            displayColumnDefOptions={{ 'mrt-row-actions': { header: '', size: 110 } }}
            state={{ isLoading: loading }}
            storageKey={storageKey}
            title={title}
        />
    )
}

function TariffForm({ draft, addons, onDone }: { draft: Draft; addons: Addon[]; onDone: () => void }) {
    const { t } = useTranslation()
    const squads = useSquads()
    const tariffs = useTariffs()
    const addonTariffs = (tariffs.data ?? []).filter((t) => t.kind === 'addon')
    const form = useForm({
        initialValues: {
            kind: draft.kind,
            addon_id: draft.addon_id ? String(draft.addon_id) : null,
            name: draft.name ?? '',
            description: draft.description ?? '',
            monthly_price: draft.monthly_price ?? 0,
            active: draft.active ?? true,
            sort_order: draft.sort_order ?? 0,
            manage_rw: draft.manage_rw ?? false,
            traffic_gb: draft.traffic_limit_bytes ? Math.round((draft.traffic_limit_bytes / GB) * 100) / 100 : 0,
            traffic_strategy: draft.traffic_strategy ?? 'NO_RESET',
            hwid_limit: draft.hwid_limit ?? ('' as number | ''),
            squad_uuids: draft.squad_uuids ?? [],
            periods: (draft.periods ?? []).map((p) => ({ ...p, days: p.days ?? 0 })),
            included: (draft.included_addon_tariff_ids ?? []).map(String),
            // what to do with current subscribers when included add-ons change
            sync_included: 'skip' as 'skip' | 'disable' | 'keep_paid',
            price_change: 'keep'
        },
        validate: {
            name: (v) => (v.trim() ? null : t('tariffs.name_required')),
            addon_id: (v, vals) => (vals.kind === 'addon' && !v ? t('errors.tariff.addon_required') : null),
            included: (v) => {
                const ids = v.map((id) => addonTariffs.find((t) => String(t.id) === id)?.addon_id)
                return new Set(ids).size === ids.length ? null : t('tariffs.one_per_addon')
            }
        }
    })
    const priceChanged = !!draft.id && form.values.monthly_price !== draft.monthly_price && (draft.subscribers ?? 0) > 0

    const m = useApiMutation((v: typeof form.values) => {
        const body = {
            kind: v.kind,
            addon_id: v.addon_id ? Number(v.addon_id) : null,
            name: v.name.trim(),
            description: v.description,
            monthly_price: v.monthly_price,
            active: v.active,
            sort_order: v.sort_order,
            manage_rw: v.manage_rw,
            traffic_limit_bytes: Math.round(v.traffic_gb * GB),
            traffic_strategy: v.traffic_strategy,
            hwid_limit: v.hwid_limit === '' ? null : Number(v.hwid_limit),
            squad_uuids: v.squad_uuids,
            periods: v.periods.filter((p) => p.months + p.days > 0 && !(p.months === 1 && !p.days)),
            included_addon_tariff_ids: v.kind === 'base' ? v.included.map(Number) : [],
            price_change: v.price_change
        }
        if (!draft.id) return api.post('tariffs', body)
        return api.put(`tariffs/${draft.id}`, body).then(() =>
            includedChanged && v.sync_included !== 'skip'
                ? api.post(`tariffs/${draft.id}/sync-included`, { removed: v.sync_included })
                : undefined
        )
    })
    const includedChanged =
        !!draft.id &&
        (draft.subscribers ?? 0) > 0 &&
        [...form.values.included].sort().join() !== (draft.included_addon_tariff_ids ?? []).map(String).sort().join()

    return (
        <form
            onSubmit={form.onSubmit((v) =>
                m.mutate(v, {
                    onSuccess: () => {
                        notifyOk(t('tariffs.saved'))
                        onDone()
                    },
                    onError: (e) => notifyError(e)
                })
            )}
        >
            <Stack gap="md">
                <FormSection icon={PiTagDuotone} title={t('tariffs.tariff')} description={t('tariffs.section_main')}>
                    <SimpleGrid cols={{ base: 1, xs: 2 }}>
                        <Select
                            label={t('tariffs.kind')}
                            leftSection={<PiStackDuotone size={16} />}
                            disabled={!!draft.id}
                            data={[
                                { value: 'base', label: t('tariffs.kind_base') },
                                { value: 'addon', label: t('tariffs.addon') }
                            ]}
                            {...form.getInputProps('kind')}
                        />
                        {form.values.kind === 'addon' && (
                            <Select
                                label={t('tariffs.addon')}
                                leftSection={<PiPuzzlePieceDuotone size={16} />}
                                disabled={!!draft.id}
                                data={addons.map((a) => ({ value: String(a.id), label: a.name }))}
                                {...form.getInputProps('addon_id')}
                            />
                        )}
                    </SimpleGrid>
                    <TextInput label={t('tariffs.col_name')} leftSection={<PiTextAa size={16} />} required {...form.getInputProps('name')} />
                    <Textarea label={t('tariffs.description_label')} autosize minRows={2} {...form.getInputProps('description')} />
                    {form.values.kind === 'base' && (
                        <MultiSelect
                            label={t('tariffs.included')}
                            description={t('tariffs.included_hint')}
                            leftSection={<PiPuzzlePieceDuotone size={16} />}
                            placeholder={addonTariffs.length ? t('tariffs.no_included') : t('tariffs.no_addon_tariffs')}
                            data={addonTariffs.map((t) => ({ value: String(t.id), label: `${t.addon_name} · ${t.name}` }))}
                            clearable
                            {...form.getInputProps('included')}
                        />
                    )}
                    {includedChanged && (
                        <Select
                            label={t('tariffs.current_subscribers')}
                            description={t('tariffs.subscribers_count', { count: draft.subscribers })}
                            leftSection={<PiPuzzlePieceDuotone size={16} />}
                            data={[
                                { value: 'skip', label: t('tariffs.sync_skip') },
                                { value: 'disable', label: t('tariffs.sync_disable') },
                                { value: 'keep_paid', label: t('tariffs.sync_keep') }
                            ]}
                            allowDeselect={false}
                            {...form.getInputProps('sync_included')}
                        />
                    )}
                    <SimpleGrid cols={{ base: 1, xs: 2 }}>
                        <NumberInput
                            label={t('tariffs.monthly_price')}
                            leftSection={<CurrencyIcon size={16} />}
                            min={0}
                            decimalScale={2}
                            {...form.getInputProps('monthly_price')}
                        />
                        <NumberInput label={t('tariffs.sort_order')} leftSection={<PiSortAscending size={16} />} {...form.getInputProps('sort_order')} />
                    </SimpleGrid>
                    {priceChanged && (
                        <Radio.Group label={t('tariffs.price_changes', { count: draft.subscribers })} {...form.getInputProps('price_change')}>
                            <Stack gap={6} mt={6}>
                                <Radio value="keep" label={t('tariffs.price_keep')} />
                                <Radio value="apply" label={t('tariffs.price_apply')} />
                            </Stack>
                        </Radio.Group>
                    )}
                    <Switch
                        label={t('tariffs.active_label')}
                        description={t('tariffs.active_hint')}
                        {...form.getInputProps('active', { type: 'checkbox' })}
                    />
                </FormSection>

                <FormSection
                    icon={PiCalendarDuotone}
                    color="teal"
                    title={t('tariffs.col_periods')}
                    description={t('tariffs.periods_hint')}
                    actions={
                        <Button
                            color="teal"
                            leftSection={<PiPlus size={14} />}
                            onClick={() => form.insertListItem('periods', { months: 3, days: 0, price: form.values.monthly_price * 3 })}
                            size="xs"
                            variant="soft"
                        >
                            {t('tariffs.period')}
                        </Button>
                    }
                >
                    {form.values.periods.length === 0 && (
                        <Text c="dimmed" size="sm">
                            {t('tariffs.no_periods')}
                        </Text>
                    )}
                    {form.values.periods.map((_, i) => (
                        <Group key={i} wrap="nowrap" align="flex-end">
                            <NumberInput
                                label={t('tariffs.months')}
                                leftSection={<PiCalendarDuotone size={16} />}
                                min={0}
                                max={36}
                                {...form.getInputProps(`periods.${i}.months`)}
                            />
                            <NumberInput
                                label={t('tariffs.days')}
                                leftSection={<PiClockDuotone size={16} />}
                                min={0}
                                max={365}
                                {...form.getInputProps(`periods.${i}.days`)}
                            />
                            <NumberInput
                                label={t('tariffs.period_price')}
                                leftSection={<CurrencyIcon size={16} />}
                                min={0}
                                decimalScale={2}
                                {...form.getInputProps(`periods.${i}.price`)}
                            />
                            <ActionIcon color="red" variant="soft" size="input-sm" onClick={() => form.removeListItem('periods', i)}>
                                <PiTrash size={16} />
                            </ActionIcon>
                        </Group>
                    ))}
                </FormSection>

                <FormSection icon={TbChartLine} color="violet" title={t('tariffs.panel_section')} description={t('tariffs.panel_section_hint')}>
                    <Switch
                        label={t('tariffs.manage_rw')}
                        description={t('tariffs.manage_rw_hint')}
                        {...form.getInputProps('manage_rw', { type: 'checkbox' })}
                    />
                    {form.values.manage_rw && (
                        <>
                            <SimpleGrid cols={{ base: 1, xs: 2 }}>
                                <NumberInput
                                    label={t('tariffs.traffic_limit')}
                                    description={t('tariffs.traffic_limit_hint')}
                                    leftSection={<TbChartLine size={16} />}
                                    min={0}
                                    decimalScale={2}
                                    {...form.getInputProps('traffic_gb')}
                                />
                                <Select
                                    label={t('tariffs.traffic_reset')}
                                    description={t('tariffs.traffic_reset_hint')}
                                    leftSection={<PiClockDuotone size={16} />}
                                    data={STRATEGIES.map((value) => ({ value, label: strategyLabel(value) }))}
                                    {...form.getInputProps('traffic_strategy')}
                                />
                            </SimpleGrid>
                            <NumberInput
                                label={t('tariffs.hwid')}
                                description={t('tariffs.hwid_hint')}
                                leftSection={<TbDevices size={16} />}
                                min={0}
                                {...form.getInputProps('hwid_limit')}
                            />
                            <MultiSelect
                                label={t('tariffs.squads_label')}
                                leftSection={<TbCirclesRelation size={16} />}
                                placeholder={squads.isPending ? t('common.loading') : t('tariffs.choose')}
                                data={(squads.data ?? []).map((s) => ({ value: s.uuid, label: s.name, members: s.info.membersCount }))}
                                renderOption={({ option }) => {
                                    const sq = squads.data?.find((x) => x.uuid === option.value)
                                    return (
                                        <Group flex="1" gap="xs" wrap="nowrap">
                                            <Text size="sm" truncate="end">
                                                {option.label}
                                            </Text>
                                            <Badge color="gray" ml="auto" size="sm" variant="light">
                                                {sq?.info.membersCount ?? 0}
                                            </Badge>
                                        </Group>
                                    )
                                }}
                                searchable
                                {...form.getInputProps('squad_uuids')}
                            />
                            {squads.error && <Alert color="red" variant="soft">{squads.error.message}</Alert>}
                        </>
                    )}
                </FormSection>
                <FormFooter inline loading={m.isPending} onCancel={onDone} />
            </Stack>
        </form>
    )
}
