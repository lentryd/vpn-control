// Adapted from remnawave/frontend (AGPL-3.0): widgets/remnawave-settings/api-tokens-card
import { ActionIcon, Box, Center, Group, ScrollArea, Stack, Text, Tooltip, Transition } from '@mantine/core'
import { modals } from '@mantine/modals'
import { useTranslation } from 'react-i18next'
import { PiEmpty } from 'react-icons/pi'
import { TbCookie, TbPlus, TbRefresh } from 'react-icons/tb'

import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { SettingsCardShared } from '@shared/ui/settings-card'

import classes from './api-token-card.module.css'
import { ApiTokenItem } from './api-token-item'
import { isMobileViewport, useApiTokens } from './hooks'
import { CreateApiTokenContent } from './modals/create-api-token-modal'

export function ApiTokensCard() {
    const { t } = useTranslation()
    const { data, isRefetching, refetch } = useApiTokens()
    const tokens = data?.tokens ?? []

    return (
        <SettingsCardShared.Container maw={900}>
            <SettingsCardShared.Header
                description={t('tokens.card_description')}
                icon={<TbCookie size={24} />}
                iconColor="cyan"
                iconVariant="soft"
                title={t('settings.tokens')}
            />

            <SettingsCardShared.Content>
                {data && tokens.length === 0 && (
                    <Center h="300px">
                        <Stack align="center" gap="xs">
                            <PiEmpty size={48} />
                            <Text c="dimmed" size="sm" ta="center">
                                {t('tokens.none')}
                            </Text>
                        </Stack>
                    </Center>
                )}

                <Transition mounted={tokens.length > 0} transition="fade">
                    {(styles) => (
                        <Box style={styles}>
                            <Box className={classes.tokenTable}>
                                <Box className={classes.tokenHeaderRow}>
                                    <Text className={classes.tokenColLabel}>{t('tariffs.col_name')}</Text>
                                    <Text className={classes.tokenColLabel}>{t('tokens.col_scopes')}</Text>
                                    <Text className={classes.tokenColLabel} visibleFrom="sm">
                                        {t('tokens.col_expires')}
                                    </Text>
                                    <span />
                                </Box>
                                <ScrollArea.Autosize mah={300} mih={300}>
                                    <Stack gap={0}>
                                        {tokens.map((token) => (
                                            <ApiTokenItem key={token.id} token={token} />
                                        ))}
                                    </Stack>
                                </ScrollArea.Autosize>
                            </Box>
                        </Box>
                    )}
                </Transition>
            </SettingsCardShared.Content>

            <SettingsCardShared.Bottom>
                <Group justify="space-between">
                    <ActionIcon.Group>
                        <Tooltip label={t('tokens.refresh')}>
                            <ActionIcon aria-label={t('tokens.refresh')} loading={isRefetching} onClick={() => refetch()} size="input-md" variant="soft">
                                <TbRefresh size={24} />
                            </ActionIcon>
                        </Tooltip>
                    </ActionIcon.Group>

                    <Tooltip label={t('common.create')}>
                        <ActionIcon
                            aria-label={t('tokens.create')}
                            color="teal"
                            onClick={() => {
                                const isMobile = isMobileViewport()
                                modals.open({
                                    title: <BaseOverlayHeader iconColor="teal" IconComponent={TbCookie} iconVariant="soft" title={t('tokens.create')} />,
                                    fullScreen: isMobile,
                                    centered: true,
                                    size: 'min(800px, 90vw)',
                                    children: <CreateApiTokenContent isMobile={isMobile} />
                                })
                            }}
                            size="input-md"
                            variant="soft"
                        >
                            <TbPlus size={24} />
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </SettingsCardShared.Bottom>
        </SettingsCardShared.Container>
    )
}
