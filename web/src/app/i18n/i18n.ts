// Adapted from remnawave/frontend (AGPL-3.0)
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpApi from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'

export const LANGUAGES = [
    { value: 'en', label: 'English', emoji: '🇬🇧' },
    { value: 'ru', label: 'Русский', emoji: '🇷🇺' }
] as const

i18n.use(initReactI18next)
    .use(LanguageDetector)
    .use(HttpApi)
    .init({
        fallbackLng: 'en',
        supportedLngs: LANGUAGES.map((l) => l.value),
        debug: process.env.NODE_ENV !== 'production',
        defaultNS: 'vpn-control',
        ns: ['vpn-control'],
        detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            convertDetectedLanguage: (lng) => (lng.includes('-') ? lng.split('-')[0] : lng)
        },
        load: 'languageOnly',
        preload: LANGUAGES.map((l) => l.value),
        // relative to the page, so it works under any BASE_PATH
        backend: { loadPath: 'locales/{{lng}}/{{ns}}.json' },
        interpolation: { escapeValue: false },
        react: { useSuspense: true }
    })

export default i18n
