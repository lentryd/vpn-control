import { ActionIcon, Menu } from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import {
    PiArrowsLeftRight,
    PiCalendarPlus,
    PiCopy,
    PiLinkBreak,
    PiPause,
    PiPencilSimple,
    PiPlay,
    PiPuzzlePiece
} from 'react-icons/pi'
import { TbDots } from 'react-icons/tb'

import { api } from '@/api/client'
import { useInvalidateAll } from '@/api/hooks'
import type { AddonItem, Subscription } from '@/api/types'
import { openExtendModal } from '@/modals/ExtendModal'
import { confirmDanger } from '@/modals/open'
import {
    openAddonEdit,
    openChangeTariffModal,
    openConnectAddonModal,
    openSubscriptionForm
} from '@/modals/SubscriptionModals'

import { notifyError, notifyOk } from './notify'

export const addonTitle = (addon: AddonItem, subTitle: string) => `${addon.addon_name} · ${subTitle}`

export function useItemActions() {
    const invalidate = useInvalidateAll()
    const clipboard = useClipboard()

    const toggle = async (kind: 'subscription' | 'addon', id: number, enable: boolean) => {
        try {
            await api.post(`items/${kind}/${id}/${enable ? 'enable' : 'disable'}`)
            await invalidate()
            notifyOk(enable ? 'Включено в панели' : 'Отключено в панели')
        } catch (e) {
            notifyError(e)
        }
    }

    const copyLink = (url: string) => {
        clipboard.copy(url)
        notifyOk('Ссылка подписки скопирована')
    }

    const unlinkSubscription = (sub: Subscription, onDone?: () => void) =>
        confirmDanger(
            'Отвязать подписку?',
            'Подписка и её аддоны пропадут из учёта. Пользователи в панели останутся как есть, история платежей сохранится.',
            async () => {
                try {
                    await api.del(`subscriptions/${sub.id}`)
                    await invalidate()
                    onDone?.()
                } catch (e) {
                    notifyError(e)
                }
            },
            'Отвязать'
        )

    const unlinkAddon = (addon: AddonItem, onDone?: () => void) =>
        confirmDanger(
            'Отвязать аддон?',
            'Аддон пропадёт из учёта, пользователь в панели останется. Чтобы аддон перестал работать, отключите его в панели.',
            async () => {
                try {
                    await api.del(`subscription-addons/${addon.id}`)
                    await invalidate()
                    onDone?.()
                } catch (e) {
                    notifyError(e)
                }
            },
            'Отвязать'
        )

    return { toggle, copyLink, unlinkSubscription, unlinkAddon }
}

// SubscriptionMenuItems is the "more actions" list shared by row menus and
// the subscription modal footer.
export function SubscriptionMenuItems({ sub, onUnlinked }: { sub: Subscription; onUnlinked?: () => void }) {
    const { toggle, copyLink, unlinkSubscription } = useItemActions()
    const disabled = sub.rw_user?.status === 'DISABLED'
    return (
        <>
            <Menu.Label>Управление</Menu.Label>
            <Menu.Item
                leftSection={<PiCalendarPlus size={16} />}
                disabled={!sub.rw_user}
                onClick={() => openExtendModal({ kind: 'subscription', id: sub.id, title: sub.title })}
            >
                Продлить
            </Menu.Item>
            <Menu.Item leftSection={<PiPuzzlePiece size={16} />} disabled={!sub.rw_user} onClick={() => openConnectAddonModal(sub)}>
                Подключить аддон
            </Menu.Item>
            <Menu.Item
                leftSection={<PiArrowsLeftRight size={16} />}
                onClick={() => openChangeTariffModal({ kind: 'subscription', id: sub.id, title: sub.title, tariffId: sub.tariff_id })}
            >
                Сменить тариф
            </Menu.Item>
            <Menu.Item leftSection={<PiPencilSimple size={16} />} onClick={() => openSubscriptionForm({ sub })}>
                Изменить / привязать
            </Menu.Item>
            {sub.rw_user && (
                <>
                    <Menu.Item leftSection={<PiCopy size={16} />} onClick={() => copyLink(sub.rw_user!.subscription_url)}>
                        Скопировать ссылку подписки
                    </Menu.Item>
                    <Menu.Item
                        leftSection={disabled ? <PiPlay size={16} /> : <PiPause size={16} />}
                        onClick={() => toggle('subscription', sub.id, disabled)}
                    >
                        {disabled ? 'Включить в панели' : 'Отключить в панели'}
                    </Menu.Item>
                </>
            )}
            <Menu.Divider />
            <Menu.Label>Опасная зона</Menu.Label>
            <Menu.Item color="red" leftSection={<PiLinkBreak size={16} />} onClick={() => unlinkSubscription(sub, onUnlinked)}>
                Отвязать
            </Menu.Item>
        </>
    )
}

export function AddonMenuItems({ addon, subTitle, onUnlinked }: { addon: AddonItem; subTitle: string; onUnlinked?: () => void }) {
    const { toggle, unlinkAddon } = useItemActions()
    const title = addonTitle(addon, subTitle)
    const disabled = addon.rw_user?.status === 'DISABLED'
    return (
        <>
            <Menu.Label>Управление</Menu.Label>
            <Menu.Item
                leftSection={<PiCalendarPlus size={16} />}
                disabled={!addon.rw_user}
                onClick={() => openExtendModal({ kind: 'addon', id: addon.id, title })}
            >
                Продлить
            </Menu.Item>
            <Menu.Item
                leftSection={<PiArrowsLeftRight size={16} />}
                onClick={() => openChangeTariffModal({ kind: 'addon', id: addon.id, title, tariffId: addon.tariff_id, addonId: addon.addon_id })}
            >
                Сменить тариф
            </Menu.Item>
            <Menu.Item leftSection={<PiPencilSimple size={16} />} onClick={() => openAddonEdit(addon)}>
                Цена и автопродление
            </Menu.Item>
            {addon.rw_user && (
                <Menu.Item
                    leftSection={disabled ? <PiPlay size={16} /> : <PiPause size={16} />}
                    onClick={() => toggle('addon', addon.id, disabled)}
                >
                    {disabled ? 'Включить в панели' : 'Отключить в панели'}
                </Menu.Item>
            )}
            <Menu.Divider />
            <Menu.Label>Опасная зона</Menu.Label>
            <Menu.Item color="red" leftSection={<PiLinkBreak size={16} />} onClick={() => unlinkAddon(addon, onUnlinked)}>
                Отвязать
            </Menu.Item>
        </>
    )
}

function DotsTarget() {
    return (
        <Menu.Target>
            <ActionIcon aria-label="Действия" color="gray" onClick={(e) => e.stopPropagation()} variant="subtle">
                <TbDots size={18} />
            </ActionIcon>
        </Menu.Target>
    )
}

export function SubscriptionActions({ sub }: { sub: Subscription }) {
    return (
        <Menu position="bottom-end" withinPortal>
            <DotsTarget />
            <Menu.Dropdown>
                <SubscriptionMenuItems sub={sub} />
            </Menu.Dropdown>
        </Menu>
    )
}

export function AddonActions({ addon, subTitle }: { addon: AddonItem; subTitle: string }) {
    return (
        <Menu position="bottom-end" withinPortal>
            <DotsTarget />
            <Menu.Dropdown>
                <AddonMenuItems addon={addon} subTitle={subTitle} />
            </Menu.Dropdown>
        </Menu>
    )
}
