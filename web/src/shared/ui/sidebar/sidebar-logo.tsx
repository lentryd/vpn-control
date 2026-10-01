// Adapted from remnawave/frontend (AGPL-3.0)
import { useNavigate } from 'react-router'

import { Logo } from '../logo'
import classes from './sidebar.module.css'

export const SidebarLogoShared = () => {
    const navigate = useNavigate()

    return (
        <Logo
            c="cyan"
            className={classes.fadeIn}
            onClick={() => navigate('/')}
            style={{ cursor: 'pointer' }}
            w="2.5rem"
        />
    )
}
