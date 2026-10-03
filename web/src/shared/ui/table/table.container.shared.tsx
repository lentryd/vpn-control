import { Card, type CardProps } from '@mantine/core'

import classes from './table.module.css'

export function TableContainerShared({ children, className, ...props }: CardProps) {
    return (
        <Card className={`${classes.container} ${className ?? ''}`} padding={0} {...props}>
            {children}
        </Card>
    )
}
