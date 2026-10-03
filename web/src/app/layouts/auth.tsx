import { Group, Menu, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconLanguage } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'

import { LANGUAGES } from '@/app/i18n/i18n'

import classes from './auth.module.css'
import { ThemeSwitch } from './main/user-menu'

// AuthLayout centres the sign-in card over a soft grid, with theme and
// language pickers underneath.
export function AuthLayout() {
    const { i18n } = useTranslation()
    const current = LANGUAGES.find((l) => l.value === i18n.resolvedLanguage) ?? LANGUAGES[0]
    return (
        <div className={classes.root}>
            <div className={classes.card}>
                <Outlet />
            </div>
            <Group className={classes.footer} gap="sm">
                <ThemeSwitch />
                <Menu position="top" width={160}>
                    <Menu.Target>
                        <UnstyledButton c="dimmed" fz="xs" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px' }}>
                            <IconLanguage size={15} stroke={1.75} />
                            {current.label}
                            <IconChevronDown size={12} />
                        </UnstyledButton>
                    </Menu.Target>
                    <Menu.Dropdown>
                        {LANGUAGES.map((l) => (
                            <Menu.Item key={l.value} onClick={() => i18n.changeLanguage(l.value)}>
                                {l.label}
                            </Menu.Item>
                        ))}
                    </Menu.Dropdown>
                </Menu>
            </Group>
        </div>
    )
}
