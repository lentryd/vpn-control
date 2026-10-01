import { Alert, Group, Indicator, NumberInput, Paper, Select, SimpleGrid, Stack, Switch, Text, TextInput } from '@mantine/core'
import {
    PiArrowsClockwise,
    PiArrowsLeftRight,
    PiArrowsLeftRightDuotone,
    PiCalendarDuotone,
    PiCurrencyRub,
    PiHexagonDuotone,
    PiLinkDuotone,
    PiPencilSimpleDuotone,
    PiPlusCircle,
    PiPlusCircleDuotone,
    PiPuzzlePiece,
    PiPuzzlePieceDuotone,
    PiTag,
    PiTagDuotone,
    PiUser,
    PiUserCircle,
    PiWalletDuotone
} from 'react-icons/pi'
import { useForm } from '@mantine/form'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { api } from '@/api/client'
import { useApiMutation, useCustomers, useRwUsers, useTariffs } from '@/api/hooks'
import type { AddonItem, RwUserRow, Subscription, Tariff } from '@/api/types'
import { fmtDate, fmtMoney } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { periodCost } from '@/components/pricing'
import { FormFooter, FormSection } from '@shared/ui/forms/form-section'

import { openModal } from './open'

const tariffLabel = (t: Tariff) => `${t.name} — ${fmtMoney(t.monthly_price)}/мес${t.active ? '' : ' (отключён)'}`

const rwLabel = (u: RwUserRow) => `${u.username}${u.description ? ` · ${u.description}` : ''}`

const statusColor: Record<string, string> = { ACTIVE: 'teal', EXPIRED: 'red', LIMITED: 'orange', DISABLED: 'gray' }

function Payment({
    months,
    setMonths,
    amount,
    setAmount,
    allowDebt,
    setAllowDebt
}: {
    months: number
    setMonths: (n: number) => void
    amount: number
    setAmount: (n: number) => void
    allowDebt: boolean
    setAllowDebt: (b: boolean) => void
}) {
    return (
        <FormSection icon={PiWalletDuotone} color="orange" title="Оплата" description="Списывается с баланса клиента">
            <SimpleGrid cols={{ base: 1, xs: 2 }}>
                <NumberInput
                    label="Месяцев"
                    leftSection={<PiCalendarDuotone size={16} />}
                    min={1}
                    max={36}
                    value={months}
                    onChange={(v) => setMonths(Number(v) || 1)}
                />
                <NumberInput
                    label="Списать, ₽"
                    leftSection={<PiCurrencyRub size={16} />}
                    min={0}
                    decimalScale={2}
                    value={amount}
                    onChange={(v) => setAmount(Number(v) || 0)}
                />
            </SimpleGrid>
            <Switch
                label="Разрешить уход в минус"
                description="Баланс клиента станет отрицательным (долг)"
                checked={allowDebt}
                onChange={(e) => setAllowDebt(e.currentTarget.checked)}
            />
        </FormSection>
    )
}

// openSubscriptionForm links a panel user to a customer (or edits a link).
export function openSubscriptionForm(p: { sub?: Subscription; customerId?: number; rwUserId?: number }) {
    openModal(p.sub ? { icon: PiPencilSimpleDuotone, title: 'Подписка', subtitle: p.sub.title } : { icon: PiLinkDuotone, title: 'Привязать пользователя панели' }, (close) => (
        <SubscriptionForm {...p} onDone={close} />
    ))
}

