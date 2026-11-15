// Records the tutorial (?demo) to an MP4: Chrome plays it on the real GPU, every painted frame is
// captured with its timestamp, and ffmpeg builds a smooth 60 fps video timed exactly as it played.
//
// Usage: node tools/record/record.mjs <app url> <out.mp4> [--web <web.mp4>] [--chapters <out.json>] [--outro "text"]
// Needs the app running (pnpm dev) and ffmpeg on the PATH.

import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args.splice(i, 2)[1] : undefined
}
const web = opt('--web'), chaptersOut = opt('--chapters'), outro = opt('--outro')
const [base = 'http://localhost:5210/', out = 'lazuli-tutorial.mp4'] = args
const W = 1920, H = 1080

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'lazuli-rec-'))
const frames = mkdtempSync(join(tmpdir(), 'lazuli-frames-'))
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars',
  `--window-size=${W},${H}`, 'about:blank',
], { stdio: 'ignore' })
setTimeout(() => { console.log('watchdog: timed out'); chrome.kill(); process.exit(2) }, 400000).unref()

let target
for (let i = 0; i < 60 && !target; i++) {
  await sleep(200)
  try {
    target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page')
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
const shots = []
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
  if (msg.method === 'Page.screencastFrame') {
    const { data, metadata, sessionId } = msg.params
    const file = join(frames, `f${String(shots.length).padStart(6, '0')}.jpg`)
    writeFileSync(file, Buffer.from(data, 'base64'))
    shots.push({ file, t: metadata.timestamp })
    ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId } }))
  }
  if (msg.method === 'Runtime.exceptionThrown') console.log('[page error]', msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })

await send('Runtime.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
const url = `${base}${base.includes('?') ? '&' : '?'}demo${outro ? `&outro=${encodeURIComponent(outro)}` : ''}`
await send('Page.navigate', { url })
await sleep(3500) // fonts, first frames, the engine warming up

await send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1, maxWidth: W, maxHeight: H })
await sleep(800)
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', text: ' ', windowsVirtualKeyCode: 32 })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 })
const started = Date.now()

let chapters = null, t0 = 0
while (!chapters && Date.now() - started < 300000) {
  await sleep(500)
  const r = await send('Runtime.evaluate', { expression: 'JSON.stringify([window.__demoDone ?? null, window.__demoT0 ?? 0])', returnByValue: true })
  ;[chapters, t0] = JSON.parse(r.result?.result?.value ?? '[null, 0]')
}
await sleep(500)
await send('Page.stopScreencast')
ws.close()
chrome.kill()
if (!chapters) throw new Error('the tutorial never finished')
console.log(`${shots.length} frames over ${((shots.at(-1).t - shots[0].t)).toFixed(1)} s`)

// Each frame lasts until the next one was painted; ffmpeg resamples to a steady 60 fps.
const list = shots.map((s, i) => `file '${s.file}'\nduration ${((shots[i + 1]?.t ?? s.t + 1 / 30) - s.t).toFixed(4)}`).join('\n')
writeFileSync(join(frames, 'list.txt'), `${list}\nfile '${shots.at(-1).file}'\n`)
const encode = (file, crf, width) => {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(frames, 'list.txt'),
    '-vf', `fps=60,scale=${width}:-2:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-movflags', '+faststart', file], { stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${file}`)
  console.log(`wrote ${file}`)
}
encode(out, 16, W)
if (web) encode(web, 26, 1600)
// Chapter times count from step one; the video starts a little earlier.
const offset = t0 ? t0 / 1000 - shots[0].t : 0
const timed = chapters.map((c) => ({ t: Math.max(0, Math.round((c.t + offset) * 10) / 10), title: c.title }))
console.log(timed.map((c) => `${c.t.toFixed(1).padStart(5)}  ${c.title}`).join('\n'))
if (chaptersOut) writeFileSync(chaptersOut, JSON.stringify({ chapters: timed }, null, 2) + '\n')
rmSync(frames, { recursive: true, force: true })
rmSync(profile, { recursive: true, force: true })
