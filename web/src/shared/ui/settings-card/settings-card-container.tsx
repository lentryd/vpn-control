import { Card, Flex, type CardProps } from '@mantine/core'

export function SettingsCardContainer({ children, ...props }: CardProps) {
    return (
        <Card padding="lg" {...props}>
            <Flex direction="column" gap="sm">
                {children}
            </Flex>
        </Card>
    )
}
