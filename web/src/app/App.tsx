import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'

import { setUnauthorizedHandler } from '@/api/client'
import { useMe, useSettings } from '@/api/hooks'
import { setFormat } from '@/components/format'
import { CustomerPage } from '@/pages/CustomerPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ExpenseItemsPage } from '@/pages/ExpenseItemsPage'
import { ExpensesPage } from '@/pages/ExpensesPage'
import { LoginPage } from '@/pages/LoginPage'
import { PaymentsPage } from '@/pages/PaymentsPage'
import { ReferralsPage } from '@/pages/ReferralsPage'
import { RwUsersPage } from '@/pages/RwUsersPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SubscriptionsPage } from '@/pages/SubscriptionsPage'
import { TariffsPage } from '@/pages/TariffsPage'

import { AuthLayout } from './layouts/auth'
import { MainLayout } from './layouts/dashboard'
import { LoadingScreen } from '@shared/ui/loading-screen'

export function App() {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const location = useLocation()

    useEffect(() => {
        setUnauthorizedHandler(() => {
            qc.setQueryData(['me'], null)
            if (!window.location.hash.startsWith('#/login')) navigate('/login', { replace: true })
        })
    }, [navigate, qc])

    const me = useMe()
    const settings = useSettings(!!me.data)
    if (location.pathname === '/login') {
        return (
            <Routes>
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                </Route>
            </Routes>
        )
    }
    if (me.isPending || (me.data && settings.isPending)) {
        return <LoadingScreen height="60vh" />
    }
    if (!me.data) return <Navigate to="/login" replace />
    // money formatting follows the base currency; set before pages render
    setFormat({ base: settings.data?.base_currency })

    return (
        <Routes>
            <Route element={<MainLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="customers/:id" element={<CustomerPage />} />
                <Route path="subscriptions" element={<SubscriptionsPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="referrals" element={<ReferralsPage />} />
                <Route path="tariffs" element={<TariffsPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="expense-items" element={<ExpenseItemsPage />} />
                <Route path="panel-users" element={<RwUsersPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    )
}
