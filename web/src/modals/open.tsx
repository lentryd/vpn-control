import { modals } from '@mantine/modals'
import type { ReactNode } from 'react'
import { PiWarningDuotone } from 'react-icons/pi'

import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'

export interface ModalHeader {
    color?: string
    icon: React.ComponentType<{ size: number }>
    subtitle?: ReactNode
    title: ReactNode
}

// openModal shows content in a Mantine modal titled like the panel's
// overlays (soft icon + title + subtitle); the render function gets a close
// callback.
export function openModal(header: ModalHeader, render: (close: () => void) => ReactNode, size: string | number = 'md') {
    const id = `m-${Math.random().toString(36).slice(2)}`
    const close = () => modals.close(id)
    modals.open({
        modalId: id,
        title: (
            <BaseOverlayHeader
                iconColor={header.color ?? 'cyan'}
                IconComponent={header.icon}
                subtitle={header.subtitle}
                title={header.title}
            />
        ),
        size,
        // wide entity modals go full screen on phones, as in the panel
        fullScreen: size === '1000px' && window.matchMedia('(max-width: 40em)').matches,
        children: render(close)
    })
    return close
}

export function confirmDanger(title: string, text: ReactNode, onConfirm: () => void, confirmLabel = 'Удалить') {
    modals.openConfirmModal({
        title: <BaseOverlayHeader iconColor="red" IconComponent={PiWarningDuotone} title={title} />,
        children: text,
        labels: { confirm: confirmLabel, cancel: 'Отмена' },
        confirmProps: { color: 'red', variant: 'soft' },
        cancelProps: { color: 'gray', variant: 'subtle' },
        onConfirm
    })
}
