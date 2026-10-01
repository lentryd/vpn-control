// Adapted from remnawave/frontend (AGPL-3.0)
import { rem, Tooltip } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { PiSignOut } from 'react-icons/pi'
import { useNavigate } from 'react-router'

import { api } from '@/api/client'

import { HeaderControl } from './HeaderControl'
import classes from './LogoutControl.module.css'

export function LogoutControl() {
    const navigate = useNavigate()
    const qc = useQueryClient()

    const handleLogout = async () => {
        await api.post('auth/logout').catch(() => undefined)
        qc.clear()
        navigate('/login', { replace: true })
    }

    return (
        <Tooltip label="Выйти">
            <HeaderControl className={classes.logout} onClick={handleLogout}>
                <PiSignOut style={{ width: rem(22), height: rem(22) }} />
            </HeaderControl>
        </Tooltip>
    )
}
