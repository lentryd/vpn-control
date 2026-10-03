import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './app/vendor.css'
import './app/global.css'

import './app/i18n/i18n'

import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { NavigationProgress } from '@mantine/nprogress'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'

import { App } from './app/App'
import { LocaleProvider } from './app/i18n/locale-provider'
import { cssVariablesResolver, theme } from '@shared/constants/theme'
import { LoadingScreen } from '@shared/ui/loading-screen'

dayjs.extend(relativeTime)

// PWA: installable app and offline shell (public/sw.js). Not in the dev
// server, where a cached shell would only get in the way of reloads.
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('service worker:', err))
    })
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 }
    }
})

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <MantineProvider cssVariablesResolver={cssVariablesResolver} defaultColorScheme="auto" theme={theme}>
            <Suspense fallback={<LoadingScreen />}>
                <QueryClientProvider client={queryClient}>
                    <HashRouter>
                        <LocaleProvider>
                            <Notifications position="top-right" limit={4} />
                            <NavigationProgress size={2} />
                            <App />
                        </LocaleProvider>
                    </HashRouter>
                </QueryClientProvider>
            </Suspense>
        </MantineProvider>
    </StrictMode>
)
