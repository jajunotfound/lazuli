// Records the opening ("meet lazuli") to a video at any size, for social posts, plus a strip of
// stills to pick a cover from. The canvas behind it is the Lazuli preset, so the shapes grow out
// where Lazuli sinks in. The tour and welcome card are marked seen so nothing pops up after.
//
// Usage: node tools/record/meet.mjs <app url> <out.mp4> [--size 1080x1920] [--dpr 2] [--stills dir] [--music]

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args.splice(i, 2)[1] : undefined
}
const [W, H] = (opt('--size') ?? '1080x1920').split('x').map(Number)
const dpr = Number(opt('--dpr') ?? 2)
const stills = opt('--stills')
// Silent by default (social videos rarely play with sound); --music adds the soundtrack.
const music = args.includes('--music')
if (music) args.splice(args.indexOf('--music'), 1)
const [base = 'http://localhost:5210/', out = 'lazuli-meet.mp4'] = args

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'lazuli-meet-'))
const frames = mkdtempSync(join(tmpdir(), 'lazuli-meet-frames-'))
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars',
  `--window-size=${W},${H}`, 'about:blank',
], { stdio: 'ignore' })
setTimeout(() => { console.log('watchdog: timed out'); chrome.kill(); process.exit(2) }, 120000).unref()

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
let recording = false
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
  if (msg.method === 'Page.screencastFrame') {
    const { data, metadata, sessionId } = msg.params
    if (recording) {
      const file = join(frames, `f${String(shots.length).padStart(6, '0')}.jpg`)
      writeFileSync(file, Buffer.from(data, 'base64'))
      shots.push({ file, t: metadata.timestamp })
    }
    ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId } }))
  }
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value

await send('Runtime.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: dpr, mobile: false })
// Seen already: no tour or welcome card after the opening.
await send('Page.addScriptToEvaluateOnNewDocument', { source: "try { localStorage.setItem('lazuli.tour.seen', '1'); localStorage.setItem('lazuli:welcome-seen', '1') } catch {}" })
await send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1, maxWidth: W * dpr, maxHeight: H * dpr })
recording = true
await send('Page.navigate', { url: `${base}${base.includes('?') ? '&' : '?'}p=lazuli&meet` })

// Until the opening has played and gone, then a beat of the canvas.
const t0 = Date.now()
let seen = false
for (;;) {
  await sleep(100)
  const here = await evaluate("!!document.querySelector('.entrance')")
  if (here) seen = true
  if ((seen && !here) || Date.now() - t0 > 20000) break
}
await sleep(1600)
recording = false
await send('Page.stopScreencast')
ws.close()
chrome.kill()

// Drop the empty tab before the page drew anything (a black first frame, and any long gap after it).
shots.shift()
while (shots.length > 2 && shots[1].t - shots[0].t > 0.5) shots.shift()
const length = shots.at(-1).t - shots[0].t + 1 / 30
console.log(`${shots.length} frames over ${length.toFixed(1)} s`)
const list = shots.map((s, i) => `file '${s.file}'\nduration ${((shots[i + 1]?.t ?? s.t + 1 / 30) - s.t).toFixed(4)}`).join('\n')
writeFileSync(join(frames, 'list.txt'), `${list}\nfile '${shots.at(-1).file}'\n`)

const wav = join(frames, 'music.wav')
if (music) spawnSync(process.execPath, [new URL('./music.mjs', import.meta.url).pathname, wav, String(length)], { stdio: 'inherit' })
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(frames, 'list.txt'),
  ...(music ? ['-i', wav, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '160k', '-shortest'] : []),
  '-vf', `fps=60,scale=${W}:${H}:flags=lanczos:in_range=full:out_range=tv,format=yuv420p`,
  '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '16',
  '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-movflags', '+faststart', out], { stdio: 'inherit' })
if (r.status !== 0) throw new Error('ffmpeg failed')
console.log(`wrote ${out}`)

// Stills every quarter second, full resolution, to pick a cover from.
if (stills) {
  mkdirSync(stills, { recursive: true })
  const t = shots[0].t
  let next = 0
  for (const s of shots) {
    if (s.t - t >= next) {
      spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', s.file, join(stills, `meet-${next.toFixed(2)}.png`)])
      next += 0.25
    }
  }
  console.log(`stills in ${stills}`)
}
rmSync(frames, { recursive: true, force: true })
rmSync(profile, { recursive: true, force: true })
