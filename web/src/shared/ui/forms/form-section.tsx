// Adapted from remnawave/frontend (AGPL-3.0): the section cards of
// shared/ui/forms/users/forms-components (SectionCard + BaseOverlayHeader).
import { Button, Group, Stack, ThemeIconProps } from '@mantine/core'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { PiFloppyDiskDuotone } from 'react-icons/pi'

import { BaseOverlayHeader } from '../overlays/base-overlay-header'
import { SectionCard } from '../section-card'

export function FormSection({
    icon,
    color = 'cyan',
    title,
    description,
    actions,
    children
}: {
    icon: React.ComponentType<{ size: number }>
    color?: ThemeIconProps['color']
    title: string
    description?: ReactNode
    actions?: ReactNode
    children: ReactNode
}) {
    return (
        <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} transition={{ duration: 0.3 }}>
            <SectionCard.Root>
                <SectionCard.Section>
                    <Group justify="space-between" wrap="nowrap">
                        <BaseOverlayHeader iconColor={color} IconComponent={icon} subtitle={description} title={title} titleOrder={5} />
                        {actions}
                    </Group>
                </SectionCard.Section>
                <SectionCard.Section>
                    <Stack gap="md">{children}</Stack>
                </SectionCard.Section>
            </SectionCard.Root>
        </motion.div>
    )
}

// FormFooter is the panel's modal footer: secondary actions, then the
// teal "save" button.
export function FormFooter({
    onCancel,
    loading,
    submitLabel = 'Сохранить',
    submitIcon,
    disabled,
    onSubmit,
    children
}: {
    onCancel?: () => void
    loading?: boolean
    submitLabel?: string
    submitIcon?: ReactNode
    disabled?: boolean
    onSubmit?: () => void
    children?: ReactNode
}) {
    return (
        <Group gap="md" justify="flex-end" mt="md" wrap="wrap">
            {children}
            {onCancel && (
                <Button color="gray" onClick={onCancel} size="md" variant="subtle">
                    Отмена
                </Button>
            )}
            <Button
                color="teal"
                disabled={disabled}
                leftSection={submitIcon ?? <PiFloppyDiskDuotone size={16} />}
                loading={loading}
                onClick={onSubmit}
                size="md"
                type={onSubmit ? 'button' : 'submit'}
                variant="soft"
            >
                {submitLabel}
            </Button>
        </Group>
    )
}
