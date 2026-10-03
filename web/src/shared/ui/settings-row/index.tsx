import { Box, Card, Text } from '@mantine/core'
import type { ReactNode } from 'react'

import classes from './settings-row.module.css'

// SettingsGroup is a titled card of settings rows.
export function SettingsGroup({ title, description, actions, children }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
    return (
        <Card className={classes.group} padding={0}>
            <div className={classes.groupHeader}>
                <Box miw={0}>
                    <Text className={classes.groupTitle}>{title}</Text>
                    {description && (
                        <Text c="dimmed" mt={2} size="xs">
                            {description}
                        </Text>
                    )}
                </Box>
                {actions}
            </div>
            {children}
        </Card>
    )
}

// SettingsRow is one setting: what it is on the left, its control on the right.
export function SettingsRow({ label, description, children, wide }: { label: ReactNode; description?: ReactNode; children: ReactNode; wide?: boolean }) {
    return (
        <div className={classes.row} data-wide={wide || undefined}>
            <div className={classes.text}>
                <Text fw={500} size="sm">
                    {label}
                </Text>
                {description && (
                    <Text c="dimmed" component="div" mt={3} size="xs">
                        {description}
                    </Text>
                )}
            </div>
            <div className={classes.control}>{children}</div>
        </div>
    )
}
