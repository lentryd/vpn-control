// Layout follows remnawave/frontend (AGPL-3.0): shared/_modals/users/view-user-modal
// and shared/ui/forms/users/forms-components/user-identification-card.
import { ActionIcon, Badge, Button, Group, Menu, NumberInput, Paper, Progress, SimpleGrid, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core'
import { useForm } from '@mantine/form'
import dayjs from 'dayjs'
import { motion } from 'motion/react'
import { type ReactNode, useEffect, useMemo, useRef } from 'react'
import {
    PiArrowSquareOut,
    PiArrowsLeftRight,
    PiArrowsClockwise,
    PiFloppyDiskDuotone,
    PiTag,
    PiTagDuotone,
    PiUser,
    PiCalendarPlus,
    PiCopy,
    PiHexagonDuotone,
    PiPuzzlePiece,
    PiPuzzlePieceDuotone,
    PiUserCircle
} from 'react-icons/pi'
import { TbCalendar, TbDots, TbUser, TbWifi } from 'react-icons/tb'
import { Link } from 'react-router'

import { api } from '@/api/client'
import { useApiMutation, useCustomers, useRwUsers, useSubscriptions, useTariffs } from '@/api/hooks'
import type { AddonItem, RwUser, Subscription } from '@/api/types'
import { StatusBadge } from '@/components/badges'
import { fmtBytes, fmtDate, fmtDateTime, fmtMoney, fromNow, currencySymbol } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { addonTitle, AddonMenuItems, SubscriptionMenuItems, useItemActions } from '@/components/ItemActions'
import { Money } from '@/components/ui'
import { openExtendModal } from '@/modals/ExtendModal'
import { openChangeTariffModal, openConnectAddonModal, RwUserSelect, rwLabel, tariffLabel } from '@/modals/SubscriptionModals'
import { FormColumns, FormSection } from '@shared/ui/forms/form-section'
import { LoadingScreen } from '@shared/ui/loading-screen'
import { ModalFooter } from '@shared/ui/modal-footer'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { SectionCard } from '@shared/ui/section-card'

import { openModal } from './open'
import { SearchSelect } from '@shared/ui/forms/search-select'
import { CurrencyIcon } from '@shared/currencies'

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
                                {rw.unlimited ? '∞ бессрочно' : fmtDateTime(rw.expire_at)}
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

type SubValues = {
    customer_id: string
    rw_user_id: string | null
    label: string
    tariff_id: string | null
    price_override: number | ''
    auto_extend: boolean
}

const subValues = (sub: Subscription): SubValues => ({
    customer_id: String(sub.customer_id),
    rw_user_id: sub.rw_user ? String(sub.rw_user.id) : null,
    label: sub.label,
    tariff_id: sub.tariff_id ? String(sub.tariff_id) : null,
    price_override: sub.price_override ?? '',
    auto_extend: sub.auto_extend
})

type AddonValues = { price_override: number | ''; auto_extend: boolean }

const addonValues = (a: AddonItem): AddonValues => ({ price_override: a.price_override ?? '', auto_extend: a.auto_extend })

// useSyncedForm is a form over server data that also changes elsewhere
// (another modal, a refetch): fields the user hasn't touched follow the
// server, edited ones are kept.
function useSyncedForm<T extends Record<string, unknown>>(server: T) {
    const form = useForm<T>({ initialValues: server })
    const base = useRef(server)
    const key = JSON.stringify(server)
    useEffect(() => {
        const prev = base.current
        if (JSON.stringify(prev) === key) return
        const next = { ...form.getValues() }
        for (const k of Object.keys(server) as (keyof T)[]) {
            if (next[k] === prev[k]) next[k] = server[k]
        }
        base.current = server
        form.setInitialValues(server)
        form.setValues(next)
        form.resetDirty(server)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])
    return form
}

function CustomerLink({ id, onNavigate }: { id: number; onNavigate: () => void }) {
    return (
        <Button color="indigo" component={Link} onClick={onNavigate} rightSection={<PiArrowSquareOut size={14} />} size="xs" to={`/customers/${id}`} variant="subtle">
            Клиент
        </Button>
    )
}

function SwitchAutoExtend(props: ReturnType<ReturnType<typeof useForm>['getInputProps']>) {
    return (
        <Switch
            description="Продлевать из платежей клиента"
            label="Автопродление"
            thumbIcon={<PiArrowsClockwise size={10} />}
            {...props}
        />
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
                                {a.rw_user?.unlimited ? 'бессрочно' : `до ${fmtDate(a.rw_user?.expire_at)}`} · <Money value={a.price} />
                            </Text>
                        </Stack>
                        <StatusBadge size="md" user={a.rw_user} />
                    </Group>
                ))}
            </SectionCard.Root>
        </motion.div>
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
    return <SubscriptionEditor close={close} sub={sub} />
}

