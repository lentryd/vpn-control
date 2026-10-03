import { Button, Card, Group, Text, UnstyledButton, useComputedColorScheme } from '@mantine/core'
import { Background, BackgroundVariant, type BuiltInEdge, Controls, Handle, MiniMap, type Node, type NodeProps, Panel, Position, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import type { ReferralNode } from '@/api/types'
import { Dot } from '@/components/badges'
import { fmtMoney } from '@/components/format'

import classes from './referral-flow.module.css'

const W = 236
const H = 76
const GAP_X = 96
const GAP_Y = 14

type RefData = { node: ReferralNode; root: boolean; collapsed: boolean; onToggle: (id: number) => void }
type RefFlowNode = Node<RefData, 'ref'>

// layout places the forest left to right: each leaf takes the next row,
// a parent sits level with its first child, so roots stay at the top.
function layout(roots: ReferralNode[], collapsed: Set<number>, onToggle: (id: number) => void) {
    const nodes: RefFlowNode[] = []
    const edges: BuiltInEdge[] = []
    let row = 0
    const place = (n: ReferralNode, depth: number): number => {
        const kids = collapsed.has(n.id) ? [] : n.children
        let y: number
        if (!kids.length) {
            y = row
            row += H + GAP_Y
        } else {
            const ys = kids.map((k) => {
                const active = k.monthly > 0 && !k.archived
                edges.push({ id: `${n.id}-${k.id}`, source: String(n.id), target: String(k.id), animated: active, className: active ? classes.active : undefined })
                return place(k, depth + 1)
            })
            y = ys[0]
        }
        nodes.push({
            id: String(n.id),
            type: 'ref',
            position: { x: depth * (W + GAP_X), y },
            data: { node: n, root: depth === 0, collapsed: collapsed.has(n.id), onToggle },
            width: W,
            height: H,
            draggable: false,
            selectable: false
        })
        return y
    }
    for (const r of roots) {
        place(r, 0)
        row += GAP_Y * 2
    }
    return { nodes, edges }
}

function RefNodeView({ data }: NodeProps<RefFlowNode>) {
    const { t } = useTranslation()
    const n = data.node
    const has = n.children.length > 0
    return (
        <div className={classes.node} data-archived={n.archived || undefined} data-root={data.root || undefined}>
            {!data.root && <Handle className={classes.handle} isConnectable={false} position={Position.Left} type="target" />}
            <Group gap={8} wrap="nowrap">
                <Dot color={n.archived ? 'gray' : n.monthly > 0 ? 'teal' : 'yellow'} />
                <span className={classes.name}>{n.name}</span>
                {has && (
                    <UnstyledButton
                        aria-label={t('referrals.expand')}
                        className={`${classes.toggle} nodrag`}
                        onClick={(e) => {
                            e.stopPropagation()
                            data.onToggle(n.id)
                        }}
                    >
                        {data.collapsed ? `+${n.branch_count}` : null}
                        {data.collapsed ? <IconChevronRight size={13} /> : <IconChevronLeft size={13} />}
                    </UnstyledButton>
                )}
            </Group>
            <div className={classes.line}>
                {n.archived
                    ? t('customer.archived')
                    : n.monthly > 0
                      ? t('customer.ref_monthly', { amount: fmtMoney(n.monthly) })
                      : t('customer.ref_inactive')}
                {' · '}
                {t('customer.ref_paid', { amount: fmtMoney(n.total_paid) })}
            </div>
            {has ? (
                <div className={`${classes.line} ${classes.branch}`}>
                    {t('referrals.referred', { count: n.direct_count })}
                    {n.branch_count > n.direct_count ? ` · ${t('referrals.branch', { count: n.branch_count })}` : ''}
                    {` · ${t('customer.ref_monthly', { amount: fmtMoney(n.branch_monthly) })}`}
                </div>
            ) : (
                n.accrued_total > 0 && <div className={classes.line}>{t('referrals.accrued', { amount: fmtMoney(n.accrued_total, 2) })}</div>
            )}
            {has && !data.collapsed && <Handle className={classes.handle} isConnectable={false} position={Position.Right} type="source" />}
        </div>
    )
}

const nodeTypes = { ref: RefNodeView }

// ReferralFlow draws who brought whom as a pannable, zoomable graph; a
// click on a person opens their page, the chevron folds their branch.
export function ReferralFlow({ roots }: { roots: ReferralNode[] }) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const scheme = useComputedColorScheme('light')
    const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
    const toggle = useCallback(
        (id: number) =>
            setCollapsed((s) => {
                const next = new Set(s)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
            }),
        []
    )
    const { nodes, edges } = useMemo(() => layout(roots, collapsed, toggle), [roots, collapsed, toggle])
    const parents = useMemo(() => {
        const ids: number[] = []
        const walk = (n: ReferralNode) => {
            if (n.children.length) ids.push(n.id)
            n.children.forEach(walk)
        }
        roots.forEach(walk)
        return ids
    }, [roots])

    return (
        <Card className={classes.canvas} padding={0}>
            {roots.length === 0 ? (
                <Text c="dimmed" m="auto" size="sm">
                    {t('common.empty')}
                </Text>
            ) : (
                <ReactFlow
                    colorMode={scheme}
                    edges={edges}
                    edgesFocusable={false}
                    defaultViewport={{ x: 28, y: 28, zoom: 1 }}
                    fitViewOptions={{ padding: 0.08 }}
                    maxZoom={1.6}
                    minZoom={0.2}
                    nodeTypes={nodeTypes}
                    nodes={nodes}
                    nodesConnectable={false}
                    nodesDraggable={false}
                    onNodeClick={(_, node) => navigate(`/customers/${node.id}`)}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background gap={20} size={1.2} variant={BackgroundVariant.Dots} />
                    <Controls position="bottom-left" showInteractive={false} />
                    <MiniMap nodeBorderRadius={10} nodeColor={(n) => ((n.data as RefData).root ? '#8363f9' : scheme === 'dark' ? '#52525b' : '#c4c4cc')} pannable position="bottom-right" zoomable />
                    <Panel position="top-right">
                        <Group gap={6}>
                            <Button onClick={() => setCollapsed(new Set())} size="xs" variant="default">
                                {t('referrals.expand_all')}
                            </Button>
                            <Button onClick={() => setCollapsed(new Set(parents))} size="xs" variant="default">
                                {t('referrals.collapse_all')}
                            </Button>
                        </Group>
                    </Panel>
                </ReactFlow>
            )}
        </Card>
    )
}
