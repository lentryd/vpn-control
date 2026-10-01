import { Loader, rem, Tooltip } from '@mantine/core'
import { useState } from 'react'
import { PiArrowsClockwise } from 'react-icons/pi'

import { api } from '@/api/client'
import { useDashboard, useInvalidateAll } from '@/api/hooks'
import { fromNow } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { HeaderControl } from '@shared/ui/header-buttons'

// SyncControl pulls fresh users from the panel; its tooltip shows when the
// background sync last ran and whether it failed.
export function SyncControl() {
    const invalidate = useInvalidateAll()
    const dashboard = useDashboard()
    const [syncing, setSyncing] = useState(false)
    const info = dashboard.data?.sync

    const sync = async () => {
        setSyncing(true)
        try {
            await api.post('rw/sync')
            await invalidate()
            notifyOk('Данные из панели обновлены')
        } catch (e) {
            notifyError(e, 'Синхронизация не удалась')
        } finally {
            setSyncing(false)
        }
    }

    return (
        <Tooltip
            label={info?.error ? `Ошибка синхронизации: ${info.error}` : `Синхронизировано с панелью ${fromNow(info?.last_sync)}`}
            maw={320}
            multiline
        >
            <HeaderControl
                disabled={syncing}
                onClick={sync}
                style={info?.error ? { borderColor: 'var(--mantine-color-red-6)', color: 'var(--mantine-color-red-4)' } : undefined}
            >
                {syncing ? <Loader color="cyan" size={18} /> : <PiArrowsClockwise style={{ width: rem(22), height: rem(22) }} />}
            </HeaderControl>
        </Tooltip>
    )
}
