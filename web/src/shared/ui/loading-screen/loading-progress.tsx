// Adapted from remnawave/frontend (AGPL-3.0)
import { nprogress } from '@mantine/nprogress'
import { useEffect } from 'react'

export function LoadingProgress() {
    useEffect(() => {
        nprogress.start()
        return () => nprogress.complete()
    }, [])

    return <></>
}
