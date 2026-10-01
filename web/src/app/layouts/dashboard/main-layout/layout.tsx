// Adapted from remnawave/frontend (AGPL-3.0)
import { Group } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'

import { LogoutControl } from '@shared/ui/header-buttons'

import { SyncControl } from './header/sync-control'
import { CompactLayout } from './layout-variants/compact.layout'
import { MobileLayout } from './layout-variants/mobile.layout'

export function MainLayout() {
    const isMobile = useMediaQuery('(max-width: 64em)', undefined, { getInitialValueInEffect: false })
    const isHiResDesktop = useMediaQuery(`(min-width: 2048px)`, undefined, {
        getInitialValueInEffect: false
    })

    const headerControls = (
        <Group gap="xs" wrap="nowrap">
            <SyncControl />
            <LogoutControl />
        </Group>
    )

    if (isMobile) {
        return <MobileLayout headerControls={headerControls} />
    }

    return <CompactLayout headerControls={headerControls} isHiResDesktop={isHiResDesktop} />
}
