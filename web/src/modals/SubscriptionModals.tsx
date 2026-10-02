import { Alert, Group, Indicator, NumberInput, Paper, Select, type SelectProps, SimpleGrid, Stack, Switch, Text, TextInput } from '@mantine/core'
import { TbUser } from 'react-icons/tb'
import {
    PiArrowsClockwise,
    PiArrowsClockwiseDuotone,
    PiArrowsLeftRight,
    PiArrowsLeftRightDuotone,
    PiLinkDuotone,
    PiPlusCircle,
    PiPlusCircleDuotone,
    PiPuzzlePiece,
    PiPuzzlePieceDuotone,
    PiTag,
    PiTagDuotone,
    PiUser,
    PiUserCircle,
    PiUserCircleDuotone,
    PiWalletDuotone
} from 'react-icons/pi'
import { useForm } from '@mantine/form'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'

import { api } from '@/api/client'
import { useApiMutation, useCustomers, useRwUsers, useTariffs } from '@/api/hooks'
import type { RwUserRow, Subscription, Tariff } from '@/api/types'
import { expiryColor, StatusBadge } from '@/components/badges'
import { daysLeft, fmtBytes, fmtDate, fmtMoney, isUnlimited, currencySymbol } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { periodCost } from '@/components/pricing'
import { PaymentSection, tariffPresets, type Term, termBetween, type TermPreset, TermSection } from '@/components/term'
import { FormColumns, FormFooter, FormSection } from '@shared/ui/forms/form-section'

import { openModal } from './open'
import { SearchSelect } from '@shared/ui/forms/search-select'
import { CurrencyIcon } from '@shared/currencies'

export const tariffLabel = (t: Tariff) => `${t.name} — ${fmtMoney(t.monthly_price)}/мес${t.active ? '' : ' (отключён)'}`

export const rwLabel = (u: RwUserRow) => `${u.username}${u.description ? ` · ${u.description}` : ''}`

const statusColor: Record<string, string> = { ACTIVE: 'teal', EXPIRED: 'red', LIMITED: 'orange', DISABLED: 'gray' }

// openSubscriptionForm links a panel user to a customer; an existing link
// is edited in the subscription modal itself.
export function openSubscriptionForm(p: { customerId?: number; rwUserId?: number }) {
    openModal({ icon: PiLinkDuotone, color: 'cyan', title: 'Привязать пользователя панели' }, (close) => <SubscriptionForm {...p} onDone={close} />, '1000px')
}

// RwUserSelect picks a panel user, listed the way the panel shows them.
export function RwUserSelect({
    options,
    users,
    ...props
}: { options: { value: string; label: string }[]; users: RwUserRow[] | undefined } & Omit<SelectProps, 'data'>) {
    return (
        <SearchSelect
            allowDeselect
            clearable
            data={options}
            label="Пользователь Remnawave"
            leftSection={<PiUserCircle size={16} />}
            nothingFoundMessage="Свободных пользователей нет"
            placeholder="Выберите пользователя"
            renderOption={({ option }) => {
                const u = users?.find((x) => String(x.id) === option.value)
                return (
                    <Group gap="sm" wrap="nowrap">
                        <Indicator color={statusColor[u?.status ?? ''] ?? 'gray'} inline size={8} zIndex={0} />
                        <Text size="sm">{u?.username}</Text>
                        {u?.description && (
                            <Text c="dimmed" size="xs" truncate="end">
                                {u.description}
                            </Text>
                        )}
                    </Group>
                )
            }}
            {...props}
        />
    )
}

// RwUserPreview shows the picked panel user the way the panel lists it.
function RwUserPreview({ user }: { user: RwUserRow }) {
    const days = daysLeft(user.expire_at)
    return (
        <Paper bd="1px solid rgba(255,255,255,0.08)" bg="rgba(255,255,255,0.02)" p="sm" radius="md">
            <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap">
                    <Stack gap={0} miw={0}>
                        <Text fw={600} size="sm" truncate="end">
                            {user.username}
                        </Text>
                        <Text c="dimmed" size="xs" truncate="end">
                            {user.description || 'без описания'}
                        </Text>
                    </Stack>
                    <StatusBadge size="md" user={user} />
                </Group>
                <SimpleGrid cols={2} spacing="sm">
                    <Stack gap={0}>
                        <Text c="dimmed" size="xs">
                            Истекает
                        </Text>
                        <Text c={expiryColor(days)} ff="monospace" fw={500} size="sm">
                            {fmtDate(user.expire_at)}
                        </Text>
                    </Stack>
                    <Stack gap={0}>
                        <Text c="dimmed" size="xs">
                            Трафик
                        </Text>
                        <Text ff="monospace" fw={500} size="sm">
                            {fmtBytes(user.used_traffic_bytes)} / {user.traffic_limit_bytes ? fmtBytes(user.traffic_limit_bytes) : '∞'}
                        </Text>
                    </Stack>
                </SimpleGrid>
            </Stack>
        </Paper>
    )
}

