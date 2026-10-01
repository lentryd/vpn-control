// Layout follows remnawave/frontend (AGPL-3.0): shared/_modals/users/view-user-modal
// and shared/ui/forms/users/forms-components/user-identification-card.
import { ActionIcon, Anchor, Badge, Button, Group, Menu, Paper, Progress, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import dayjs from 'dayjs'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import {
    PiArrowsLeftRight,
    PiArrowsClockwise,
    PiCalendarPlus,
    PiCopy,
    PiHexagonDuotone,
    PiPuzzlePiece,
    PiPuzzlePieceDuotone,
    PiUserCircle
} from 'react-icons/pi'
import { TbCalendar, TbDots, TbUser, TbWifi } from 'react-icons/tb'
import { Link } from 'react-router'

import { useSubscriptions } from '@/api/hooks'
import type { AddonItem, RwUser, Subscription } from '@/api/types'
import { StatusBadge } from '@/components/badges'
import { fmtBytes, fmtDateTime, fromNow } from '@/components/format'
import { addonTitle, AddonMenuItems, SubscriptionMenuItems, useItemActions } from '@/components/ItemActions'
import { Money } from '@/components/ui'
import { openExtendModal } from '@/modals/ExtendModal'
import { openChangeTariffModal, openConnectAddonModal } from '@/modals/SubscriptionModals'
import { LoadingScreen } from '@shared/ui/loading-screen'
import { ModalFooter } from '@shared/ui/modal-footer'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { SectionCard } from '@shared/ui/section-card'

import { openModal } from './open'

const MotionStack = motion.create(Stack)
const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }
const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

const statusIconColor: Record<string, string> = { ACTIVE: 'teal', DISABLED: 'gray', EXPIRED: 'red', LIMITED: 'yellow' }

