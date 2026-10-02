import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import { AreaChart, BarChart } from '@mantine/charts'
import {
    Alert,
    Anchor,
    Badge,
    Box,
    Button,
    Card,
    Indicator,
    Group,
    Paper,
    RingProgress,
    SimpleGrid,
    Stack,
    Text,
    useMatches
} from '@mantine/core'
import dayjs from 'dayjs'
import { motion } from 'motion/react'
import { useMemo } from 'react'
import {
    PiCalendarDotsDuotone,
    PiCalendarPlus,
    PiChartBarDuotone,
    PiChartLineUpDuotone,
    PiClockCountdownDuotone,
    PiCloudDuotone,
    PiCoinsDuotone,
    PiReceiptDuotone,
    PiStarDuotone,
    PiTreeStructureDuotone,
    PiVaultDuotone,
    PiWarningDuotone
} from 'react-icons/pi'
import { TbCalendar } from 'react-icons/tb'
import { Link } from 'react-router'

import { useDashboard } from '@/api/hooks'
import type { ExpiringItem, MeteredSummary } from '@/api/types'
import { SquadBadge } from '@shared/ui/infra/squad'
import { expirationText, expiryColor, StatusPill } from '@/components/badges'
import { fmtDate, fmtMoney, fmtNum, dateLayout } from '@/components/format'
import { Money, PageHeader, StatCard } from '@/components/ui'
import { openExtendModal } from '@/modals/ExtendModal'
import { openViewAddonModal, openViewSubscriptionModal } from '@/modals/ViewItemModal'
import { NodeLabel } from '@shared/ui/infra/node'
import { ProviderLabel } from '@shared/ui/infra/provider'
import { LoadingScreen } from '@shared/ui/loading-screen'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { Page } from '@shared/ui/page'
import { SectionCard } from '@shared/ui/section-card'
import { DataTableCard, DataTableShared } from '@shared/ui/table'
import { useTranslation } from 'react-i18next'
import { codedText } from '@/components/notify'

// Block is a dashboard card with the panel's card-title header.
function Block({
    icon,
    title,
    description,
    actions,
    children,
    flush,
    style
}: {
    icon: React.ReactNode
    title: string
    description?: React.ReactNode
    actions?: React.ReactNode
    children: React.ReactNode
    flush?: boolean
    style?: React.CSSProperties
}) {
    return (
        <DataTableShared.Container style={style}>
            <DataTableShared.Title actions={actions} description={description} icon={icon} title={title} />
            {flush ? children : <Card.Section p="md">{children}</Card.Section>}
        </DataTableShared.Container>
    )
}

const fadeIn = (index: number) => ({
    animate: { opacity: 1, y: 0 },
    initial: { opacity: 0, y: 0 },
    transition: { duration: 0.2, delay: index * 0.07, ease: 'easeIn' as const }
})

