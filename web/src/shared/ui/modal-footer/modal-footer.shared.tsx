import { Group, type MantineSpacing } from '@mantine/core'
import { IconCloudOff } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

import { useOffline } from '@/api/client'

import styles from './modal-footer.module.css'

interface IProps {
    children: React.ReactNode
    isMobile?: boolean
    mt?: MantineSpacing
}

// ModalFooter sticks a modal's buttons to its bottom edge. Offline, the
// action buttons (anything but default/subtle ones like Cancel) are locked
// and a hint says why.
export function ModalFooter({ children, isMobile = false, mt = 'md' }: IProps) {
    const { t } = useTranslation()
    const offline = useOffline()
    return (
        <Group
            className={styles.footer}
            component="footer"
            data-offline={offline || undefined}
            gap="sm"
            grow={isMobile}
            justify="flex-end"
            mt={mt}
            preventGrowOverflow={false}
            wrap="wrap"
        >
            {offline && (
                <span className={styles.offline}>
                    <IconCloudOff size={14} stroke={1.75} />
                    {t('offline.blocked')}
                </span>
            )}
            {children}
        </Group>
    )
}
