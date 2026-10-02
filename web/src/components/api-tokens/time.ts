import dayjs from 'dayjs'

import i18n from '@/app/i18n/i18n'

// formatTokenTime is the panel's TIME_FIRST_DATETIME: "14:30:00, 5 March 2026".
export const formatTokenTime = (time: string | null | undefined) =>
    time ? dayjs(time).locale(i18n.resolvedLanguage ?? 'en').format('HH:mm:ss, D MMMM YYYY') : '-'
