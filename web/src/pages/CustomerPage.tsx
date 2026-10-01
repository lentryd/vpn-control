import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import {
    Alert,
    Anchor,
    Badge,
    Button,
    Card,
    Group,
    Menu,
    SimpleGrid,
    Stack,
    Tabs,
    Text
} from '@mantine/core'
import {
    PiCalendarPlusDuotone,
    PiCoinsDuotone,
    PiCreditCardDuotone,
    PiLink,
    PiPencilSimple,
    PiPlus,
    PiScales,
    PiTrash,
    PiUserDuotone,
    PiUserPlus,
    PiUsersThreeDuotone,
    PiWalletDuotone
} from 'react-icons/pi'
import { TbChevronDown } from 'react-icons/tb'
import { Link, useNavigate, useParams } from 'react-router'

import { api } from '@/api/client'
import { useCustomer, useInvalidateAll } from '@/api/hooks'
import type { CustomerDetail, Extension, LedgerEntry } from '@/api/types'
import { durationLabel, fmtDate, fmtDateTime, fmtMoney } from '@/components/format'
import { notifyError } from '@/components/notify'
import { paymentColumns, paymentTableProps } from '@/components/PaymentTable'
import { SubscriptionCard } from '@/components/SubscriptionCard'
import { Money, PageHeader, StatCard } from '@/components/ui'
import { openAdjustModal, openCustomerForm } from '@/modals/CustomerModals'
import { confirmDanger } from '@/modals/open'
import { openPaymentModal } from '@/modals/PaymentModal'
import { openProvisionModal, openSubscriptionForm } from '@/modals/SubscriptionModals'
import { LoadingScreen } from '@shared/ui/loading-screen'
import { Page } from '@shared/ui/page'
import { DataTableCard } from '@shared/ui/table'

const ledgerLabel: Record<string, { label: string; color: string }> = {
    payment: { label: 'Платёж', color: 'teal' },
    charge: { label: 'Списание', color: 'orange' },
    adjustment: { label: 'Корректировка', color: 'blue' },
    refund: { label: 'Возврат', color: 'grape' }
}

const extKind: Record<string, string> = { extend: 'Продление', connect: 'Подключение', tariff_change: 'Смена тарифа' }

const mono = (v: string) => (
    <Text ff="monospace" size="sm">
        {v}
    </Text>
)

const customerPaymentColumns = paymentColumns(false)

const ledgerColumns: MRT_ColumnDef<LedgerEntry>[] = [
    { id: 'date', header: 'Дата', sortingFn: 'datetime', accessorFn: (r) => new Date(r.date), Cell: ({ row }) => mono(fmtDateTime(row.original.date)) },
    {
        accessorKey: 'type',
        header: 'Операция',
        Cell: ({ row }) => (
            <Badge color={ledgerLabel[row.original.type]?.color} size="lg" variant="soft">
                {ledgerLabel[row.original.type]?.label ?? row.original.type}
            </Badge>
        )
    },
    {
        accessorKey: 'amount',
        header: 'Сумма',
        Cell: ({ cell }) => (
            <Text c={cell.getValue<number>() > 0 ? 'teal' : 'red'} ff="monospace" fw={600} size="sm">
                {cell.getValue<number>() > 0 ? '+' : ''}
                {fmtMoney(cell.getValue<number>(), 2)}
            </Text>
        )
    },
    { accessorKey: 'note', header: 'Описание', size: 320 }
]

const extColumns: MRT_ColumnDef<Extension>[] = [
    {
        accessorKey: 'created_at',
        header: 'Когда',
        sortingFn: 'datetime',
        accessorFn: (r) => new Date(r.created_at),
        Cell: ({ row }) => mono(fmtDateTime(row.original.created_at))
    },
    {
        accessorKey: 'kind',
        header: 'Действие',
        Cell: ({ row }) => (
            <Group gap={6} wrap="nowrap">
                <Badge color={row.original.status === 'failed' ? 'red' : 'teal'} variant="soft">
                    {extKind[row.original.kind]}
                </Badge>
                {row.original.subscription_addon_id && (
                    <Badge color="grape" size="xs" variant="soft">
                        аддон
                    </Badge>
                )}
                {row.original.status === 'failed' && (
                    <Text c="red" size="xs" truncate="end" title={row.original.error}>
                        {row.original.error}
                    </Text>
                )}
            </Group>
        )
    },
    { id: 'term', header: 'Срок', accessorFn: (r) => durationLabel(r.months, r.days) },
    { accessorKey: 'amount', header: 'Сумма', Cell: ({ cell }) => mono(fmtMoney(cell.getValue<number>(), 2)) },
    {
        id: 'period',
        header: 'Период',
        size: 220,
        accessorFn: (r) => r.to_at,
        Cell: ({ row }) => (row.original.from_at ? mono(`${fmtDate(row.original.from_at)} → ${fmtDate(row.original.to_at)}`) : '–')
    },
    { accessorKey: 'actor', header: 'Кто' }
]

