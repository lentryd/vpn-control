// Adapted from remnawave/frontend (AGPL-3.0)
import { Box, BoxProps } from '@mantine/core'
import { nprogress } from '@mantine/nprogress'
import { AnimatePresence, motion } from 'motion/react'
import { forwardRef, ReactNode, useEffect } from 'react'

interface PageProps extends BoxProps {
    children: ReactNode
    title: string
}

export const Page = forwardRef<HTMLDivElement, PageProps>(({ children, title, ...other }, ref) => {
    useEffect(() => {
        nprogress.complete()
        return () => nprogress.start()
    }, [])

    return (
        <>
            <title>{`${title} | VPN Control`}</title>

            <AnimatePresence mode="wait">
                <motion.div
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                    <Box ref={ref} {...other}>
                        {children}
                    </Box>
                </motion.div>
            </AnimatePresence>
        </>
    )
})
