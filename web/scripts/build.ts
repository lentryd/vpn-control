// Production build: index.html → dist/ with relative asset URLs, so the same
// build works at the domain root or under any BASE_PATH (e.g. /control/),
// plus public/ (favicon, locales) copied as is.
import { cp, mkdir, rm } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

import type { BunPlugin } from 'bun'

import postcss from './postcss-plugin'

const root = new URL('..', import.meta.url).pathname
const outdir = `${root}dist`

await rm(outdir, { recursive: true, force: true })

// Bun inlines every font into the CSS as a data: URL (~1 MB of subsets the
// browser would otherwise fetch lazily by unicode-range). Keep the fontsource
// url(./files/x.woff2) references as they are and copy the files next to the CSS.
const fonts = new Map<string, string>()
const externalFonts: BunPlugin = {
    name: 'external-fonts',
    setup(build) {
        build.onResolve({ filter: /\.woff2?$/ }, ({ path, importer }) => {
            fonts.set(path, resolve(dirname(importer), path))
            return { path, external: true }
        })
    }
}

const result = await Bun.build({
    entrypoints: [`${root}index.html`],
    outdir,
    target: 'browser',
    minify: true,
    splitting: true,
    sourcemap: 'none',
    naming: { chunk: 'assets/[name]-[hash].[ext]', asset: 'assets/[name]-[hash].[ext]' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [postcss, externalFonts]
})

if (!result.success) {
    for (const log of result.logs) console.error(log)
    process.exit(1)
}

await cp(`${root}public`, outdir, { recursive: true })

for (const [ref, src] of fonts) {
    const dest = resolve(outdir, 'assets', ref)
    await mkdir(dirname(dest), { recursive: true })
    await cp(src, dest)
}
console.log(`assets/files/  ${fonts.size} fonts (${[...new Set([...fonts.keys()].map((f) => basename(f).split('-')[0]))].join(', ')})`)

for (const out of result.outputs) console.log(`${out.path.replace(root, '')}  ${(out.size / 1024).toFixed(1)} kB`)
