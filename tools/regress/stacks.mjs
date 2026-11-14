// Render the multi-shape stacks in stacks.html with the current build and report each check.
// Usage: node tools/regress/stacks.mjs (server on :5398 at the repo root). Exit 1 on any failure.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'lazuli-stacks-'))
const steps = join(dir, 'steps.json')
writeFileSync(steps, JSON.stringify([{ eval: 'done.then(r => JSON.stringify(r))' }]))
const shoot = join(import.meta.dirname, '../visual-fit/shoot.mjs')
const raw = execFileSync('node', [shoot, 'http://localhost:5398/tools/regress/stacks.html', join(dir, 's'), '200', '200', steps], { maxBuffer: 1 << 24 }).toString().trim()
const line = raw.split('\n').find((l) => l.startsWith('[eval] '))
if (!line) throw new Error(`no result from the stacks page:\n${raw}`)
const rows = JSON.parse(JSON.parse(line.slice(7)))
for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.case.padEnd(28)} ${r.note}`)
const errors = raw.split('\n').filter((l) => l.startsWith('[error]'))
if (errors.length) console.log(errors.join('\n'))
const failed = rows.filter((r) => !r.ok).length
console.log(`${rows.length} checks, ${failed} failed`)
process.exit(failed ? 1 : 0)
