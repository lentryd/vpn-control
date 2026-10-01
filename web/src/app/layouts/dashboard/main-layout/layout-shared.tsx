// Adapted from remnawave/frontend (AGPL-3.0)
import { AppShell, Group, GroupProps } from '@mantine/core'
import { Outlet } from 'react-router'

import { SidebarLogoShared, SidebarTitleShared } from '@shared/ui/sidebar'

type LayoutMainProps = Omit<React.ComponentProps<typeof AppShell.Main>, 'children'>

export const LayoutMain = (props: LayoutMainProps) => (
    <AppShell.Main {...props}>
        <Outlet />
    </AppShell.Main>
)

export const LayoutBrand = (props: GroupProps) => (
    <Group {...props}>
        <SidebarLogoShared />
        <SidebarTitleShared />
    </Group>
)
