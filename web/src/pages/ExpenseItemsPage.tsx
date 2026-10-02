import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import {
    ActionIcon,
    Alert,
    Badge,
    Box,
    Button,
    Drawer,
    Group,
    Indicator,
    Menu,
    NumberInput,
    SegmentedControl,
    Select,
    SimpleGrid,
    Stack,
    Switch,
    Text,
    Textarea,
    TextInput,
    Tooltip
} from '@mantine/core'
import { DateInput, MonthPickerInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import {
    PiArrowsClockwise,
    PiBuildingsDuotone,
    PiCalendarCheckDuotone,
    PiCalendarDuotone,
    PiChartBar,
    PiChartBarDuotone,
    PiCoinsDuotone,
    PiCurrencyRub,
    PiLock,
    PiNotePencil,
    PiPencilSimple,
    PiPencilSimpleDuotone,
    PiPercent,
    PiPlus,
    PiTextAa,
    PiTrash,
    PiUsersDuotone
} from 'react-icons/pi'
import { TbCloudDataConnection, TbDots, TbServer2 } from 'react-icons/tb'

import { api } from '@/api/client'
import {
    useApiMutation,
    useExpenseItems,
    useInboundStatus,
    useInfra,
    useInvalidateAll,
    useMetered,
    useNodes,
    useSettings
} from '@/api/hooks'
import type { ExpenseItem } from '@/api/types'
import { expiryColor } from '@/components/badges'
import { fmtCurrency, fmtDate, fmtMoney, fmtNum } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { PageHeader } from '@/components/ui'
import { confirmDanger, openModal } from '@/modals/open'
import { MeteredCard } from '@/pages/DashboardPage'
import { FormFooter, FormSection, FormStack } from '@shared/ui/forms/form-section'
import { NodeLabel, NodeSelect } from '@shared/ui/infra/node'
import { SquadBadge, SquadSelect } from '@shared/ui/infra/squad'
import { ProviderInput, ProviderLabel } from '@shared/ui/infra/provider'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { Page } from '@shared/ui/page'
import { DataTableCard } from '@shared/ui/table'
import { SearchSelect } from '@shared/ui/forms/search-select'

// usePanelBilling maps a node to the panel's Infra Billing record for it.
function usePanelBilling() {
    const { data } = useInfra()
    return useMemo(() => {
        const nodes = data?.billing_nodes ?? []
        return (nodeUuid?: string | null) => (nodeUuid ? nodes.find((b) => b.nodeUuid === nodeUuid) : undefined)
    }, [data])
}

// dueDate is the item's own next payment date, else the panel's Infra
// Billing date for its node; the column sorts by what it shows.
function dueDate(item: ExpenseItem, billing: ReturnType<typeof usePanelBilling>) {
    return item.next_due_date ?? billing(item.rw_node_uuid)?.nextBillingAt ?? null
}

function DueCell({ item }: { item: ExpenseItem }) {
    const billing = usePanelBilling()
    const panel = billing(item.rw_node_uuid)
    const date = dueDate(item, billing)
    if (!date) return <Text c="dimmed">–</Text>
    const days = dayjs(date).diff(dayjs(), 'day')
    return (
        <Stack align="center" gap={0}>
            <Text ff="monospace" fw={500} size="sm">
                {fmtDate(date)}
            </Text>
            <Group gap={4}>
                <Text c={expiryColor(days)} size="xs">
                    {days < 0 ? `просрочено на ${-days} дн.` : days === 0 ? 'сегодня' : `через ${days} дн.`}
                </Text>
                {!item.next_due_date && panel && (
                    <Tooltip label="Дата из Infra Billing панели">
                        <Badge color="gray" size="xs" variant="soft">
                            панель
                        </Badge>
                    </Tooltip>
                )}
            </Group>
        </Stack>
    )
}

export function ExpenseItemsPage() {
    const { data } = useExpenseItems()
    const invalidate = useInvalidateAll()
    const [edit, setEdit] = useState<Partial<ExpenseItem> | null>(null)
    const [metered, setMetered] = useState<ExpenseItem | null>(null)
    const [syncing, setSyncing] = useState(false)

    const syncTraffic = async () => {
        setSyncing(true)
        try {
            await api.post('traffic/sync')
            await invalidate()
            notifyOk('Трафик нод обновлён')
        } catch (e) {
            notifyError(e)
        } finally {
            setSyncing(false)
        }
    }

    const billing = usePanelBilling()
    const columns = useMemo<MRT_ColumnDef<ExpenseItem>[]>(
        () => [
            {
                accessorKey: 'name',
                header: 'Статья',
                size: 220,
                Cell: ({ row }) => (
                    <Group gap="md" pl={10} wrap="nowrap">
                        <Indicator color={row.original.active ? 'teal' : 'gray'} inline size={10} zIndex={0} />
                        <Box miw={0}>
                            <Text fw={500} size="sm" truncate="end">
                                {row.original.name}
                            </Text>
                            <Text c="dimmed" fw={600} size="xs">
                                {row.original.active ? (row.original.period === 'year' ? 'ежегодно' : 'ежемесячно') : 'не учитывается'}
                            </Text>
                        </Box>
                    </Group>
                )
            },
            {
                accessorKey: 'provider',
                header: 'Провайдер',
                filterVariant: 'multi-select',
                size: 200,
                Cell: ({ row }) => <ProviderLabel name={row.original.provider} uuid={row.original.provider_uuid} />
            },
            {
                id: 'node',
                header: 'Нода',
                size: 220,
                accessorFn: (r) => r.rw_node_uuid,
                enableColumnFilter: false,
                Cell: ({ row }) =>
                    row.original.rw_node_uuid ? (
                        <Stack gap={2}>
                            <NodeLabel uuid={row.original.rw_node_uuid} />
                            {row.original.rw_squad_uuid && <SquadBadge size="sm" uuid={row.original.rw_squad_uuid} />}
                        </Stack>
                    ) : (
                        <Text c="dimmed">–</Text>
                    )
            },
            {
                accessorKey: 'pricing',
                header: 'Тарификация',
                filterVariant: 'select',
                mantineFilterSelectProps: {
                    data: [
                        { value: 'fixed', label: 'Фиксированная' },
                        { value: 'metered', label: 'По трафику' }
                    ]
                },
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ row }) =>
                    row.original.pricing === 'metered' ? (
                        <Badge color="cyan" leftSection={<TbCloudDataConnection size={14} />} variant="soft">
                            по трафику
                        </Badge>
                    ) : (
                        <Badge color="gray" leftSection={<PiCalendarDuotone size={14} />} variant="soft">
                            {row.original.period === 'year' ? 'в год' : 'в месяц'}
                        </Badge>
                    )
            },
            {
                id: 'price',
                header: 'Цена',
                enableColumnFilter: false,
                accessorFn: (r) => (r.pricing === 'metered' ? r.min_charge : r.amount),
                Cell: ({ row }) => {
                    const it = row.original
                    return it.pricing === 'metered' ? (
                        <Stack gap={0}>
                            <Text ff="monospace" fw={500} size="sm">
                                {fmtCurrency(it.price_per_gb, it.currency)}/ГБ
                            </Text>
                            <Text c="dimmed" size="xs">
                                мин. {fmtCurrency(it.min_charge, it.currency)}
                            </Text>
                        </Stack>
                    ) : (
                        <Text ff="monospace" fw={500} size="sm">
                            {fmtCurrency(it.amount, it.currency)}
                        </Text>
                    )
                }
            },
            {
                id: 'fee',
                header: 'Курс / комиссия / доля',
                size: 200,
                enableColumnFilter: false,
                enableSorting: false,
                accessorFn: (r) => r.fee_percent,
                Cell: ({ row }) => {
                    const it = row.original
                    return (
                        <Group gap={4}>
                            {it.currency !== 'RUB' && it.rate && (
                                <Badge color="gray" variant="soft">
                                    {fmtNum(it.rate, 2)} ₽
                                </Badge>
                            )}
                            {it.fee_percent > 0 && (
                                <Badge color="orange" variant="soft">
                                    +{it.fee_percent}%
                                </Badge>
                            )}
                            {it.share_percent !== 100 && (
                                <Badge color="indigo" variant="soft">
                                    доля {it.share_percent}%
                                </Badge>
                            )}
                            {it.currency === 'RUB' && !it.fee_percent && it.share_percent === 100 && <Text c="dimmed">–</Text>}
                        </Group>
                    )
                }
            },
            {
                accessorKey: 'monthly_rub',
                header: 'В месяц',
                enableColumnFilter: false,
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ row }) =>
                    row.original.plan_error ? (
                        <Tooltip label={row.original.plan_error} multiline maw={320}>
                            <Badge color="red" variant="soft">
                                ошибка
                            </Badge>
                        </Tooltip>
                    ) : (
                        <Stack align="center" gap={0}>
                            <Text ff="monospace" fw={600} size="sm">
                                {fmtMoney(row.original.monthly_rub, 2)}
                            </Text>
                            {row.original.pricing === 'metered' && (
                                <Text c="dimmed" size="xs">
                                    прогноз
                                </Text>
                            )}
                        </Stack>
                    )
            },
            {
                id: 'due',
                header: 'След. оплата',
                enableColumnFilter: false,
                mantineTableBodyCellProps: { align: 'center' },
                sortingFn: 'datetime',
                sortUndefined: 'last',
                sortDescFirst: false,
                accessorFn: (r) => {
                    const d = dueDate(r, billing)
                    return d ? new Date(d) : undefined
                },
                Cell: ({ row }) => <DueCell item={row.original} />
            }
        ],
        [billing]
    )

    return (
        <Page title="Статьи расходов">
            <PageHeader
                icon={<PiBuildingsDuotone size={24} />}
                title="Статьи расходов"
                description={`Регулярные платежи за инфраструктуру. Плановые расходы: ${fmtMoney(data?.monthly_total, 2)} в месяц по текущему курсу`}
                actions={
                    <>
                        <Button color="gray" leftSection={<PiArrowsClockwise size={16} />} loading={syncing} onClick={syncTraffic}>
                            Обновить трафик
                        </Button>
                        <Button
                            color="teal"
                            variant="soft"
                            leftSection={<PiPlus size={16} />}
                            onClick={() => setEdit({ pricing: 'fixed', active: true, currency: 'RUB', share_percent: 100, period: 'month' })}
                        >
                            Статья
                        </Button>
                    </>
                }
            />
            <DataTableCard
                storageKey="expense-items"
                icon={<PiBuildingsDuotone size={24} />}
                title="Регулярные платежи"
                description="Провайдеры, ноды и даты оплат подтягиваются из Infra Billing панели"
                columns={columns}
                data={data?.items ?? []}
                state={{ isLoading: !data }}
                initialState={{ sorting: [{ id: 'due', desc: false }] }}
                enableRowActions
                renderRowActions={({ row }) => (
                    <ItemMenu item={row.original} onEdit={() => setEdit(row.original)} onMetered={() => setMetered(row.original)} />
                )}
                mantineTableBodyRowProps={({ row }) => ({
                    onClick: (e) => {
                        if (!(e.target as HTMLElement).closest('button, a, [role="menuitem"]')) setEdit(row.original)
                    },
                    style: { cursor: 'pointer', opacity: row.original.active ? 1 : 0.55 }
                })}
            />
            <Drawer
                opened={!!edit}
                onClose={() => setEdit(null)}
                position="right"
                size="lg"
                title={
                    <BaseOverlayHeader
                        IconComponent={edit?.id ? PiPencilSimpleDuotone : PiPlus}
                        subtitle={edit?.id ? edit.name : undefined}
                        title={edit?.id ? 'Статья расходов' : 'Новая статья'}
                    />
                }
            >
                {edit && <ItemForm item={edit} onDone={() => setEdit(null)} />}
            </Drawer>
            <Drawer
                opened={!!metered}
                onClose={() => setMetered(null)}
                position="right"
                size="xl"
                title={<BaseOverlayHeader IconComponent={PiChartBarDuotone} subtitle={metered?.name} title="Трафик и стоимость" />}
            >
                {metered && <MeteredView item={metered} />}
            </Drawer>
        </Page>
    )
}