export function CustomerPage() {
    const id = Number(useParams().id)
    const { data, isPending, error } = useCustomer(id)
    const navigate = useNavigate()
    const invalidate = useInvalidateAll()

    if (isPending) {
        return <LoadingScreen height="60vh" />
    }
    if (error || !data) return <Alert color="red">{error?.message ?? 'Клиент не найден'}</Alert>
    const c: CustomerDetail = data

    const remove = () =>
        confirmDanger('Удалить клиента?', 'Удалить можно только клиента без платежей и подписок. Остальных — в архив.', async () => {
            try {
                await api.del(`customers/${c.id}`)
                await invalidate()
                navigate('/customers')
            } catch (e) {
                notifyError(e)
            }
        })

    return (
        <Page title={c.name}>
            <PageHeader
                icon={<PiUserDuotone size={24} />}
                title={c.name}
                description={
                    <Group gap="xs" component="span">
                        {c.archived && (
                            <Badge color="gray" variant="soft">
                                архив
                            </Badge>
                        )}
                        {c.referrer_id ? (
                            <span>
                                Привёл:{' '}
                                <Anchor component={Link} to={`/customers/${c.referrer_id}`} size="sm">
                                    {c.referrer_name}
                                </Anchor>
                            </span>
                        ) : (
                            <span>Пришёл сам</span>
                        )}
                        {c.contact && <span>· {c.contact}</span>}
                    </Group>
                }
                actions={
                    <>
                        <Button color="teal" variant="soft" leftSection={<PiCreditCardDuotone size={16} />} onClick={() => openPaymentModal({ customerId: c.id, name: c.name })}>
                            Записать платёж
                        </Button>
                        <Menu position="bottom-end">
                            <Menu.Target>
                                <Button color="gray" rightSection={<TbChevronDown size={14} />}>
                                    Ещё
                                </Button>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Item leftSection={<PiUserPlus size={16} />} onClick={() => openProvisionModal(c)}>
                                    Создать подписку в панели
                                </Menu.Item>
                                <Menu.Item leftSection={<PiLink size={16} />} onClick={() => openSubscriptionForm({ customerId: c.id })}>
                                    Привязать пользователя панели
                                </Menu.Item>
                                <Menu.Item leftSection={<PiScales size={16} />} onClick={() => openAdjustModal(c)}>
                                    Корректировка баланса
                                </Menu.Item>
                                <Menu.Item leftSection={<PiPencilSimple size={16} />} onClick={() => openCustomerForm(c)}>
                                    Редактировать
                                </Menu.Item>
                                <Menu.Divider />
                                <Menu.Item color="red" leftSection={<PiTrash size={16} />} onClick={remove}>
                                    Удалить
                                </Menu.Item>
                            </Menu.Dropdown>
                        </Menu>
                    </>
                }
            />

            <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="xs" mb="md">
                <StatCard title="Баланс" value={<Money value={c.balance} signed digits={2} />} icon={PiWalletDuotone} color={c.balance < 0 ? 'red' : 'teal'} />
                <StatCard title="В месяц" value={<Money value={c.monthly} />} icon={PiCoinsDuotone} />
                <StatCard title="Оплатил всего" value={<Money value={c.total_paid} />} hint={`посл. ${fmtDate(c.last_payment_at)}`} icon={PiCreditCardDuotone} color="grape" />
                <StatCard title="Привёл клиентов" value={c.referrals_count} icon={PiUsersThreeDuotone} color="indigo" />
            </SimpleGrid>

            {c.notes && (
                <Alert color="gray" mb="lg">
                    {c.notes}
                </Alert>
            )}

            <Tabs defaultValue="subs" keepMounted={false}>
                <Tabs.List mb="md">
                    <Tabs.Tab value="subs">Подписки ({c.subscriptions.length})</Tabs.Tab>
                    <Tabs.Tab value="payments">Платежи ({c.payments?.length ?? 0})</Tabs.Tab>
                    <Tabs.Tab value="ledger">Баланс</Tabs.Tab>
                    <Tabs.Tab value="refs">Рефералы ({c.referrals?.length ?? 0})</Tabs.Tab>
                    <Tabs.Tab value="ext">Продления</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="subs">
                    <Stack>
                        {c.subscriptions.map((s) => (
                            <SubscriptionCard key={s.id} sub={s} />
                        ))}
                        {c.subscriptions.length === 0 && (
                            <Text c="dimmed">У клиента пока нет подписок.</Text>
                        )}
                        <Group>
                            <Button color="teal" leftSection={<PiPlus size={16} />} onClick={() => openProvisionModal(c)} variant="soft">
                                Создать в панели
                            </Button>
                            <Button leftSection={<PiLink size={16} />} color="gray" onClick={() => openSubscriptionForm({ customerId: c.id })}>
                                Привязать существующего
                            </Button>
                        </Group>
                    </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="payments">
                    <DataTableCard
                        compact
                        storageKey="customer-payments"
                        icon={<PiCreditCardDuotone size={24} />}
                        title="Платежи"
                        {...paymentTableProps}
                        columns={customerPaymentColumns}
                        data={(c.payments ?? []).map((p) => ({ ...p, customer_name: c.name }))}
                    />
                </Tabs.Panel>

                <Tabs.Panel value="ledger">
                    <DataTableCard
                        compact
                        storageKey="customer-ledger"
                        icon={<PiWalletDuotone size={24} />}
                        title="Движения по балансу"
                        description="Импортированные платежи баланс не меняют"
                        columns={ledgerColumns}
                        data={c.ledger ?? []}
                        initialState={{ sorting: [{ id: 'date', desc: true }] }}
                    />
                </Tabs.Panel>

                <Tabs.Panel value="refs">
                    <SimpleGrid cols={{ base: 1, md: 2 }}>
                        <Card>
                            <Text fw={600} mb="sm">
                                Кого привёл
                            </Text>
                            <Stack gap={6}>
                                {(c.referrals ?? []).map((r) => (
                                    <Group key={r.id} justify="space-between">
                                        <Anchor component={Link} to={`/customers/${r.id}`} size="sm" c={r.archived ? 'dimmed' : undefined}>
                                            {r.name}
                                        </Anchor>
                                        <Text size="xs" c="dimmed">
                                            {r.monthly ? `${Math.round(r.monthly)} ₽/мес` : 'неактивен'} · оплатил {Math.round(r.total_paid)} ₽
                                        </Text>
                                    </Group>
                                ))}
                                {!c.referrals?.length && (
                                    <Text c="dimmed" size="sm">
                                        Никого
                                    </Text>
                                )}
                            </Stack>
                        </Card>
                        <Card>
                            <Text fw={600} mb="sm">
                                Начисления (учётно)
                            </Text>
                            <Stack gap={6}>
                                {(c.accruals ?? []).map((a) => (
                                    <Group key={a.id} justify="space-between" wrap="nowrap">
                                        <Text size="sm">
                                            {fmtDate(a.date)} · {a.referrer_id === c.id ? `от ${a.referee_name}` : `для ${a.referrer_name}`}
                                        </Text>
                                        <Text size="sm" c={a.referrer_id === c.id ? 'teal' : 'dimmed'}>
                                            {a.amount.toFixed(2)} ₽ ({a.percent}%)
                                        </Text>
                                    </Group>
                                ))}
                                {!c.accruals?.length && (
                                    <Text c="dimmed" size="sm">
                                        Нет
                                    </Text>
                                )}
                            </Stack>
                        </Card>
                    </SimpleGrid>
                </Tabs.Panel>

                <Tabs.Panel value="ext">
                    <DataTableCard
                        compact
                        storageKey="customer-extensions"
                        icon={<PiCalendarPlusDuotone size={24} />}
                        title="Продления"
                        description="Что и когда продлевалось в панели"
                        columns={extColumns}
                        data={c.extensions ?? []}
                        initialState={{ sorting: [{ id: 'created_at', desc: true }] }}
                    />
                </Tabs.Panel>
            </Tabs>
        </Page>
    )
}
