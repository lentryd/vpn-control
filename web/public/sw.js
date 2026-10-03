// Service worker: makes the app installable and keeps the shell available
// offline. The API is never touched: data always comes from the network.
//   - page (navigation): network first, the cached index.html when offline
//   - assets/ (content-hashed, immutable): cache first
//   - everything else (locales, icons, manifest): stale-while-revalidate
const SHELL = 'shell-v1'
const ASSETS = 'assets-v1'
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
            .then((keys) => Promise.all(keys.filter((key) => key !== SHELL && key !== ASSETS).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    )
})

self.addEventListener('fetch', (event) => {
    const { request } = event
    if (request.method !== 'GET' || !request.url.startsWith(scope)) return
    const path = request.url.slice(scope.length)
    if (path.startsWith('api/')) return

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
