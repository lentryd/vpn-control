import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import { Anchor, Badge, Button, Group, SegmentedControl } from '@mantine/core'
import { PiLink, PiUserPlus, PiUsersThreeDuotone } from 'react-icons/pi'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { useRwUsers } from '@/api/hooks'
import type { RwUserRow } from '@/api/types'
import { ExpireCell, OnlineCell, StatusBadge, TrafficCell, UsernameCell } from '@/components/badges'
import { PageHeader } from '@/components/ui'
import { openCustomerForm } from '@/modals/CustomerModals'
import { openSubscriptionForm } from '@/modals/SubscriptionModals'
import { openViewAddonModal, openViewSubscriptionModal } from '@/modals/ViewItemModal'
import { Page } from '@shared/ui/page'
import { DataTableCard } from '@shared/ui/table'
import { useTranslation } from 'react-i18next'

export function RwUsersPage() {
    const { t } = useTranslation()
    const { data, isFetching } = useRwUsers()
    const [scope, setScope] = useState('unlinked')
    const rows = useMemo(() => (data ?? []).filter((u) => (scope === 'all' ? true : !u.linked)), [data, scope])

    const columns = useMemo<MRT_ColumnDef<RwUserRow>[]>(
        () => [
            { accessorKey: 'username', header: t('expense_items.col_user'), size: 240, Cell: ({ row }) => <UsernameCell user={row.original} /> },
            { accessorKey: 'description', header: t('tariffs.description_label') },
            { id: 'status', header: t('dashboard.col_status'), accessorFn: (r) => r.status, filterVariant: 'multi-select', size: 190, mantineTableBodyCellProps: { align: 'center' }, Cell: ({ row }) => <StatusBadge user={row.original} /> },
            {
                id: 'expire',
                header: t('sub.expires'),
                sortingFn: 'datetime',
                accessorFn: (r) => (r.expire_at ? new Date(r.expire_at) : undefined),
                sortDescFirst: false,
                sortUndefined: 'last',
                enableColumnFilter: false,
                mantineTableBodyCellProps: { align: 'center' },
                Cell: ({ row }) => <ExpireCell date={row.original.expire_at} />
            },
            { id: 'traffic', header: t('sub.traffic'), accessorFn: (r) => r.used_traffic_bytes, enableColumnFilter: false, size: 260, Cell: ({ row }) => <TrafficCell user={row.original} /> },
            {
                id: 'online',
                header: t('subscriptions.col_online'),
                size: 190,
                sortingFn: 'datetime',
                accessorFn: (r) => (r.online_at ? new Date(r.online_at) : undefined),
                sortUndefined: 'last',
                enableColumnFilter: false,
                Cell: ({ row }) => <OnlineCell user={row.original} />
            },
            {
                id: 'linked',
                header: t('sub.customer'),
                accessorFn: (r) => r.customer_name,
                Cell: ({ row }) =>
                    row.original.linked ? (
                        <Group gap={6}>
                            <Anchor component={Link} to={`/customers/${row.original.customer_id}`} size="sm">
                                {row.original.customer_name}
                            </Anchor>
                            {row.original.subscription_addon_id && (
                                <Badge size="xs" color="grape" variant="soft">
                                    {t('dashboard.addon_badge')}
                                </Badge>
                            )}
                        </Group>
                    ) : (
                        <Badge color="yellow" variant="soft">
                            {t('panel_users.unlinked_one')}
                        </Badge>
                    )
            }
        ],
        [t]
    )

    return (
        <Page title={t('menu.panel_users')}>
            <PageHeader
                icon={<PiUsersThreeDuotone size={24} />}
                title={t('menu.panel_users')}
                description={t('panel_users.description')}
            />
            <DataTableCard
                storageKey="panel-users"
                icon={<PiUsersThreeDuotone size={24} />}
                title={t('panel_users.table_title')}
                actions={
                    <SegmentedControl
                        size="xs"
                        value={scope}
                        onChange={setScope}
                        data={[
                            { value: 'unlinked', label: t('panel_users.unlinked') },
                            { value: 'all', label: t('common.all') }
                        ]}
                    />
                }
                columns={columns}
                data={rows}
                state={{ showProgressBars: isFetching, isLoading: !data }}
                onRowClick={(r) => {
                    if (r.subscription_addon_id && r.parent_subscription_id) openViewAddonModal(r.subscription_addon_id, r.parent_subscription_id)
                    else if (r.subscription_id) openViewSubscriptionModal({ id: r.subscription_id, title: r.username, customer_name: r.customer_name })
                }}
                displayColumnDefOptions={{ 'mrt-row-actions': { header: '', size: 270 } }}
                initialState={{ sorting: [{ id: 'expire', desc: false }] }}
                enableRowActions
                positionActionsColumn="last"
                renderRowActions={({ row }) =>
                    row.original.linked ? null : (
                        <Group gap={4} wrap="nowrap">
                            <Button
                                size="compact-xs"
                                variant="soft"
                                leftSection={<PiLink size={14} />}
                                onClick={() => openSubscriptionForm({ rwUserId: row.original.id })}
                            >
                                {t('panel_users.to_customer')}
                            </Button>
                            <Button
                                size="compact-xs"
                                color="teal"
                                variant="soft"
                                leftSection={<PiUserPlus size={14} />}
                                onClick={() =>
                                    openCustomerForm(undefined, (id) => openSubscriptionForm({ customerId: id, rwUserId: row.original.id }))
                                }
                            >
                                {t('customers.new')}
                            </Button>
                        </Group>
                    )
                }
            />
        </Page>
    )
}
