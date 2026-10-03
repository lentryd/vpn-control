import { Box, CardSection, Group, Text, type ActionIconProps, type CardSectionProps } from '@mantine/core'
import { forwardRef, type ReactNode } from 'react'

import classes from './table.module.css'

export interface CardTitleProps extends Omit<CardSectionProps, 'c' | 'fw' | 'size' | 'tt' | 'title'> {
    actions?: ReactNode
    description?: ReactNode
    icon?: ReactNode
    iconProps?: ActionIconProps
    title: ReactNode
}

// CardTitle is a card's header row: small muted icon, title, a hint under
// it and actions on the right, over a hairline.
export const CardTitle = forwardRef<HTMLDivElement, CardTitleProps>(
    ({ title, description, actions, withBorder = true, icon, iconProps: _iconProps, className, ...props }, ref) => (
        <CardSection className={`${classes.header} ${className ?? ''}`} data-with-border={withBorder || undefined} ref={ref} {...props}>
            <Group align="center" gap="sm" miw={0} style={{ flex: '1 1 260px' }} wrap="nowrap">
                {icon && <span className={classes.icon}>{icon}</span>}
                <Box miw={0}>
                    <Text className={classes.title}>{title}</Text>
                    {description && (
                        <Text c="dimmed" component="div" mt={2} size="xs">
                            {description}
                        </Text>
                    )}
                </Box>
            </Group>
            {actions && (
                <Group className={classes.actions} gap="xs" wrap="wrap">
                    {actions}
                </Group>
            )}
        </CardSection>
    )
)
