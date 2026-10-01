import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The SPA uses relative asset URLs ("./") and a hash router so the same
// build works at the domain root or under any BASE_PATH (e.g. /control/).
export default defineConfig({
    base: './',
    plugins: [react()],
    resolve: {
        alias: {
            '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        proxy: { '/api': 'http://localhost:8080' }
    },
    build: {
        chunkSizeWarningLimit: 2000
    }
})
