import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { Spotlight, type SpotlightActionGroupData } from '@mantine/spotlight'
import { IconContrast, IconLanguage, IconReceipt2, IconRefresh, IconSearch, IconStack2, IconUser, IconUserPlus } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useCustomers, useSubscriptions } from '@/api/hooks'
import { fmtDate } from '@/components/format'

import { ALL_NAV_ITEMS } from './navigation'
import classes from './shell.module.css'
import { useSync } from './sync-status'

const icon = (Icon: React.ComponentType<{ size?: number; stroke?: number }>) => (
    <span className={classes.spotlightActionIcon}>
        <Icon size={16} stroke={1.75} />
    </span>
)

// The modals (forms, date pickers, their icons) load on first use, so they
// stay out of the bundle every page needs.
const modals = {
    customer: () => import('@/modals/CustomerModals'),
    expense: () => import('@/modals/ExpenseModal'),
    view: () => import('@/modals/ViewItemModal')
}

// CommandPalette is ⌘K: jump to a page, a customer or a subscription, or
// run a common action, from anywhere.
export function CommandPalette() {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const { sync } = useSync()
    const { setColorScheme } = useMantineColorScheme()
    const scheme = useComputedColorScheme('dark')
    // entity lists load only once the palette has been opened
    const [wanted, setWanted] = useState(false)
    const customers = useCustomers(wanted)
    const subscriptions = useSubscriptions(wanted)

    const actions = useMemo<SpotlightActionGroupData[]>(() => {
        const pages = ALL_NAV_ITEMS.map((item) => ({
            id: `page:${item.to}`,
            label: String(t(item.label as never)),
            leftSection: icon(item.icon),
            onClick: () => navigate(item.to)
        }))
        const quick = [
            { id: 'act:customer', label: t('customers.new'), leftSection: icon(IconUserPlus), onClick: () => void modals.customer().then((m) => m.openCustomerForm(undefined, (id) => navigate(`/customers/${id}`))) },
            { id: 'act:expense', label: t('expense_modal.new'), leftSection: icon(IconReceipt2), onClick: () => void modals.expense().then((m) => m.openExpenseForm({})) },
            { id: 'act:sync', label: t('shell.sync_now'), leftSection: icon(IconRefresh), onClick: () => void sync() },
            {
                id: 'act:theme',
                label: t('shell.toggle_theme'),
                leftSection: icon(IconContrast),
                onClick: () => setColorScheme(scheme === 'dark' ? 'light' : 'dark')
            },
            {
                id: 'act:lang',
                label: i18n.resolvedLanguage === 'ru' ? 'Switch to English' : 'Переключить на русский',
                leftSection: icon(IconLanguage),
                onClick: () => i18n.changeLanguage(i18n.resolvedLanguage === 'ru' ? 'en' : 'ru')
            }
        ]
        const groups: SpotlightActionGroupData[] = [
            { group: t('shell.group_pages'), actions: pages },
            { group: t('shell.group_actions'), actions: quick }
        ]
        if (customers.data?.length) {
            groups.push({
                group: t('shell.group_customers'),
                actions: customers.data.map((c) => ({
                    id: `customer:${c.id}`,
                    label: c.name,
                    description: [c.contact, c.archived ? t('customer.archived') : ''].filter(Boolean).join(' · ') || undefined,
                    leftSection: icon(IconUser),
                    onClick: () => navigate(`/customers/${c.id}`)
                }))
            })
        }
        if (subscriptions.data?.length) {
            groups.push({
                group: t('shell.group_subscriptions'),
                actions: subscriptions.data.map((s) => ({
                    id: `sub:${s.id}`,
                    label: s.title,
                    description: [s.customer_name, s.rw_user?.username, s.rw_user?.expire_at ? fmtDate(s.rw_user.expire_at) : ''].filter(Boolean).join(' · '),
                    leftSection: icon(IconStack2),
                    onClick: () => void modals.view().then((m) => m.openViewSubscriptionModal(s))
                }))
            })
        }
        return groups
    }, [t, i18n, navigate, customers.data, subscriptions.data, sync, setColorScheme, scheme])

    return (
        <Spotlight
            actions={actions}
            classNames={{
                action: classes.spotlightAction,
                actionsGroup: classes.spotlightGroupLabel,
                actionLabel: classes.spotlightLabel,
                actionDescription: classes.spotlightDescription
            }}
            highlightQuery
            limit={40}
            maxHeight={440}
            nothingFound={t('shell.nothing_found')}
            onSpotlightOpen={() => setWanted(true)}
            radius="lg"
            scrollable
            searchProps={{ leftSection: <IconSearch size={18} stroke={1.75} />, placeholder: t('shell.search_placeholder') }}
            shortcut={['mod + K', '/']}
        />
    )
}
