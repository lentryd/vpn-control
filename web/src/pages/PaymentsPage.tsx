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

const columns = paymentColumns(true)

export function PaymentsPage() {
    const { data, isFetching } = usePayments()
    const stats = useMemo(() => {
        const rows = data ?? []
        const month = dayjs().startOf('month')
        const thisMonth = rows.filter((p) => !dayjs(p.date).isBefore(month))
        const sum = (xs: typeof rows) => xs.reduce((s, p) => s + p.amount, 0)
        return { total: sum(rows), count: rows.length, month: sum(thisMonth), monthCount: thisMonth.length }
    }, [data])

    return (
        <Page title="Платежи">
            <PageHeader
                description="Поступления от клиентов. Нажмите на строку, чтобы изменить платёж"
                icon={<PiCreditCardDuotone size={24} />}
                title="Платежи"
            />
            <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
                <StatCard color="teal" icon={PiCoinsDuotone} title="Всего поступлений" value={fmtMoney(stats.total, 2)} />
                <StatCard
                    color="cyan"
                    hint={`${stats.monthCount} платежей`}
                    icon={PiCalendarCheckDuotone}
                    title={`За ${dayjs().format('MMMM')}`}
                    value={fmtMoney(stats.month, 2)}
                />
                <StatCard color="violet" icon={PiReceiptDuotone} title="Платежей" value={stats.count} />
            </SimpleGrid>
            <DataTableCard
                {...paymentTableProps}
                columns={columns}
                data={data ?? []}
                description="Изменение платежа поправит и баланс клиента"
                icon={<PiCreditCardDuotone size={24} />}
                state={{ showProgressBars: isFetching, isLoading: !data }}
                storageKey="payments"
                title="Поступления"
            />
        </Page>
    )
}
