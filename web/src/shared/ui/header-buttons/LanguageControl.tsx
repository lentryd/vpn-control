// Adapted from remnawave/frontend (AGPL-3.0): shared/ui/language-picker
import { Menu, rem, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { TbLanguage } from 'react-icons/tb'

import { LANGUAGES } from '@/app/i18n/i18n'

import { HeaderControl } from './HeaderControl'

export function LanguageControl() {
    const { i18n } = useTranslation()
    return (
        <Menu position="bottom-end" width={160} withinPortal>
            <Menu.Target>
                <HeaderControl>
                    <TbLanguage style={{ width: rem(22), height: rem(22) }} />
                </HeaderControl>
            </Menu.Target>
            <Menu.Dropdown>
                {LANGUAGES.map((l) => (
                    <Menu.Item
                        key={l.value}
                        leftSection={<Text>{l.emoji}</Text>}
                        onClick={() => i18n.changeLanguage(l.value)}
                        fw={i18n.resolvedLanguage === l.value ? 600 : undefined}
                    >
                        {l.label}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    )
}
