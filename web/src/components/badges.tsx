// Cells follow remnawave/frontend (AGPL-3.0): widgets/dashboard/users/user-status-badge
// and entities/dashboard/users/ui/table-columns.
import { Badge, BadgeProps, Box, Group, Indicator, Progress, Stack, Text, Tooltip } from '@mantine/core'
import dayjs from 'dayjs'
import { PiClockCountdown, PiClockUser, PiLinkBreak, PiProhibit, PiPulse, PiTrash } from 'react-icons/pi'

import type { RwUser } from '@/api/types'

import { daysLeft, fmtBytes, fmtDate, fmtDateTime, fromNow, isUnlimited, strategyLabel } from './format'

const statusMeta: Record<string, { color: BadgeProps['color']; label: string; icon: React.ReactNode }> = {
    ACTIVE: { color: 'teal', label: 'Активна', icon: <PiPulse size={18} /> },
    DISABLED: { color: 'shaded-gray', label: 'Отключена', icon: <PiProhibit size={18} /> },
    LIMITED: { color: 'orange', label: 'Лимит', icon: <PiClockCountdown size={18} /> },
    EXPIRED: { color: 'red', label: 'Истекла', icon: <PiClockUser size={18} /> }
}

export function StatusBadge({ user, ...props }: { user: RwUser | null } & Omit<BadgeProps, 'children' | 'color'>) {
    if (!user) {
        return (
            <Badge color="yellow" leftSection={<PiLinkBreak size={18} />} size="lg" variant="soft" {...props}>
                Не привязана
            </Badge>
        )
    }
    if (user.deleted) {
        return (
            <Badge color="red" leftSection={<PiTrash size={18} />} size="lg" variant="soft" {...props}>
                Удалена
            </Badge>
        )
    }
    return <StatusPill status={user.status} {...props} />
}

export function StatusPill({ status, ...props }: { status: string } & Omit<BadgeProps, 'children' | 'color'>) {
    const m = statusMeta[status] ?? { color: 'gray', label: status, icon: null }
    return (
        <Badge color={m.color} leftSection={m.icon} miw="13ch" size="lg" variant="soft" {...props}>
            {m.label}
        </Badge>
    )
}

export function expiryColor(days: number | null) {
    if (days === null) return 'gray'
    if (days < 0) return 'red'
    if (days <= 3) return 'orange'
    if (days <= 7) return 'yellow'
    return 'teal'
}

// expirationText mirrors the panel's get-expiration-text util.
export function expirationText(date: string | null | undefined) {
    if (!date) return 'неизвестно'
    const d = dayjs(date)
    if (isUnlimited(date)) return 'бессрочно'
    if (d.isBefore(dayjs())) return `истекла ${d.fromNow()}`
    return `истекает через ${d.fromNow(true)}`
}

export function ExpireCell({ date }: { date: string | null | undefined }) {
    const d = daysLeft(date)
    if (!date || d === null) return <Text c="dimmed">—</Text>
    if (isUnlimited(date))
        return (
            <Tooltip label={`${dayjs(date).format('DD.MM.YYYY')} — в панели «навсегда»`}>
                <Stack gap={0} align="center">
                    <Text ff="monospace" fw={600} size="md">
                        ∞
                    </Text>
                    <Text c="teal" size="xs">
                        бессрочно
                    </Text>
                </Stack>
            </Tooltip>
        )
    return (
        <Tooltip label={fmtDateTime(date)}>
            <Stack gap={0} align="center">
                <Text ff="monospace" fw={500} size="sm">
                    {fmtDate(date)}
                </Text>
                <Text c={expiryColor(d)} size="xs">
                    {expirationText(date)}
                </Text>
            </Stack>
        </Tooltip>
    )
}

function connectionColor(onlineAt: string | null | undefined) {
    if (!onlineAt) return 'var(--mantine-color-yellow-5)'
    return dayjs().diff(dayjs(onlineAt), 'second') <= 60 ? 'var(--mantine-color-teal-5)' : 'var(--mantine-color-red-5)'
}

// UsernameCell is the panel's username column: connection indicator, name
// and when the user was last online.
export function UsernameCell({ user, title, badge }: { user: RwUser | null; title?: string; badge?: React.ReactNode }) {
    return (
        <Group align="center" gap="md" pl={10} wrap="nowrap">
            <Indicator color={user ? connectionColor(user.online_at) : 'var(--mantine-color-dark-3)'} inline size={12} zIndex={0} />
            <Box miw={0} w="100%">
                <Group gap={6} wrap="nowrap">
                    {badge}
                    <Text fw={500} size="sm" truncate="end">
                        {title ?? user?.username ?? '—'}
                    </Text>
                </Group>
                <Text c="dimmed" fw={600} size="xs" truncate="end">
                    {!user ? 'нет в панели' : user.online_at ? fromNow(user.online_at) : 'ещё не подключался'}
                </Text>
            </Box>
        </Group>
    )
}

// TrafficCell is the panel's data-usage column.
export function TrafficCell({ user }: { user: RwUser | null }) {
    if (!user) return <Text c="dimmed">—</Text>
    const used = user.used_traffic_bytes
    const limit = user.traffic_limit_bytes
    const unlimited = !limit
    const pct = unlimited ? 0 : (used * 100) / limit
    const strategy = user.traffic_limit_strategy === 'NO_RESET' ? '∞' : strategyLabel[user.traffic_limit_strategy]
    const color = unlimited ? 'teal' : pct > 95 ? 'red' : pct > 80 ? 'yellow.4' : 'teal'

    return (
        <Box miw={220}>
            <Group justify="space-between">
                <Text c="red.5" fw={700} fz="xs">
                    {pct.toFixed(2)}%
                    <Text c="dimmed" component="span" fz="xs">
                        {' '}
                        {strategy}
                    </Text>
                </Text>
                <Text c="teal.5" fw={700} fz="xs">
                    {(100 - pct).toFixed(2)}%
                </Text>
            </Group>
            <Progress color={color} radius="xs" size="md" value={unlimited ? 100 : Math.min(100, pct)} />
            <Group gap="xs" justify="space-between" mt={2}>
                <Text c="dimmed" fw={550} size="xs">
                    {fmtBytes(used)}
                </Text>
                <Text c="dimmed" fw={550} size="xs">
                    {unlimited ? '∞' : fmtBytes(limit)}
                </Text>
            </Group>
        </Box>
    )
}

// lastSeenColor follows the panel's last-seen indicator: green within 5
// minutes, yellow within an hour, red otherwise.
export function lastSeenColor(onlineAt: string | null | undefined) {
    const minutes = onlineAt ? dayjs().diff(dayjs(onlineAt), 'minute') : null
    if (minutes === null) return 'gray'
    if (minutes <= 5) return 'teal'
    if (minutes <= 60) return 'yellow'
    return 'red'
}

export function OnlineCell({ user }: { user: RwUser | null }) {
    if (!user?.online_at) return <Text c="dimmed" size="sm">никогда</Text>
    return (
        <Tooltip label={fmtDateTime(user.online_at)}>
            <Group gap="xs" wrap="nowrap">
                <Box bg={`${lastSeenColor(user.online_at)}.5`} h={8} miw={8} style={{ borderRadius: '50%' }} w={8} />
                <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
                    {fromNow(user.online_at)}
                </Text>
            </Group>
        </Tooltip>
    )
}
