import { Group, type MantineSpacing } from '@mantine/core'

import styles from './modal-footer.module.css'

interface IProps {
    children: React.ReactNode
    isMobile?: boolean
    mt?: MantineSpacing
}

// ModalFooter sticks a modal's buttons to its bottom edge.
export function ModalFooter({ children, isMobile = false, mt = 'md' }: IProps) {
    return (
        <Group className={styles.footer} component="footer" gap="sm" grow={isMobile} justify="flex-end" mt={mt} preventGrowOverflow={false} wrap="wrap">
            {children}
        </Group>
    )
}
