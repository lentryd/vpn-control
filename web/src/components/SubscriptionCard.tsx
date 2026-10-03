import { Badge, Grid, Group, Paper, Stack, Text, ThemeIcon, Tooltip, UnstyledButton } from '@mantine/core'
import {
    PiArrowsClockwise,
    PiCalendarCheckDuotone,
    PiChartPieSliceDuotone,
    PiHexagonDuotone,
    PiPuzzlePieceDuotone,
    PiTagDuotone,
    PiWifiHighDuotone
} from 'react-icons/pi'

import type { RwUser, Subscription } from '@/api/types'
import { openViewAddonModal, openViewSubscriptionModal } from '@/modals/ViewItemModal'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { SectionCard } from '@shared/ui/section-card'

import { ExpireCell, OnlineCell, StatusBadge, TrafficCell, TrafficMini, trafficHint, trafficResetColor } from './badges'
import { fmtDate } from './format'
import { AddonActions, SubscriptionActions } from './ItemActions'
import { Money } from './ui'
import { useTranslation } from 'react-i18next'

const tileStyle = { background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(255, 255, 255, 0.06)' }

function AutoIcon({ on }: { on: boolean }) {
    const { t } = useTranslation()
    return (
        <Tooltip label={on ? t('card.auto_on') : t('card.auto_off')}>
            <PiArrowsClockwise color={on ? 'var(--mantine-color-teal-5)' : 'var(--mantine-color-dark-3)'} size={16} />
        </Tooltip>
    )
}

// Tile is one labelled fact of the card: an icon, a caption and its value.
function Tile({
    icon: Icon,
    color,
    label,
    extra,
    children
}: {
    icon: React.ComponentType<{ size: number }>
    color: string
    label: string
    extra?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <Paper h="100%" p="sm" radius="md" style={tileStyle}>
            <Group gap={8} mb={8} wrap="nowrap">
                <ThemeIcon color={color} radius="md" size="sm" variant="soft">
                    <Icon size={14} />
                </ThemeIcon>
                <Text c="dimmed" fw={500} size="xs" tt="uppercase" style={{ letterSpacing: 0.4 }}>
                    {label}
                    {extra && (
                        <Text c="dimmed" component="span" fw={500} size="xs" tt="none">
                            {' ('}
                            {extra})
                        </Text>
                    )}
                </Text>
            </Group>
            <Stack component="div" gap={2}>
                {children}
            </Stack>
        </Paper>
    )
}

// TrafficResetLabel is the reset date shown next to the traffic caption.
function TrafficResetLabel({ user }: { user: RwUser }) {
    const { t } = useTranslation()
    return (
        <Tooltip label={trafficHint(user)}>
            <Text c={trafficResetColor(user)} component="span" inherit>
                {user.next_traffic_reset_at ? t('traffic.reset_on', { date: fmtDate(user.next_traffic_reset_at) }) : t('traffic.no_reset')}
            </Text>
        </Tooltip>
    )
}

