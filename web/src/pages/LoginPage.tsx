import { Alert, Button, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertCircle, IconArrowRight } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { api } from '@/api/client'
import { errorText } from '@/components/notify'
import { Logo } from '@shared/ui/logo'
import { Page } from '@shared/ui/page'

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
            <Stack gap={6} mb={28}>
                <Logo mb={14} size={40} />
                <Title order={2} style={{ letterSpacing: '-0.02em' }}>
                    {t('login.welcome')}
                </Title>
                <Text c="dimmed" size="sm">
                    {t('login.hint')}
                </Text>
            </Stack>
            <form onSubmit={submit}>
                <Stack gap="md">
                    <TextInput
                        autoComplete="username"
                        autoFocus
                        label={t('login.username')}
                        placeholder="admin"
                        required
                        size="md"
                        {...form.getInputProps('username')}
                    />
                    <PasswordInput
                        autoComplete="current-password"
                        label={t('login.password')}
                        placeholder={t('login.password_placeholder')}
                        required
                        size="md"
                        {...form.getInputProps('password')}
                    />
                    {error && (
                        <Alert color="red" icon={<IconAlertCircle size={18} />} py="xs">
                            {error}
                        </Alert>
                    )}
                    <Button fullWidth loading={loading} mt={4} rightSection={<IconArrowRight size={16} />} size="md" type="submit" variant="filled">
                        {t('login.submit')}
                    </Button>
                </Stack>
            </form>
        </Page>
    )
}
