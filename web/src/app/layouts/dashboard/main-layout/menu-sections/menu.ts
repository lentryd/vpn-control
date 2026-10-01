import { PiChartPieSliceDuotone, PiCreditCard, PiReceipt, PiStar, PiTreeStructure, PiUsers, PiUsersThree } from 'react-icons/pi'
import { TbBuildingBank, TbSettings, TbHexagon, TbServer, TbTags } from 'react-icons/tb'

import { MenuItem } from './interfaces'

// MENU is the app's navigation, grouped the way the panel groups its own:
// single-item sections render as plain links, the rest as dropdowns.
export const MENU: MenuItem[] = [
    {
        header: 'Главная',
        id: 'home',
        icon: PiStar,
        section: [{ name: 'Главная', href: '/', icon: PiStar, id: 'home' }]
    },
    {
        header: 'Клиенты',
        id: 'customers',
        icon: PiUsers,
        section: [
            { name: 'Клиенты', href: '/customers', icon: PiUsers, id: 'customers' },
            { name: 'Подписки', href: '/subscriptions', icon: TbHexagon, id: 'subscriptions' },
            { name: 'Платежи', href: '/payments', icon: PiCreditCard, id: 'payments' },
            { name: 'Рефералы', href: '/referrals', icon: PiTreeStructure, id: 'referrals' }
        ]
    },
    {
        header: 'Тарифы',
        id: 'tariffs',
        icon: TbTags,
        section: [{ name: 'Тарифы и аддоны', href: '/tariffs', icon: TbTags, id: 'tariffs' }]
    },
    {
        header: 'Финансы',
        id: 'finance',
        icon: PiChartPieSliceDuotone,
        section: [
            { name: 'Траты', href: '/expenses', icon: PiReceipt, id: 'expenses' },
            { name: 'Статьи расходов', href: '/expense-items', icon: TbBuildingBank, id: 'expense-items' }
        ]
    },
    {
        header: 'Панель',
        id: 'panel',
        icon: TbServer,
        section: [{ name: 'Пользователи панели', href: '/panel-users', icon: PiUsersThree, id: 'panel-users' }]
    },
    {
        header: 'Настройки',
        id: 'settings',
        icon: TbSettings,
        section: [{ name: 'Настройки', href: '/settings', icon: TbSettings, id: 'settings' }]
    }
]
