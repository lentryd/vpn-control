import { Divider } from '@mantine/core'
import type { ReactNode } from 'react'

export function SettingsCardBottom({ children }: { children: ReactNode }) {
    return (
        <>
            <Divider mt="md" />
            {children}
        </>
    )
}
