// Adapted from remnawave/frontend (AGPL-3.0)
import { Group, MantineSpacing, Modal } from '@mantine/core'

import styles from './ModalFooter.module.css'

interface IProps {
    children: React.ReactNode
    isMobile?: boolean
    mt?: MantineSpacing
}

export function ModalFooter(props: IProps) {
    const { children, isMobile = false, mt = 'md' } = props

    return (
        <Modal.Header className={styles.footer} component="footer" h="auto" mt={mt} pos="sticky">
            <Group
                gap="md"
                grow={!!isMobile}
                justify="flex-end"
                preventGrowOverflow={false}
                w="100%"
                wrap="wrap"
            >
                {children}
            </Group>
        </Modal.Header>
    )
}
