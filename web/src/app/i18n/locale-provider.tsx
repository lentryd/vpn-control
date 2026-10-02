import { DatesProvider } from '@mantine/dates'
import { ModalsProvider } from '@mantine/modals'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { setFormat } from '@/components/format'

const intlLocale: Record<string, string> = { ru: 'ru-RU', en: 'en-US' }

// LocaleProvider applies the UI language everywhere it isn't automatic:
// dayjs, Mantine dates, number/money formatting and <html lang>. It runs
// during render, so pages below always format with the current language.
export function LocaleProvider({ children }: { children: ReactNode }) {
    const { i18n, t } = useTranslation()
    const lng = i18n.resolvedLanguage ?? 'en'
    dayjs.locale(lng)
    setFormat({ locale: intlLocale[lng] ?? lng })
    document.documentElement.lang = lng
    return (
        <DatesProvider settings={{ locale: lng, firstDayOfWeek: lng === 'en' ? 0 : 1 }}>
            <ModalsProvider labels={{ confirm: t('common.confirm'), cancel: t('common.cancel') }}>{children}</ModalsProvider>
        </DatesProvider>
    )
}
