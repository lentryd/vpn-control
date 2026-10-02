import { SimpleGrid } from '@mantine/core'
import dayjs from 'dayjs'
import { PiCalendarCheckDuotone, PiCoinsDuotone, PiCreditCardDuotone, PiReceiptDuotone } from 'react-icons/pi'
import { useMemo } from 'react'

import { usePayments } from '@/api/hooks'
import { fmtMoney } from '@/components/format'
import { paymentColumns, paymentTableProps } from '@/components/PaymentTable'
import { PageHeader, StatCard } from '@/components/ui'
import { Page } from '@shared/ui/page'
import { DataTableCard } from '@shared/ui/table'
import { useTranslation } from 'react-i18next'


export function PaymentsPage() {
    const { t } = useTranslation()
    const { data, isFetching } = usePayments()
    const columns = useMemo(() => paymentColumns(true), [t])
    const stats = useMemo(() => {
        const rows = data ?? []
        const month = dayjs().startOf('month')
        const thisMonth = rows.filter((p) => !dayjs(p.date).isBefore(month))
        const sum = (xs: typeof rows) => xs.reduce((s, p) => s + p.amount, 0)
        return { total: sum(rows), count: rows.length, month: sum(thisMonth), monthCount: thisMonth.length }
    }, [data])

    return (
        <Page title={t('menu.payments')}>
            <PageHeader
                description={t('payments.description')}
                icon={<PiCreditCardDuotone size={24} />}
                title={t('menu.payments')}
            />
            <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
                <StatCard color="teal" icon={PiCoinsDuotone} title={t('payments.total')} value={fmtMoney(stats.total, 2)} />
                <StatCard
                    color="cyan"
                    hint={t('payments.count', { count: stats.monthCount })}
                    icon={PiCalendarCheckDuotone}
                    title={t('payments.for_month', { month: dayjs().format('MMMM') })}
                    value={fmtMoney(stats.month, 2)}
                />
                <StatCard color="violet" icon={PiReceiptDuotone} title={t('payments.payments')} value={stats.count} />
            </SimpleGrid>
            <DataTableCard
                {...paymentTableProps}
                columns={columns}
                data={data ?? []}
                description={t('payments.table_hint')}
                icon={<PiCreditCardDuotone size={24} />}
                state={{ showProgressBars: isFetching, isLoading: !data }}
                storageKey="payments"
                title={t('payments.table_title')}
            />
        </Page>
    )
}
