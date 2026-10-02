// Checks that every locale has exactly the keys of the English one
// (plural suffixes _one/_few/_many/_other count as one key).
import { readFileSync, readdirSync } from 'node:fs'

const dir = new URL('../public/locales/', import.meta.url)
const flat = (o, p = '') =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`.replace(/_(zero|one|two|few|many|other)$/, '')]))
const load = (lng) => new Set(flat(JSON.parse(readFileSync(new URL(`${lng}/vpn-control.json`, dir)))))

const en = load('en')
let failed = false
for (const lng of readdirSync(dir).filter((d) => d !== 'en')) {
    const keys = load(lng)
    const missing = [...en].filter((k) => !keys.has(k))
    const extra = [...keys].filter((k) => !en.has(k))
    if (missing.length || extra.length) {
        failed = true
        console.error(`${lng}: missing ${missing.join(', ') || '-'}; extra ${extra.join(', ') || '-'}`)
    }
}
if (failed) process.exit(1)
console.log(`locales match (${en.size} keys)`)