function ItemMenu({ item, onEdit, onMetered }: { item: ExpenseItem; onEdit: () => void; onMetered: () => void }) {
    const invalidate = useInvalidateAll()
    return (
        <Menu position="bottom-end" withinPortal>
            <Menu.Target>
                <ActionIcon color="gray" variant="subtle">
                    <TbDots size={18} />
                </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>Управление</Menu.Label>
                {item.pricing === 'metered' && (
                    <>
                        <Menu.Item leftSection={<PiChartBar size={16} />} onClick={onMetered}>
                            Трафик и прогноз
                        </Menu.Item>
                        <Menu.Item leftSection={<PiLock size={16} />} onClick={() => openClosePeriod(item)}>
                            Закрыть период
                        </Menu.Item>
                    </>
                )}
                <Menu.Item leftSection={<PiPencilSimple size={16} />} onClick={onEdit}>
                    Изменить
                </Menu.Item>
                <Menu.Divider />
                <Menu.Label>Опасная зона</Menu.Label>
                <Menu.Item
                    color="red"
                    leftSection={<PiTrash size={16} />}
                    onClick={() =>
                        confirmDanger(`Удалить «${item.name}»?`, 'Уже записанные траты останутся, связь со статьёй пропадёт.', async () => {
                            try {
                                await api.del(`expense-items/${item.id}`)
                                await invalidate()
                            } catch (e) {
                                notifyError(e)
                            }
                        })
                    }
                >
                    Удалить
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    )
}