function SubscriptionForm({ sub, customerId, rwUserId, onDone }: { sub?: Subscription; customerId?: number; rwUserId?: number; onDone: () => void }) {
    const customers = useCustomers()
    const tariffs = useTariffs()
    const rwUsers = useRwUsers()
    const form = useForm({
        initialValues: {
            customer_id: String(sub?.customer_id ?? customerId ?? ''),
            rw_user_id: sub?.rw_user?.id ? String(sub.rw_user.id) : rwUserId ? String(rwUserId) : null,
            tariff_id: sub?.tariff_id ? String(sub.tariff_id) : null,
            label: sub?.label ?? '',
            price_override: sub?.price_override ?? ('' as number | ''),
            auto_extend: sub?.auto_extend ?? true
        },
        validate: { customer_id: (v) => (v ? null : 'Выберите клиента') }
    })
    const rwOptions = useMemo(
        () =>
            (rwUsers.data ?? [])
                .filter((u) => !u.linked || u.id === sub?.rw_user?.id || u.id === rwUserId)
                .map((u) => ({ value: String(u.id), label: rwLabel(u) })),
        [rwUsers.data, sub, rwUserId]
    )
    const m = useApiMutation((v: typeof form.values) => {
        const body = {
            customer_id: Number(v.customer_id),
            rw_user_id: v.rw_user_id ? Number(v.rw_user_id) : null,
            tariff_id: v.tariff_id ? Number(v.tariff_id) : null,
            label: v.label,
            price_override: v.price_override === '' ? null : Number(v.price_override),
            auto_extend: v.auto_extend
        }
        return sub ? api.put(`subscriptions/${sub.id}`, body) : api.post('subscriptions', body)
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
            <Stack gap="md">
                <FormSection icon={PiHexagonDuotone} title="Подписка" description="Чья и какой пользователь панели">
                    <Select
                        label="Клиент"
                        leftSection={<PiUser size={16} />}
                        searchable
                        required
                        data={(customers.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
                        {...form.getInputProps('customer_id')}
                    />
                    <Select
                        label="Пользователь Remnawave"
                        description="Только ещё не привязанные"
                        leftSection={<PiUserCircle size={16} />}
                        searchable
                        clearable
                        allowDeselect
                        data={rwOptions}
                        renderOption={({ option }) => {
                            const u = rwUsers.data?.find((x) => String(x.id) === option.value)
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
                        {...form.getInputProps('rw_user_id')}
                    />
                    <TextInput label="Метка" leftSection={<PiTag size={16} />} placeholder="например «Родители»" {...form.getInputProps('label')} />
                </FormSection>
                <FormSection icon={PiTagDuotone} color="teal" title="Тариф и цена">
                    <Select
                        label="Тариф"
                        description="Здесь параметры в панели не меняются — для этого «Сменить тариф»"
                        leftSection={<PiTag size={16} />}
                        searchable
                        clearable
                        allowDeselect
                        data={(tariffs.data ?? []).filter((t) => t.kind === 'base').map((t) => ({ value: String(t.id), label: tariffLabel(t) }))}
                        {...form.getInputProps('tariff_id')}
                    />
                    <NumberInput
                        label="Индивидуальная цена, ₽/мес"
                        description="Пусто — цена тарифа"
                        leftSection={<PiCurrencyRub size={16} />}
                        min={0}
                        decimalScale={2}
                        {...form.getInputProps('price_override')}
                    />
                    <Switch
                        label="Автопродление"
                        description="Продлевать из платежей клиента"
                        thumbIcon={<PiArrowsClockwise size={10} />}
                        {...form.getInputProps('auto_extend', { type: 'checkbox' })}
                    />
                </FormSection>
                <FormFooter loading={m.isPending} onCancel={onDone} />
            </Stack>
        </form>
    )
}

// openProvisionModal creates a brand-new panel user for a customer.
export function openProvisionModal(customer: { id: number; name: string }) {
    openModal({ icon: PiPlusCircleDuotone, color: 'teal', title: 'Новая подписка', subtitle: customer.name }, (close) => <ProvisionForm customerId={customer.id} onDone={close} />)
}

function ProvisionForm({ customerId, onDone }: { customerId: number; onDone: () => void }) {
    const tariffs = useTariffs()
    const [tariffId, setTariffId] = useState<string | null>(null)
    const [username, setUsername] = useState('')
    const [label, setLabel] = useState('')
    const [months, setMonths] = useState(1)
    const [amount, setAmount] = useState(0)
    const [allowDebt, setAllowDebt] = useState(false)
    const eligible = (tariffs.data ?? []).filter((t) => t.kind === 'base' && t.manage_rw && t.active)
    const tariff = eligible.find((t) => String(t.id) === tariffId)
    useEffect(() => {
        if (tariff) setAmount(periodCost(tariff.monthly_price, tariff.periods, months))
    }, [tariff, months])
    const m = useApiMutation(() =>
        api.post('subscriptions/provision', {
            customer_id: customerId,
            tariff_id: Number(tariffId),
            username,
            label,
            months,
            days: 0,
            amount,
            allow_debt: allowDebt
        })
    )
    return (
        <Stack gap="md">
            {eligible.length === 0 && (
                <Alert color="yellow" variant="soft">
                    Нет базовых тарифов с параметрами панели. Включите «Управлять параметрами пользователя» и выберите сквады у тарифа.
                </Alert>
            )}
            <FormSection icon={PiUserCircle} title="Пользователь в панели" description="Создастся с параметрами тарифа">
                <Select
                    label="Тариф"
                    leftSection={<PiTag size={16} />}
                    data={eligible.map((t) => ({ value: String(t.id), label: tariffLabel(t) }))}
                    value={tariffId}
                    onChange={setTariffId}
                />
                <TextInput
                    label="Username"
                    description="3–36 символов: латиница, цифры, _ и -"
                    leftSection={<PiUser size={16} />}
                    value={username}
                    onChange={(e) => setUsername(e.currentTarget.value.trim())}
                />
                <TextInput label="Метка" leftSection={<PiTag size={16} />} value={label} onChange={(e) => setLabel(e.currentTarget.value)} />
            </FormSection>
            <Payment {...{ months, setMonths, amount, setAmount, allowDebt, setAllowDebt }} />
            <FormFooter
                disabled={!tariffId || username.length < 3}
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
        </Stack>
    )
}

export function openConnectAddonModal(sub: Subscription) {
    openModal({ icon: PiPuzzlePieceDuotone, color: 'grape', title: 'Подключить аддон', subtitle: sub.title }, (close) => <ConnectAddonForm sub={sub} onDone={close} />)
}

function ConnectAddonForm({ sub, onDone }: { sub: Subscription; onDone: () => void }) {
    const tariffs = useTariffs()
    const connected = new Set(sub.addons.map((a) => a.addon_id))
    const options = (tariffs.data ?? []).filter((t) => t.kind === 'addon' && t.active && !connected.has(t.addon_id ?? 0))
    const groups = Object.entries(
        options.reduce<Record<string, { value: string; label: string }[]>>((acc, t) => {
            ;(acc[t.addon_name] ??= []).push({ value: String(t.id), label: tariffLabel(t) })
            return acc
        }, {})
    ).map(([group, items]) => ({ group, items }))
    const [tariffId, setTariffId] = useState<string | null>(null)
    const [months, setMonths] = useState(1)
    const [amount, setAmount] = useState(0)
    const [allowDebt, setAllowDebt] = useState(false)
    const tariff = options.find((t) => String(t.id) === tariffId)
    useEffect(() => {
        if (tariff) setAmount(periodCost(tariff.monthly_price, tariff.periods, months))
    }, [tariff, months])
    const m = useApiMutation(() =>
        api.post(`subscriptions/${sub.id}/addons`, { tariff_id: Number(tariffId), months, days: 0, amount, allow_debt: allowDebt })
    )
    return (
        <Stack gap="md">
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
            <FormSection icon={PiPuzzlePieceDuotone} color="grape" title="Аддон" description="Создастся отдельный пользователь панели">
                <Select label="Аддон и тариф" leftSection={<PiPuzzlePiece size={16} />} data={groups} value={tariffId} onChange={setTariffId} />
                {tariff && !tariff.squad_uuids.length && (
                    <Alert color="orange" variant="soft">
                        У тарифа не выбраны сквады — пользователь аддона будет создан без серверов.
                    </Alert>
                )}
            </FormSection>
            <Payment {...{ months, setMonths, amount, setAmount, allowDebt, setAllowDebt }} />
            <FormFooter
                disabled={!tariffId || !sub.rw_user}
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
        </Stack>
    )
}

export function openChangeTariffModal(p: { kind: 'subscription' | 'addon'; id: number; title: string; tariffId: number | null; addonId?: number }) {
    openModal({ icon: PiArrowsLeftRightDuotone, color: 'indigo', title: 'Смена тарифа', subtitle: p.title }, (close) => <ChangeTariffForm {...p} onDone={close} />)
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
        <Stack gap="md">
            <FormSection icon={PiArrowsLeftRightDuotone} color="indigo" title="Новый тариф">
                <Select
                    label="Тариф"
                    leftSection={<PiTag size={16} />}
                    data={options.filter((o) => o.id !== tariffId).map((o) => ({ value: String(o.id), label: tariffLabel(o) }))}
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
            <FormSection icon={PiWalletDuotone} color="orange" title="Доплата">
                <NumberInput
                    label="Доплата, ₽"
                    description="Списывается с баланса; отрицательная — вернуть на баланс"
                    leftSection={<PiCurrencyRub size={16} />}
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
        </Stack>
    )
}

export function openAddonEdit(a: AddonItem) {
    openModal({ icon: PiPuzzlePieceDuotone, color: 'grape', title: 'Аддон', subtitle: a.addon_name }, (close) => <AddonEditForm a={a} onDone={close} />)
}

function AddonEditForm({ a, onDone }: { a: AddonItem; onDone: () => void }) {
    const form = useForm({
        initialValues: { price_override: a.price_override ?? ('' as number | ''), auto_extend: a.auto_extend }
    })
    const m = useApiMutation((v: typeof form.values) =>
        api.put(`subscription-addons/${a.id}`, {
            price_override: v.price_override === '' ? null : Number(v.price_override),
            auto_extend: v.auto_extend
        })
    )
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
            <Stack gap="md">
                <FormSection icon={PiPuzzlePieceDuotone} color="grape" title="Цена и продление">
                    <NumberInput
                        label="Индивидуальная цена, ₽/мес"
                        description="Пусто — цена тарифа"
                        leftSection={<PiCurrencyRub size={16} />}
                        min={0}
                        decimalScale={2}
                        {...form.getInputProps('price_override')}
                    />
                    <Switch
                        label="Автопродление"
                        description="Продлевать из платежей клиента"
                        {...form.getInputProps('auto_extend', { type: 'checkbox' })}
                    />
                </FormSection>
                <FormFooter loading={m.isPending} onCancel={onDone} />
            </Stack>
        </form>
    )
}
