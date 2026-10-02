// Adapted from remnawave/frontend (AGPL-3.0): pages/auth/login + features/auth/login-form
import { Badge, Box, Button, Container, Group, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PiSignInDuotone } from 'react-icons/pi'
import { useNavigate } from 'react-router'

import { api } from '@/api/client'
import { Logo } from '@shared/ui/logo'
import { Page } from '@shared/ui/page'
import { errorText } from '@/components/notify'
import { useTranslation } from 'react-i18next'

export function LoginPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const form = useForm({ mode: 'uncontrolled', initialValues: { username: '', password: '' } })

    const submit = form.onSubmit(async (values) => {
        setLoading(true)
        setError(null)
        try {
            const me = await api.post<{ username: string }>('auth/login', values)
            qc.setQueryData(['me'], me)
            navigate('/', { replace: true })
        } catch (e) {
            setError(errorText(e))
        } finally {
            setLoading(false)
        }
    })

    return (
        <Page title={t('login.title')}>
            <Stack align="center" gap="xs">
                <Group align="center" gap={4} justify="center">
                    <Logo c="cyan" w="3rem" />
                    <Title ff="Unbounded" order={1} pos="relative">
                        <Text c="cyan" component="span" inherit>
                            VPN
                        </Text>
                        <Text c="white" component="span" inherit>
                            Control
                        </Text>
                    </Title>
                </Group>
                <Text c="dimmed" size="sm" ta="center">
                    {t('login.hint')}
                </Text>

                <Box maw={800} p={30} w={{ base: 440, sm: 500, md: 500 }}>
                    <form onSubmit={submit}>
                        <Container size="100%">
                            <Paper>
                                <TextInput
                                    autoComplete="username"
                                    label={t('login.username')}
                                    placeholder={t('login.username')}
                                    required
                                    {...form.getInputProps('username')}
                                />
                                <PasswordInput
                                    autoComplete="current-password"
                                    label={t('login.password')}
                                    mt="md"
                                    placeholder={t('login.password_placeholder')}
                                    required
                                    {...form.getInputProps('password')}
                                />
                                {error && (
                                    <Badge color="red" fullWidth mt="md" size="lg" style={{ textTransform: 'none' }} variant="soft">
                                        {error}
                                    </Badge>
                                )}
                                <Button
                                    fullWidth
                                    leftSection={<PiSignInDuotone size="16px" />}
                                    loading={loading}
                                    mt="xl"
                                    type="submit"
                                    variant="default"
                                >
                                    {t('login.submit')}
                                </Button>
                            </Paper>
                        </Container>
                    </form>
                </Box>
            </Stack>
        </Page>
    )
}
