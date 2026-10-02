// Locale keys are type-checked against the English file.
import 'i18next'

import type en from '../public/locales/en/vpn-control.json'

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'vpn-control'
        resources: { 'vpn-control': typeof en }
    }
}