// SubscriptionCard is a section card per subscription on the customer page;
// clicking the header opens the subscription modal, as rows do in tables.
export function SubscriptionCard({ sub }: { sub: Subscription }) {
    const { t } = useTranslation()
    return (
        <SectionCard.Root>
            <SectionCard.Section>
                <Group justify="space-between" wrap="nowrap">
                    <UnstyledButton onClick={() => openViewSubscriptionModal(sub)}>
                        <BaseOverlayHeader
                            IconComponent={PiHexagonDuotone}
                            subtitle={sub.rw_user?.username ?? t('view.not_linked')}
                            title={sub.title}
                            titleOrder={5}
                        />
                    </UnstyledButton>
                    <Group gap="xs" wrap="nowrap">
                        <AutoIcon on={sub.auto_extend} />
                        <StatusBadge user={sub.rw_user} />
                        <SubscriptionActions sub={sub} />
                    </Group>
                </Group>
            </SectionCard.Section>
            <SectionCard.Section>
                <Grid columns={10} gap="xs">
                    <Grid.Col span={{ base: 10, xs: 5, lg: 2 }}>
                        <Tile color="cyan" icon={PiTagDuotone} label={t('tariffs.tariff')}>
                            <Text fw={600} size="sm" truncate="end">
                                {sub.tariff_name || '—'}
                            </Text>
                            <Group gap={6} wrap="nowrap">
                                <Text c="dimmed" size="xs">
                                    <Money value={sub.price} /> {t('card.per_month')}
                                </Text>
                                {sub.price_override !== null && (
                                    <Badge color="yellow" size="xs" variant="soft">
                                        {t('card.custom')}
                                    </Badge>
                                )}
                            </Group>
                        </Tile>
                    </Grid.Col>
                    <Grid.Col span={{ base: 10, xs: 5, lg: 2 }}>
                        <Tile color="teal" icon={PiCalendarCheckDuotone} label={t('sub.paid_until')}>
                            <ExpireCell align="flex-start" date={sub.rw_user?.expire_at} />
                        </Tile>
                    </Grid.Col>
                    <Grid.Col span={{ base: 10, xs: 6, lg: 4 }}>
                        <Tile color="blue" extra={sub.rw_user?.traffic_limit_bytes ? <TrafficResetLabel user={sub.rw_user} /> : undefined} icon={PiChartPieSliceDuotone} label={t('sub.traffic')}>
                            <TrafficCell user={sub.rw_user} withReset={false} />
                        </Tile>
                    </Grid.Col>
                    <Grid.Col span={{ base: 10, xs: 4, lg: 2 }}>
                        <Tile color="grape" icon={PiWifiHighDuotone} label={t('card.last_online')}>
                            <OnlineCell user={sub.rw_user} />
                        </Tile>
                    </Grid.Col>
                </Grid>
            </SectionCard.Section>
            {sub.addons.length > 0 && (
                <SectionCard.Section>
                    <Text c="dimmed" fw={500} mb={8} size="xs" tt="uppercase" style={{ letterSpacing: 0.4 }}>
                        {t('view.addons')}
                    </Text>
                    <Stack gap="xs">
                        {sub.addons.map((a) => (
                            <Paper key={a.id} p="sm" radius="md" style={tileStyle}>
                                <Grid align="center" columns={10} gap="sm">
                                    <Grid.Col span={{ base: 10, xs: 5, lg: 2 }}>
                                        <UnstyledButton maw="100%" onClick={() => openViewAddonModal(a.id, sub.id)}>
                                            <Group gap={10} wrap="nowrap">
                                                <ThemeIcon color="grape" radius="md" size="lg" variant="soft">
                                                    <PiPuzzlePieceDuotone size={20} />
                                                </ThemeIcon>
                                                <Stack gap={0} miw={0}>
                                                    <Group gap={6} wrap="nowrap">
                                                        <Text fw={600} size="sm" truncate="end">
                                                            {a.addon_name}
                                                        </Text>
                                                        <AutoIcon on={a.auto_extend} />
                                                    </Group>
                                                    <Text c="dimmed" size="xs" truncate="end">
                                                        {a.tariff_name || t('view.no_tariff')}
                                                        {' · '}
                                                        {a.included ? t('card.in_tariff') : <Money value={a.price} />}
                                                    </Text>
                                                </Stack>
                                            </Group>
                                        </UnstyledButton>
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 10, xs: 5, lg: 2 }}>
                                        <ExpireCell align="flex-start" date={a.rw_user?.expire_at} />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 10, xs: 6, lg: 4 }}>
                                        <TrafficMini user={a.rw_user} w="100%" />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 10, xs: 4, lg: 2 }}>
                                        <Group gap="xs" justify="flex-end" wrap="nowrap">
                                            <StatusBadge size="md" user={a.rw_user} />
                                            <AddonActions addon={a} subTitle={sub.title} />
                                        </Group>
                                    </Grid.Col>
                                </Grid>
                            </Paper>
                        ))}
                    </Stack>
                </SectionCard.Section>
            )}
        </SectionCard.Root>
    )
}
