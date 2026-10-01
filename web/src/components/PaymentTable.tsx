import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import { ActionIcon, ActionIconGroup, Anchor, Badge, Group, Text } from '@mantine/core'
import { PiBank, PiCurrencyBtc, PiLightning, PiMoney, PiPencilSimple, PiQuestion, PiTrash, PiUser } from 'react-icons/pi'
import { Link } from 'react-router'

import { api } from '@/api/client'
import { useInvalidateAll } from '@/api/hooks'
import type { Payment } from '@/api/types'
import { openPaymentEdit } from '@/modals/PaymentEditModal'
import { confirmDanger } from '@/modals/open'

import { fmtDate, fmtMoney } from './format'
import { notifyError } from './notify'

const methodMeta: Record<string, { color: string; icon: React.ReactNode }> = {
    Перевод: { color: 'cyan', icon: <PiBank size={14} /> },
    СБП: { color: 'violet', icon: <PiLightning size={14} /> },
    Наличные: { color: 'teal', icon: <PiMoney size={14} /> },
    Крипта: { color: 'orange', icon: <PiCurrencyBtc size={14} /> }
}

export function MethodBadge({ method }: { method: string }) {
    if (!method) return <Text c="dimmed">—</Text>
    const m = methodMeta[method] ?? { color: 'gray', icon: <PiQuestion size={14} /> }
    return (
        <Badge color={m.color} leftSection={m.icon} size="lg" variant="soft">
            {method}
        </Badge>
    )
}

// paymentColumns are shared by the payments page and the customer card.
export function paymentColumns(withCustomer: boolean): MRT_ColumnDef<Payment>[] {
    const cols: MRT_ColumnDef<Payment>[] = [
        {
            id: 'date',
            header: 'Дата',
            size: 130,
            sortingFn: 'datetime',
            accessorFn: (r) => new Date(r.date),
            enableColumnFilter: false,
            Cell: ({ row }) => (
                <Text ff="monospace" fw={500} size="sm">
                    {fmtDate(row.original.date)}
                </Text>
            )
        }
    ]
    if (withCustomer) {
        cols.push({
            accessorKey: 'customer_name',
            header: 'Клиент',
            Cell: ({ row }) => (
                <Anchor component={Link} onClick={(e) => e.stopPropagation()} size="sm" to={`/customers/${row.original.customer_id}`}>
                    <Group gap={6} wrap="nowrap">
                        <PiUser size={14} />
                        {row.original.customer_name}
                    </Group>
                </Anchor>
            )
        })
    }
    cols.push(
        {
            accessorKey: 'amount',
            header: 'Сумма',
            size: 140,
            enableColumnFilter: false,
            Cell: ({ cell }) => (
                <Text c="teal.4" ff="monospace" fw={600} size="sm" style={{ whiteSpace: 'nowrap' }}>
                    +{fmtMoney(cell.getValue<number>(), 2)}
                </Text>
            )
        },
        {
            accessorKey: 'method',
            header: 'Способ',
            size: 160,
            filterVariant: 'multi-select',
            Cell: ({ cell }) => <MethodBadge method={cell.getValue<string>()} />
        },
        {
            accessorKey: 'note',
            header: 'Комментарий',
            size: 300,
            Cell: ({ row }) => (
                <Group gap="xs" wrap="nowrap">
                    {row.original.historical && (
                        <Badge color="gray" size="md" variant="soft">
                            импорт
                        </Badge>
                    )}
                    <Text c={row.original.note ? undefined : 'dimmed'} size="sm" truncate="end">
                        {row.original.note || '—'}
                    </Text>
                </Group>
            )
        }
    )
    return cols
}

export function PaymentRowActions({ payment }: { payment: Payment }) {
    const invalidate = useInvalidateAll()
    const remove = () =>
        confirmDanger(
            'Удалить платёж?',
            'Удалится поступление, его зачисление на баланс и реферальное начисление. Уже сделанные продления останутся.',
            async () => {
                try {
                    await api.del(`payments/${payment.id}`)
                    await invalidate()
                } catch (e) {
                    notifyError(e)
                }
            }
        )
    return (
        <ActionIconGroup>
            <ActionIcon color="cyan" onClick={() => openPaymentEdit(payment)} size="lg" variant="soft">
                <PiPencilSimple size={18} />
            </ActionIcon>
            <ActionIcon color="red" onClick={remove} size="lg" variant="soft">
                <PiTrash size={18} />
            </ActionIcon>
        </ActionIconGroup>
    )
}

export const paymentTableProps = {
    enableRowActions: true,
    positionActionsColumn: 'last' as const,
    onRowClick: openPaymentEdit,
    renderRowActions: ({ row }: { row: { original: Payment } }) => <PaymentRowActions payment={row.original} />,
    displayColumnDefOptions: { 'mrt-row-actions': { header: '', size: 110 } },
    initialState: { sorting: [{ id: 'date', desc: true }] }
}
