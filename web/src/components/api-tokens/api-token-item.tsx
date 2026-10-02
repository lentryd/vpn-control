// Adapted from remnawave/frontend (AGPL-3.0): widgets/remnawave-settings/api-tokens-card/api-token-item
import { ActionIcon, Box, Group, Menu, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import { TbCookie, TbDots, TbEye, TbTrash } from 'react-icons/tb'

import { api } from '@/api/client'
import { useApiMutation } from '@/api/hooks'
import type { ApiToken } from '@/api/types'
import { notifyError } from '@/components/notify'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'

import classes from './api-token-card.module.css'
import { isMobileViewport } from './hooks'
import { ViewApiTokenContent } from './modals/view-api-token-modal'
import { formatTokenTime } from './time'

export function ApiTokenItem({ token }: { token: ApiToken }) {
    const { t } = useTranslation()
    const remove = useApiMutation(() => api.del(`api-tokens/${token.id}`))

    const isFull = token.scopes.includes('*')
    const hasScopes = isFull || token.scopes.length > 0
    const isExpired = !!token.expire_at && dayjs(token.expire_at).isBefore(dayjs())
    const dotColor = isFull ? 'var(--mantine-color-teal-5)' : hasScopes ? 'var(--mantine-color-cyan-5)' : 'var(--mantine-color-dark-3)'

    return (
        <Box className={classes.tokenRow}>
            <Group gap="sm" style={{ minWidth: 0 }} wrap="nowrap">
                <Box style={{ background: dotColor, borderRadius: '50%', flexShrink: 0, height: 8, width: 8 }} />
                <Text fw={500} size="sm" truncate="end">
                    {token.name}
                </Text>
            </Group>

            <Text c="dimmed" ff="monospace" size="xs" truncate="end">
                {isFull ? t('tokens.full_access') : token.scopes.length}
            </Text>

            <Text c={isExpired ? 'red.5' : 'dimmed'} fw={isExpired ? 600 : 400} size="xs" truncate="end" visibleFrom="sm">
                {isExpired ? t('tokens.expired') : token.expire_at ? formatTokenTime(token.expire_at) : t('tokens.never_expires')}
            </Text>

            <Menu position="bottom-end" shadow="lg" trigger="click-hover" width={190}>
                <Menu.Target>
                    <ActionIcon color="gray" onClick={(event) => event.stopPropagation()} size="md" variant="subtle">
                        <TbDots size={18} />
                    </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
                    <Menu.Item
                        leftSection={<TbEye size={15} />}
                        onClick={() => {
                            const isMobile = isMobileViewport()
                            modals.open({
                                title: <BaseOverlayHeader iconColor="teal" IconComponent={TbCookie} iconVariant="soft" title={token.name} />,
                                fullScreen: isMobile,
                                centered: true,
                                size: 'min(800px, 90vw)',
                                children: <ViewApiTokenContent isMobile={isMobile} token={token} />
                            })
                        }}
                    >
                        {t('tokens.view')}
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                        color="red"
                        disabled={remove.isPending}
                        leftSection={<TbTrash size={15} />}
                        onClick={() => remove.mutate(undefined, { onError: (e) => notifyError(e) })}
                    >
                        {t('common.delete')}
                    </Menu.Item>
                </Menu.Dropdown>
            </Menu>
        </Box>
    )
}
