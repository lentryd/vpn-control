import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import { Anchor, Badge, Button, SegmentedControl, SimpleGrid, Stack } from '@mantine/core'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { PiClockCountdownDuotone, PiClockUserDuotone, PiLinkBreakDuotone, PiLinkDuotone, PiPulseDuotone, PiUsersDuotone } from 'react-icons/pi'
import { TbHexagon } from 'react-icons/tb'
import { Link } from 'react-router'

import { useSubscriptions } from '@/api/hooks'
import type { AddonItem, RwUser, Subscription } from '@/api/types'
import { ExpireCell, OnlineCell, StatusBadge, TrafficCell, UsernameCell } from '@/components/badges'
import { daysLeft } from '@/components/format'
import { AddonActions, SubscriptionActions } from '@/components/ItemActions'
import { Money } from '@/components/ui'
import { openSubscriptionForm } from '@/modals/SubscriptionModals'
import { openViewAddonModal, openViewSubscriptionModal } from '@/modals/ViewItemModal'
import { IMetricCardProps, MetricCardShared } from '@shared/ui/metrics/metric-card'
import { Page } from '@shared/ui/page'
import { PageHeaderShared } from '@shared/ui/page-header'
import { DataTableCard } from '@shared/ui/table'

interface Row {
    key: string
    kind: 'subscription' | 'addon'
    title: string
    customer_id: number
    customer_name: string
    tariff: string
    price: number
    rw: RwUser | null
    auto: boolean
    sub: Subscription
    addon?: AddonItem
}