function openClosePeriod(item: ExpenseItem) {
    openModal({ icon: PiCalendarCheckDuotone, color: 'orange', title: 'Закрыть период', subtitle: item.name }, (close) => (
        <ClosePeriodForm item={item} onDone={close} />
    ))
}

function ClosePeriodForm({ item, onDone }: { item: ExpenseItem; onDone: () => void }) {
    const [month, setMonth] = useState<string | null>(dayjs().subtract(1, 'month').format('YYYY-MM-01'))
    const m = useApiMutation(() =>
        api.post<{ rub_amount: number }>(`expense-items/${item.id}/close-period`, { period: dayjs(month).format('YYYY-MM') })
    )
    return (
        <FormStack>
            <FormSection
                icon={PiCalendarCheckDuotone}
                color="orange"
                title="Период"
                description="Трата запишется на рассчитанную по трафику сумму. Когда придёт счёт — поправьте сумму в журнале, расчёт сохранится для сравнения."
            >
                <MonthPickerInput label="Месяц" leftSection={<PiCalendarDuotone size={16} />} value={month} onChange={setMonth} />
            </FormSection>
            <FormFooter
                loading={m.isPending}
                onCancel={onDone}
                onSubmit={() =>
                    m.mutate(undefined, {
                        onSuccess: (r) => {
                            notifyOk(`Записано ${fmtMoney(r.rub_amount, 2)}`)
                            onDone()
                        },
                        onError: (e) => notifyError(e)
                    })
                }
                submitIcon={<PiLock size={16} />}
                submitLabel="Закрыть период"
            />
        </FormStack>
    )
}

