// Cells follow remnawave/frontend (AGPL-3.0): widgets/dashboard/users/user-status-badge
// and entities/dashboard/users/ui/table-columns.
import { Badge, BadgeProps, Box, Group, Indicator, Progress, Stack, Text, Tooltip } from '@mantine/core'
import dayjs from 'dayjs'
import { PiClockCountdown, PiClockUser, PiLinkBreak, PiProhibit, PiPulse, PiTrash } from 'react-icons/pi'

import type { RwUser } from '@/api/types'
import i18n from '@/app/i18n/i18n'

import { dateLayout, daysLeft, fmtBytes, fmtDate, fmtDateTime, fromNow, isTrafficLow, isUnlimited, strategyLabel, trafficPct } from './format'

const statusMeta: Record<string, { color: BadgeProps['color']; icon: React.ReactNode }> = {
    ACTIVE: { color: 'teal', icon: <PiPulse size={18} /> },
    DISABLED: { color: 'shaded-gray', icon: <PiProhibit size={18} /> },
    LIMITED: { color: 'orange', icon: <PiClockCountdown size={18} /> },
    EXPIRED: { color: 'red', icon: <PiClockUser size={18} /> }
}

// statusLabel names a panel user status (and the app's own pseudo ones).
export const statusLabel = (status: string) =>
    ['ACTIVE', 'DISABLED', 'LIMITED', 'EXPIRED', 'UNLINKED', 'DELETED'].includes(status)
        ? i18n.t(`status.${status as 'ACTIVE'}`)
        : status

export function StatusBadge({ user, ...props }: { user: RwUser | null } & Omit<BadgeProps, 'children' | 'color'>) {
    if (!user) {
        return (
            <Badge color="yellow" leftSection={<PiLinkBreak size={18} />} size="lg" variant="soft" {...props}>
                {statusLabel('UNLINKED')}
            </Badge>
        )
    }
    if (user.deleted) {
        return (
            <Badge color="red" leftSection={<PiTrash size={18} />} size="lg" variant="soft" {...props}>
                {statusLabel('DELETED')}
            </Badge>
        )
    }
    return <StatusPill status={user.status} {...props} />
}