export function DashboardPage() {
    const { t } = useTranslation()
    const { data, isPending, error } = useDashboard()
    // the table takes two of three columns only where there are three; a
    // span on the one-column phone grid adds an implicit column and skews it
    const tableSpan = useMatches({ base: undefined, lg: 'span 2' })
    if (isPending) return <LoadingScreen height="60vh" />
    if (error || !data) return <Alert color="red">{error?.message}</Alert>

    const cards = [
        {
            title: 'MRR',
            value: fmtMoney(data.mrr),
            hint: t('dashboard.mrr_hint', { customers: data.active_customers, subs: data.active_subs, addons: data.active_addons }),
            icon: PiCoinsDuotone,
            color: 'cyan'
        },
        { title: t('dashboard.expenses_month'), value: fmtMoney(data.planned_expenses), hint: t('dashboard.expenses_hint'), icon: PiReceiptDuotone, color: 'orange' },
        { title: t('dashboard.profit_month'), value: fmtMoney(data.profit), hint: t('dashboard.profit_hint'), icon: PiChartLineUpDuotone, color: data.profit >= 0 ? 'teal' : 'red' },
        {
            title: t('dashboard.cash'),
            value: fmtMoney(data.cash_balance),
            hint: t('dashboard.cash_hint', { income: fmtMoney(data.income_month), expenses: fmtMoney(data.expenses_month) }),
            icon: PiVaultDuotone,
            color: 'grape'
        }
    ]

    return (
        <Page title={t('menu.home')}>
            <PageHeader
                icon={<PiStarDuotone size={24} />}
                title={t('menu.home')}
                description={t('dashboard.window', { count: data.window_days })}
            />
            {data.sync.error && (
                <Alert color="red" icon={<PiWarningDuotone />} mb="md" title={t('dashboard.no_panel')} variant="soft">
                    {data.sync.error}
                </Alert>
            )}
            <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} mb="md" spacing="xs">
                {cards.map((c, i) => (
                    <motion.div key={c.title} {...fadeIn(i)}>
                        <StatCard color={c.color} hint={c.hint} icon={c.icon} title={c.title} value={c.value} />
                    </motion.div>
                ))}
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, lg: 3 }} mb="md" spacing="md">
                <ExpiringTable data={data.expiring} style={{ gridColumn: tableSpan }} />
                <Stack>
                    <Block icon={<PiTreeStructureDuotone size={24} />} title={t('dashboard.referrals')} description={t('dashboard.referrals_hint')}>
                        <Group justify="space-between">
                            <Text size="sm" c="dimmed">
                                {t('dashboard.accrued_month')}
                            </Text>
                            <Money value={data.referral_month} />
                        </Group>
                        <Group justify="space-between">
                            <Text size="sm" c="dimmed">
                                {t('dashboard.total')}
                            </Text>
                            <Money value={data.referral_total} />
                        </Group>
                        {data.debt_total > 0 && (
                            <Group justify="space-between" mt="xs">
                                <Text size="sm" c="red">
                                    {t('dashboard.debts')}
                                </Text>
                                <Money value={data.debt_total} />
                            </Group>
                        )}
                    </Block>
                    <Block icon={<PiCalendarDotsDuotone size={24} />} title={t('dashboard.due_soon')}>
                        {data.due_soon?.length ? (
                            <Stack gap="sm">
                                {data.due_soon.map((d, i) => {
                                    const days = dayjs(d.next_due_date).diff(dayjs(), 'day')
                                    return (
                                        <Group gap="sm" justify="space-between" key={`${d.id}-${i}`} wrap="nowrap">
                                            <Stack gap={2} miw={0}>
                                                <Group gap="xs" wrap="nowrap">
                                                    <Text fw={500} size="sm" truncate="end">
                                                        {d.name}
                                                    </Text>
                                                    {d.source === 'panel' && (
                                                        <Badge color="gray" size="xs" variant="soft">
                                                            {t('dashboard.panel_badge')}
                                                        </Badge>
                                                    )}
                                                </Group>
                                                <Group gap="sm" wrap="nowrap">
                                                    {d.provider && <ProviderLabel name={d.provider} size="xs" uuid={d.provider_uuid} />}
                                                    {d.node_uuid && <NodeLabel size="xs" uuid={d.node_uuid} />}
                                                </Group>
                                            </Stack>
                                            <Stack align="flex-end" gap={0}>
                                                <Badge color={expiryColor(days)} leftSection={<TbCalendar size={12} />} variant="soft">
                                                    {fmtDate(d.next_due_date)}
                                                </Badge>
                                                {d.monthly_rub !== undefined && (
                                                    <Text c="dimmed" ff="monospace" size="xs">
                                                        {fmtMoney(d.monthly_rub)}
                                                    </Text>
                                                )}
                                            </Stack>
                                        </Group>
                                    )
                                })}
                            </Stack>
                        ) : (
                            <Text size="sm" c="dimmed">
                                {t('dashboard.no_due')}{' '}
                                <Anchor component={Link} to="/expense-items" size="sm">
                                    {t('dashboard.no_due_link')}
                                </Anchor>
                            </Text>
                        )}
                    </Block>
                </Stack>
            </SimpleGrid>

            {data.metered?.map((m) => <MeteredCard key={m.item_id} m={m} />)}

            <Block icon={<PiChartBarDuotone size={24} />} title={t('dashboard.by_month')}>
                <BarChart
                    h={260}
                    data={data.months.map((m) => ({ ...m, month: dayjs(m.month + '-01').format('MMM YY') }))}
                    dataKey="month"
                    series={[
                        { name: 'income', label: t('dashboard.income'), color: 'teal.6' },
                        { name: 'expenses', label: t('dashboard.spent'), color: 'orange.6' }
                    ]}
                    valueFormatter={(v) => fmtMoney(v)}
                    withLegend
                    gridAxis="y"
                />
            </Block>
        </Page>
    )
}

