import { Group, Text, ThemeIconProps } from '@mantine/core'
import type { ReactNode } from 'react'

import { MetricCardShared } from '@shared/ui/metrics/metric-card'
import { PageHeaderShared } from '@shared/ui/page-header'

import { fmtMoney } from './format'

// PageHeader is the panel's page header card: soft icon, title,
// description and actions on the right.
export function PageHeader({
    title,
    description,
    actions,
    icon
}: {
    title: ReactNode
    description?: ReactNode
    actions?: ReactNode
    icon: ReactNode
}) {
    return <PageHeaderShared actions={actions} description={description} icon={icon} title={title} wrapActions />
}

// StatCard is the panel's metric card.
export function StatCard({
    title,
    value,
    hint,
    icon,
    color = 'cyan'
}: {
    title: string
    value: ReactNode
    hint?: ReactNode
    icon: React.ComponentType<{ size: number }>
    color?: ThemeIconProps['color']
}) {
    return <MetricCardShared IconComponent={icon} iconColor={color} iconVariant="soft" subtitle={hint} title={title} value={value} />
}

export function Money({ value, signed, digits = 0 }: { value: number | null | undefined; signed?: boolean; digits?: 0 | 2 }) {
    if (value === null || value === undefined) return <Text c="dimmed">—</Text>
    const color = signed ? (value > 0 ? 'teal' : value < 0 ? 'red' : undefined) : undefined
    return (
        <Text span c={color} fw={500} inherit style={{ whiteSpace: 'nowrap' }}>
            {signed && value > 0 ? '+' : ''}
            {fmtMoney(value, digits)}
        </Text>
    )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
    return (
        <Group justify="space-between" mb="sm">
            <Text fw={600}>{children}</Text>
            {right}
        </Group>
    )
}
