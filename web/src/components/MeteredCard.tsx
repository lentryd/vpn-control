import { AreaChart } from '@mantine/charts'
import { Alert, Anchor, Badge, Box, Card, Group, Progress, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import { IconCloud } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import type { MeteredSummary } from '@/api/types'
import { dateLayout, fmtMoney, fmtNum } from '@/components/format'
import { codedText } from '@/components/notify'
import { openViewSubscriptionModal } from '@/modals/ViewItemModal'
import { NodeLabel } from '@shared/ui/infra/node'
import { SquadBadge } from '@shared/ui/infra/squad'
import { DataTableShared } from '@shared/ui/table'

function Figure({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string }) {
    return (
        <Box>
            <Text c="dimmed" fw={500} size="xs">
                {label}
            </Text>
            <Text c={tone} className="num" fw={600} fz={22} lh={1.25} mt={4} style={{ letterSpacing: '-0.02em' }}>
                {value}
            </Text>
            {hint && (
                <Text c="dimmed" mt={2} size="xs">
                    {hint}
                </Text>
            )}
        </Box>
    )
}

// MeteredCard is a per-GB expense item for its current billing period: use
// against the allowance, what's due, the forecast, daily traffic and who
// used the most.
export function MeteredCard({ m }: { m: MeteredSummary }) {
    const { t } = useTranslation()
    if (m.error) {
        return (
            <Alert color="yellow" icon={<IconCloud size={18} />} mb="md" title={m.name}>
                {codedText(m.error, m.error_code, m.error_params)}
            </Alert>
        )
    }
    const progress = m.included_gb ? Math.min(100, (m.used_gb / m.included_gb) * 100) : 0
    const forecastOver = m.forecast_gb > m.included_gb
    const avgDaily = m.daily.length ? m.daily.reduce((sum, d) => sum + d.gb, 0) / m.daily.length : 0
    const free = m.min_mode === 'free'
    const gb = t('format.units.gb')
    // a period starting on the 1st reads as a month, any other as dates
    const periodLabel =
        dayjs(m.period_start).date() === 1
            ? dayjs(m.period_start).format('MMMM YYYY')
            : `${dayjs(m.period_start).format(t('format.date_short'))} – ${dayjs(m.period_end).format(dateLayout())}`
    const priceHint = m.tiers?.length ? t('metered.tiered_price') : t('metered.per_gb_over', { price: fmtMoney(m.price_per_gb, 2) })
    const maxGb = Math.max(...(m.top_consumers ?? []).map((c) => c.gb), 1)

    return (
        <DataTableShared.Container mb="md">
            <DataTableShared.Title
                actions={<Badge size="lg">{periodLabel}</Badge>}
                description={
                    <Group component="span" gap="xs" mt={2}>
                        <NodeLabel fallback={m.node_name} size="xs" uuid={m.node_uuid} />
                        {m.squad_uuid && <SquadBadge size="sm" uuid={m.squad_uuid} />}
                    </Group>
                }
                icon={<IconCloud />}
                title={t('metered.card_title', { name: m.name })}
            />
            <Card.Section p="lg">
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl" verticalSpacing="lg">
                    <Box>
                        <Figure
                            label={free ? t('metered.used_free') : t('metered.used_min')}
                            value={
                                <>
                                    {fmtNum(m.used_gb)}
                                    <Text c="dimmed" component="span" fw={500} fz={14}>
                                        {' '}
                                        / {fmtNum(m.included_gb)} {gb}
                                    </Text>
                                </>
                            }
                        />
                        <Progress color={progress >= 100 ? 'orange' : 'brand'} mt={10} size={6} value={progress} />
                    </Box>
                    <Figure
                        hint={`${free ? t('metered.fee') : t('metered.minimum')} ${fmtMoney(m.min_charge)} · ${priceHint}`}
                        label={t('metered.due_now')}
                        value={fmtMoney(m.cost_rub, 2)}
                    />
                    <Figure
                        hint={
                            forecastOver
                                ? t(free ? 'metered.over_free' : 'metered.over_min', { gb: fmtNum(m.forecast_gb - m.included_gb) })
                                : t(free ? 'metered.within_free' : 'metered.within_min')
                        }
                        label={t('metered.forecast')}
                        tone={forecastOver ? 'orange' : undefined}
                        value={`${fmtNum(m.forecast_gb)} ${gb} · ${fmtMoney(m.forecast_rub)}`}
                    />
                </SimpleGrid>
            </Card.Section>
            <Card.Section p="lg" style={{ borderTop: '1px solid var(--app-border)' }}>
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
                    <Stack gap="xs">
                        <Box>
                            <Text fw={600} size="sm">
                                {t('metered.daily')}
                            </Text>
                            <Text c="dimmed" size="xs">
                                {t('metered.daily_subtitle', { period: periodLabel, gb: fmtNum(m.used_gb) })}
                            </Text>
                        </Box>
                        <AreaChart
                            activeDotProps={{ r: 4, strokeWidth: 2, stroke: 'var(--app-surface)' }}
                            curveType="monotone"
                            data={m.daily.map((d) => ({ ...d, date: dayjs(d.date).format(t('format.date_short')) }))}
                            dataKey="date"
                            fillOpacity={0.18}
                            gridAxis="x"
                            gridProps={{ stroke: 'var(--chart-grid)' }}
                            h={220}
                            referenceLines={
                                avgDaily > 0
                                    ? [{ y: avgDaily, color: 'var(--app-text-faint)', label: t('metered.avg_daily', { gb: fmtNum(avgDaily, 1) }), labelPosition: 'insideTopRight' }]
                                    : undefined
                            }
                            series={[{ name: 'gb', label: gb, color: 'var(--chart-income)' }]}
                            strokeDasharray="0"
                            strokeWidth={2}
                            tickLine="none"
                            valueFormatter={(v) => `${fmtNum(v)} ${gb}`}
                            withDots={false}
                            xAxisProps={{ interval: 'preserveStartEnd', minTickGap: 24, tickMargin: 8 }}
                            yAxisProps={{ width: 40, tickMargin: 4, tickFormatter: (v: number) => fmtNum(v, 1) }}
                        />
                    </Stack>
                    <Stack gap="sm">
                        <Box>
                            <Text fw={600} size="sm">
                                {t('metered.top_consumers')}
                            </Text>
                            <Text c="dimmed" size="xs">
                                {m.squad_uuid ? t('metered.squad_share', { pct: fmtNum(m.squad_share_percent, 1) }) : t('metered.all_node_users')}
                            </Text>
                            <Text c="dimmed" size="xs">
                                {t('metered.consumers_legend', { forecast: fmtMoney(m.forecast_rub) })}
                            </Text>
                        </Box>
                        {m.consumer_error && (
                            <Text c="red" size="xs">
                                {m.consumer_error}
                            </Text>
                        )}
                        {m.top_consumers?.map((c) => (
                            <Box key={c.rw_user_id}>
                                <Group gap="xs" justify="space-between" wrap="nowrap">
                                    <Group gap={6} miw={0} wrap="nowrap">
                                        <Text fw={500} size="sm" style={{ flexShrink: 0 }}>
                                            {c.customer_id ? (
                                                <Anchor component={Link} inherit to={`/customers/${c.customer_id}`}>
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
                                                onClick={() => openViewSubscriptionModal({ id: c.subscription_id!, title: c.sub_title, customer_name: c.customer_name })}
                                                size="xs"
                                                truncate="end"
                                            >
                                                {c.sub_title}
                                            </Anchor>
                                        )}
                                    </Group>
                                    <Tooltip
                                        label={t('metered.consumer_hint', {
                                            gb: `${fmtNum(c.gb)} ${gb}`,
                                            pct: fmtNum(c.share_percent, 1),
                                            cost: fmtMoney(c.cost_rub),
                                            forecast: fmtMoney(m.forecast_rub),
                                            scope: m.squad_uuid ? t('metered.scope_squad') : t('metered.scope_node'),
                                        })}
                                        multiline
                                        style={{ whiteSpace: 'pre-line' }}
                                        w={320}
                                        withArrow
                                    >
                                        <Text c="dimmed" className="num" size="xs" style={{ whiteSpace: 'nowrap', cursor: 'help' }}>
                                            {fmtNum(c.gb)} {gb} · {fmtNum(c.share_percent, 1)}% · ≈{fmtMoney(c.cost_rub)}
                                        </Text>
                                    </Tooltip>
                                </Group>
                                <Progress color="brand" mt={5} size={4} value={(c.gb / maxGb) * 100} />
                            </Box>
                        ))}
                    </Stack>
                </SimpleGrid>
            </Card.Section>
        </DataTableShared.Container>
    )
}