export function SubscriptionsPage() {
    const { data, isFetching } = useSubscriptions()
    const [scope, setScope] = useState('active')

    const rows = useMemo(() => {
        const out: Row[] = []
        for (const s of data ?? []) {
            if (scope === 'active' && s.customer_archived) continue
            out.push({
                key: `s${s.id}`,
                kind: 'subscription',
                title: s.title,
                customer_id: s.customer_id,
                customer_name: s.customer_name,
                tariff: s.tariff_name,
                price: s.price,
                rw: s.rw_user,
                auto: s.auto_extend,
                sub: s
            })
            for (const a of s.addons) {
                out.push({
                    key: `a${a.id}`,
                    kind: 'addon',
                    title: `${a.addon_name} · ${s.title}`,
                    customer_id: s.customer_id,
                    customer_name: s.customer_name,
                    tariff: a.tariff_name,
                    price: a.price,
                    rw: a.rw_user,
                    auto: a.auto_extend,
                    sub: s,
                    addon: a
                })
            }
        }
        if (scope === 'expiring') {
            return out.filter((r) => {
                const d = daysLeft(r.rw?.expire_at)
                return d !== null && d <= 7 && d >= -30 && !r.sub.customer_archived
            })
        }
        if (scope === 'unlinked') return out.filter((r) => !r.rw)
        return out
    }, [data, scope])

    const columns = useMemo<MRT_ColumnDef<Row>[]>(
        () => [
            {
                accessorKey: 'title',
                header: 'Подписка',
                size: 260,
                Cell: ({ row }) => (
                    <UsernameCell
                        user={row.original.rw}
                        title={row.original.title}
                        badge={
                            row.original.kind === 'addon' && (
                                <Badge size="xs" color="grape" variant="soft">
                                    аддон
                                </Badge>
                            )
                        }
                    />
                )
            },
            {
                accessorKey: 'customer_name',
                header: 'Клиент',
                Cell: ({ row }) => (
                    <Anchor component={Link} to={`/customers/${row.original.customer_id}`} size="sm">
                        {row.original.customer_name}
                    </Anchor>
                )
            },
            {
                id: 'status',
                header: 'Статус',
                accessorFn: (r) => (r.rw ? r.rw.status : 'UNLINKED'),
                filterVariant: 'multi-select',
                mantineFilterMultiSelectProps: {
                    data: [
                        { value: 'ACTIVE', label: 'Активна' },
                        { value: 'EXPIRED', label: 'Истекла' },
                        { value: 'LIMITED', label: 'Лимит' },
                        { value: 'DISABLED', label: 'Отключена' },
                        { value: 'UNLINKED', label: 'Не привязана' }
                    ]
                },
                size: 190,
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ row }) => <StatusBadge user={row.original.rw} />
            },
            {
                id: 'expire',
                header: 'Оплачено до',
                sortingFn: 'datetime',
                accessorFn: (r) => (r.rw?.expire_at ? new Date(r.rw.expire_at) : undefined),
                sortDescFirst: false,
                sortUndefined: 'last',
                enableColumnFilter: false,
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ row }) => <ExpireCell date={row.original.rw?.expire_at} />
            },
            { accessorKey: 'tariff', header: 'Тариф', filterVariant: 'multi-select' },
            { accessorKey: 'price', header: 'Цена', enableColumnFilter: false, Cell: ({ cell }) => <Money value={cell.getValue<number>()} /> },
            {
                id: 'traffic',
                header: 'Трафик',
                accessorFn: (r) => r.rw?.used_traffic_bytes ?? 0,
                enableColumnFilter: false,
                size: 260,
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ row }) => <TrafficCell user={row.original.rw} />
            },
            {
                id: 'online',
                header: 'В сети',
                size: 190,
                sortingFn: 'datetime',
                accessorFn: (r) => (r.rw?.online_at ? new Date(r.rw.online_at) : undefined),
                sortUndefined: 'last',
                enableColumnFilter: false,
                Cell: ({ row }) => <OnlineCell user={row.original.rw} />
            },
            { id: 'username', header: 'Username', accessorFn: (r) => r.rw?.username ?? '' },
            {
                accessorKey: 'auto',
                header: 'Автопродл.',
                enableColumnFilter: false,
                Cell: ({ cell }) => (cell.getValue<boolean>() ? 'да' : 'нет')
            }
        ],
        []
    )

    const stats = useMemo(() => {
        const all = (data ?? []).filter((s) => !s.customer_archived).flatMap((s) => [s.rw_user, ...s.addons.map((a) => a.rw_user)])
        const count = (f: (u: (typeof all)[number]) => boolean) => all.filter(f).length
        return { all, count }
    }, [data])

    const cards: IMetricCardProps[] = [
        { IconComponent: PiUsersDuotone, iconColor: 'blue', title: 'Всего', value: stats.all.length, iconVariant: 'soft' },
        { IconComponent: PiPulseDuotone, iconColor: 'teal', title: 'Активны', value: stats.count((u) => u?.status === 'ACTIVE'), iconVariant: 'soft' },
        {
            IconComponent: PiClockCountdownDuotone,
            iconColor: 'orange',
            title: 'Истекают за 7 дней',
            value: stats.count((u) => {
                const d = daysLeft(u?.expire_at)
                return u?.status === 'ACTIVE' && d !== null && d >= 0 && d <= 7
            }),
            iconVariant: 'soft'
        },
        { IconComponent: PiClockUserDuotone, iconColor: 'red', title: 'Истекли', value: stats.count((u) => u?.status === 'EXPIRED'), iconVariant: 'soft' },
        { IconComponent: PiLinkBreakDuotone, iconColor: 'gray', title: 'Без панели', value: stats.count((u) => !u), iconVariant: 'soft' }
    ]

    return (
        <Page title="Подписки">
            <PageHeaderShared
                icon={<TbHexagon size={24} />}
                title="Подписки"
                description="Все подписки и аддоны: у кого что и до какого числа"
            />
            <Stack>
                <SimpleGrid cols={{ base: 1, xs: 2, xl: 5 }} spacing="xs">
                    {cards.map((card, index) => (
                        <motion.div
                            animate={{ opacity: 1, y: 0 }}
                            initial={{ opacity: 0, y: 0 }}
                            key={card.title}
                            transition={{ duration: 0.2, delay: index * 0.07, ease: 'easeIn' }}
                        >
                            <MetricCardShared isLoading={!data} {...card} />
                        </motion.div>
                    ))}
                </SimpleGrid>

                <DataTableCard
                    storageKey="subscriptions"
                    icon={<TbHexagon size={24} />}
                    title="Подписки и аддоны"
                    actions={
                        <>
                            <SegmentedControl
                                size="xs"
                                value={scope}
                                onChange={setScope}
                                data={[
                                    { value: 'active', label: 'Активные клиенты' },
                                    { value: 'expiring', label: 'Истекают' },
                                    { value: 'unlinked', label: 'Без панели' },
                                    { value: 'all', label: 'Все' }
                                ]}
                            />
                            <Button leftSection={<PiLinkDuotone size={16} />} onClick={() => openSubscriptionForm({})} variant="soft">
                                Привязать
                            </Button>
                        </>
                    }
                    columns={columns}
                    data={rows}
                    getRowId={(r) => r.key}
                    state={{ showProgressBars: isFetching, isLoading: !data }}
                    initialState={{ sorting: [{ id: 'expire', desc: false }], columnVisibility: { username: false, auto: false } }}
                    enableRowActions
                    renderRowActions={({ row }) =>
                        row.original.kind === 'addon' ? (
                            <AddonActions addon={row.original.addon!} subTitle={row.original.sub.title} />
                        ) : (
                            <SubscriptionActions sub={row.original.sub} />
                        )
                    }
                    onRowClick={(r) => (r.kind === 'addon' ? openViewAddonModal(r.addon!.id, r.sub.id) : openViewSubscriptionModal(r.sub))}
                />
            </Stack>
        </Page>
    )
}
