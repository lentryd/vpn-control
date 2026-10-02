import { notifications } from '@mantine/notifications'

import { ApiError } from '@/api/client'
import i18n from '@/app/i18n/i18n'

// errorText is an error for people: API errors are translated by code,
// falling back to the server's English message.
export function errorText(err: unknown): string {
    if (err instanceof ApiError && err.code) {
        return i18n.t(`errors.${err.code}` as never, { ...err.params, defaultValue: err.message }) as string
    }
    return err instanceof Error ? err.message : String(err)
}

// codedText translates an error reported inside response data.
export function codedText(message: string, code?: string, params?: Record<string, unknown>): string {
    return code ? (i18n.t(`errors.${code}` as never, { ...params, defaultValue: message }) as string) : message
}

export const notifyOk = (message: string, title = i18n.t('common.done')) => notifications.show({ title, message, color: 'teal' })

export const notifyError = (err: unknown, title = i18n.t('common.error')) =>
    notifications.show({
        title,
        message: errorText(err),
        color: 'red',
        autoClose: 8000
    })
