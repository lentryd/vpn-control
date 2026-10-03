import { Tooltip } from '@mantine/core'
import dayjs from 'dayjs'
import { IconRefresh } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api } from '@/api/client'
import { useDashboard, useInvalidateAll } from '@/api/hooks'
import { fromNow } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'

import classes from './shell.module.css'

// useSync pulls fresh users from the panel and refreshes every query.
export function useSync() {
    const { t } = useTranslation()
    const invalidate = useInvalidateAll()
    const [syncing, setSyncing] = useState(false)
    const sync = async () => {
        setSyncing(true)
        try {
            await api.post('rw/sync')
            await invalidate()
            notifyOk(t('sync.done'))
        } catch (e) {
            notifyError(e, t('sync.failed'))
        } finally {
            setSyncing(false)
        }
    }
    return { sync, syncing }
}

// SyncStatus is the sidebar row with the panel sync state; a click syncs now.
export function SyncStatus({ collapsed }: { collapsed: boolean }) {
    const { t } = useTranslation()
    const dashboard = useDashboard()
    const { sync, syncing } = useSync()
    const info = dashboard.data?.sync
    const color = syncing ? 'var(--mantine-color-yellow-5)' : info?.error ? 'var(--mantine-color-red-5)' : 'var(--mantine-color-teal-5)'
    const label = info?.error ? t('sync.error', { error: info.error }) : t('sync.synced', { ago: fromNow(info?.last_sync) })
    const last = info?.last_sync ? dayjs(info.last_sync) : null
    const short = last ? t('shell.synced_ago', { time: last.format(last.isSame(dayjs(), 'day') ? 'HH:mm' : 'D MMM, HH:mm') }) : label

    return (
        <Tooltip label={label} maw={300} multiline position={collapsed ? 'right' : 'top-start'}>
            <button
                className={classes.sync}
                disabled={syncing}
                onClick={sync}
                style={{ '--sync-color': color } as React.CSSProperties}
                type="button"
            >
                <span className={classes.syncDot} />
                <span className={classes.syncText}>{syncing ? t('common.loading') : info?.error ? t('sync.failed') : short}</span>
                <IconRefresh className={`${classes.syncIcon} ${syncing ? classes.spinning : ''}`} size={14} stroke={1.75} />
            </button>
        </Tooltip>
    )
}
