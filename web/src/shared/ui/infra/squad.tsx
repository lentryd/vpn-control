import { Badge, BadgeProps, type SelectProps } from '@mantine/core'
import { PiUsersThreeDuotone } from 'react-icons/pi'

import { useSquads } from '@/api/hooks'
import { SearchSelect } from '../forms/search-select'

export function useSquadName() {
    const squads = useSquads()
    return (uuid: string) => squads.data?.find((s) => s.uuid === uuid)?.name ?? 'сквад'
}

// SquadBadge shows an internal squad by name, as the panel's squad chips.
export function SquadBadge({ uuid, ...props }: { uuid: string } & Omit<BadgeProps, 'children'>) {
    const name = useSquadName()
    return (
        <Badge color="violet" leftSection={<PiUsersThreeDuotone size={14} />} variant="soft" w="fit-content" {...props}>
            {name(uuid)}
        </Badge>
    )
}

export function SquadSelect(props: Omit<SelectProps, 'data'>) {
    const squads = useSquads()
    return (
        <SearchSelect
            data={(squads.data ?? []).map((s) => ({ value: s.uuid, label: `${s.name} · ${s.info.membersCount} польз.` }))}
            leftSection={<PiUsersThreeDuotone size={16} />}
            nothingFoundMessage="Нет сквадов"
            {...props}
        />
    )
}
