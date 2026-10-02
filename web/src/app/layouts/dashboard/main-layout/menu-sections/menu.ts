import { PiChartPieSliceDuotone, PiCreditCard, PiReceipt, PiStar, PiTreeStructure, PiUsers, PiUsersThree } from 'react-icons/pi'
import { TbBuildingBank, TbSettings, TbHexagon, TbServer, TbTags } from 'react-icons/tb'

import { useTranslation } from 'react-i18next'

import { MenuItem } from './interfaces'

// MENU is the app's navigation, grouped the way the panel groups its own:
// single-item sections render as plain links, the rest as dropdowns.
// header/name are locale keys.
export const MENU: MenuItem[] = [
    {
        header: 'menu.home',
        id: 'home',
        icon: PiStar,
        section: [{ name: 'menu.home', href: '/', icon: PiStar, id: 'home' }]
    },
    {
        header: 'menu.customers',
        id: 'customers',
        icon: PiUsers,
        section: [
            { name: 'menu.customers', href: '/customers', icon: PiUsers, id: 'customers' },
            { name: 'menu.subscriptions', href: '/subscriptions', icon: TbHexagon, id: 'subscriptions' },
            { name: 'menu.payments', href: '/payments', icon: PiCreditCard, id: 'payments' },
            { name: 'menu.referrals', href: '/referrals', icon: PiTreeStructure, id: 'referrals' }
        ]
    },
    {
        header: 'menu.tariffs',
        id: 'tariffs',
        icon: TbTags,
        section: [{ name: 'menu.tariffs_addons', href: '/tariffs', icon: TbTags, id: 'tariffs' }]
    },
    {
        header: 'menu.finance',
        id: 'finance',
        icon: PiChartPieSliceDuotone,
        section: [
            { name: 'menu.expenses', href: '/expenses', icon: PiReceipt, id: 'expenses' },
            { name: 'menu.expense_items', href: '/expense-items', icon: TbBuildingBank, id: 'expense-items' }
        ]
    },
    {
        header: 'menu.panel',
        id: 'panel',
        icon: TbServer,
        section: [{ name: 'menu.panel_users', href: '/panel-users', icon: PiUsersThree, id: 'panel-users' }]
    },
    {
        header: 'menu.settings',
        id: 'settings',
        icon: TbSettings,
        section: [{ name: 'menu.settings', href: '/settings', icon: TbSettings, id: 'settings' }]
    }
]

// useMenu is MENU with its labels translated.
export function useMenu(): MenuItem[] {
    const { t } = useTranslation()
    const tr = <T extends string | undefined>(key: T): T => (key ? (t(key as never) as string as T) : key)
    return MENU.map((m) => ({
        ...m,
        header: tr(m.header),
        section: m.section.map((s) => ({
            ...s,
            name: tr(s.name),
            dropdownItems: s.dropdownItems?.map((d) => ({ ...d, name: tr(d.name) }))
        }))
    }))
}
