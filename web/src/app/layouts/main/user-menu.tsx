import { Avatar, Box, Menu, SegmentedControl, Text, useMantineColorScheme, type MantineColorScheme } from '@mantine/core'
import { IconCheck, IconDeviceDesktop, IconLanguage, IconLogout, IconMoon, IconSelector, IconSun } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { api } from '@/api/client'
import { useMe } from '@/api/hooks'
import { LANGUAGES } from '@/app/i18n/i18n'

import classes from './shell.module.css'

export function useLogout() {
    const navigate = useNavigate()
    const qc = useQueryClient()
    return async () => {
        await api.post('auth/logout').catch(() => undefined)
        qc.clear()
        navigate('/login', { replace: true })
    }
}

// ThemeSwitch picks light, dark or the system scheme.
export function ThemeSwitch({ fullWidth }: { fullWidth?: boolean }) {
    const { t } = useTranslation()
    const { colorScheme, setColorScheme } = useMantineColorScheme()
    const item = (value: MantineColorScheme, Icon: typeof IconSun, label: string) => ({
        value,
        label: (
            <Box aria-label={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={label}>
                <Icon size={15} stroke={1.75} />
            </Box>
        )
    })
    return (
        <SegmentedControl
            data={[
                item('light', IconSun, t('shell.theme_light')),
                item('dark', IconMoon, t('shell.theme_dark')),
                item('auto', IconDeviceDesktop, t('shell.theme_auto'))
            ]}
            fullWidth={fullWidth}
            onChange={(v) => setColorScheme(v as MantineColorScheme)}
            size="xs"
            value={colorScheme}
        />
    )
}

// UserMenu is the account block at the bottom of the sidebar: theme,
// language and sign-out.
export function UserMenu({ collapsed }: { collapsed: boolean }) {
    const { t, i18n } = useTranslation()
    const me = useMe()
    const logout = useLogout()
    const name = me.data?.username ?? '—'

    return (
        <Menu position={collapsed ? 'right-end' : 'top-start'} width={248} offset={collapsed ? 12 : 6}>
            <Menu.Target>
                <button className={classes.user} type="button">
                    <Avatar className={classes.avatar} radius="xl" size={26}>
                        {name.charAt(0).toUpperCase()}
                    </Avatar>
                    <div className={classes.userText}>
                        <Text fw={500} lh={1.25} size="sm" truncate>
                            {name}
                        </Text>
                    </div>
                    <IconSelector className={classes.userChevron} size={16} stroke={1.75} />
                </button>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>{t('shell.signed_in_as')}</Menu.Label>
                <Box px={10} pb={8}>
                    <Text fw={600} size="sm">
                        {name}
                    </Text>
                </Box>
                <Menu.Divider />
                <Menu.Label>{t('shell.theme')}</Menu.Label>
                <Box px={6} pb={6}>
                    <ThemeSwitch fullWidth />
                </Box>
                <Menu.Divider />
                <Menu.Label>{t('header.language')}</Menu.Label>
                {LANGUAGES.map((l) => (
                    <Menu.Item
                        key={l.value}
                        leftSection={<IconLanguage size={16} stroke={1.75} />}
                        onClick={() => i18n.changeLanguage(l.value)}
                        rightSection={i18n.resolvedLanguage === l.value ? <IconCheck size={14} /> : null}
                    >
                        {l.label}
                    </Menu.Item>
                ))}
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconLogout size={16} stroke={1.75} />} onClick={logout}>
                    {t('header.logout')}
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    )
}
