import { Badge, Group, SimpleGrid, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { PiArrowsClockwise, PiHexagonDuotone } from 'react-icons/pi'

import type { Subscription } from '@/api/types'
import { openViewAddonModal, openViewSubscriptionModal } from '@/modals/ViewItemModal'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { SectionCard } from '@shared/ui/section-card'

import { ExpireCell, OnlineCell, StatusBadge, TrafficCell } from './badges'
import { AddonActions, SubscriptionActions } from './ItemActions'
import { Money } from './ui'

function AutoIcon({ on }: { on: boolean }) {
    return (
        <Tooltip label={on ? 'Продлевается из платежей автоматически' : 'Автопродление выключено'}>
            <PiArrowsClockwise color={on ? 'var(--mantine-color-teal-5)' : 'var(--mantine-color-dark-3)'} size={16} />
        </Tooltip>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <Stack gap={2}>
            <Text c="dimmed" size="xs">
                {label}
            </Text>
            <Text component="div" size="sm">
                {children}
            </Text>
        </Stack>
    )
}

// SubscriptionCard is a section card per subscription on the customer page;
// clicking the header opens the subscription modal, as rows do in tables.
export function SubscriptionCard({ sub }: { sub: Subscription }) {
    return (
        <SectionCard.Root>
            <SectionCard.Section>
                <Group justify="space-between" wrap="nowrap">
                    <UnstyledButton onClick={() => openViewSubscriptionModal(sub)}>
                        <BaseOverlayHeader
                            IconComponent={PiHexagonDuotone}
                            subtitle={sub.rw_user?.username ?? 'не привязана к панели'}
                            title={sub.title}
                            titleOrder={5}
                        />
                    </UnstyledButton>
                    <Group gap="xs" wrap="nowrap">
                        <AutoIcon on={sub.auto_extend} />
                        <StatusBadge user={sub.rw_user} />
                        <SubscriptionActions sub={sub} />
                    </Group>
                </Group>
            </SectionCard.Section>
            <SectionCard.Section>
                <SimpleGrid cols={{ base: 2, md: 5 }} spacing="md">
                    <Field label="Тариф">{sub.tariff_name || '—'}</Field>
                    <Field label="Цена">
                        <Group gap={4}>
                            <Money value={sub.price} />
                            {sub.price_override !== null && (
                                <Badge color="yellow" size="xs" variant="soft">
                                    инд.
                                </Badge>
                            )}
                        </Group>
                    </Field>
                    <Field label="Оплачено до">
                        <Group>
                            <ExpireCell date={sub.rw_user?.expire_at} />
                        </Group>
                    </Field>
                    <Field label="Трафик">
                        <TrafficCell user={sub.rw_user} />
                    </Field>
                    <Field label="Был в сети">
                        <OnlineCell user={sub.rw_user} />
                    </Field>
                </SimpleGrid>
            </SectionCard.Section>
            {sub.addons.length > 0 && (
                <SectionCard.Section>
                    <Stack gap="xs">
                        {sub.addons.map((a) => (
                            <Group justify="space-between" key={a.id} wrap="nowrap">
                                <UnstyledButton onClick={() => openViewAddonModal(a.id, sub.id)}>
                                    <Group gap={6} wrap="nowrap">
                                        <Badge color="grape" variant="soft">
                                            {a.addon_name}
                                        </Badge>
                                        <Text size="sm">{a.tariff_name || 'без тарифа'}</Text>
                                        <AutoIcon on={a.auto_extend} />
                                    </Group>
                                </UnstyledButton>
                                <Group gap="md" wrap="nowrap">
                                    <Money value={a.price} />
                                    <ExpireCell date={a.rw_user?.expire_at} />
                                    <StatusBadge size="md" user={a.rw_user} />
                                    <AddonActions addon={a} subTitle={sub.title} />
                                </Group>
                            </Group>
                        ))}
                    </Stack>
                </SectionCard.Section>
            )}
        </SectionCard.Root>
    )
}