function MeteredView({ item }: { item: ExpenseItem }) {
    const [month, setMonth] = useState<string | null>(dayjs().format('YYYY-MM-01'))
    const q = useMetered(item.id, dayjs(month).format('YYYY-MM'))
    const consumers = useMemo<MRT_ColumnDef<NonNullable<NonNullable<typeof q.data>['top_consumers']>[number]>[]>(
        () => [
            { accessorKey: 'username', header: 'Пользователь', Cell: ({ row }) => row.original.username || `#${row.original.rw_user_id}` },
            { accessorKey: 'customer_name', header: 'Клиент', Cell: ({ row }) => row.original.customer_name || '–' },
            { accessorKey: 'gb', header: 'ГБ', Cell: ({ cell }) => <Text ff="monospace" size="sm">{fmtNum(cell.getValue<number>())}</Text> },
            { accessorKey: 'share_percent', header: 'Доля', Cell: ({ cell }) => `${fmtNum(cell.getValue<number>(), 1)}%` },
            { accessorKey: 'cost_rub', header: '≈ ₽', Cell: ({ cell }) => fmtMoney(cell.getValue<number>()) }
        ],
        []
    )
    return (
        <Stack>
            <MonthPickerInput label="Месяц" leftSection={<PiCalendarDuotone size={16} />} value={month} onChange={setMonth} w={220} />
            {q.error && (
                <Alert color="red" variant="soft">
                    {q.error.message}
                </Alert>
            )}
            {q.data && <MeteredCard m={q.data} />}
            {q.data?.top_consumers && q.data.top_consumers.length > 5 && (
                <DataTableCard
                    compact
                    columns={consumers}
                    data={q.data.top_consumers}
                    icon={<PiUsersDuotone size={24} />}
                    initialState={{ sorting: [{ id: 'gb', desc: true }] }}
                    storageKey="consumers"
                    title="Все потребители"
                />
            )}
        </Stack>
    )
}

