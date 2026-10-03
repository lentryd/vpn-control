import { Transition } from '@mantine/core'
import { IconCloudCheck, IconCloudOff } from '@tabler/icons-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { networkStore } from '@/api/client'
import { useInvalidateAll } from '@/api/hooks'
import { fmtDateTime, fromNow } from '@/components/format'

import classes from './shell.module.css'

// OfflineBanner sits above the page while there is no connection: the data
// shown is the last the service worker saw, so it says how old it is. Back
// online, it confirms briefly and refreshes every query.
export function OfflineBanner() {
    const { t } = useTranslation()
    const { offline, cachedAt } = useSyncExternalStore(networkStore.subscribe, networkStore.get)
    const invalidate = useInvalidateAll()
    const invalidateRef = useRef(invalidate)
    invalidateRef.current = invalidate
    const [restored, setRestored] = useState(false)
    const wasOffline = useRef(offline)
    const [, tick] = useState(0)

    useEffect(() => {
        if (wasOffline.current && !offline) {
            invalidateRef.current()
            setRestored(true)
            const id = setTimeout(() => setRestored(false), 2500)
            wasOffline.current = false
            return () => clearTimeout(id)
        }
        wasOffline.current = offline
    }, [offline])

    // Keep "N minutes ago" current.
    useEffect(() => {
        if (!offline) return
        const id = setInterval(() => tick((n) => n + 1), 30_000)
        return () => clearInterval(id)
    }, [offline])

    const since = cachedAt ? new Date(cachedAt).toISOString() : null

    return (
        <Transition duration={180} mounted={offline || restored} transition="slide-down">
            {(style) => (
                <div className={classes.offline} data-restored={!offline || undefined} role="status" style={style}>
                    <span className={classes.offlineIcon}>
                        {offline ? <IconCloudOff size={16} stroke={1.75} /> : <IconCloudCheck size={16} stroke={1.75} />}
                    </span>
                    <div className={classes.offlineText}>
                        <span className={classes.offlineTitle}>{offline ? t('offline.title') : t('offline.restored')}</span>
                        {offline && (
                            <span className={classes.offlineHint}>
                                {since ? (
                                    <span title={fmtDateTime(since)}>{t('offline.cached', { time: fromNow(since) })}</span>
                                ) : (
                                    t('offline.no_cache')
                                )}
                                {' · '}
                                {t('offline.read_only')}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </Transition>
    )
}
