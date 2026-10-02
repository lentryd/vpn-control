import '@fontsource-variable/montserrat'
import '@fontsource/fira-mono/400.css'
import '@fontsource/fira-mono/500.css'
import '@fontsource/fira-mono/700.css'
import '@fontsource/unbounded/700.css'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/charts/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/nprogress/styles.css'
import '@kastov/mantine-react-table-open/styles.css'
import './app/global.css'

import './app/i18n/i18n'

import { MantineProvider, v8CssVariablesResolver } from '@mantine/core'
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
import { theme } from '@shared/constants/theme'
import { LoadingScreen } from '@shared/ui/loading-screen'

dayjs.extend(relativeTime)

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 }
    }
})

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <MantineProvider
            cssVariablesResolver={v8CssVariablesResolver}
            defaultColorScheme="dark"
            forceColorScheme="dark"
            theme={theme}
        >
            <Suspense fallback={<LoadingScreen height="60vh" />}>
                <QueryClientProvider client={queryClient}>
                    <HashRouter>
                        <LocaleProvider>
                            <Notifications position="top-right" />
                            <NavigationProgress />
                            <App />
                        </LocaleProvider>
                    </HashRouter>
                </QueryClientProvider>
            </Suspense>
        </MantineProvider>
    </StrictMode>
)
