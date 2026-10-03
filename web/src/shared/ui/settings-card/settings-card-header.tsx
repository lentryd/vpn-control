import { Box, Divider, Group, Text, ThemeIcon, type ThemeIconProps } from '@mantine/core'
import type { ReactNode } from 'react'

interface SettingsCardHeaderProps {
    description: ReactNode | string
    icon: ReactNode
    iconColor?: ThemeIconProps['color']
    iconVariant?: ThemeIconProps['variant']
    title: string
}

// SettingsCardHeader: tinted icon, title and what the block is for.
export function SettingsCardHeader({ description, icon, iconColor = 'brand', iconVariant = 'soft', title }: SettingsCardHeaderProps) {
    return (
        <Box>
            <Group align="flex-start" gap="md" wrap="nowrap">
                <ThemeIcon color={iconColor} radius="md" size={36} variant={iconVariant}>
                    {icon}
                </ThemeIcon>
                <Box miw={0}>
                    <Text c="var(--app-text-strong)" fw={600} fz={15} lh={1.3}>
                        {title}
                    </Text>
                    <Text c="dimmed" component="div" mt={2} size="sm">
                        {description}
                    </Text>
                </Box>
            </Group>
            <Divider my="md" />
        </Box>
    )
}
