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
import { durationLabel, fmtBytes, fmtMoney, GB, strategyLabel } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { PageHeader } from '@/components/ui'
import { confirmDanger } from '@/modals/open'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { Page } from '@shared/ui/page'
import { FormFooter, FormSection } from '@shared/ui/forms/form-section'
import { DataTableCard } from '@shared/ui/table'
import { CurrencyIcon } from '@shared/currencies'

type Draft = Partial<Tariff> & { kind: 'base' | 'addon' }

export function TariffsPage() {
    const tariffs = useTariffs()
    const addons = useAddons()
    const [draft, setDraft] = useState<Draft | null>(null)
    const base = (tariffs.data ?? []).filter((t) => t.kind === 'base')
    const addonTariffs = (tariffs.data ?? []).filter((t) => t.kind === 'addon')

    return (
        <Page title="Тарифы и аддоны">
            <PageHeader
                icon={<TbTags size={24} />}
                title="Тарифы и аддоны"
                description="Цены и параметры пользователей панели для базовых подписок и аддонов из addons.yml"
                actions={
                    <Button color="teal" leftSection={<PiPlus size={16} />} onClick={() => setDraft({ kind: 'base', active: true })} variant="soft">
                        Тариф
                    </Button>
                }
            />
            <Tabs defaultValue="base">
                <Tabs.List mb="md">
                    <Tabs.Tab value="base">Базовые ({base.length})</Tabs.Tab>
                    <Tabs.Tab value="addons">Аддоны ({addonTariffs.length})</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="base">
                    <TariffTable
                        description="Цена и параметры основной подписки"
                        icon={<PiTagDuotone size={24} />}
                        loading={!tariffs.data}
                        onEdit={(t) => setDraft(t)}
                        rows={base}
                        storageKey="tariffs-base"
                        title="Базовые тарифы"
                    />
                </Tabs.Panel>
                <Tabs.Panel value="addons">
                    <Stack>
                        {(addons.data ?? []).length === 0 && (
                            <Alert color="yellow">
                                Аддоны берутся из addons.yml сервиса subpage (переменная ADDONS_CONFIG). Файл не найден или пуст.
                            </Alert>
                        )}
                        {(addons.data ?? []).map((a) => (
                            <TariffTable
                                key={a.id}
                                actions={
                                    <Button
                                        color="grape"
                                        leftSection={<PiPlus size={14} />}
                                        onClick={() => setDraft({ kind: 'addon', addon_id: a.id, active: true, manage_rw: true })}
                                        size="xs"
                                        variant="soft"
                                    >
                                        Тариф аддона
                                    </Button>
                                }
                                description={`пользователь панели: ${a.prefix}<username>${a.suffix}`}
                                icon={<PiPuzzlePieceDuotone size={24} />}
                                onEdit={(t) => setDraft(t)}
                                rows={addonTariffs.filter((t) => t.addon_id === a.id)}
                                storageKey="tariffs-addon"
                                title={
                                    <Group gap="xs">
                                        {a.name}
                                        {!a.in_config && (
                                            <Badge color="red" variant="soft">
                                                нет в addons.yml
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
                        title={draft?.id ? 'Тариф' : 'Новый тариф'}
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
    const invalidate = useInvalidateAll()
    const remove = (t: Tariff) =>
        confirmDanger(`Удалить тариф «${t.name}»?`, 'Удалить можно только неиспользуемый тариф.', async () => {
            try {
                await api.del(`tariffs/${t.id}`)
                await invalidate()
            } catch (e) {
                notifyError(e)
            }
        })

    const columns = useMemo<MRT_ColumnDef<Tariff>[]>(
        () => [
            {
                accessorKey: 'name',
                header: 'Название',
                size: 220,
                Cell: ({ row }) => (
                    <Group gap="md" pl={10} wrap="nowrap">
                        <Indicator color={row.original.active ? 'teal' : 'gray'} inline size={10} zIndex={0} />
                        <Box miw={0}>
                            <Text fw={500} size="sm" truncate="end">
                                {row.original.name}
                            </Text>
                            <Text c="dimmed" fw={600} size="xs" truncate="end">
                                {row.original.description || (row.original.active ? 'активен' : 'скрыт')}
                            </Text>
                        </Box>
                    </Group>
                )
            },
            {
                accessorKey: 'monthly_price',
                header: 'Цена/мес',
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ cell }) => (
                    <Text ff="monospace" fw={600} size="sm">
                        {fmtMoney(cell.getValue<number>())}
                    </Text>
                )
            },
            {
                id: 'periods',
                header: 'Периоды',
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
                header: 'Параметры панели',
                size: 280,
                enableSorting: false,
                accessorFn: (t) => t.manage_rw,
                Cell: ({ row }) => {
                    const t = row.original
                    if (!t.manage_rw) return <Text c="dimmed" size="xs">не управляет</Text>
                    return (
                        <Group gap={4}>
                            <Badge color="violet" variant="soft">
                                {t.traffic_limit_bytes ? fmtBytes(t.traffic_limit_bytes) : '∞'}
                            </Badge>
                            <Badge color="gray" variant="soft">
                                {strategyLabel[t.traffic_strategy] ?? t.traffic_strategy}
                            </Badge>
                            {t.hwid_limit !== null && (
                                <Badge color="indigo" variant="soft">
                                    {t.hwid_limit} устр.
                                </Badge>
                            )}
                            <Badge variant="soft">сквадов {t.squad_uuids.length}</Badge>
                        </Group>
                    )
                }
            },
            {
                accessorKey: 'subscribers',
                header: 'Подписчиков',
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ row }) => (
                    <Text fw={600} size="sm">
                        {row.original.subscribers}
                        {row.original.overridden > 0 && (
                            <Text c="yellow" component="span" size="xs">{` (${row.original.overridden} инд.)`}</Text>
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
        []
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
    const squads = useSquads()
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
            price_change: 'keep'
        },
        validate: {
            name: (v) => (v.trim() ? null : 'Введите название'),
            addon_id: (v, vals) => (vals.kind === 'addon' && !v ? 'Выберите аддон' : null)
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
            price_change: v.price_change
        }
        return draft.id ? api.put(`tariffs/${draft.id}`, body) : api.post('tariffs', body)
    })

    return (
        <form
            onSubmit={form.onSubmit((v) =>
                m.mutate(v, {
                    onSuccess: () => {
                        notifyOk('Тариф сохранён')
                        onDone()
                    },
                    onError: (e) => notifyError(e)
                })
            )}
        >
            <Stack gap="md">
                <FormSection icon={PiTagDuotone} title="Тариф" description="Название и цена">
                    <SimpleGrid cols={{ base: 1, xs: 2 }}>
                        <Select
                            label="Тип"
                            leftSection={<PiStackDuotone size={16} />}
                            disabled={!!draft.id}
                            data={[
                                { value: 'base', label: 'Базовая подписка' },
                                { value: 'addon', label: 'Аддон' }
                            ]}
                            {...form.getInputProps('kind')}
                        />
                        {form.values.kind === 'addon' && (
                            <Select
                                label="Аддон"
                                leftSection={<PiPuzzlePieceDuotone size={16} />}
                                disabled={!!draft.id}
                                data={addons.map((a) => ({ value: String(a.id), label: a.name }))}
                                {...form.getInputProps('addon_id')}
                            />
                        )}
                    </SimpleGrid>
                    <TextInput label="Название" leftSection={<PiTextAa size={16} />} required {...form.getInputProps('name')} />
                    <Textarea label="Описание" autosize minRows={2} {...form.getInputProps('description')} />
                    <SimpleGrid cols={{ base: 1, xs: 2 }}>
                        <NumberInput
                            label="Цена в месяц"
                            leftSection={<CurrencyIcon size={16} />}
                            min={0}
                            decimalScale={2}
                            {...form.getInputProps('monthly_price')}
                        />
                        <NumberInput label="Порядок" leftSection={<PiSortAscending size={16} />} {...form.getInputProps('sort_order')} />
                    </SimpleGrid>
                    {priceChanged && (
                        <Radio.Group label={`Цена меняется, у тарифа ${draft.subscribers} подписчиков`} {...form.getInputProps('price_change')}>
                            <Stack gap={6} mt={6}>
                                <Radio value="keep" label="Оставить текущим подписчикам старую цену (запишется как индивидуальная)" />
                                <Radio value="apply" label="Применить новую цену ко всем" />
                            </Stack>
                        </Radio.Group>
                    )}
                    <Switch
                        label="Активен"
                        description="Доступен для подключения новым подписчикам"
                        {...form.getInputProps('active', { type: 'checkbox' })}
                    />
                </FormSection>

                <FormSection
                    icon={PiCalendarDuotone}
                    color="teal"
                    title="Периоды"
                    description="Скидка за несколько месяцев или пакет в днях (например пробная неделя)"
                    actions={
                        <Button
                            color="teal"
                            leftSection={<PiPlus size={14} />}
                            onClick={() => form.insertListItem('periods', { months: 3, days: 0, price: form.values.monthly_price * 3 })}
                            size="xs"
                            variant="soft"
                        >
                            Период
                        </Button>
                    }
                >
                    {form.values.periods.length === 0 && (
                        <Text c="dimmed" size="sm">
                            Без периодов: цена = месячная × число месяцев, дни — месячная / 30
                        </Text>
                    )}
                    {form.values.periods.map((_, i) => (
                        <Group key={i} wrap="nowrap" align="flex-end">
                            <NumberInput
                                label="Месяцев"
                                leftSection={<PiCalendarDuotone size={16} />}
                                min={0}
                                max={36}
                                {...form.getInputProps(`periods.${i}.months`)}
                            />
                            <NumberInput
                                label="Дней"
                                leftSection={<PiClockDuotone size={16} />}
                                min={0}
                                max={365}
                                {...form.getInputProps(`periods.${i}.days`)}
                            />
                            <NumberInput
                                label="Цена за период"
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

                <FormSection icon={TbChartLine} color="violet" title="Параметры в панели" description="Что выставлять пользователю при подключении и смене тарифа">
                    <Switch
                        label="Управлять параметрами пользователя"
                        description="Лимит трафика, стратегия сброса, HWID и сквады"
                        {...form.getInputProps('manage_rw', { type: 'checkbox' })}
                    />
                    {form.values.manage_rw && (
                        <>
                            <SimpleGrid cols={{ base: 1, xs: 2 }}>
                                <NumberInput
                                    label="Лимит трафика, ГБ"
                                    description="0 — без лимита"
                                    leftSection={<TbChartLine size={16} />}
                                    min={0}
                                    decimalScale={2}
                                    {...form.getInputProps('traffic_gb')}
                                />
                                <Select
                                    label="Сброс трафика"
                                    description="Когда обнулять счётчик"
                                    leftSection={<PiClockDuotone size={16} />}
                                    data={Object.entries(strategyLabel).map(([value, label]) => ({ value, label }))}
                                    {...form.getInputProps('traffic_strategy')}
                                />
                            </SimpleGrid>
                            <NumberInput
                                label="Лимит устройств (HWID)"
                                description="Пусто — как в панели по умолчанию"
                                leftSection={<TbDevices size={16} />}
                                min={0}
                                {...form.getInputProps('hwid_limit')}
                            />
                            <MultiSelect
                                label="Внутренние сквады"
                                leftSection={<TbCirclesRelation size={16} />}
                                placeholder={squads.isPending ? 'Загрузка…' : 'Выберите'}
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