function expirationStyle(expireAt: string | null | undefined) {
    const days = expireAt ? dayjs(expireAt).diff(dayjs(), 'day') : null
    if (days === null || days <= 0)
        return { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', color: 'red.5', icon: 'var(--mantine-color-red-5)' }
    if (days <= 7)
        return { bg: 'rgba(251, 191, 36, 0.10)', border: 'rgba(251, 191, 36, 0.2)', color: 'yellow.4', icon: 'var(--mantine-color-yellow-4)' }
    return { bg: 'rgba(45, 212, 191, 0.08)', border: 'rgba(45, 212, 191, 0.2)', color: 'teal.5', icon: 'var(--mantine-color-teal-5)' }
}

// lastSeenStyle follows the panel's last-seen indicator: green within 5
// minutes, yellow within an hour, red otherwise.
function lastSeenStyle(onlineAt: string | null | undefined) {
    const minutes = onlineAt ? dayjs().diff(dayjs(onlineAt), 'minute') : null
    if (minutes !== null && minutes <= 5) return expirationStyle(dayjs().add(30, 'day').toISOString())
    if (minutes !== null && minutes <= 60) return expirationStyle(dayjs().add(3, 'day').toISOString())
    return expirationStyle(null)
}

function Pill({ tip, style, icon, children }: { tip: string; style: ReturnType<typeof expirationStyle>; icon: ReactNode; children: ReactNode }) {
    return (
        <Paper bd={`1px solid ${style.border}`} bg={style.bg} p="xs" radius="md">
            <Tooltip label={tip}>
                <Group gap="xs" justify="center" wrap="nowrap">
                    {icon}
                    <Text c={style.color} fw={600} size="sm">
                        {children}
                    </Text>
                </Group>
            </Tooltip>
        </Paper>
    )
}

// IdentityCard is the panel's user identification card for the RW user
// behind a subscription or add-on.
function IdentityCard({ title, rw, icon }: { title: string; rw: RwUser | null; icon: React.ComponentType<{ size: number }> }) {
    const { copyLink } = useItemActions()
    const used = rw?.used_traffic_bytes ?? 0
    const limit = rw?.traffic_limit_bytes ?? 0
    const pct = limit ? Math.floor((used * 100) / limit) : 0
    const exp = expirationStyle(rw?.expire_at)
    const onlineStyle = lastSeenStyle(rw?.online_at)

    return (
        <motion.div variants={cardVariants}>
            <SectionCard.Root>
                <SectionCard.Section>
                    <Group justify="space-between" wrap="nowrap">
                        <BaseOverlayHeader
                            iconColor={rw ? statusIconColor[rw.status] ?? 'gray' : 'yellow'}
                            IconComponent={icon}
                            subtitle={rw ? `${rw.username} · ID ${rw.id}` : 'не привязана к панели'}
                            title={title}
                            titleOrder={5}
                        />
                        <StatusBadge h={28} user={rw} />
                    </Group>
                </SectionCard.Section>

                {rw && (
                    <SectionCard.Section>
                        <Group gap={5} justify="flex-end">
                            <Tooltip label="Скопировать ссылку подписки">
                                <ActionIcon color="teal" onClick={() => copyLink(rw.subscription_url)} size="lg" variant="soft">
                                    <PiCopy size={22} />
                                </ActionIcon>
                            </Tooltip>
                            {rw.subscription_url && (
                                <Tooltip label="Открыть страницу подписки">
                                    <ActionIcon
                                        color="cyan"
                                        component="a"
                                        href={rw.subscription_url}
                                        rel="noopener noreferrer"
                                        size="lg"
                                        target="_blank"
                                        variant="soft"
                                    >
                                        <PiUserCircle size={22} />
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </Group>
                    </SectionCard.Section>
                )}

                {rw && (
                    <SectionCard.Section>
                        <Group gap="xs" justify="space-between" mb={6}>
                            <Text c="gray.3" ff="monospace" fw={600} size="sm">
                                {fmtBytes(used)}
                            </Text>
                            <Text c="dimmed" size="xs">
                                {limit ? fmtBytes(limit) : '∞'}
                            </Text>
                        </Group>
                        <Progress
                            color={!limit ? 'teal' : pct > 95 ? 'red' : pct > 80 ? 'yellow.4' : 'teal'}
                            radius="sm"
                            size="sm"
                            value={limit ? pct : 100}
                        />
                    </SectionCard.Section>
                )}

                {rw && (
                    <SectionCard.Section>
                        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
                            <Pill icon={<TbCalendar color={exp.icon} size={18} />} style={exp} tip="Оплачено до">
                                {rw.expire_at ? dayjs(rw.expire_at).format('DD.MM.YYYY HH:mm') : '—'}
                            </Pill>
                            <Pill
                                icon={<TbWifi color={onlineStyle.icon} size={18} />}
                                style={onlineStyle}
                                tip={rw.online_at ? fmtDateTime(rw.online_at) : 'Ещё не подключался'}
                            >
                                {rw.online_at ? fromNow(rw.online_at) : 'не подключался'}
                            </Pill>
                        </SimpleGrid>
                    </SectionCard.Section>
                )}
            </SectionCard.Root>
        </motion.div>
    )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <Group justify="space-between" wrap="nowrap">
            <Text c="dimmed" size="sm">
                {label}
            </Text>
            <Text component="div" fw={500} size="sm" ta="right">
                {children}
            </Text>
        </Group>
    )
}

function BillingCard({
    customerId,
    customerName,
    tariff,
    price,
    override,
    auto,
    onNavigate
}: {
    customerId: number
    customerName: string
    tariff: string
    price: number
    override: boolean
    auto: boolean
    onNavigate: () => void
}) {
    return (
        <motion.div variants={cardVariants}>
            <SectionCard.Root>
                <SectionCard.Section>
                    <BaseOverlayHeader IconComponent={TbUser} iconColor="indigo" title="Учёт" titleOrder={5} />
                </SectionCard.Section>
                <SectionCard.Section>
                    <Stack gap="xs">
                        <Row label="Клиент">
                            <Anchor component={Link} onClick={onNavigate} size="sm" to={`/customers/${customerId}`}>
                                {customerName}
                            </Anchor>
                        </Row>
                        <Row label="Тариф">{tariff || '—'}</Row>
                        <Row label="Цена в месяц">
                            <Group gap={4} justify="flex-end" wrap="nowrap">
                                <Money value={price} />
                                {override && (
                                    <Badge color="yellow" size="xs" variant="soft">
                                        инд.
                                    </Badge>
                                )}
                            </Group>
                        </Row>
                        <Row label="Автопродление из платежей">
                            <Badge color={auto ? 'teal' : 'gray'} leftSection={<PiArrowsClockwise size={14} />} variant="soft">
                                {auto ? 'включено' : 'выключено'}
                            </Badge>
                        </Row>
                    </Stack>
                </SectionCard.Section>
            </SectionCard.Root>
        </motion.div>
    )
}

function AddonsCard({ sub }: { sub: Subscription }) {
    return (
        <motion.div variants={cardVariants}>
            <SectionCard.Root>
                <SectionCard.Section>
                    <Group justify="space-between" wrap="nowrap">
                        <BaseOverlayHeader IconComponent={PiPuzzlePieceDuotone} iconColor="grape" title="Аддоны" titleOrder={5} />
                        <Button
                            color="grape"
                            disabled={!sub.rw_user}
                            leftSection={<PiPuzzlePiece size={16} />}
                            onClick={() => openConnectAddonModal(sub)}
                            size="xs"
                            variant="soft"
                        >
                            Подключить
                        </Button>
                    </Group>
                </SectionCard.Section>
                {sub.addons.length === 0 && (
                    <Text c="dimmed" size="sm">
                        Аддонов нет
                    </Text>
                )}
                {sub.addons.map((a) => (
                    <Group
                        justify="space-between"
                        key={a.id}
                        onClick={() => openViewAddonModal(a.id, sub.id)}
                        style={{ cursor: 'pointer' }}
                        wrap="nowrap"
                    >
                        <Stack gap={0} miw={0}>
                            <Group gap={6} wrap="nowrap">
                                <Badge color="grape" variant="soft">
                                    {a.addon_name}
                                </Badge>
                                <Text size="sm" truncate="end">
                                    {a.tariff_name || 'без тарифа'}
                                </Text>
                            </Group>
                            <Text c="dimmed" size="xs">
                                до {a.rw_user?.expire_at ? dayjs(a.rw_user.expire_at).format('DD.MM.YYYY') : '—'} · <Money value={a.price} />
                            </Text>
                        </Stack>
                        <StatusBadge size="md" user={a.rw_user} />
                    </Group>
                ))}
            </SectionCard.Root>
        </motion.div>
    )
}

function Columns({ left, right }: { left: ReactNode; right: ReactNode }) {
    return (
        <Group align="flex-start" gap="md" grow={false} wrap="wrap">
            <MotionStack animate="visible" gap="md" initial="hidden" style={{ flex: '1 1 400px' }} variants={containerVariants}>
                {left}
            </MotionStack>
            <MotionStack animate="visible" gap="md" initial="hidden" style={{ flex: '1 1 400px' }} variants={containerVariants}>
                {right}
            </MotionStack>
        </Group>
    )
}

function MoreMenu({ children }: { children: ReactNode }) {
    return (
        <Menu keepMounted position="top-end" shadow="md">
            <Menu.Target>
                <Button color="gray" leftSection={<TbDots size={18} />} size="md">
                    Ещё
                </Button>
            </Menu.Target>
            <Menu.Dropdown>{children}</Menu.Dropdown>
        </Menu>
    )
}

function ViewSubscription({ id, close }: { id: number; close: () => void }) {
    const { data } = useSubscriptions()
    const sub = data?.find((s) => s.id === id)
    if (!data) return <LoadingScreen height="40vh" />
    if (!sub)
        return (
            <Text c="dimmed" p="md">
                Подписка удалена
            </Text>
        )

    return (
        <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={{ duration: 0.4, ease: 'easeInOut' }}>
            <Columns
                left={
                    <>
                        <IdentityCard icon={PiHexagonDuotone} rw={sub.rw_user} title={sub.title} />
                        <BillingCard
                            auto={sub.auto_extend}
                            customerId={sub.customer_id}
                            customerName={sub.customer_name}
                            onNavigate={close}
                            override={sub.price_override !== null}
                            price={sub.price}
                            tariff={sub.tariff_name}
                        />
                    </>
                }
                right={<AddonsCard sub={sub} />}
            />
            <ModalFooter isMobile={window.matchMedia('(max-width: 40em)').matches}>
                <MoreMenu>
                    <SubscriptionMenuItems onUnlinked={close} sub={sub} />
                </MoreMenu>
                <Button
                    color="indigo"
                    leftSection={<PiArrowsLeftRight size={16} />}
                    onClick={() => openChangeTariffModal({ kind: 'subscription', id: sub.id, title: sub.title, tariffId: sub.tariff_id })}
                    size="md"
                    variant="soft"
                >
                    Сменить тариф
                </Button>
                <Button
                    color="teal"
                    disabled={!sub.rw_user}
                    leftSection={<PiCalendarPlus size={16} />}
                    onClick={() => openExtendModal({ kind: 'subscription', id: sub.id, title: sub.title })}
                    size="md"
                    variant="soft"
                >
                    Продлить
                </Button>
            </ModalFooter>
        </motion.div>
    )
}

function ViewAddon({ id, subId, close }: { id: number; subId: number; close: () => void }) {
    const { data } = useSubscriptions()
    const sub = data?.find((s) => s.id === subId)
    const addon: AddonItem | undefined = sub?.addons.find((a) => a.id === id)
    if (!data) return <LoadingScreen height="40vh" />
    if (!sub || !addon)
        return (
            <Text c="dimmed" p="md">
                Аддон удалён
            </Text>
        )
    const title = addonTitle(addon, sub.title)

    return (
        <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={{ duration: 0.4, ease: 'easeInOut' }}>
            <Columns
                left={<IdentityCard icon={PiPuzzlePieceDuotone} rw={addon.rw_user} title={title} />}
                right={
                    <>
                        <BillingCard
                            auto={addon.auto_extend}
                            customerId={sub.customer_id}
                            customerName={sub.customer_name}
                            onNavigate={close}
                            override={addon.price_override !== null}
                            price={addon.price}
                            tariff={addon.tariff_name}
                        />
                        <IdentityCard icon={PiHexagonDuotone} rw={sub.rw_user} title={`Основная подписка: ${sub.title}`} />
                    </>
                }
            />
            <ModalFooter isMobile={window.matchMedia('(max-width: 40em)').matches}>
                <MoreMenu>
                    <AddonMenuItems addon={addon} onUnlinked={close} subTitle={sub.title} />
                </MoreMenu>
                <Button
                    color="indigo"
                    leftSection={<PiArrowsLeftRight size={16} />}
                    onClick={() =>
                        openChangeTariffModal({ kind: 'addon', id: addon.id, title, tariffId: addon.tariff_id, addonId: addon.addon_id })
                    }
                    size="md"
                    variant="soft"
                >
                    Сменить тариф
                </Button>
                <Button
                    color="teal"
                    disabled={!addon.rw_user}
                    leftSection={<PiCalendarPlus size={16} />}
                    onClick={() => openExtendModal({ kind: 'addon', id: addon.id, title })}
                    size="md"
                    variant="soft"
                >
                    Продлить
                </Button>
            </ModalFooter>
        </motion.div>
    )
}

export function openViewSubscriptionModal(sub: Pick<Subscription, 'id' | 'title' | 'customer_name'>) {
    openModal(
        { icon: PiHexagonDuotone, title: sub.title, subtitle: sub.customer_name },
        (close) => <ViewSubscription close={close} id={sub.id} />,
        '1000px'
    )
}

export function openViewAddonModal(addonId: number, subId: number) {
    openModal(
        { icon: PiPuzzlePieceDuotone, color: 'grape', title: 'Аддон' },
        (close) => <ViewAddon close={close} id={addonId} subId={subId} />,
        '1000px'
    )
}
