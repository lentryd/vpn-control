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
import { useTranslation } from 'react-i18next'

function Node({ node, depth }: { node: ReferralNode; depth: number }) {
    const { t } = useTranslation()
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
                    <ActionIcon variant="subtle" color="gray" size="sm" onClick={toggle} aria-label={t('referrals.expand')}>
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
                        {t('customer.ref_monthly', { amount: fmtMoney(node.monthly) })}
                    </Badge>
                )}
                {has && (
                    <Tooltip label={t('referrals.counts', { direct: node.direct_count, active: node.direct_active, branch: node.branch_count })}>
                        <Badge size="xs" variant="soft" color="indigo">
                            {t('referrals.referred', { count: node.direct_count })}
                            {node.branch_count > node.direct_count ? ` · ${t('referrals.branch', { count: node.branch_count })}` : ''}
                        </Badge>
                    </Tooltip>
                )}
                {has && (
                    <Text size="xs" c="dimmed">
                        {t('referrals.branch_totals', { monthly: fmtMoney(node.branch_monthly), paid: fmtMoney(node.branch_paid) })}
                    </Text>
                )}
                {node.accrued_total > 0 && (
                    <Text size="xs" c="grape">
                        {t('referrals.accrued', { amount: fmtMoney(node.accrued_total, 2) })}
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
    const { t } = useTranslation()
    const tree = useReferralTree()
    const accruals = useAccruals()
    const settings = useSettings()
    const totals = useMemo(() => (accruals.data ?? []).reduce((s, a) => s + a.amount, 0), [accruals.data])

    const columns = useMemo<MRT_ColumnDef<Accrual>[]>(
        () => [
            { id: 'date', header: t('customer.col_date'), sortingFn: 'datetime', accessorFn: (r) => new Date(r.date), enableColumnFilter: false, Cell: ({ row }) => fmtDate(row.original.date) },
            { accessorKey: 'referrer_name', header: t('referrals.col_to'), filterVariant: 'multi-select' },
            { accessorKey: 'referee_name', header: t('referrals.col_for') },
            { accessorKey: 'percent', header: '%' },
            { accessorKey: 'amount', header: t('customer.col_amount'), Cell: ({ cell }) => <Money value={cell.getValue<number>()} digits={2} /> },
            { accessorKey: 'status', header: t('dashboard.col_status'), Cell: () => <Badge variant="soft" color="gray">{t('referrals.recorded')}</Badge> }
        ],
        [t]
    )

    return (
        <Page title={t('menu.referrals')}>
            <PageHeader
                icon={<PiTreeStructureDuotone size={24} />}
                title={t('menu.referrals')}
                description={t('referrals.description', { pct: settings.data?.referral_percent ?? '…', total: fmtMoney(totals, 2) })}
            />
            <Tabs defaultValue="tree">
                <Tabs.List mb="md">
                    <Tabs.Tab value="tree">{t('referrals.tree')}</Tabs.Tab>
                    <Tabs.Tab value="accruals">{t('referrals.accruals')}</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="tree">
                    <DataTableShared.Container>
                        <DataTableShared.Title
                            icon={<PiTreeStructureDuotone size={24} />}
                            title={t('referrals.tree')}
                            description={t('referrals.tree_hint')}
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
                        title={t('referrals.accruals')}
                        description={t('referrals.accruals_hint')}
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
