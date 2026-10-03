import { Box, Group, Text, ThemeIcon, type ThemeIconProps, type TitleProps } from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import type { ReactNode } from 'react'

type IProps = {
    hideIcon?: boolean
    icon?: ReactNode
    iconColor?: ThemeIconProps['color']
    IconComponent: React.ComponentType<{ size: number }>
    iconSize?: number
    iconVariant?: ThemeIconProps['variant']
    subtitle?: ReactNode | string
    themeIconProps?: ThemeIconProps
    title: ReactNode
    titleOrder?: TitleProps['order']
    truncateTitle?: boolean
    withCopy?: boolean
}

const titleSize: Record<number, number> = { 1: 20, 2: 18, 3: 17, 4: 16, 5: 15, 6: 14 }

// BaseOverlayHeader titles modals and form sections: tinted icon tile,
// title and a muted subtitle.
export const BaseOverlayHeader = (props: IProps) => {
    const {
        themeIconProps,
        IconComponent,
        iconSize = 18,
        iconVariant = 'soft',
        iconColor = 'brand',
        subtitle,
        title,
        titleOrder = 4,
        withCopy = false,
        hideIcon = false,
        icon,
        truncateTitle = false
    } = props

    const { copy } = useClipboard()
    const size = titleOrder <= 4 ? 36 : 32

    return (
        <Group gap={12} style={{ minWidth: 0 }} wrap="nowrap">
            {!hideIcon && (
                <ThemeIcon color={iconColor} radius="md" size={size} variant={iconVariant} {...themeIconProps}>
                    <IconComponent size={iconSize} />
                </ThemeIcon>
            )}
            {icon}
            <Box miw={0} style={truncateTitle ? { overflow: 'hidden' } : undefined}>
                <Text
                    c="var(--app-text-strong)"
                    fw={600}
                    fz={titleSize[titleOrder] ?? 16}
                    lh={1.3}
                    onClick={() => withCopy && typeof title === 'string' && copy(title)}
                    style={{ letterSpacing: '-0.01em', cursor: withCopy ? 'copy' : undefined }}
                    truncate={truncateTitle ? 'end' : undefined}
                >
                    {title}
                </Text>
                {subtitle && (
                    <Text c="dimmed" component="div" lh={1.4} mt={2} size="xs">
                        {subtitle}
                    </Text>
                )}
            </Box>
        </Group>
    )
}