// SubscriptionEditor is the subscription modal: like the panel's user
// modal, the cards are the edit form and the footer saves them.
function SubscriptionEditor({ sub, close }: { sub: Subscription; close: () => void }) {
    const customers = useCustomers()
    const tariffs = useTariffs()
    const rwUsers = useRwUsers()
    const form = useSyncedForm(subValues(sub))
    const rwOptions = useMemo(
        () => (rwUsers.data ?? []).filter((u) => !u.linked || u.id === sub.rw_user?.id).map((u) => ({ value: String(u.id), label: rwLabel(u) })),
        [rwUsers.data, sub.rw_user?.id]
    )
    const tariff = tariffs.data?.find((t) => String(t.id) === form.values.tariff_id)
    const m = useApiMutation((v: SubValues) =>
        api.put(`subscriptions/${sub.id}`, {
            customer_id: Number(v.customer_id),
            rw_user_id: v.rw_user_id ? Number(v.rw_user_id) : null,
            tariff_id: v.tariff_id ? Number(v.tariff_id) : null,
            label: v.label,
            price_override: v.price_override === '' ? null : Number(v.price_override),
            auto_extend: v.auto_extend
        })
    )
    const save = form.onSubmit((v) =>
        m.mutate(v, {
            onSuccess: () => {
                form.resetDirty(v)
                notifyOk('Сохранено')
            },
            onError: (e) => notifyError(e)
        })
    )

    return (
        <motion.form animate={{ opacity: 1 }} initial={{ opacity: 0 }} onSubmit={save} transition={{ duration: 0.4, ease: 'easeInOut' }}>
            <FormColumns
                left={
                    <>
                        <IdentityCard icon={PiHexagonDuotone} rw={sub.rw_user} title={sub.title} />
                        <FormSection
                            actions={<CustomerLink id={sub.customer_id} onNavigate={close} />}
                            color="indigo"
                            description="Чья подписка и как её отличать"
                            icon={TbUser}
                            title="Учёт"
                        >
                            <SearchSelect
                                data={(customers.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
                                label="Клиент"
                                leftSection={<PiUser size={16} />}
                                {...form.getInputProps('customer_id')}
                            />
                            <TextInput
                                description="Чтобы отличать подписки одного клиента"
                                label="Метка"
                                leftSection={<PiTag size={16} />}
                                placeholder="например «Родители»"
                                {...form.getInputProps('label')}
                            />
                            <RwUserSelect
                                description="Только ещё не привязанные"
                                options={rwOptions}
                                users={rwUsers.data}
                                {...form.getInputProps('rw_user_id')}
                            />
                        </FormSection>
                    </>
                }
                right={
                    <>
                        <FormSection color="teal" description="Сколько стоит месяц" icon={PiTagDuotone} title="Тариф и цена">
                            <SearchSelect
                                allowDeselect
                                clearable
                                data={(tariffs.data ?? []).filter((t) => t.kind === 'base').map((t) => ({ value: String(t.id), label: tariffLabel(t) }))}
                                description="Параметры в панели здесь не меняются — для этого «Сменить тариф»"
                                label="Тариф"
                                leftSection={<PiTag size={16} />}
                                placeholder="Без тарифа"
                                {...form.getInputProps('tariff_id')}
                            />
                            <NumberInput
                                decimalScale={2}
                                description={tariff ? `Пусто — цена тарифа, ${fmtMoney(tariff.monthly_price)}` : 'Пусто — цена тарифа'}
                                label={`Индивидуальная цена, ${currencySymbol()}/мес`}
                                leftSection={<CurrencyIcon size={16} />}
                                min={0}
                                {...form.getInputProps('price_override')}
                            />
                            <SwitchAutoExtend {...form.getInputProps('auto_extend', { type: 'checkbox' })} />
                        </FormSection>
                        <AddonsCard sub={sub} />
                    </>
                }
            />
            <ModalFooter isMobile={window.matchMedia('(max-width: 40em)').matches}>
                <MoreMenu>
                    <SubscriptionMenuItems inView onUnlinked={close} sub={sub} />
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
                    disabled={!sub.rw_user || sub.rw_user.unlimited}
                    leftSection={<PiCalendarPlus size={16} />}
                    onClick={() => openExtendModal({ kind: 'subscription', id: sub.id, title: sub.title })}
                    size="md"
                    variant="soft"
                >
                    Продлить
                </Button>
                <SaveButton dirty={form.isDirty()} loading={m.isPending} />
            </ModalFooter>
        </motion.form>
    )
}

function SaveButton({ dirty, loading }: { dirty: boolean; loading: boolean }) {
    return (
        <Button color="teal" disabled={!dirty} leftSection={<PiFloppyDiskDuotone size={16} />} loading={loading} size="md" type="submit" variant="light">
            Сохранить
        </Button>
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
    return <AddonEditor addon={addon} close={close} sub={sub} />
}

function AddonEditor({ addon, sub, close }: { addon: AddonItem; sub: Subscription; close: () => void }) {
    const tariffs = useTariffs()
    const form = useSyncedForm(addonValues(addon))
    const title = addonTitle(addon, sub.title)
    const tariff = tariffs.data?.find((t) => t.id === addon.tariff_id)
    const m = useApiMutation((v: AddonValues) =>
        api.put(`subscription-addons/${addon.id}`, {
            price_override: v.price_override === '' ? null : Number(v.price_override),
            auto_extend: v.auto_extend
        })
    )
    const save = form.onSubmit((v) =>
        m.mutate(v, {
            onSuccess: () => {
                form.resetDirty(v)
                notifyOk('Сохранено')
            },
            onError: (e) => notifyError(e)
        })
    )

    return (
        <motion.form animate={{ opacity: 1 }} initial={{ opacity: 0 }} onSubmit={save} transition={{ duration: 0.4, ease: 'easeInOut' }}>
            <FormColumns
                left={<IdentityCard icon={PiPuzzlePieceDuotone} rw={addon.rw_user} title={title} />}
                right={
                    <>
                        <FormSection
                            actions={<CustomerLink id={sub.customer_id} onNavigate={close} />}
                            color="grape"
                            description={`${sub.customer_name} · ${addon.tariff_name || 'без тарифа'}`}
                            icon={PiTagDuotone}
                            title="Цена и продление"
                        >
                            <NumberInput
                                decimalScale={2}
                                description={tariff ? `Пусто — цена тарифа, ${fmtMoney(tariff.monthly_price)}` : 'Пусто — цена тарифа'}
                                label={`Индивидуальная цена, ${currencySymbol()}/мес`}
                                leftSection={<CurrencyIcon size={16} />}
                                min={0}
                                {...form.getInputProps('price_override')}
                            />
                            <SwitchAutoExtend {...form.getInputProps('auto_extend', { type: 'checkbox' })} />
                        </FormSection>
                        <IdentityCard icon={PiHexagonDuotone} rw={sub.rw_user} title={`Основная подписка: ${sub.title}`} />
                    </>
                }
            />
            <ModalFooter isMobile={window.matchMedia('(max-width: 40em)').matches}>
                <MoreMenu>
                    <AddonMenuItems addon={addon} inView onUnlinked={close} subTitle={sub.title} />
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
                    disabled={!addon.rw_user || addon.rw_user.unlimited}
                    leftSection={<PiCalendarPlus size={16} />}
                    onClick={() => openExtendModal({ kind: 'addon', id: addon.id, title })}
                    size="md"
                    variant="soft"
                >
                    Продлить
                </Button>
                <SaveButton dirty={form.isDirty()} loading={m.isPending} />
            </ModalFooter>
        </motion.form>
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