export function StatusPill({ status, ...props }: { status: string } & Omit<BadgeProps, 'children' | 'color'>) {
    const m = statusMeta[status] ?? { color: 'gray', icon: null }
    return (
        <Badge color={m.color} leftSection={m.icon} miw="13ch" size="lg" variant="soft" {...props}>
            {statusLabel(status)}
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
    if (!date) return i18n.t('expiry.unknown')
    const d = dayjs(date)
    if (isUnlimited(date)) return i18n.t('expiry.forever')
    if (d.isBefore(dayjs())) return i18n.t('expiry.expired', { ago: d.fromNow() })
    return i18n.t('expiry.expires_in', { in: d.fromNow(true) })
}

export function ExpireCell({ date, align = 'center' }: { date: string | null | undefined; align?: 'center' | 'flex-start' | 'flex-end' }) {
    const d = daysLeft(date)
    if (!date || d === null) return <Text c="dimmed">—</Text>
    if (isUnlimited(date))
        return (
            <Tooltip label={i18n.t('expiry.forever_hint', { date: dayjs(date).format(dateLayout()) })}>
                <Stack gap={0} align={align}>
                    <Text ff="monospace" fw={600} size="md">
                        ∞
                    </Text>
                    <Text c="teal" size="xs">
                        {i18n.t('expiry.forever')}
                    </Text>
                </Stack>
            </Tooltip>
        )
    return (
        <Tooltip label={fmtDateTime(date)}>
            <Stack gap={0} align={align}>
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
                    {!user ? i18n.t('users.not_in_panel') : user.online_at ? fromNow(user.online_at) : i18n.t('users.never_connected')}
                </Text>
            </Box>
        </Group>
    )
}

// TrafficInfo is what the traffic helpers need of a panel user.
export type TrafficInfo = Pick<RwUser, 'status' | 'used_traffic_bytes' | 'traffic_limit_bytes' | 'next_traffic_reset_at' | 'last_traffic_reset_at'>

// trafficColor is the panel's usage bar color.
export const trafficColor = (pct: number | null) => (pct === null ? 'teal' : pct > 95 ? 'red' : pct > 80 ? 'yellow.4' : 'teal')

// trafficResetColor highlights the reset of a user running out of traffic:
// yellow while a reset will free it, red if nothing will.
export const trafficResetColor = (user: TrafficInfo) => (!isTrafficLow(user) ? 'dimmed' : user.next_traffic_reset_at ? 'yellow.4' : 'red.5')

// trafficResetText says when a limited user's traffic is reset next.
export function trafficResetText(user: TrafficInfo) {
    if (!user.next_traffic_reset_at) return i18n.t('traffic.no_reset')
    return i18n.t('traffic.resets_in', { in: dayjs(user.next_traffic_reset_at).fromNow(true) })
}

// trafficHint is the tooltip of a limited user's traffic: what's left and
// when it was and will be reset.
export function trafficHint(user: TrafficInfo) {
    const left = Math.max(0, user.traffic_limit_bytes - user.used_traffic_bytes)
    return [
        i18n.t('traffic.left', { left: fmtBytes(left) }),
        user.next_traffic_reset_at ? i18n.t('traffic.next_reset', { date: fmtDateTime(user.next_traffic_reset_at) }) : i18n.t('traffic.no_reset'),
        user.last_traffic_reset_at && i18n.t('traffic.last_reset', { date: fmtDateTime(user.last_traffic_reset_at) })
    ]
        .filter(Boolean)
        .map((line) => <div key={line as string}>{line}</div>)
}

// TrafficCell is the panel's data-usage column, plus when the traffic is
// reset next — highlighted for users running out of it.
export function TrafficCell({ user, withReset = true }: { user: RwUser | null; withReset?: boolean }) {
    if (!user) return <Text c="dimmed">—</Text>
    const used = user.used_traffic_bytes
    const limit = user.traffic_limit_bytes
    const unlimited = !limit
    const pct = trafficPct(user) ?? 0
    const strategy = user.traffic_limit_strategy === 'NO_RESET' ? '∞' : strategyLabel(user.traffic_limit_strategy)
    const color = trafficColor(unlimited ? null : pct)

    const cell = (
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
            {withReset && !unlimited && (
                <Text c={trafficResetColor(user)} fw={550} size="xs" ta="center">
                    {trafficResetText(user)}
                </Text>
            )}
        </Box>
    )
    if (unlimited) return cell
    return <Tooltip label={trafficHint(user)}>{cell}</Tooltip>
}

// TrafficMini is a one-line usage meter for tight rows (add-ons on cards).
export function TrafficMini({ user, w = 150, withReset = true }: { user: TrafficInfo | null; w?: number | string; withReset?: boolean }) {
    if (!user) return null
    const limit = user.traffic_limit_bytes
    const pct = trafficPct(user)
    const body = (
        <Stack gap={3} w={w}>
            <Group gap={4} justify="space-between" wrap="nowrap">
                <Text c="dimmed" ff="monospace" size="xs">
                    {fmtBytes(user.used_traffic_bytes)} / {limit ? fmtBytes(limit) : '∞'}
                </Text>
                {pct !== null && (
                    <Text c={trafficColor(pct)} fw={600} size="xs">
                        {Math.round(pct)}%
                    </Text>
                )}
            </Group>
            <Progress color={trafficColor(pct)} radius="xs" size="xs" value={pct === null ? 100 : Math.min(100, pct)} />
            {withReset && limit > 0 && (
                <Text c={trafficResetColor(user)} size="xs">
                    {trafficResetText(user)}
                </Text>
            )}
        </Stack>
    )
    return limit ? <Tooltip label={trafficHint(user)}>{body}</Tooltip> : body
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
    if (!user?.online_at) return <Text c="dimmed" size="sm">{i18n.t('common.never')}</Text>
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
