// Service worker: makes the app installable and keeps the shell available
// offline, along with the data last seen by a signed-in admin.
//   - page (navigation): network first, the cached index.html when offline
//   - api/ reads: network first, the last good response when offline; the
//     cache is dropped on login, logout and any 401, so it never outlives
//     the session it came from; X-Cached-At tells the page how old it is
//   - assets/ (content-hashed, immutable): cache first
//   - everything else (locales, icons, manifest): stale-while-revalidate
const SHELL = 'shell-v1'
const ASSETS = 'assets-v1'
const API = 'api-v1'
const MAX_ASSETS = 300

const scope = new URL('/', self.location).href
const shellUrl = scope // the page itself; the hash router keeps it the only one

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(SHELL).then((cache) => cache.add(shellUrl)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== SHELL && key !== ASSETS && key !== API).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    )
})

self.addEventListener('fetch', (event) => {
    const { request } = event
    if (!request.url.startsWith(scope)) return
    const path = request.url.slice(scope.length)
    if (path.startsWith('api/')) {
        if (request.method === 'GET' && cacheableApi(path)) event.respondWith(apiNetworkFirst(request))
        else if (/^api\/auth\/(login|logout)/.test(path)) event.waitUntil(caches.delete(API))
        return
    }
    if (request.method !== 'GET') return

    if (request.mode === 'navigate') event.respondWith(networkFirst(request))
    else if (path.startsWith('assets/')) event.respondWith(cacheFirst(request))
    else event.respondWith(staleWhileRevalidate(request))
})

async function networkFirst(request) {
    const cache = await caches.open(SHELL)
    try {
        const response = await fetch(request)
        if (response.ok) await cache.put(shellUrl, response.clone())
        return response
    } catch (err) {
        const cached = await cache.match(shellUrl)
        if (cached) return cached
        throw err
    }
}

// Token API (v1/) and file downloads stay network only.
function cacheableApi(path) {
    return !path.startsWith('api/v1/') && !path.startsWith('api/backup/')
}

async function apiNetworkFirst(request) {
    let response
    try {
        response = await fetch(request)
    } catch (err) {
        const cached = await caches.open(API).then((cache) => cache.match(request))
        if (cached) return cached
        throw err
    }
    if (response.ok) {
        const headers = new Headers(response.headers)
        headers.set('X-Cached-At', new Date().toISOString())
        const stamped = new Response(await response.clone().blob(), { status: response.status, statusText: response.statusText, headers })
        await caches.open(API).then((cache) => cache.put(request, stamped))
    } else if (response.status === 401) {
        await caches.delete(API)
    }
    return response
}

async function cacheFirst(request) {
    const cache = await caches.open(ASSETS)
    const cached = await cache.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok) {
        await cache.put(request, response.clone())
        trim(cache)
    }
    return response
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(SHELL)
    const cached = await cache.match(request)
    const network = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone())
        return response
    })
    if (!cached) return network
    network.catch(() => {}) // offline: the cached copy is enough
    return cached
}

// Every deploy adds new hashed chunks; drop the oldest beyond MAX_ASSETS
// (cache keys come back in insertion order).
async function trim(cache) {
    const keys = await cache.keys()
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((key) => cache.delete(key)))
}
