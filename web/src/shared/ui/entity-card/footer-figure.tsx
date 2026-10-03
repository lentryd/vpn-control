import { Box, Text } from '@mantine/core'
import type { ReactNode } from 'react'

// FooterFigure is a small caption-over-value pair for a card footer.
export function FooterFigure({ label, align, children }: { label: ReactNode; align?: 'right'; children: ReactNode }) {
    return (
        <Box miw={0} ta={align}>
            <Text c="dimmed" size="xs">
                {label}
            </Text>
            <Text className="num" component="div" fw={600} size="sm" truncate="end">
                {children}
            </Text>
        </Box>
    )
}