function ExpiringTable({ data, style }: { data: ExpiringItem[]; style?: React.CSSProperties }) {
    const { t } = useTranslation()
    const columns = useMemo<MRT_ColumnDef<ExpiringItem>[]>(
        () => [
            {
                accessorKey: 'title',
                header: t('dashboard.col_subscription'),
                size: 220,
                Cell: ({ row }) => (
                    <Group gap="md" pl={10} wrap="nowrap">
                        <Indicator color={expiryColor(row.original.days_left)} inline size={10} zIndex={0} />
                        <Box miw={0}>
                            <Group gap={6} wrap="nowrap">
                                {row.original.kind === 'addon' && (
                                    <Badge color="grape" size="xs" variant="soft">
                                        {t('dashboard.addon_badge')}
                                    </Badge>
                                )}
                                <Text fw={500} size="sm" truncate="end">
                                    {row.original.title}
                                </Text>
                            </Group>
                            <Anchor component={Link} fw={600} size="xs" to={`/customers/${row.original.customer_id}`}>
                                {row.original.customer_name}
                            </Anchor>
                        </Box>
                    </Group>
                )
            },
            {
                accessorKey: 'days_left',
                header: t('dashboard.col_term'),
                size: 150,
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ row }) => (
                    <Stack align="center" gap={0}>
                        <Text ff="monospace" fw={500} size="sm">
                            {fmtDate(row.original.expire_at)}
                        </Text>
                        <Text c={expiryColor(row.original.days_left)} size="xs">
                            {expirationText(row.original.expire_at)}
                        </Text>
                    </Stack>
                )
            },
            {
                accessorKey: 'status',
                header: t('dashboard.col_status'),
                size: 150,
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ row }) => <StatusPill size="md" status={row.original.status} />
            },
            {
                accessorKey: 'price',
                header: t('dashboard.col_price'),
                size: 100,
                Cell: ({ cell }) => (
                    <Text ff="monospace" size="sm">
                        {fmtMoney(cell.getValue<number>())}
                    </Text>
                )
            },
            {
                accessorKey: 'balance',
                header: t('dashboard.col_balance'),
                size: 100,
                Cell: ({ cell }) => (
                    <Text c={cell.getValue<number>() < 0 ? 'red' : cell.getValue<number>() > 0 ? 'teal' : 'dimmed'} ff="monospace" size="sm">
                        {fmtMoney(cell.getValue<number>())}
                    </Text>
                )
            }
        ],
        [t]
    )
    return (
        <Box style={style}>
            <DataTableCard
                compact
                fill
                actions={
                    <Badge color={data.length ? 'orange' : 'teal'} size="lg" variant="soft">
                        {data.length}
                    </Badge>
                }
                columns={columns}
                data={data}
                description={t('dashboard.expiring_hint')}
                enableRowActions
                icon={<PiClockCountdownDuotone size={24} />}
                initialState={{ sorting: [{ id: 'days_left', desc: false }] }}
                onRowClick={(e) =>
                    e.kind === 'addon'
                        ? openViewAddonModal(e.id, e.subscription_id)
                        : openViewSubscriptionModal({ id: e.id, title: e.title, customer_name: e.customer_name })
                }
                renderEmptyRowsFallback={() => (
                    <Text c="dimmed" p="md" size="sm">
                        {t('dashboard.nothing_expiring')}
                    </Text>
                )}
                renderRowActions={({ row }) => (
                    <Button
                        color="teal"
                        leftSection={<PiCalendarPlus size={14} />}
                        onClick={() =>
                            openExtendModal({ kind: row.original.kind, id: row.original.id, title: `${row.original.customer_name} · ${row.original.title}` })
                        }
                        size="compact-xs"
                        variant="soft"
                    >
                        {t('dashboard.extend')}
                    </Button>
                )}
                displayColumnDefOptions={{ 'mrt-row-actions': { header: '', size: 120 } }}
                storageKey="dashboard-expiring"
                title={t('dashboard.expiring')}
            />
        </Box>
    )
}