function SubscriptionForm({ customerId, rwUserId, onDone }: { customerId?: number; rwUserId?: number; onDone: () => void }) {
    const customers = useCustomers()
    const tariffs = useTariffs()
    const rwUsers = useRwUsers()
    const form = useForm({
        initialValues: {
            customer_id: String(customerId ?? ''),
            rw_user_id: rwUserId ? String(rwUserId) : null,
            tariff_id: null as string | null,
            label: '',
            price_override: '' as number | '',
            auto_extend: true
        },
        validate: { customer_id: (v) => (v ? null : 'Выберите клиента') }
    })
    const rwOptions = useMemo(
        () =>
            (rwUsers.data ?? [])
                .filter((u) => !u.linked || u.id === rwUserId)
                .map((u) => ({ value: String(u.id), label: rwLabel(u) })),
        [rwUsers.data, rwUserId]
    )
    const picked = rwUsers.data?.find((u) => String(u.id) === form.values.rw_user_id)
    const m = useApiMutation((v: typeof form.values) => {
        const body = {
            customer_id: Number(v.customer_id),
            rw_user_id: v.rw_user_id ? Number(v.rw_user_id) : null,
            tariff_id: v.tariff_id ? Number(v.tariff_id) : null,
            label: v.label,
            price_override: v.price_override === '' ? null : Number(v.price_override),
            auto_extend: v.auto_extend
        }
        return api.post('subscriptions', body)
    })
    return (
        <form
            onSubmit={form.onSubmit((v) =>
                m.mutate(v, {
                    onSuccess: () => {
                        notifyOk('Сохранено')
                        onDone()
                    },
                    onError: (e) => notifyError(e)
                })
            )}
        >
            <FormColumns
                left={
                    <>
                        <FormSection color="blue" icon={TbUser} title="Клиент" description="Чья это подписка">
                            <SearchSelect
                                data={(customers.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
                                label="Клиент"
                                leftSection={<PiUser size={16} />}
                                required
                                {...form.getInputProps('customer_id')}
                            />
                            <TextInput
                                description="Чтобы отличать подписки одного клиента"
                                label="Метка"
                                leftSection={<PiTag size={16} />}
                                placeholder="например «Родители»"
                                {...form.getInputProps('label')}
                            />
                        </FormSection>
                        <FormSection color="cyan" icon={PiUserCircleDuotone} title="Пользователь панели" description="Только ещё не привязанные">
                            <RwUserSelect options={rwOptions} users={rwUsers.data} {...form.getInputProps('rw_user_id')} />
                            {picked && <RwUserPreview user={picked} />}
                        </FormSection>
                    </>
                }
                right={
                    <>
                        <FormSection color="teal" icon={PiTagDuotone} title="Тариф и цена" description="Сколько стоит месяц">
                            <SearchSelect
                                allowDeselect
                                clearable
                                data={(tariffs.data ?? []).filter((t) => t.kind === 'base').map((t) => ({ value: String(t.id), label: tariffLabel(t) }))}
                                description="Здесь параметры в панели не меняются — для этого «Сменить тариф»"
                                label="Тариф"
                                leftSection={<PiTag size={16} />}
                                placeholder="Без тарифа"
                                {...form.getInputProps('tariff_id')}
                            />
                            <NumberInput
                                decimalScale={2}
                                description="Пусто — цена тарифа"
                                label={`Индивидуальная цена, ${currencySymbol()}/мес`}
                                leftSection={<CurrencyIcon size={16} />}
                                min={0}
                                {...form.getInputProps('price_override')}
                            />
                        </FormSection>
                        <FormSection color="orange" icon={PiArrowsClockwiseDuotone} title="Продление">
                            <Switch
                                description="Продлевать из платежей клиента"
                                label="Автопродление"
                                thumbIcon={<PiArrowsClockwise size={10} />}
                                {...form.getInputProps('auto_extend', { type: 'checkbox' })}
                            />
                        </FormSection>
                    </>
                }
            />
            <FormFooter loading={m.isPending} onCancel={onDone} submitIcon={<PiLinkDuotone size={16} />} submitLabel="Привязать" />
        </form>
    )
}

// openProvisionModal creates a brand-new panel user for a customer.
export function openProvisionModal(customer: { id: number; name: string }) {
    openModal({ icon: PiPlusCircleDuotone, color: 'teal', title: 'Новая подписка', subtitle: customer.name }, (close) => <ProvisionForm customerId={customer.id} onDone={close} />, '1000px')
}

function ProvisionForm({ customerId, onDone }: { customerId: number; onDone: () => void }) {
    const tariffs = useTariffs()
    const customers = useCustomers()
    const [tariffId, setTariffId] = useState<string | null>(null)
    const [username, setUsername] = useState('')
    const [label, setLabel] = useState('')
    const [term, setTerm] = useState<Term>({ months: 1, days: 0, until: null })
    const [amount, setAmount] = useState(0)
    const [allowDebt, setAllowDebt] = useState(false)
    const eligible = (tariffs.data ?? []).filter((t) => t.kind === 'base' && t.manage_rw && t.active)
    const tariff = eligible.find((t) => String(t.id) === tariffId)
    useEffect(() => {
        if (tariff) setAmount(periodCost(tariff.monthly_price, tariff.periods, term.months, term.days))
    }, [tariff, term])
    const m = useApiMutation(() =>
        api.post('subscriptions/provision', {
            customer_id: customerId,
            tariff_id: Number(tariffId),
            username,
            label,
            months: term.months,
            days: term.days,
            amount,
            allow_debt: allowDebt
        })
    )
    return (
        <>
            {eligible.length === 0 && (
                <Alert color="yellow" mb="md" variant="soft">
                    Нет базовых тарифов с параметрами панели. Включите «Управлять параметрами пользователя» и выберите сквады у тарифа.
                </Alert>
            )}
            <FormColumns
                left={
                    <>
                        <FormSection color="cyan" icon={PiUserCircleDuotone} title="Пользователь в панели" description="Создастся с параметрами тарифа">
                            <Select
                                data={eligible.map((t) => ({ value: String(t.id), label: tariffLabel(t) }))}
                                label="Тариф"
                                leftSection={<PiTag size={16} />}
                                onChange={setTariffId}
                                placeholder="Выберите тариф"
                                value={tariffId}
                            />
                            <TextInput
                                data-autofocus
                                description="3–36 символов: латиница, цифры, _ и -"
                                label="Username"
                                leftSection={<PiUser size={16} />}
                                onChange={(e) => setUsername(e.currentTarget.value.trim())}
                                value={username}
                            />
                            <TextInput
                                label="Метка"
                                leftSection={<PiTag size={16} />}
                                onChange={(e) => setLabel(e.currentTarget.value)}
                                placeholder="например «Родители»"
                                value={label}
                            />
                        </FormSection>
                        <TermSection
                            description="Считается от сегодня"
                            from={null}
                            onChange={setTerm}
                            presets={tariff ? tariffPresets(tariff.monthly_price, tariff.periods) : []}
                            value={term}
                        />
                    </>
                }
                right={
                    <PaymentSection
                        allowDebt={allowDebt}
                        amount={amount}
                        balance={customers.data?.find((c) => c.id === customerId)?.balance}
                        monthly={tariff?.monthly_price}
                        onAllowDebt={setAllowDebt}
                        onAmount={setAmount}
                    />
                }
            />
            <FormFooter
                disabled={!tariffId || username.length < 3 || term.months + term.days <= 0}
                loading={m.isPending}
                onCancel={onDone}
                onSubmit={() =>
                    m.mutate(undefined, {
                        onSuccess: () => {
                            notifyOk('Пользователь создан в панели')
                            onDone()
                        },
                        onError: (e) => notifyError(e)
                    })
                }
                submitIcon={<PiPlusCircle size={16} />}
                submitLabel="Создать в панели"
            />
        </>
    )
}

export function openConnectAddonModal(sub: Subscription) {
    openModal({ icon: PiPuzzlePieceDuotone, color: 'grape', title: 'Подключить аддон', subtitle: sub.title }, (close) => <ConnectAddonForm sub={sub} onDone={close} />, '1000px')
}

function ConnectAddonForm({ sub, onDone }: { sub: Subscription; onDone: () => void }) {
    const tariffs = useTariffs()
    const customers = useCustomers()
    const connected = new Set(sub.addons.map((a) => a.addon_id))
    const options = (tariffs.data ?? []).filter((t) => t.kind === 'addon' && t.active && !connected.has(t.addon_id ?? 0))
    const groups = Object.entries(
        options.reduce<Record<string, { value: string; label: string }[]>>((acc, t) => {
            ;(acc[t.addon_name] ??= []).push({ value: String(t.id), label: tariffLabel(t) })
            return acc
        }, {})
    ).map(([group, items]) => ({ group, items }))
    // By default the add-on runs until the subscription is paid up, so
    // connecting it mid-period charges only the rest of that period.
    // An unlimited subscription gets an unlimited, free add-on.
    const subEnd = sub.rw_user?.expire_at && dayjs(sub.rw_user.expire_at).isAfter(dayjs().add(1, 'hour')) ? sub.rw_user.expire_at : null
    const subUnlimited = isUnlimited(subEnd)
    const alignTerm: Term | null = useMemo(
        () => (!subEnd ? null : subUnlimited ? { months: 0, days: 0, until: subEnd } : { ...termBetween(dayjs(), dayjs(subEnd)), until: subEnd }),
        [subEnd, subUnlimited]
    )
    const [tariffId, setTariffId] = useState<string | null>(null)
    const [term, setTerm] = useState<Term>(alignTerm ?? { months: 1, days: 0, until: null })
    const [amount, setAmount] = useState(0)
    const [allowDebt, setAllowDebt] = useState(false)
    const tariff = options.find((t) => String(t.id) === tariffId)
    useEffect(() => {
        if (tariff) setAmount(periodCost(tariff.monthly_price, tariff.periods, term.months, term.days))
    }, [tariff, term])
    const presets: TermPreset[] = [
        ...(alignTerm
            ? [
                  {
                      label: subUnlimited ? 'Бессрочно, как подписка' : `До конца подписки · ${fmtDate(subEnd)}`,
                      hint: tariff ? fmtMoney(periodCost(tariff.monthly_price, tariff.periods, alignTerm.months, alignTerm.days)) : undefined,
                      term: alignTerm
                  }
              ]
            : []),
        ...(tariff ? tariffPresets(tariff.monthly_price, tariff.periods) : [])
    ]
    const m = useApiMutation(() =>
        api.post(`subscriptions/${sub.id}/addons`, {
            tariff_id: Number(tariffId),
            months: term.months,
            days: term.days,
            until: term.until,
            amount,
            allow_debt: allowDebt
        })
    )
    return (
        <>
            {(!sub.rw_user || groups.length === 0) && (
                <Stack gap="xs" mb="md">
                    {!sub.rw_user && (
                        <Alert color="yellow" variant="soft">
                            Сначала привяжите подписку к пользователю панели.
                        </Alert>
                    )}
                    {groups.length === 0 && (
                        <Alert color="yellow" variant="soft">
                            Нет доступных тарифов аддонов — создайте их в «Тарифы и аддоны».
                        </Alert>
                    )}
                </Stack>
            )}
            <FormColumns
                left={
                    <>
                        <FormSection color="grape" icon={PiPuzzlePieceDuotone} title="Аддон" description="Создастся отдельный пользователь панели">
                            <Select
                                data={groups}
                                label="Аддон и тариф"
                                leftSection={<PiPuzzlePiece size={16} />}
                                onChange={setTariffId}
                                placeholder="Выберите аддон"
                                value={tariffId}
                            />
                            {tariff && !tariff.squad_uuids.length && (
                                <Alert color="orange" variant="soft">
                                    У тарифа не выбраны сквады — пользователь аддона будет создан без серверов.
                                </Alert>
                            )}
                        </FormSection>
                        <TermSection description="Считается от сегодня" from={null} onChange={setTerm} presets={presets} value={term} />
                    </>
                }
                right={
                    <PaymentSection
                        allowDebt={allowDebt}
                        amount={amount}
                        balance={customers.data?.find((c) => c.id === sub.customer_id)?.balance}
                        description="По тарифу пропорционально сроку; можно изменить (0 — бесплатно)"
                        monthly={tariff?.monthly_price}
                        onAllowDebt={setAllowDebt}
                        onAmount={setAmount}
                    />
                }
            />
            <FormFooter
                disabled={!tariffId || !sub.rw_user || (term.months + term.days <= 0 && !term.until)}
                loading={m.isPending}
                onCancel={onDone}
                onSubmit={() =>
                    m.mutate(undefined, {
                        onSuccess: () => {
                            notifyOk('Аддон подключён')
                            onDone()
                        },
                        onError: (e) => notifyError(e)
                    })
                }
                submitIcon={<PiPuzzlePiece size={16} />}
                submitLabel="Подключить"
            />
        </>
    )
}

export function openChangeTariffModal(p: { kind: 'subscription' | 'addon'; id: number; title: string; tariffId: number | null; addonId?: number }) {
    openModal({ icon: PiArrowsLeftRightDuotone, color: 'indigo', title: 'Смена тарифа', subtitle: p.title }, (close) => <ChangeTariffForm {...p} onDone={close} />, '1000px')
}

function ChangeTariffForm({
    kind,
    id,
    tariffId,
    addonId,
    onDone
}: {
    kind: 'subscription' | 'addon'
    id: number
    tariffId: number | null
    addonId?: number
    onDone: () => void
}) {
    const tariffs = useTariffs()
    const options = (tariffs.data ?? []).filter((t) =>
        kind === 'subscription' ? t.kind === 'base' : t.kind === 'addon' && t.addon_id === addonId
    )
    const [target, setTarget] = useState<string | null>(null)
    const [surcharge, setSurcharge] = useState(0)
    const [clearOverride, setClearOverride] = useState(true)
    const quote = useQuery({
        queryKey: ['tariff-quote', kind, id, target],
        enabled: !!target,
        queryFn: () =>
            api.get<{ old_monthly: number; new_monthly: number; expire_at: string | null; surcharge: number }>(
                `items/${kind}/${id}/tariff-quote?tariff_id=${target}`
            )
    })
    useEffect(() => {
        if (quote.data) setSurcharge(Math.max(0, quote.data.surcharge))
    }, [quote.data])
    const t = options.find((x) => String(x.id) === target)
    const m = useApiMutation(() =>
        api.post(`items/${kind}/${id}/tariff`, { tariff_id: Number(target), surcharge, clear_override: clearOverride })
    )
    return (
        <>
            <FormColumns
                left={
                    <FormSection color="indigo" icon={PiArrowsLeftRightDuotone} title="Новый тариф" description="Сравнение с текущей ценой">
                        <Select
                            label="Тариф"
                            leftSection={<PiTag size={16} />}
                            data={options.filter((o) => o.id !== tariffId).map((o) => ({ value: String(o.id), label: tariffLabel(o) }))}
                            placeholder="Выберите тариф"
                            value={target}
                            onChange={setTarget}
                        />
                        {quote.data && (
                            <Paper bd="1px solid rgba(255,255,255,0.08)" bg="rgba(255,255,255,0.02)" p="sm" radius="md">
                                <Stack gap={4}>
                                    <Group justify="space-between">
                                        <Text c="dimmed" size="sm">
                                            В месяц
                                        </Text>
                                        <Text ff="monospace" fw={600} size="sm">
                                            {fmtMoney(quote.data.old_monthly)} → {fmtMoney(quote.data.new_monthly)}
                                        </Text>
                                    </Group>
                                    <Group justify="space-between">
                                        <Text c="dimmed" size="sm">
                                            Оплачено до
                                        </Text>
                                        <Text ff="monospace" size="sm">
                                            {fmtDate(quote.data.expire_at)}
                                        </Text>
                                    </Group>
                                    <Group justify="space-between">
                                        <Text c="dimmed" size="sm">
                                            Пропорционально за остаток
                                        </Text>
                                        <Text ff="monospace" fw={600} size="sm">
                                            {fmtMoney(quote.data.surcharge, 2)}
                                        </Text>
                                    </Group>
                                </Stack>
                            </Paper>
                        )}
                        {t && (
                            <Text c="dimmed" size="xs">
                                {t.manage_rw
                                    ? 'Лимит трафика, стратегия сброса, HWID и сквады будут обновлены в панели.'
                                    : 'У тарифа не включено управление параметрами — в панели ничего не изменится.'}
                            </Text>
                        )}
                    </FormSection>
                }
                right={
                    <FormSection icon={PiWalletDuotone} color="orange" title="Доплата" description="Пропорционально оставшемуся сроку">
                        <NumberInput
                            label={`Доплата, ${currencySymbol()}`}
                            description="Списывается с баланса; отрицательная — вернуть на баланс"
                            leftSection={<CurrencyIcon size={16} />}
                            decimalScale={2}
                            value={surcharge}
                            onChange={(v) => setSurcharge(Number(v) || 0)}
                        />
                        <Switch
                            label="Сбросить индивидуальную цену"
                            description="Брать цену нового тарифа"
                            checked={clearOverride}
                            onChange={(e) => setClearOverride(e.currentTarget.checked)}
                        />
                    </FormSection>
                }
            />
            <FormFooter
                disabled={!target}
                loading={m.isPending}
                onCancel={onDone}
                onSubmit={() =>
                    m.mutate(undefined, {
                        onSuccess: () => {
                            notifyOk('Тариф сменён')
                            onDone()
                        },
                        onError: (e) => notifyError(e)
                    })
                }
                submitIcon={<PiArrowsLeftRight size={16} />}
                submitLabel="Сменить"
            />
        </>
    )
}
