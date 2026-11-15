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
const web = opt('--web'), chaptersOut = opt('--chapters'), outro = opt('--outro'), poster = opt('--poster')
// --reels: a 9:16 video for Instagram, cropped along the window the page follows the action with.
// Reels are silent; the tutorial gets the music (no click sounds: they distract).
const reels = args.includes('--reels')
if (reels) args.splice(args.indexOf('--reels'), 1)
const music = !reels && !args.includes('--no-music')
if (args.includes('--no-music')) args.splice(args.indexOf('--no-music'), 1)
// 1.5× keeps the crop sharp on a phone while the capture still runs near 30 fps (2× drops to ~12).
const DPR = reels ? Number(opt('--dpr') ?? 1.5) : 1
const [base = 'http://localhost:5210/', out = 'lazuli-tutorial.mp4'] = args
const W = 1920, H = 1080

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'lazuli-rec-'))
const frames = mkdtempSync(join(tmpdir(), 'lazuli-frames-'))
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars',
  // The live capture follows Chrome's own pixel density (an emulated one only reaches screenshots).
  `--force-device-scale-factor=${DPR}`,
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
// Exactly W × H in CSS pixels; 0 keeps the density from the flag above.
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 0, mobile: false })
const url = `${base}${base.includes('?') ? '&' : '?'}demo${reels ? '&reels' : ''}${outro ? `&outro=${encodeURIComponent(outro)}` : ''}`
await send('Page.navigate', { url })
await sleep(3500) // fonts, first frames, the engine warming up

await send('Page.startScreencast', { format: 'jpeg', quality: reels ? 78 : 95, everyNthFrame: 1, maxWidth: W * DPR, maxHeight: H * DPR })
await sleep(800)
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', text: ' ', windowsVirtualKeyCode: 32 })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 })
const started = Date.now()

let chapters = null, t0 = 0, clicks = [], path = []
while (!chapters && Date.now() - started < 300000) {
  await sleep(500)
  const r = await send('Runtime.evaluate', { expression: 'JSON.stringify([window.__demoDone ?? null, window.__demoT0 ?? 0, window.__demoClicks ?? [], window.__demoReel ?? []])', returnByValue: true })
  ;[chapters, t0, clicks, path] = JSON.parse(r.result?.result?.value ?? '[null, 0, [], []]')
}
await sleep(500)
await send('Page.stopScreencast')
ws.close()
chrome.kill()
if (!chapters) throw new Error('the tutorial never finished')
// Start the video as step one starts (the frames before it show the "press Space" hint).
if (t0) {
  const start = t0 / 1000 - 0.3
  const first = shots.findIndex((x) => x.t >= start)
  if (first > 0) shots.splice(0, first - 1)
}
console.log(`${shots.length} frames over ${((shots.at(-1).t - shots[0].t)).toFixed(1)} s`)

// Each frame lasts until the next one was painted; ffmpeg resamples to a steady 60 fps.
const list = shots.map((s, i) => `file '${s.file}'\nduration ${((shots[i + 1]?.t ?? s.t + 1 / 30) - s.t).toFixed(4)}`).join('\n')
writeFileSync(join(frames, 'list.txt'), `${list}\nfile '${shots.at(-1).file}'\n`)
// Times on the page count from step one; the video starts a little earlier.
const offset = t0 ? t0 / 1000 - shots[0].t : 0
const length = shots.at(-1).t - shots[0].t + 1 / 30

// The soundtrack: made to the video's length (tools/record/music.mjs).
const wav = join(frames, 'music.wav')
if (music) {
  const m = spawnSync(process.execPath, [new URL('./music.mjs', import.meta.url).pathname, wav, String(length)], { stdio: 'inherit' })
  if (m.status !== 0) throw new Error('music failed')
}
// Reels: the window's path as crop commands (frame pixels), one every ~33 ms.
const cropW = Math.round((H * DPR * 9) / 16)
if (reels) {
  const x = (c) => Math.max(0, Math.min(W * DPR - cropW, Math.round(c * DPR - cropW / 2)))
  const cmds = [`0.000 crop x ${x(path[0]?.[1] ?? W / 2)};`, ...path.map(([t, c]) => `${Math.max(0, t + offset).toFixed(3)} crop x ${x(c)};`)]
  writeFileSync(join(frames, 'crop.txt'), cmds.join('\n') + '\n')
}
const encode = (file, crf, width) => {
  const vf = reels
    ? `fps=30,scale=${W * DPR}:${H * DPR},sendcmd=f=${join(frames, 'crop.txt')},crop=w=${cropW}:h=${H * DPR}:x=0:y=0,scale=1080:1920:flags=lanczos:in_range=full:out_range=tv,format=yuv420p`
    : `fps=60,scale=${width}:-2:flags=lanczos:in_range=full:out_range=tv,format=yuv420p`
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(frames, 'list.txt'),
    ...(music ? ['-i', wav, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '160k', '-shortest'] : []),
    // Frames are full-range JPEGs; video players expect standard (limited-range) BT.709 4:2:0,
    // which every browser and QuickTime plays. Main profile for the widest support.
    '-vf', vf,
    '-c:v', 'libx264', '-profile:v', 'main', '-preset', 'slow', '-crf', String(crf),
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', file], { stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${file}`)
  console.log(`wrote ${file}`)
}
encode(out, 16, W)
if (web) encode(web, 26, 1600)
const timed = chapters.map((c) => ({ t: Math.max(0, Math.round((c.t + offset) * 10) / 10), title: c.title }))
console.log(timed.map((c) => `${c.t.toFixed(1).padStart(5)}  ${c.title}`).join('\n'))
if (chaptersOut) writeFileSync(chaptersOut, JSON.stringify({ chapters: timed }, null, 2) + '\n')
// A cover image for the player: the lit chrome shapes, a little after "Pick the colors".
const cover_ = poster ?? (web ? web.replace(/\.mp4$/, '-poster.jpg') : null)
const cover = timed.find((c) => c.title === 'Pick the colors')
if (cover_ && cover) {
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(cover.t + 2.4), '-i', web ?? out, '-frames:v', '1', '-q:v', '3', cover_], { stdio: 'inherit' })
  console.log(`wrote ${cover_}`)
}
rmSync(frames, { recursive: true, force: true })
rmSync(profile, { recursive: true, force: true })
