// API base is relative to the page: the app may live at "/" or under a
// BASE_PATH like "/control/", and the API is always "<that>/api/".
const API_BASE = new URL('api/', document.baseURI).toString()

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message)
    }
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(fn: () => void) {
    onUnauthorized = fn
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
    const isForm = body instanceof FormData
    const res = await fetch(API_BASE + path.replace(/^\//, ''), {
        method,
        credentials: 'same-origin',
        headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body)
    })
    if (res.status === 401 && !path.startsWith('auth/login')) {
        onUnauthorized?.()
    }
    if (!res.ok) {
        let message = `${res.status} ${res.statusText}`
        try {
            const data = await res.json()
            if (data?.message) message = data.message
        } catch {
            /* not JSON */
        }
        throw new ApiError(res.status, message)
    }
    return res
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await send(method, path, body)
    if (res.status === 204) return undefined as T
    const text = await res.text()
    return (text ? JSON.parse(text) : undefined) as T
}

// download fetches a file and hands it to the browser under the name from
// Content-Disposition.
async function download(path: string, fallbackName: string) {
    const res = await send('GET', path)
    const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const api = {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
    del: <T>(path: string) => request<T>('DELETE', path),
    upload: <T>(path: string, form: FormData) => request<T>('POST', path, form),
    download
}
