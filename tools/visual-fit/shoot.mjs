// Headless-Chrome driver (macOS Chrome path). Usage: node shoot.mjs <url> <out-prefix> <width> <height> [steps.json]
// steps: [{ "eval": "js", "wait": ms, "shot": "name", "mouse": [x,y], "key": "r", "click": [x,y], "touch": true }]
import { spawn } from 'node:child_process'
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, prefix, w = '1280', h = '832', stepsFile] = process.argv.slice(2)
const steps = stepsFile ? JSON.parse(readFileSync(stepsFile, 'utf8')) : [{ wait: 1500, shot: 'default' }]
const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'lazuli-chrome-'))
// GPU=1 renders on the real GPU (for timing); the default SwiftShader is deterministic.
const gl = process.env.GPU ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  ...gl, '--hide-scrollbars',
  `--window-size=${w},${h}`, 'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
setTimeout(() => { console.log('watchdog: timed out'); chrome.kill(); process.exit(2) }, 580000).unref()
let target
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200)
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
    target = list.find((t) => t.type === 'page')
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
const logs = []
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  if (msg.method === 'Runtime.consoleAPICalled') logs.push(`[${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description).join(' '))
  if (msg.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + JSON.stringify(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text))
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })

await send('Runtime.enable')
await send('Page.enable')
const mobile = Number(w) <= 640
await send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: mobile ? 2 : 1, mobile })
if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Emulation.setEmulatedMedia', { features: [
  { name: 'prefers-color-scheme', value: process.env.SCHEME ?? 'light' },
  { name: 'prefers-reduced-motion', value: process.env.MOTION ?? 'no-preference' },
] })
await send('Page.navigate', { url })
await sleep(1500)

for (const s of steps) {
  if (s.eval) {
    const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true })
    if (r.result?.exceptionDetails) logs.push('[eval error] ' + JSON.stringify(r.result.exceptionDetails.exception?.description))
    else if (s.save) writeFileSync(s.save, String(r.result.result.value))
    else if (r.result?.result?.value !== undefined) logs.push('[eval] ' + JSON.stringify(r.result.result.value))
  }
  if (s.mouse) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: s.mouse[0], y: s.mouse[1] })
  if (s.click) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: s.click[0], y: s.click[1] })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: s.click[0], y: s.click[1], button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: s.click[0], y: s.click[1], button: 'left', clickCount: 1 })
  }
  if (s.tap) {
    const pt = [{ x: s.tap[0], y: s.tap[1] }]
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt })
    await sleep(40)
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  if (s.key) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: s.key, text: s.key.length === 1 ? s.key : undefined, code: s.code, windowsVirtualKeyCode: s.vk })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: s.key, code: s.code, windowsVirtualKeyCode: s.vk })
  }
  if (s.wait) await sleep(s.wait)
  if (s.shot) {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(`${prefix}-${s.shot}.png`, Buffer.from(r.result.data, 'base64'))
  }
}
console.log(logs.join('\n') || '(no console output)')
ws.close()
chrome.kill()
process.exit(0)
