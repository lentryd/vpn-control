import { notifications } from '@mantine/notifications'

export const notifyOk = (message: string, title = 'Готово') =>
    notifications.show({ title, message, color: 'teal' })

export const notifyError = (err: unknown, title = 'Ошибка') =>
    notifications.show({
        title,
        message: err instanceof Error ? err.message : String(err),
        color: 'red',
        autoClose: 8000
    })
