// Adapted from remnawave/frontend (AGPL-3.0)
import { Text } from '@mantine/core'

import classes from './sidebar.module.css'

const titleParts = [
    { text: 'VPN', color: 'cyan' },
    { text: 'Control', color: 'white' }
]

export const SidebarTitleShared = () => (
    <Text className={classes.logoTitle}>
        {titleParts.map((part) => (
            <Text c={part.color} component="span" inherit key={part.text}>
                {part.text}
            </Text>
        ))}
    </Text>
)
