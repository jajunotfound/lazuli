// Compare the current build against the frozen reference (tools/regress/ref) for every case in
// compare.html. Usage: node tools/regress/compare.mjs (server on :5398 at the repo root).
// Exit code 1 when any case differs by more than 2/255 in any channel.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'lazuli-compare-'))
const steps = join(dir, 'steps.json')
writeFileSync(steps, JSON.stringify([{ eval: 'done.then(r => JSON.stringify(r))' }]))
const shoot = join(import.meta.dirname, '../visual-fit/shoot.mjs')
const raw = execFileSync('node', [shoot, 'http://localhost:5398/tools/regress/compare.html', join(dir, 'c'), '200', '200', steps], { maxBuffer: 1 << 24 }).toString().trim()
const line = raw.split('\n').find((l) => l.startsWith('[eval] '))
if (!line) throw new Error(`no result from the compare page:\n${raw}`)
const rows = JSON.parse(JSON.parse(line.slice(7)))
let worst = 0
for (const r of rows) {
  worst = Math.max(worst, r.max)
  console.log(`${r.max <= 2 ? 'ok  ' : 'FAIL'} ${r.case.padEnd(24)} max ${r.max}/255, ${r.over} values > 2`)
}
console.log(`${rows.length} renders, worst ${worst}/255`)
process.exit(worst <= 2 ? 0 : 1)
