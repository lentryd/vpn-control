import type { MRT_ColumnDef } from '@kastov/mantine-react-table-open'
import { ActionIcon, Anchor, Badge, Box, Card, Collapse, Group, Stack, Tabs, Text, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { PiCoinsDuotone, PiTreeStructureDuotone } from 'react-icons/pi'
import { TbChevronDown, TbChevronRight } from 'react-icons/tb'
import { useMemo } from 'react'
import { Link } from 'react-router'

import { useAccruals, useReferralTree, useSettings } from '@/api/hooks'
import type { Accrual, ReferralNode } from '@/api/types'
import { fmtDate, fmtMoney } from '@/components/format'
import { Money, PageHeader } from '@/components/ui'
import { Page } from '@shared/ui/page'
import { DataTableCard, DataTableShared } from '@shared/ui/table'

function Node({ node, depth }: { node: ReferralNode; depth: number }) {
    const [opened, { toggle }] = useDisclosure(depth < 1)
    const has = node.children.length > 0
    return (
        <Box>
            <Group
                gap="xs"
                wrap="nowrap"
                py={6}
                px="xs"
                style={{
                    marginLeft: depth * 24,
                    borderLeft: depth ? '1px solid rgba(255,255,255,0.08)' : undefined,
                    borderRadius: 8
                }}
            >
                {has ? (
                    <ActionIcon variant="subtle" color="gray" size="sm" onClick={toggle} aria-label="Раскрыть">
                        {opened ? <TbChevronDown size={14} /> : <TbChevronRight size={14} />}
                    </ActionIcon>
                ) : (
                    <Box w={22} />
                )}
                <Anchor component={Link} to={`/customers/${node.id}`} fw={500} size="sm" c={node.archived ? 'dimmed' : undefined}>
                    {node.name}
                </Anchor>
                {node.monthly > 0 && (
                    <Badge size="xs" variant="soft" color="teal">
                        {fmtMoney(node.monthly)}/мес
                    </Badge>
                )}
                {has && (
                    <Tooltip label={`Прямых: ${node.direct_count} (активных ${node.direct_active}), вся ветка: ${node.branch_count}`}>
                        <Badge size="xs" variant="soft" color="indigo">
                            привёл {node.direct_count}
                            {node.branch_count > node.direct_count ? ` · ветка ${node.branch_count}` : ''}
                        </Badge>
                    </Tooltip>
                )}
                {has && (
                    <Text size="xs" c="dimmed">
                        ветка: {fmtMoney(node.branch_monthly)}/мес · оплатила {fmtMoney(node.branch_paid)}
                    </Text>
                )}
                {node.accrued_total > 0 && (
                    <Text size="xs" c="grape">
                        начислено {fmtMoney(node.accrued_total, 2)}
                    </Text>
                )}
            </Group>
            {has && (
                <Collapse expanded={opened}>
                    {node.children.map((ch) => (
                        <Node key={ch.id} node={ch} depth={depth + 1} />
                    ))}
                </Collapse>
            )}
        </Box>
    )
}

export function ReferralsPage() {
    const tree = useReferralTree()
    const accruals = useAccruals()
    const settings = useSettings()
    const totals = useMemo(() => (accruals.data ?? []).reduce((s, a) => s + a.amount, 0), [accruals.data])

    const columns = useMemo<MRT_ColumnDef<Accrual>[]>(
        () => [
            { id: 'date', header: 'Дата', sortingFn: 'datetime', accessorFn: (r) => new Date(r.date), enableColumnFilter: false, Cell: ({ row }) => fmtDate(row.original.date) },
            { accessorKey: 'referrer_name', header: 'Кому', filterVariant: 'multi-select' },
            { accessorKey: 'referee_name', header: 'За кого' },
            { accessorKey: 'percent', header: '%' },
            { accessorKey: 'amount', header: 'Сумма', Cell: ({ cell }) => <Money value={cell.getValue<number>()} digits={2} /> },
            { accessorKey: 'status', header: 'Статус', Cell: () => <Badge variant="soft" color="gray">учтено</Badge> }
        ],
        []
    )

    return (
        <Page title="Рефералы">
            <PageHeader
                icon={<PiTreeStructureDuotone size={24} />}
                title="Рефералы"
                description={`Учёт без списаний: пригласившему начисляется ${settings.data?.referral_percent ?? '…'}% от платежей приглашённых (можно переопределить у клиента). Всего начислено ${fmtMoney(totals, 2)}.`}
            />
            <Tabs defaultValue="tree">
                <Tabs.List mb="md">
                    <Tabs.Tab value="tree">Кто кого привёл</Tabs.Tab>
                    <Tabs.Tab value="accruals">Начисления</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="tree">
                    <DataTableShared.Container>
                        <DataTableShared.Title
                            icon={<PiTreeStructureDuotone size={24} />}
                            title="Кто кого привёл"
                            description="Ветки раскрываются; цифры — по приглашённым и всей ветке"
                        />
                        <Card.Section p="md">
                            <Stack gap={0}>
                                {(tree.data ?? []).map((n) => (
                                    <Node key={n.id} node={n} depth={0} />
                                ))}
                            </Stack>
                        </Card.Section>
                    </DataTableShared.Container>
                </Tabs.Panel>
                <Tabs.Panel value="accruals">
                    <DataTableCard
                        storageKey="accruals"
                        icon={<PiCoinsDuotone size={24} />}
                        title="Начисления"
                        description="Только учёт: баланс клиентов не меняется"
                        columns={columns}
                        data={accruals.data ?? []}
                        state={{ isLoading: !accruals.data }}
                        initialState={{ sorting: [{ id: 'date', desc: true }] }}
                    />
                </Tabs.Panel>
            </Tabs>
        </Page>
    )
}
