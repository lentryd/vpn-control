// Adapted from remnawave/frontend (AGPL-3.0)
import { Card, Group, Stack, Text, ThemeIcon, ThemeIconProps } from '@mantine/core'
import { ReactNode } from 'react'

import { ShimmerSkeleton } from '@shared/ui/shimmer-skeleton'

import classes from './metric-card.module.css'

export interface IMetricCardProps {
    iconColor?: ThemeIconProps['color']
    IconComponent: React.ComponentType<{ size: number }>
    iconSize?: number
    iconVariant: ThemeIconProps['variant']
    isLoading?: boolean
    subtitle?: ReactNode
    themeIconProps?: ThemeIconProps
    title: string
    value: ReactNode
    rollingNumberComponent?: ReactNode
}

export function MetricCardShared(props: IMetricCardProps) {
    const {
        iconColor,
        themeIconProps,
        IconComponent,
        iconSize = 24,
        iconVariant,
        isLoading,
        title,
        value,
        subtitle,
        rollingNumberComponent
    } = props

    return (
        <Card>
            <Group gap="md" wrap="nowrap">
                <ThemeIcon
                    color={iconColor}
                    radius="lg"
                    size="xl"
                    variant={iconVariant}
                    {...themeIconProps}
                >
                    <IconComponent size={iconSize} />
                </ThemeIcon>

                <Stack gap={0} miw={0}>
                    <Text className={classes.title} truncate="end">
                        {title}
                    </Text>
                    {isLoading ? (
                        <ShimmerSkeleton height={24} width={80} />
                    ) : (
                        (rollingNumberComponent ?? (
                            <Text className={classes.value} component="div" truncate="end">
                                {typeof value === 'number' ? value.toLocaleString('ru-RU') : value}
                            </Text>
                        ))
                    )}
                    {subtitle && (
                        <Text className={classes.subtitle} component="div">
                            {subtitle}
                        </Text>
                    )}
                </Stack>
            </Group>
        </Card>
    )
}
