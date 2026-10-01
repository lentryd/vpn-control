// Adapted from remnawave/frontend (AGPL-3.0): features/dashboard/users/users-table/model/node-select-item
// and widgets/dashboard/nodes/node-status-badge.
import { Group, Indicator, Select, SelectProps, Text, Tooltip } from '@mantine/core'
import ReactCountryFlag from 'react-country-flag'
import { HiServer } from 'react-icons/hi'

import { useNodes } from '@/api/hooks'
import type { RwNode } from '@/api/types'

export function CountryFlag({ code, size = '1.1em' }: { code?: string | null; size?: string }) {
    if (!code || code === 'XX') return <HiServer size={14} />
    return <ReactCountryFlag countryCode={code} style={{ fontSize: size, borderRadius: '2px' }} />
}

function nodeColor(n?: RwNode) {
    if (!n) return 'gray'
    if (n.isDisabled) return 'gray'
    return n.isConnected ? 'teal' : 'red'
}

// NodeLabel shows a node as the panel does: status dot, flag and name.
export function NodeLabel({ uuid, fallback, size = 'sm' }: { uuid?: string | null; fallback?: string; size?: 'xs' | 'sm' }) {
    const { data } = useNodes()
    const n = data?.find((x) => x.uuid === uuid)
    if (!uuid && !fallback) return <Text c="dimmed">—</Text>
    return (
        <Tooltip
            disabled={!n}
            label={n ? `${n.address} · ${n.isDisabled ? 'отключена' : n.isConnected ? 'в сети' : 'не в сети'} · онлайн ${n.usersOnline}` : ''}
        >
            <Group gap="xs" wrap="nowrap">
                <Indicator color={nodeColor(n)} inline processing={n?.isConnected} size={8} zIndex={0} />
                <CountryFlag code={n?.countryCode} />
                <Text fw={500} size={size} truncate="end">
                    {n?.name ?? fallback ?? uuid}
                </Text>
            </Group>
        </Tooltip>
    )
}

// NodeSelect is a Select of panel nodes with flags, like the panel's filters.
export function NodeSelect(props: Omit<SelectProps, 'data'>) {
    const { data } = useNodes()
    const nodes = data ?? []
    const selected = nodes.find((n) => n.uuid === props.value)
    return (
        <Select
            data={nodes.map((n) => ({ value: n.uuid, label: n.name }))}
            leftSection={selected ? <CountryFlag code={selected.countryCode} /> : <HiServer size={16} />}
            renderOption={({ option, checked }) => {
                const n = nodes.find((x) => x.uuid === option.value)
                return (
                    <Group gap="sm" wrap="nowrap" fw={checked ? 600 : undefined}>
                        <Indicator color={nodeColor(n)} inline size={8} zIndex={0} />
                        <CountryFlag code={n?.countryCode} />
                        <Text size="sm">{option.label}</Text>
                        {n && (
                            <Text c="dimmed" size="xs">
                                {n.address}
                            </Text>
                        )}
                    </Group>
                )
            }}
            searchable
            {...props}
        />
    )
}
