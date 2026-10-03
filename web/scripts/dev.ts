// Dev server: Bun bundles index.html on every page load, serves public/
// (favicon, locales) and proxies /api to the Go backend started with --no-web.
// HMR is off: in Bun 1.4.2 its module graph drops `import x from './a.module.css'`
// (ReferenceError: import_a_module is not defined), so reload the page instead.
import index from '../index.html'

// PORT is the Go backend's port (taskfile loads it from .env), so the dev
// server has its own DEV_PORT and derives the API address from PORT.
const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 8080}`
const publicDir = new URL('../public/', import.meta.url)

const server = Bun.serve({
    port: Number(process.env.DEV_PORT ?? 5173),
    development: { hmr: false },
    routes: {
        '/': index,
        '/api/*': (req) => {
            const url = new URL(req.url)
            return fetch(new Request(API + url.pathname + url.search, req), { redirect: 'manual' })
        }
    },
    async fetch(req) {
        const file = Bun.file(new URL(`.${new URL(req.url).pathname}`, publicDir))
        return (await file.exists()) ? new Response(file) : new Response('Not Found', { status: 404 })
    }
})

console.log(`Dev server on ${server.url} (api → ${API})`)