export function MeteredCard({ m }: { m: MeteredSummary }) {
    const { t } = useTranslation()
    if (m.error) {
        return (
            <Alert color="yellow" icon={<PiCloudDuotone />} mb="md" title={m.name} variant="soft">
                {codedText(m.error, m.error_code, m.error_params)}
            </Alert>
        )
    }
    const progress = m.included_gb ? Math.min(100, (m.used_gb / m.included_gb) * 100) : 0
    const forecastOver = m.forecast_gb > m.included_gb
    const avgDaily = m.daily.length ? m.daily.reduce((sum, d) => sum + d.gb, 0) / m.daily.length : 0
    const free = m.min_mode === 'free'
    // a period starting on the 1st reads as a month, any other as dates
    const periodLabel =
        dayjs(m.period_start).date() === 1
            ? dayjs(m.period_start).format('MMMM YYYY')
            : `${dayjs(m.period_start).format(t('format.date_short'))} – ${dayjs(m.period_end).format(dateLayout())}`
    const priceHint = m.tiers?.length ? t('metered.tiered_price') : t('metered.per_gb_over', { price: fmtMoney(m.price_per_gb, 2) })
    return (
        <Block
            actions={
                <Badge color="gray" size="lg" variant="soft">
                    {periodLabel}
                </Badge>
            }
            description={
                <Group component="span" gap="xs" mt={2}>
                    <NodeLabel fallback={m.node_name} size="xs" uuid={m.node_uuid} />
                    {m.squad_uuid && <SquadBadge size="sm" uuid={m.squad_uuid} />}
                </Group>
            }
            icon={<PiCloudDuotone size={24} />}
            style={{ marginBottom: 'var(--mantine-spacing-md)' }}
            title={t('metered.card_title', { name: m.name })}
        >
            <SimpleGrid cols={{ base: 1, md: 3 }} mb="md" spacing="xs">
                <Paper p="md" withBorder>
                    <Group gap="md" wrap="nowrap">
                        <RingProgress
                            label={
                                <Text c={progress >= 100 ? 'orange' : 'cyan'} fw={700} size="xs" ta="center">
                                    {Math.round(progress)}%
                                </Text>
                            }
                            sections={[{ value: progress, color: progress >= 100 ? 'orange' : 'cyan' }]}
                            size={72}
                        />
                        <Stack gap={0}>
                            <Text c="dimmed" fw={500} size="sm">
                                {free ? t('metered.used_free') : t('metered.used_min')}
                            </Text>
                            <Text ff="monospace" fw={700} size="lg">
                                {fmtNum(m.used_gb)} / {fmtNum(m.included_gb)} {t('format.units.gb')}
                            </Text>
                        </Stack>
                    </Group>
                </Paper>
                <StatCard
                    hint={`${free ? t('metered.fee') : t('metered.minimum')} ${fmtMoney(m.min_charge)} · ${priceHint}`}
                    icon={PiCoinsDuotone}
                    title={t('metered.due_now')}
                    value={fmtMoney(m.cost_rub, 2)}
                />
                <StatCard
                    color={forecastOver ? 'orange' : 'teal'}
                    hint={
                        forecastOver
                            ? t(free ? 'metered.over_free' : 'metered.over_min', { gb: fmtNum(m.forecast_gb - m.included_gb) })
                            : t(free ? 'metered.within_free' : 'metered.within_min')
                    }
                    icon={PiChartLineUpDuotone}
                    title={t('metered.forecast')}
                    value={`${fmtNum(m.forecast_gb)} ${t('format.units.gb')} · ${fmtMoney(m.forecast_rub)}`}
                />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
                <SectionCard.Root gap="xs">
                    <SectionCard.Section>
                        <BaseOverlayHeader
                            IconComponent={PiChartLineUpDuotone}
                            iconColor="cyan"
                            subtitle={t('metered.daily_subtitle', { period: periodLabel, gb: fmtNum(m.used_gb) })}
                            title={t('metered.daily')}
                            titleOrder={6}
                        />
                    </SectionCard.Section>
                    <Box style={{ flex: 1, minHeight: 240 }}>
                        <AreaChart
                            h="100%"
                            data={m.daily.map((d) => ({ ...d, date: dayjs(d.date).format(t('format.date_short')) }))}
                            dataKey="date"
                            series={[{ name: 'gb', label: t('format.units.gb'), color: 'cyan.6' }]}
                            curveType="monotone"
                            fillOpacity={0.35}
                            strokeWidth={2}
                            withDots={false}
                            activeDotProps={{ r: 4, strokeWidth: 2 }}
                            gridAxis="y"
                            strokeDasharray="4 4"
                            tickLine="none"
                            xAxisProps={{ interval: 'preserveStartEnd', minTickGap: 24, tickMargin: 8 }}
                            yAxisProps={{ width: 44, tickMargin: 4, tickFormatter: (v: number) => fmtNum(v, 1) }}
                            referenceLines={
                                avgDaily > 0
                                    ? [{ y: avgDaily, color: 'gray.6', label: t('metered.avg_daily', { gb: fmtNum(avgDaily, 1) }), labelPosition: 'insideTopRight' }]
                                    : undefined
                            }
                            valueFormatter={(v) => `${fmtNum(v)} ${t('format.units.gb')}`}
                        />
                    </Box>
                </SectionCard.Root>
                <SectionCard.Root gap="xs">
                    <SectionCard.Section>
                        <BaseOverlayHeader
                            IconComponent={PiChartBarDuotone}
                            iconColor="indigo"
                            subtitle={
                                m.squad_uuid
                                    ? t('metered.squad_share', { pct: fmtNum(m.squad_share_percent, 1) })
                                    : t('metered.all_node_users')
                            }
                            title={t('metered.top_consumers')}
                            titleOrder={6}
                        />
                    </SectionCard.Section>
                    {m.consumer_error && (
                        <Text c="red" size="xs">
                            {m.consumer_error}
                        </Text>
                    )}
                    {m.top_consumers?.map((c) => (
                        <Group gap="xs" justify="space-between" key={c.rw_user_id} wrap="nowrap">
                            <Group gap={6} miw={0} wrap="nowrap">
                                <Text size="sm" style={{ flexShrink: 0 }}>
                                    {c.customer_id ? (
                                        <Anchor component={Link} size="sm" to={`/customers/${c.customer_id}`}>
                                            {c.customer_name}
                                        </Anchor>
                                    ) : (
                                        c.username || `#${c.rw_user_id}`
                                    )}
                                </Text>
                                {c.subscription_id && c.sub_title && (
                                    <Anchor
                                        c="dimmed"
                                        component="button"
                                        onClick={() =>
                                            openViewSubscriptionModal({ id: c.subscription_id!, title: c.sub_title, customer_name: c.customer_name })
                                        }
                                        size="xs"
                                        truncate="end"
                                    >
                                        {c.sub_title}
                                    </Anchor>
                                )}
                            </Group>
                            <Text c="dimmed" ff="monospace" size="xs" style={{ whiteSpace: 'nowrap' }}>
                                {fmtNum(c.gb)} {t('format.units.gb')} · {fmtNum(c.share_percent, 1)}% · ≈{fmtMoney(c.cost_rub)}
                            </Text>
                        </Group>
                    ))}
                </SectionCard.Root>
            </SimpleGrid>
        </Block>
    )
}
