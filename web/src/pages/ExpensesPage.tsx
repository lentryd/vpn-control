import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import { ActionIcon, Badge, Button, Group, Menu, SimpleGrid, Tabs, Text, Tooltip } from '@mantine/core'
import { PiArrowUDownLeft, PiArrowUDownLeftDuotone, PiArrowUpRight, PiBuildingsDuotone, PiPencilSimple, PiPlus, PiReceiptDuotone, PiTrash, PiWalletDuotone } from 'react-icons/pi'
import { TbDots } from 'react-icons/tb'
import { useMemo } from 'react'

import { api } from '@/api/client'
import { useExpenses, useInvalidateAll, useProviders } from '@/api/hooks'
import type { Expense, ProviderTotals } from '@/api/types'
import { fmtCurrency, fmtDate, fmtMoney, fmtNum, baseCurrency } from '@/components/format'
import { notifyError } from '@/components/notify'
import { Money, PageHeader, StatCard } from '@/components/ui'
import { openExpenseForm } from '@/modals/ExpenseModal'
import { confirmDanger } from '@/modals/open'
import { ProviderLabel } from '@shared/ui/infra/provider'
import { Page } from '@shared/ui/page'
import { DataTableCard } from '@shared/ui/table'

export function ExpensesPage() {
    const expenses = useExpenses()
    const providers = useProviders()
    const invalidate = useInvalidateAll()

    const totals = useMemo(() => {
        let gross = 0
        let refunded = 0
        for (const e of expenses.data ?? []) {
            if (e.rub_amount >= 0) gross += e.rub_amount
            else refunded -= e.rub_amount
        }
        return { gross, refunded, net: gross - refunded }
    }, [expenses.data])

    const columns = useMemo<MRT_ColumnDef<Expense>[]>(
        () => [
            { id: 'date', header: 'Дата', sortingFn: 'datetime', accessorFn: (r) => new Date(r.date), enableColumnFilter: false, Cell: ({ row }) => <Text ff="monospace" size="sm">{fmtDate(row.original.date)}</Text> },
            {
                accessorKey: 'provider',
                header: 'Провайдер',
                filterVariant: 'multi-select',
                size: 200,
                Cell: ({ row }) => <ProviderLabel name={row.original.provider} uuid={row.original.provider_uuid} />
            },
            { accessorKey: 'item_name', header: 'Статья', filterVariant: 'multi-select' },
            {
                accessorKey: 'kind',
                header: 'Тип',
                filterVariant: 'select',
                size: 170,
                mantineTableBodyCellProps: { align: 'center' },
                mantineFilterSelectProps: { data: [{ value: 'charge', label: 'Списание' }, { value: 'refund', label: 'Возврат' }] },
                Cell: ({ row }) =>
                    row.original.kind === 'refund' ? (
                        <Badge color="teal" leftSection={<PiArrowUDownLeft size={16} />} size="lg" variant="soft">
                            возврат
                        </Badge>
                    ) : (
                        <Badge color="orange" leftSection={<PiArrowUpRight size={16} />} size="lg" variant="soft">
                            списание
                        </Badge>
                    )
            },
            {
                id: 'orig',
                header: 'Сумма в валюте',
                accessorFn: (r) => r.orig_amount,
                Cell: ({ row }) => {
                    const e = row.original
                    return (
                        <Tooltip
                            label={`курс ${fmtNum(e.fx_rate, 4)}${e.fee_percent ? ` · комиссия ${e.fee_percent}%` : ''}${e.share_percent !== 100 ? ` · доля ${e.share_percent}%` : ''}`}
                        >
                            <Text ff="monospace" size="sm">
                                {fmtCurrency(e.orig_amount, e.orig_currency)}
                            </Text>
                        </Tooltip>
                    )
                }
            },
            { accessorKey: 'rub_amount', header: `В ${baseCurrency()}`, enableColumnFilter: false, Cell: ({ cell }) => <Money value={-cell.getValue<number>()} signed digits={2} /> },
            {
                id: 'extra',
                header: 'Примечание',
                accessorFn: (r) => r.note,
                Cell: ({ row }) => {
                    const e = row.original
                    return (
                        <Group gap={6} wrap="nowrap">
                            {e.refunded_total > 0 && (
                                <Badge size="xs" color="teal" variant="soft">
                                    возвращено {fmtMoney(e.refunded_total)}
                                </Badge>
                            )}
                            {e.calc_rub_amount !== null && e.calc_rub_amount !== e.rub_amount && (
                                <Badge size="xs" color="yellow" variant="soft">
                                    расчёт {fmtMoney(e.calc_rub_amount, 2)}
                                </Badge>
                            )}
                            <Text size="sm" truncate maw={280}>
                                {e.note}
                            </Text>
                        </Group>
                    )
                }
            }
        ],
        []
    )

    const providerColumns = useMemo<MRT_ColumnDef<ProviderTotals>[]>(
        () => [
            {
                accessorKey: 'provider',
                header: 'Провайдер',
                size: 240,
                Cell: ({ row }) => <ProviderLabel name={row.original.provider} uuid={row.original.provider_uuid} />
            },
            {
                accessorKey: 'gross',
                header: 'Потрачено (gross)',
                Cell: ({ cell }) => <Text ff="monospace" size="sm">{fmtMoney(cell.getValue<number>(), 2)}</Text>
            },
            {
                accessorKey: 'refunded',
                header: 'Возвращено',
                Cell: ({ cell }) =>
                    cell.getValue<number>() ? (
                        <Text c="teal" ff="monospace" size="sm">
                            {fmtMoney(cell.getValue<number>(), 2)}
                        </Text>
                    ) : (
                        <Text c="dimmed">–</Text>
                    )
            },
            {
                accessorKey: 'net',
                header: 'Нетто',
                Cell: ({ cell }) => (
                    <Text ff="monospace" fw={700} size="sm">
                        {fmtMoney(cell.getValue<number>(), 2)}
                    </Text>
                )
            },
            { accessorKey: 'count', header: 'Операций', mantineTableBodyCellProps: { align: 'center' } },
            {
                id: 'last',
                header: 'Последняя',
                sortingFn: 'datetime',
                accessorFn: (r) => new Date(r.last),
                Cell: ({ row }) => <Text ff="monospace" size="sm">{fmtDate(row.original.last)}</Text>
            }
        ],
        []
    )

    const remove = (e: Expense) =>
        confirmDanger('Удалить трату?', `${e.provider} · ${fmtMoney(e.rub_amount, 2)}`, async () => {
            try {
                await api.del(`expenses/${e.id}`)
                await invalidate()
            } catch (err) {
                notifyError(err)
            }
        })

    return (
        <Page title="Траты">
            <PageHeader
                icon={<PiReceiptDuotone size={24} />}
                title="Траты"
                description={`Списания и возвраты. Сумма в ${baseCurrency()} фиксируется по курсу на дату и не пересчитывается`}
                actions={
                    <Button color="teal" leftSection={<PiPlus size={16} />} onClick={() => openExpenseForm({})} variant="soft">
                        Трата
                    </Button>
                }
            />
            <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md" spacing="xs">
                <StatCard title="Потрачено всего" value={fmtMoney(totals.gross, 2)} hint="до учёта возвратов" icon={PiReceiptDuotone} color="orange" />
                <StatCard title="Возвращено" value={fmtMoney(totals.refunded, 2)} icon={PiArrowUDownLeftDuotone} color="teal" />
                <StatCard title="Итого (нетто)" value={fmtMoney(totals.net, 2)} icon={PiWalletDuotone} />
            </SimpleGrid>
            <Tabs defaultValue="journal">
                <Tabs.List mb="md">
                    <Tabs.Tab value="journal">Журнал</Tabs.Tab>
                    <Tabs.Tab value="providers">По провайдерам</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="journal">
                    <DataTableCard
                        storageKey="expenses"
                        icon={<PiReceiptDuotone size={24} />}
                        title="Журнал трат"
                        columns={columns}
                        data={expenses.data ?? []}
                        state={{ showProgressBars: expenses.isFetching, isLoading: !expenses.data }}
                        onRowClick={(e) => openExpenseForm({ expense: e })}
                        initialState={{ sorting: [{ id: 'date', desc: true }] }}
                        enableRowActions
                        positionActionsColumn="last"
                        renderRowActions={({ row }) => (
                            <Menu position="bottom-end" withinPortal>
                                <Menu.Target>
                                    <ActionIcon variant="subtle" color="gray">
                                        <TbDots size={18} />
                                    </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Item leftSection={<PiPencilSimple size={16} />} onClick={() => openExpenseForm({ expense: row.original })}>
                                        Изменить
                                    </Menu.Item>
                                    {row.original.kind === 'charge' && (
                                        <Menu.Item leftSection={<PiArrowUDownLeft size={16} />} onClick={() => openExpenseForm({ refundOf: row.original })}>
                                            Оформить возврат
                                        </Menu.Item>
                                    )}
                                    <Menu.Divider />
                                    <Menu.Item color="red" leftSection={<PiTrash size={16} />} onClick={() => remove(row.original)}>
                                        Удалить
                                    </Menu.Item>
                                </Menu.Dropdown>
                            </Menu>
                        )}
                    />
                </Tabs.Panel>
                <Tabs.Panel value="providers">
                    <DataTableCard
                        storageKey="providers"
                        icon={<PiBuildingsDuotone size={24} />}
                        title="По провайдерам"
                        description="Сколько потрачено до возвратов, сколько вернули и итог"
                        compact
                        columns={providerColumns}
                        data={providers.data ?? []}
                        state={{ isLoading: !providers.data }}
                        initialState={{ sorting: [{ id: 'gross', desc: true }] }}
                    />
                </Tabs.Panel>
            </Tabs>
        </Page>
    )
}
