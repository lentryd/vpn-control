import { useSyncExternalStore } from 'react'

export const API_BASE = '/api/'

// ApiError carries the server's error code and params (translated by
// errorText) next to its English message.
export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public code?: string,
        public params?: Record<string, unknown>
    ) {
        super(message)
    }
}

// Connection state for the offline banner: offline when the browser says so
// or when the service worker had to answer from its cache (server
// unreachable). cachedAt is the oldest data on screen since then.
export type NetworkState = { offline: boolean; cachedAt: number | null }
let network: NetworkState = { offline: typeof navigator !== 'undefined' && !navigator.onLine, cachedAt: null }
const networkListeners = new Set<() => void>()

function setNetwork(next: NetworkState) {
    if (next.offline === network.offline && next.cachedAt === network.cachedAt) return
    network = next
    networkListeners.forEach((fn) => fn())
}

export const networkStore = {
    get: () => network,
    subscribe(fn: () => void) {
        networkListeners.add(fn)
        return () => networkListeners.delete(fn)
    }
}

window.addEventListener('offline', () => setNetwork({ ...network, offline: true }))
window.addEventListener('online', () => setNetwork({ offline: false, cachedAt: null }))

function trackNetwork(res: Response) {
    const stamp = res.headers.get('X-Cached-At')
    if (!stamp) {
        // A live answer proves the server is reachable, whatever
        // navigator.onLine claims (it can stay false behind a VPN).
        setNetwork({ offline: false, cachedAt: null })
        return
    }
    const at = Date.parse(stamp)
    setNetwork({ offline: true, cachedAt: network.cachedAt === null ? at : Math.min(network.cachedAt, at) })
}

// useOffline is true while there is no connection; changes are blocked then.
export const useOffline = () => useSyncExternalStore(networkStore.subscribe, networkStore.get).offline

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(fn: () => void) {
    onUnauthorized = fn
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
    // Offline, a change could only fail (or be answered from the cache), so
    // refuse it up front. Logout and login still go through: logout only
    // clears cookies, and login is never answered from the cache.
    if (method !== 'GET' && network.offline && path !== 'auth/logout' && path !== 'auth/login') {
        throw new ApiError(0, 'offline', 'offline')
    }
    const isForm = body instanceof FormData
    const res = await fetch(API_BASE + path.replace(/^\//, ''), {
        method,
        credentials: 'same-origin',
        headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body)
    })
    trackNetwork(res)
    if (res.status === 401 && !path.startsWith('auth/login')) {
        onUnauthorized?.()
    }
    if (!res.ok) {
        let message = `${res.status} ${res.statusText}`
        let code: string | undefined
        let params: Record<string, unknown> | undefined
        try {
            const data = await res.json()
            if (data?.message) message = data.message
            code = data?.code
            params = data?.params
        } catch {
            /* not JSON */
        }
        throw new ApiError(res.status, message, code, params)
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
