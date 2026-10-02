import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import { ActionIcon, Badge, Button, Group, SegmentedControl, Text, Tooltip } from '@mantine/core'
import { useMemo, useState } from 'react'
import { PiCreditCard, PiPencilSimple, PiUserPlus, PiUsersDuotone } from 'react-icons/pi'
import { useNavigate } from 'react-router'

import { useCustomers } from '@/api/hooks'
import type { Customer } from '@/api/types'
import { ExpireCell } from '@/components/badges'
import { fmtDate } from '@/components/format'
import { Money, PageHeader } from '@/components/ui'
import { Page } from '@shared/ui/page'
import { DataTableCard } from '@shared/ui/table'
import { openCustomerForm } from '@/modals/CustomerModals'
import { openPaymentModal } from '@/modals/PaymentModal'
import { useTranslation } from 'react-i18next'

export function CustomersPage() {
    const { t } = useTranslation()
    const { data, isFetching } = useCustomers()
    const navigate = useNavigate()
    const [scope, setScope] = useState('active')
    const rows = useMemo(
        () => (data ?? []).filter((c) => (scope === 'all' ? true : scope === 'archived' ? c.archived : !c.archived)),
        [data, scope]
    )

    const columns = useMemo<MRT_ColumnDef<Customer>[]>(
        () => [
            {
                accessorKey: 'name',
                header: t('sub.customer'),
                Cell: ({ row }) => (
                    <Group gap={6} wrap="nowrap" pl={10}>
                        <Text fw={500} size="sm">
                            {row.original.name}
                        </Text>
                        {row.original.archived && (
                            <Badge size="xs" color="gray" variant="soft">
                                {t('customer.archived')}
                            </Badge>
                        )}
                    </Group>
                )
            },
            { accessorKey: 'referrer_name', header: t('customers.referrer'), Cell: ({ cell }) => cell.getValue<string>() || <Text c="dimmed" size="sm">—</Text> },
            {
                accessorKey: 'nearest_expire_at',
                header: t('customers.col_next_expiry'),
                sortingFn: 'datetime',
                accessorFn: (r) => (r.nearest_expire_at ? new Date(r.nearest_expire_at) : undefined),
                sortDescFirst: false,
                sortUndefined: 'last',
                enableColumnFilter: false,
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ row }) => <ExpireCell date={row.original.nearest_expire_at} />
            },
            { accessorKey: 'monthly', header: t('sub.per_month'), enableColumnFilter: false, Cell: ({ cell }) => <Money value={cell.getValue<number>()} /> },
            { accessorKey: 'balance', header: t('dashboard.col_balance'), enableColumnFilter: false, Cell: ({ cell }) => <Money value={cell.getValue<number>()} signed digits={2} /> },
            {
                accessorKey: 'subscriptions_count',
                header: t('menu.subscriptions'),
                enableColumnFilter: false,
                Cell: ({ row }) => (
                    <Text size="sm">
                        {row.original.subscriptions_count}
                        {row.original.addons_count > 0 && <Text span c="grape" size="sm">{` ${t('customers.plus_addons', { count: row.original.addons_count })}`}</Text>}
                    </Text>
                )
            },
            { accessorKey: 'referrals_count', header: t('customers.col_referred'), enableColumnFilter: false },
            { accessorKey: 'total_paid', header: t('customer.total_paid'), enableColumnFilter: false, Cell: ({ cell }) => <Money value={cell.getValue<number>()} /> },
            {
                accessorKey: 'last_payment_at',
                header: t('customers.col_last_payment'),
                sortingFn: 'datetime',
                accessorFn: (r) => (r.last_payment_at ? new Date(r.last_payment_at) : undefined),
                sortUndefined: 'last',
                enableColumnFilter: false,
                Cell: ({ row }) => <Text size="sm">{fmtDate(row.original.last_payment_at)}</Text>
            },
            { accessorKey: 'contact', header: t('customers.contact') }
        ],
        [t]
    )

    return (
        <Page title={t('menu.customers')}>
            <PageHeader
                icon={<PiUsersDuotone size={24} />}
                title={t('menu.customers')}
                description={t('customers.description')}
                actions={
                    <Button color="teal" leftSection={<PiUserPlus size={16} />} onClick={() => openCustomerForm()} variant="soft">
                        {t('customers.new')}
                    </Button>
                }
            />
            <DataTableCard
                storageKey="customers"
                icon={<PiUsersDuotone size={24} />}
                title={t('customers.list')}
                actions={
                    <SegmentedControl
                        size="xs"
                        value={scope}
                        onChange={setScope}
                        data={[
                            { value: 'active', label: t('customers.scope_active') },
                            { value: 'archived', label: t('customers.scope_archived') },
                            { value: 'all', label: t('common.all') }
                        ]}
                    />
                }
                columns={columns}
                data={rows}
                state={{ showProgressBars: isFetching, isLoading: !data }}
                initialState={{ sorting: [{ id: 'nearest_expire_at', desc: false }], columnVisibility: { contact: false } }}
                enableRowActions
                renderRowActions={({ row }) => (
                    <Group gap={6} wrap="nowrap">
                        <Tooltip label={t('common.edit')} withArrow>
                            <ActionIcon color="gray" size="md" variant="soft" onClick={() => openCustomerForm(row.original)}>
                                <PiPencilSimple size={14} />
                            </ActionIcon>
                        </Tooltip>
                        <Button
                            color="teal"
                            size="compact-xs"
                            variant="soft"
                            leftSection={<PiCreditCard size={14} />}
                            onClick={() => openPaymentModal({ customerId: row.original.id, name: row.original.name })}
                        >
                            {t('payment.title')}
                        </Button>
                    </Group>
                )}
                displayColumnDefOptions={{ 'mrt-row-actions': { header: '', size: 150 } }}
                onRowClick={(r) => navigate(`/customers/${r.id}`)}
            />
        </Page>
    )
}
