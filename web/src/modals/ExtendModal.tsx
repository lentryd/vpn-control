import { Alert, Group, NumberInput, Paper, SimpleGrid, Stack, Switch, Text } from '@mantine/core'
import { PiCalendarDuotone, PiCalendarPlus, PiCalendarPlusDuotone, PiClockDuotone, PiCurrencyRub, PiWalletDuotone } from 'react-icons/pi'
import { TbCalendar } from 'react-icons/tb'
import { useDebouncedValue } from '@mantine/hooks'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { api } from '@/api/client'
import { useApiMutation } from '@/api/hooks'
import type { ExtensionResult } from '@/api/types'
import { fmtDate } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { FormFooter, FormSection } from '@shared/ui/forms/form-section'

import { openModal } from './open'

type Kind = 'subscription' | 'addon'

export function openExtendModal(p: { kind: Kind; id: number; title: string }) {
    openModal({ icon: PiCalendarPlusDuotone, color: 'teal', title: 'Продление', subtitle: p.title }, (close) => <ExtendForm {...p} onDone={close} />)
}

function ExtendForm({ kind, id, onDone }: { kind: Kind; id: number; onDone: () => void }) {
    const [months, setMonths] = useState(1)
    const [days, setDays] = useState(0)
    const [amount, setAmount] = useState<number | null>(null)
    const [touched, setTouched] = useState(false)
    const [allowDebt, setAllowDebt] = useState(false)
    const [dm, dd] = [useDebouncedValue(months, 250)[0], useDebouncedValue(days, 250)[0]]

    const quote = useQuery({
        queryKey: ['quote', kind, id, dm, dd],
        queryFn: () =>
            api.get<{ amount: number; from: string; to: string }>(`items/${kind}/${id}/quote?months=${dm}&days=${dd}`)
    })
    useEffect(() => {
        if (!touched && quote.data) setAmount(quote.data.amount)
    }, [quote.data, touched])

    const m = useApiMutation(() =>
        api.post<ExtensionResult>(`items/${kind}/${id}/extend`, { months, days, amount: amount ?? 0, allow_debt: allowDebt })
    )
    const submit = () =>
        m.mutate(undefined, {
            onSuccess: (r) => {
                notifyOk(`Продлено до ${fmtDate(r.to)}`)
                onDone()
            },
            onError: (e) => notifyError(e)
        })

    return (
        <Stack gap="md">
            <FormSection icon={PiCalendarPlusDuotone} color="teal" title="Срок" description="Добавляется к текущей дате окончания (или к сегодня, если уже истекла)">
                <SimpleGrid cols={{ base: 1, xs: 2 }}>
                    <NumberInput
                        label="Месяцев"
                        leftSection={<PiCalendarDuotone size={16} />}
                        min={0}
                        max={36}
                        value={months}
                        onChange={(v) => setMonths(Number(v) || 0)}
                    />
                    <NumberInput
                        label="Дней"
                        leftSection={<PiClockDuotone size={16} />}
                        min={0}
                        max={365}
                        value={days}
                        onChange={(v) => setDays(Number(v) || 0)}
                    />
                </SimpleGrid>
                {quote.data && (
                    <SimpleGrid cols={2} spacing="xs">
                        <Paper bd="1px solid rgba(255,255,255,0.08)" bg="rgba(255,255,255,0.02)" p="xs" radius="md">
                            <Group gap="xs" justify="center">
                                <TbCalendar color="var(--mantine-color-dimmed)" size={18} />
                                <Text c="dimmed" fw={600} size="sm">
                                    {fmtDate(quote.data.from)}
                                </Text>
                            </Group>
                        </Paper>
                        <Paper bd="1px solid rgba(45, 212, 191, 0.2)" bg="rgba(45, 212, 191, 0.08)" p="xs" radius="md">
                            <Group gap="xs" justify="center">
                                <TbCalendar color="var(--mantine-color-teal-5)" size={18} />
                                <Text c="teal.5" fw={600} size="sm">
                                    {fmtDate(quote.data.to)}
                                </Text>
                            </Group>
                        </Paper>
                    </SimpleGrid>
                )}
                {quote.error && (
                    <Alert color="red" variant="soft">
                        {quote.error.message}
                    </Alert>
                )}
            </FormSection>
            <FormSection icon={PiWalletDuotone} color="orange" title="Оплата" description="Списывается с баланса клиента">
                <NumberInput
                    label="Списать с баланса, ₽"
                    description="По тарифу с учётом скидок за период; можно изменить (0 — бесплатно)"
                    leftSection={<PiCurrencyRub size={16} />}
                    min={0}
                    decimalScale={2}
                    value={amount ?? ''}
                    onChange={(v) => {
                        setTouched(true)
                        setAmount(Number(v) || 0)
                    }}
                />
                <Switch
                    label="Разрешить уход в минус"
                    description="Баланс клиента станет отрицательным (долг)"
                    checked={allowDebt}
                    onChange={(e) => setAllowDebt(e.currentTarget.checked)}
                />
            </FormSection>
            <FormFooter
                disabled={months + days <= 0}
                loading={m.isPending}
                onCancel={onDone}
                onSubmit={submit}
                submitIcon={<PiCalendarPlus size={16} />}
                submitLabel="Продлить в панели"
            />
        </Stack>
    )
}
