// Adapted from remnawave/frontend (AGPL-3.0)
import { Center, Progress, Stack, Text } from '@mantine/core'

export function LoadingScreen({
    height = '100dvh',
    text = undefined,
    value = 100
}: {
    height?: string
    text?: string
    value?: number
}) {
    return (
        // the header var exists only inside AppShell; without the fallback the
        // whole calc() is invalid and the bar sticks to the top (first load, modals)
        <Center style={{ height: `calc(${height} - var(--app-shell-header-height, 0px) - 20px)` }}>
            <Stack align="center" gap="xs" w="100%">
                {text && <Text size="lg">{text}</Text>}
                <Progress
                    animated
                    color="cyan"
                    maw="32rem"
                    radius="xs"
                    striped
                    value={value}
                    w="80%"
                />
            </Stack>
        </Center>
    )
}
