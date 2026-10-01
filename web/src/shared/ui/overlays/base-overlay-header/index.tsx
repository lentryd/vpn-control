// Adapted from remnawave/frontend (AGPL-3.0)
import { Group, Stack, Text, ThemeIcon, ThemeIconProps, Title, TitleProps } from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import { ReactNode } from 'react'

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

export const BaseOverlayHeader = (props: IProps) => {
    const {
        themeIconProps,
        IconComponent,
        iconSize = 20,
        iconVariant = 'soft',
        iconColor = 'cyan',
        subtitle,
        title,
        titleOrder = 4,
        withCopy = false,
        hideIcon = false,
        icon,
        truncateTitle = false
    } = props

    const { copy } = useClipboard()

    return (
        <Group gap="sm" style={truncateTitle ? { minWidth: 0 } : undefined} wrap="nowrap">
            {!hideIcon && (
                <ThemeIcon color={iconColor} size="lg" variant={iconVariant} {...themeIconProps}>
                    <IconComponent size={iconSize} />
                </ThemeIcon>
            )}

            {icon ?? icon}

            <Stack gap="0" style={truncateTitle ? { overflow: 'hidden' } : undefined}>
                <Title
                    c="white"
                    onClick={() => withCopy && typeof title === 'string' && copy(title)}
                    order={titleOrder}
                    style={{
                        cursor: withCopy ? 'copy' : 'default',
                        ...(truncateTitle && {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        })
                    }}
                >
                    {title}
                </Title>
                {subtitle && (
                    <Text c="dimmed" size="xs">
                        {subtitle}
                    </Text>
                )}
            </Stack>
        </Group>
    )
}