function ItemForm({ item, onDone }: { item: Partial<ExpenseItem>; onDone: () => void }) {
    const nodes = useNodes()
    const infra = useInfra()
    const billing = usePanelBilling()
    const settings = useSettings()
    const itemsQ = useExpenseItems()
    const inbounds = useInboundStatus()
    const form = useForm({
        initialValues: {
            name: item.name ?? '',
            provider: item.provider ?? '',
            provider_uuid: item.provider_uuid ?? '',
            currency: item.currency ?? 'RUB',
            pricing: item.pricing ?? 'fixed',
            amount: item.amount ?? 0,
            period: item.period ?? 'month',
            fee_percent: item.fee_percent ?? 0,
            share_percent: item.share_percent ?? 100,
            price_per_gb: item.price_per_gb ?? 1,
            min_charge: item.min_charge ?? 0,
            rw_node_uuid: item.rw_node_uuid || null,
            rw_squad_uuid: item.rw_squad_uuid || null,
            rw_inbound_tag: item.rw_inbound_tag || null,
            next_due_date: item.next_due_date ? dayjs(item.next_due_date).format('YYYY-MM-DD') : null,
            active: item.active ?? true,
            notes: item.notes ?? ''
        },
        validate: { name: (v) => (v.trim() ? null : 'Введите название') }
    })
    const m = useApiMutation((v: typeof form.values) => {
        const body = { ...v, rw_node_uuid: v.rw_node_uuid ?? '', rw_squad_uuid: v.rw_squad_uuid ?? '', rw_inbound_tag: v.rw_inbound_tag ?? '' }
        return item.id ? api.put(`expense-items/${item.id}`, body) : api.post('expense-items', body)
    })
    const v = form.values
    const knownProviders = useMemo(() => [...new Set((itemsQ.data?.items ?? []).map((i) => i.provider).filter(Boolean))], [itemsQ.data])
    const panelBilling = billing(v.rw_node_uuid)
    // a saved tag stays selectable even if the node no longer serves it
    const inboundTags = useMemo(() => {
        const node = nodes.data?.find((n) => n.uuid === v.rw_node_uuid)
        const tags = (node?.configProfile.activeInbounds ?? []).map((i) => i.tag)
        return v.rw_inbound_tag && !tags.includes(v.rw_inbound_tag) ? [v.rw_inbound_tag, ...tags] : tags
    }, [nodes.data, v.rw_node_uuid, v.rw_inbound_tag])

    const pickNode = (val: string | null) => {
        form.setFieldValue('rw_node_uuid', val)
        if (val !== v.rw_node_uuid) form.setFieldValue('rw_inbound_tag', null)
        // the panel already knows who hosts this node: take its provider
        const b = billing(val)
        const p = b && infra.data?.providers.find((x) => x.uuid === b.providerUuid)
        if (p && !v.provider) {
            form.setFieldValue('provider', p.name)
            form.setFieldValue('provider_uuid', p.uuid)
        }
    }

    return (
        <form
            onSubmit={form.onSubmit((vals) =>
                m.mutate(vals, {
                    onSuccess: () => {
                        notifyOk('Сохранено')
                        onDone()
                    },
                    onError: (e) => notifyError(e)
                })
            )}
        >
            <Stack gap="md">
                <FormSection icon={PiBuildingsDuotone} title="Статья" description="Что оплачиваем и кому">
                    <TextInput label="Название" leftSection={<PiTextAa size={16} />} required {...form.getInputProps('name')} />
                    <ProviderInput
                        label="Провайдер"
                        placeholder="Из Infra Billing панели или любой другой"
                        extra={knownProviders}
                        value={v.provider}
                        onChange={(name, uuid) => {
                            form.setFieldValue('provider', name)
                            form.setFieldValue('provider_uuid', uuid)
                        }}
                    />
                    <NodeSelect
                        label="Нода в панели"
                        description={
                            panelBilling
                                ? `В Infra Billing панели следующая оплата ${fmtDate(panelBilling.nextBillingAt)}`
                                : 'Необязательно. Для тарификации по трафику — обязательно'
                        }
                        placeholder={nodes.isPending ? 'Загрузка…' : 'Не выбрана'}
                        clearable
                        allowDeselect
                        value={v.rw_node_uuid}
                        onChange={pickNode}
                        error={nodes.error?.message}
                    />
                    <Switch label="Активна" description="Учитывается в плановых расходах" {...form.getInputProps('active', { type: 'checkbox' })} />
                </FormSection>

                <FormSection icon={PiCoinsDuotone} color="teal" title="Тарификация">
                    <SegmentedControl
                        data={[
                            { value: 'fixed', label: 'Фиксированная цена' },
                            { value: 'metered', label: 'По трафику (ГБ)' }
                        ]}
                        fullWidth
                        {...form.getInputProps('pricing')}
                    />
                    <SimpleGrid cols={{ base: 1, xs: 2 }}>
                        <SearchSelect
                            label="Валюта"
                            leftSection={<PiCurrencyRub size={16} />}
                            data={['RUB', 'EUR', 'USD', 'GBP', 'CHF', 'CNY', 'TRY', 'KZT']}
                            {...form.getInputProps('currency')}
                            onChange={(c) => {
                                form.setFieldValue('currency', c ?? 'RUB')
                                if (c && c !== 'RUB' && !v.fee_percent && settings.data) {
                                    form.setFieldValue('fee_percent', Number(settings.data.default_fee_percent) || 0)
                                }
                            }}
                        />
                        {v.pricing === 'fixed' ? (
                            <Select
                                label="Период"
                                leftSection={<PiCalendarDuotone size={16} />}
                                data={[
                                    { value: 'month', label: 'Ежемесячно' },
                                    { value: 'year', label: 'Ежегодно' }
                                ]}
                                {...form.getInputProps('period')}
                            />
                        ) : (
                            <NumberInput
                                label={`Цена за ГБ, ${v.currency}`}
                                leftSection={<TbCloudDataConnection size={16} />}
                                min={0}
                                decimalScale={4}
                                {...form.getInputProps('price_per_gb')}
                            />
                        )}
                    </SimpleGrid>
                    {v.pricing === 'fixed' ? (
                        <NumberInput
                            label={`Цена за период, ${v.currency}`}
                            leftSection={<PiCoinsDuotone size={16} />}
                            min={0}
                            decimalScale={2}
                            {...form.getInputProps('amount')}
                        />
                    ) : (
                        <NumberInput
                            label={`Минимальный платёж, ${v.currency}`}
                            description={`Стоимость месяца = max(минимум, ГБ × цена). Минимум покрывает ${
                                v.price_per_gb ? fmtNum(v.min_charge / v.price_per_gb) : '—'
                            } ГБ`}
                            leftSection={<PiCoinsDuotone size={16} />}
                            min={0}
                            decimalScale={2}
                            {...form.getInputProps('min_charge')}
                        />
                    )}
                    <SimpleGrid cols={{ base: 1, xs: 2 }}>
                        <NumberInput
                            label="Комиссия банка, %"
                            leftSection={<PiPercent size={16} />}
                            decimalScale={2}
                            {...form.getInputProps('fee_percent')}
                        />
                        <NumberInput
                            label="Наша доля, %"
                            description="Домен на троих — 30%"
                            leftSection={<PiPercent size={16} />}
                            min={0}
                            max={100}
                            decimalScale={2}
                            {...form.getInputProps('share_percent')}
                        />
                    </SimpleGrid>
                    <DateInput
                        label="Следующая оплата"
                        description={panelBilling ? 'Пусто — брать дату из Infra Billing панели' : undefined}
                        leftSection={<PiCalendarDuotone size={16} />}
                        clearable
                        valueFormat="DD.MM.YYYY"
                        {...form.getInputProps('next_due_date')}
                    />
                </FormSection>

                {v.pricing === 'metered' && (
                    <FormSection icon={TbServer2} color="violet" title="Чей трафик считаем" description="Нода выбирается выше">
                        <SquadSelect
                            label="Внутренний сквад"
                            description="Если ноду делят несколько групп: стоимость считается по доле трафика участников сквада на этой ноде. Пусто — весь трафик ноды"
                            placeholder="Вся нода"
                            clearable
                            allowDeselect
                            disabled={!!v.rw_inbound_tag}
                            {...form.getInputProps('rw_squad_uuid')}
                        />
                        {(inbounds.data?.enabled || v.rw_inbound_tag) && (
                            <Select
                                label="Inbound"
                                description={
                                    inbounds.data?.enabled
                                        ? `Только трафик этого inbound — по счётчикам Prometheus панели. История с ${
                                              inbounds.data.since ? fmtDate(inbounds.data.since) : 'первого опроса'
                                          }`
                                        : 'Метрики панели отключены (REMNAWAVE_METRICS_URL): уберите inbound, чтобы сохранить статью'
                                }
                                placeholder={v.rw_node_uuid ? 'Все inbound' : 'Сначала выберите ноду'}
                                leftSection={<TbCloudDataConnection size={16} />}
                                data={inboundTags}
                                clearable
                                allowDeselect
                                disabled={!v.rw_node_uuid || !!v.rw_squad_uuid}
                                error={inbounds.data?.last_error}
                                {...form.getInputProps('rw_inbound_tag')}
                            />
                        )}
                    </FormSection>
                )}

                <FormSection icon={PiNotePencil} color="gray" title="Заметки">
                    <Textarea autosize minRows={2} {...form.getInputProps('notes')} />
                </FormSection>
                <FormFooter inline loading={m.isPending} onCancel={onDone} />
            </Stack>
        </form>
    )
}
