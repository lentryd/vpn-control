// Adapted from remnawave/frontend (AGPL-3.0): the section cards of
// shared/ui/forms/users/forms-components (SectionCard + BaseOverlayHeader)
// and the create-user modal layout (staggered columns + sticky footer).
import { Button, Group, Stack, ThemeIconProps } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { motion } from 'motion/react'
import { createContext, type ReactNode, useContext } from 'react'
import { PiFloppyDiskDuotone } from 'react-icons/pi'

import { ModalFooter } from '../modal-footer'
import { BaseOverlayHeader } from '../overlays/base-overlay-header'
import { SectionCard } from '../section-card'

const MotionStack = motion.create(Stack)
const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }
const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

// Inside a FormStack sections take their animation from the parent so they
// appear one after another; standalone they animate on their own.
const StaggerContext = createContext(false)

export function FormStack({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
    return (
        <StaggerContext.Provider value>
            <MotionStack animate="visible" gap="md" initial="hidden" style={style} variants={containerVariants}>
                {children}
            </MotionStack>
        </StaggerContext.Provider>
    )
}

// FormColumns is the wide (1000px) modal layout: two staggered columns
// that fold into one on narrow screens.
export function FormColumns({ left, right }: { left: ReactNode; right: ReactNode }) {
    return (
        <Group align="flex-start" gap="md" wrap="wrap">
            <FormStack style={{ flex: '1 1 400px' }}>{left}</FormStack>
            <FormStack style={{ flex: '1 1 400px' }}>{right}</FormStack>
        </Group>
    )
}

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
    const staggered = useContext(StaggerContext)
    const motionProps = staggered ? { variants: cardVariants } : { animate: 'visible', initial: 'hidden', variants: cardVariants }
    return (
        <motion.div {...motionProps}>
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

// FormFooter is the panel's modal footer: secondary actions, cancel, then
// the teal "save" button. In modals it sticks to the bottom edge like the
// panel's ModalFooter; drawers (no Modal context) pass `inline`.
export function FormFooter({
    onCancel,
    loading,
    submitLabel = 'Сохранить',
    submitIcon,
    disabled,
    onSubmit,
    inline,
    children
}: {
    onCancel?: () => void
    loading?: boolean
    submitLabel?: string
    submitIcon?: ReactNode
    disabled?: boolean
    onSubmit?: () => void
    inline?: boolean
    children?: ReactNode
}) {
    const isMobile = useMediaQuery('(max-width: 40em)') ?? false
    const inStack = useContext(StaggerContext)
    const buttons = (
        <>
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
                variant="light"
            >
                {submitLabel}
            </Button>
        </>
    )
    if (inline) {
        return (
            <Group gap="md" justify="flex-end" mt="md" wrap="wrap">
                {buttons}
            </Group>
        )
    }
    return (
        <ModalFooter isMobile={isMobile} mt={inStack ? 0 : 'md'}>
            {buttons}
        </ModalFooter>
    )
}
