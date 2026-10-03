import { Box, Card, Group, Skeleton, Text, ThemeIcon, type ThemeIconProps } from '@mantine/core'
import type { ReactNode } from 'react'

import { fmtLocale } from '@/components/format'

import classes from './metric-card.module.css'

export interface IMetricCardProps {
    iconColor?: ThemeIconProps['color']
    IconComponent: React.ComponentType<{ size: number }>
    iconSize?: number
    iconVariant?: ThemeIconProps['variant']
    isLoading?: boolean
    subtitle?: ReactNode
    themeIconProps?: ThemeIconProps
    title: string
    value: ReactNode
    rollingNumberComponent?: ReactNode
    // footer slot under the numbers: a sparkline, a meter
    children?: ReactNode
}

// MetricCardShared is a KPI tile: label with a tinted icon, a large figure
// and a muted line of context.
export function MetricCardShared(props: IMetricCardProps) {
    const { iconColor = 'brand', themeIconProps, IconComponent, iconSize = 17, iconVariant = 'soft', isLoading, title, value, subtitle, rollingNumberComponent, children } = props

    return (
        <Card className={classes.card} h="100%" padding="lg">
            <Group align="flex-start" gap="sm" justify="space-between" wrap="nowrap">
                <Text className={classes.title}>{title}</Text>
                <ThemeIcon color={iconColor} radius="md" size={30} variant={iconVariant} {...themeIconProps}>
                    <IconComponent size={iconSize} />
                </ThemeIcon>
            </Group>
            {isLoading ? (
                <Skeleton h={30} mt={6} w={120} />
            ) : (
                (rollingNumberComponent ?? (
                    <Text className={classes.value} component="div">
                        {typeof value === 'number' ? value.toLocaleString(fmtLocale()) : value}
                    </Text>
                ))
            )}
            {subtitle && (
                <Text className={classes.subtitle} component="div">
                    {subtitle}
                </Text>
            )}
            {children && <Box mt="md">{children}</Box>}
        </Card>
    )
}
