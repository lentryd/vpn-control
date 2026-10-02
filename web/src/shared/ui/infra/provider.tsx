// Adapted from remnawave/frontend (AGPL-3.0): shared/ui/infra-billing/select-infra-provider
// and shared/utils/misc/favicon-resolver.
import { Autocomplete, AutocompleteProps, Avatar, Group, Text } from '@mantine/core'
import { useMemo } from 'react'

import { useInfra } from '@/api/hooks'
import type { InfraProvider } from '@/api/types'

export const faviconResolver = (faviconLink: null | string | undefined) => {
    if (!faviconLink) return null
    try {
        const url = new URL(faviconLink.includes('://') ? faviconLink : `https://${faviconLink}`)
        return `https://www.google.com/s2/favicons?sz=64&domain_url=${url.protocol}//${url.host}`
    } catch {
        return null
    }
}

// Tiny favicons (Google's 16px placeholder) are dropped so initials show.
const dropPlaceholder = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.target as HTMLImageElement
    if (img.naturalWidth <= 16 && img.naturalHeight <= 16) img.src = ''
}

export function ProviderAvatar({ name, faviconLink, size = 20 }: { name: string; faviconLink?: string | null; size?: number }) {
    return (
        <Avatar
            alt={name}
            color="initials"
            imageProps={{ decoding: 'async', loading: 'lazy' }}
            name={name}
            onLoad={dropPlaceholder}
            radius="sm"
            size={size}
            src={faviconResolver(faviconLink)}
            style={{ minWidth: size, minHeight: size }}
        />
    )
}

// useProviderLookup finds the panel provider for a stored uuid or name.
export function useProviderLookup() {
    const { data } = useInfra()
    return useMemo(() => {
        const providers = data?.providers ?? []
        return (uuid?: string | null, name?: string | null): InfraProvider | undefined =>
            providers.find((p) => (uuid && p.uuid === uuid) || (name && p.name.toLowerCase() === name.toLowerCase()))
    }, [data])
}

// ProviderLabel shows a provider the way the panel's Infra Billing does:
// favicon (or initials) and name.
export function ProviderLabel({ name, uuid, size = 'sm' }: { name: string; uuid?: string | null; size?: 'xs' | 'sm' | 'md' }) {
    const lookup = useProviderLookup()
    if (!name) return <Text c="dimmed">—</Text>
    const p = lookup(uuid, name)
    return (
        <Group gap="sm" wrap="nowrap">
            <ProviderAvatar faviconLink={p?.faviconLink} name={p?.name ?? name} size={size === 'md' ? 24 : 20} />
            <Text fw={500} size={size} truncate="end">
                {p?.name ?? name}
            </Text>
        </Group>
    )
}

type ProviderInputProps = Omit<AutocompleteProps, 'data' | 'onChange' | 'value'> & {
    value: string
    // extra names (e.g. from past expenses) offered besides panel providers
    extra?: string[]
    onChange: (name: string, uuid: string) => void
}

// ProviderInput picks a provider from the panel's Infra Billing (with
// favicons) and still accepts any other name.
export function ProviderInput({ value, extra = [], onChange, ...props }: ProviderInputProps) {
    const { data } = useInfra()
    const lookup = useProviderLookup()
    const providers = data?.providers ?? []
    const names = useMemo(() => {
        const panel = providers.map((p) => p.name)
        const lower = new Set(panel.map((n) => n.toLowerCase()))
        return [...panel, ...extra.filter((n) => n && !lower.has(n.toLowerCase()))]
    }, [providers, extra])
    const current = lookup(null, value)

    return (
        <Autocomplete
            data={[...new Set(names)]}
            description={data?.error ? 'Провайдеры из панели недоступны: нужен доступ токена к Infra Billing' : undefined}
            leftSection={value ? <ProviderAvatar faviconLink={current?.faviconLink} name={value} size={16} /> : undefined}
            onChange={(name) => onChange(name, lookup(null, name)?.uuid ?? '')}
            renderOption={({ option }) => {
                const p = lookup(null, option.value)
                return (
                    <Group gap="sm" wrap="nowrap">
                        <ProviderAvatar faviconLink={p?.faviconLink} name={option.value} />
                        <Text fw={500} size="sm">
                            {option.value}
                        </Text>
                        {!p && (
                            <Text c="dimmed" size="xs">
                                не из панели
                            </Text>
                        )}
                    </Group>
                )
            }}
            value={value}
            {...props}
        />
    )
}
