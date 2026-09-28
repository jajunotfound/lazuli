// Render v1 and the current build with the same options, then diff them.
// Usage: node tools/regress/run.mjs [optsJSON] (server on :5398 at the repo root).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = 'http://localhost:5398'
const opts = process.argv[2] ?? '{"speed":0}'
const dir = mkdtempSync(join(tmpdir(), 'lazuli-regress-'))
const shoot = join(import.meta.dirname, '../visual-fit/shoot.mjs')
const steps = join(dir, 'steps.json')
writeFileSync(steps, JSON.stringify([{ wait: 1500, shot: 'frame' }]))
const run = (engine, name) => {
  const url = `${base}/tools/regress/page.html?engine=${encodeURIComponent(engine)}&opts=${encodeURIComponent(opts)}`
  execFileSync('node', [shoot, url, join(dir, name), '1280', '832', steps], { stdio: 'ignore' })
  return join(dir, `${name}-frame.png`)
}
const a = run('/tools/regress/v1/lazuli.global.js', 'v1')
const b = run('/packages/lazuli/dist/lazuli.global.js', 'v2')
// The diff page loads the PNGs over http, so link them under the served tree.
const served = join(import.meta.dirname, '.out')
execFileSync('mkdir', ['-p', served])
execFileSync('cp', [a, join(served, 'v1.png')])
execFileSync('cp', [b, join(served, 'v2.png')])
writeFileSync(steps, JSON.stringify([{ eval: 'done.then(r => JSON.stringify(r))' }]))
const out = execFileSync('node', [shoot, `${base}/tools/regress/diff.html?a=.out/v1.png&b=.out/v2.png`, join(dir, 'diff'), '200', '200', steps]).toString()
console.log(opts, '→', out.trim())
