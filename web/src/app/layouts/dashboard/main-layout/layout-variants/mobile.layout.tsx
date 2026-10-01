// Adapted from remnawave/frontend (AGPL-3.0)
import { useClickOutside, useDisclosure } from '@mantine/hooks'

import { SidebarShellLayout } from './sidebar-shell.layout'

interface IProps {
    headerControls: React.ReactNode
}

export const MobileLayout = ({ headerControls }: IProps) => {
    const [opened, { toggle }] = useDisclosure()

    const ref = useClickOutside(() => {
        if (opened) toggle()
    })

    return (
        <SidebarShellLayout
            closedSide="mobile"
            headerControls={headerControls}
            navbarRef={ref}
            onNavClose={toggle}
            opened={opened}
            padding="md"
            toggle={toggle}
        />
    )
}
