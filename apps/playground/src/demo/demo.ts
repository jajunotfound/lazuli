// The demo: open Lazuli with ?demo, start a screen recording, press Space. It plays a tutorial
// on the real app, in the style of a Screen Studio recording: the app sits in a rounded window on
// a plain backdrop, a smooth cursor does the clicking and dragging, the camera eases in on what's
// happening, and a short caption names each step. R restarts.
//
// The cursor, captions and the window's frame live outside <body>, so the camera (a transform on
// <body>) never scales them. Popovers can't be positioned inside a scaled page, so the camera is
// always back at 1× before one opens.

import type { Stack, StackOp } from 'lazuli-bg'
import { fromDrag } from '../geom'

export interface DemoApi {
  stack(): Stack
  selected(): string
  onOp(op: StackOp, tag?: string): void
  patch(patch: Record<string, unknown>): void
  select(id: string): void
  setTool(tool: 'move' | 'pen' | 'ellipse' | 'rect'): void
  undo(): void
}

export const isDemo = () => new URLSearchParams(location.search).has('demo')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

// ---- the overlay: frame, cursor, ripple, caption -----------------------------------------------

let overlay: HTMLDivElement
let cursorEl: HTMLDivElement
let captionEl: HTMLDivElement
const pos = { x: innerWidth * 0.6, y: innerHeight * 0.55 }

function buildOverlay() {
  document.documentElement.classList.add('demo')
  const mat = new URLSearchParams(location.search).get('mat')
  if (mat && /^[0-9a-f]{3,8}$/i.test(mat)) document.documentElement.style.setProperty('--mat-color', `#${mat}`)
  overlay = document.createElement('div')
  overlay.className = 'demo-overlay'
  overlay.innerHTML = `
    <div class="demo-window"></div>
    <div class="demo-caption" aria-live="polite"></div>
    <div class="demo-cursor"><svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M5 3.5v17.2l4.6-4.3 3 6.6 3.1-1.4-3-6.5h6.4L5 3.5Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>
    <div class="demo-hint">Start recording, then press Space</div>`
  document.documentElement.append(overlay)
  cursorEl = overlay.querySelector('.demo-cursor')!
  captionEl = overlay.querySelector('.demo-caption')!
  placeCursor()
}

function placeCursor() {
  cursorEl.style.transform = `translate(${pos.x - 5}px, ${pos.y - 3}px)`
}

async function glide(x: number, y: number, ms?: number) {
  const from = { ...pos }
  const dist = Math.hypot(x - from.x, y - from.y)
  const dur = ms ?? Math.min(900, Math.max(320, dist * 0.9))
  const t0 = performance.now()
  for (;;) {
    const k = Math.min(1, (performance.now() - t0) / dur)
    const e = ease(k)
    pos.x = from.x + (x - from.x) * e
    pos.y = from.y + (y - from.y) * e
    placeCursor()
    if (k >= 1) break
    await new Promise((r) => requestAnimationFrame(r))
  }
}

function ripple() {
  // For the soundtrack: a soft tick at each click (tools/record/music.mjs).
  const w = window as unknown as { __demoClicks?: number[] }
  ;(w.__demoClicks ??= []).push(Math.round((performance.now() - t0) / 10) / 100)
  const r = document.createElement('div')
  r.className = 'demo-ripple'
  r.style.left = `${pos.x}px`
  r.style.top = `${pos.y}px`
  overlay.append(r)
  setTimeout(() => r.remove(), 700)
  cursorEl.classList.add('demo-cursor--down')
  setTimeout(() => cursorEl.classList.remove('demo-cursor--down'), 160)
}

/** Chapter marks (seconds from Space) for the video player: every titled step. */
export const chapters: { t: number; title: string; hint?: string }[] = []
let t0 = 0

/** A step's title, and a hint saying where things are. */
async function caption(title: string | null, hint?: string) {
  captionEl.classList.remove('demo-caption--on')
  if (!title) return
  await sleep(180)
  captionEl.innerHTML = ''
  const b = document.createElement('b')
  b.textContent = title
  captionEl.append(b)
  if (hint) {
    const h = document.createElement('span')
    h.textContent = hint
    captionEl.append(h)
  }
  captionEl.classList.add('demo-caption--on')
  const t = Math.round((performance.now() - t0) / 100) / 10
  chapters.push({ t, title, ...(hint ? { hint } : {}) })
  console.debug(`[demo] ${t}s ${title}`)
}

/** Keys being pressed, shown the way screen recordings show them. */
async function keycaps(...keys: string[]) {
  const k = document.createElement('div')
  k.className = 'demo-keys'
  for (const key of keys) {
    const cap = document.createElement('kbd')
    cap.textContent = key
    k.append(cap)
  }
  overlay.append(k)
  requestAnimationFrame(() => k.classList.add('demo-keys--on'))
  setTimeout(() => {
    k.classList.remove('demo-keys--on')
    setTimeout(() => k.remove(), 300)
  }, 1300)
}

/** A key press the app hears (it listens on window). */
const press = (key: string, mods: KeyboardEventInit = {}) => dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods }))

/** Press the pointer on an element at a fraction of its width (for the timeline's scrubbing). */
async function pressAt(el: HTMLElement, fx: number) {
  const r = el.getBoundingClientRect()
  const x = r.left + r.width * fx, y = r.top + r.height / 2
  await glide(x, y)
  await sleep(100)
  ripple()
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1, isPrimary: true }))
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, isPrimary: true }))
  await sleep(300)
}

// ---- the camera ---------------------------------------------------------------------------------

const cam = { s: 1, x: 0, y: 0 }

/** Ease the page so the page point (px, py) (unzoomed coordinates) sits near the middle at scale s. */
async function camera(s: number, px = innerWidth / 2, py = innerHeight / 2, ms = 900) {
  const W = innerWidth, H = innerHeight
  // Toward the middle, but no further than the page's own edges allow.
  let x = W / 2 - s * px, y = H / 2 - s * py
  x = Math.min(0, Math.max(W - s * W, x))
  y = Math.min(0, Math.max(H - s * H, y))
  Object.assign(cam, { s, x, y })
  const body = document.body
  body.style.transformOrigin = '0 0'
  body.style.transition = `transform ${ms}ms cubic-bezier(0.65, 0, 0.35, 1)`
  body.style.transform = `translate(${x}px, ${y}px) scale(${s})`
  await sleep(ms + 40)
  if (s === 1) {
    // At rest the page isn't transformed at all, so popovers position normally.
    body.style.transition = 'none'
    body.style.transform = ''
  }
}

/** Where a page point (unzoomed) is on screen right now. */
const onScreen = (px: number, py: number): [number, number] => [cam.x + cam.s * px, cam.y + cam.s * py]

/** An element's center in unzoomed page coordinates. */
function centerOf(el: Element): [number, number] {
  const r = el.getBoundingClientRect()
  return [(r.left + r.width / 2 - cam.x) / cam.s, (r.top + r.height / 2 - cam.y) / cam.s]
}

function find(selector: string, text?: string): HTMLElement {
  const all = [...document.querySelectorAll<HTMLElement>(selector)]
  const el = text ? all.find((e) => e.textContent?.trim().includes(text)) : all[0]
  if (!el) throw new Error(`[demo] nothing matches ${selector}${text ? ` "${text}"` : ''}`)
  return el
}

/** Glide to an element and click it (a real click, so the app does what it always does). */
async function clickOn(el: HTMLElement, pause = 260) {
  const [px, py] = centerOf(el)
  await glide(...onScreen(px, py))
  await sleep(120)
  ripple()
  el.click()
  await sleep(pause)
}

/** Field point (frame height 1, center origin) → unzoomed page point, through the canvas frame. */
function fieldToPage(x: number, y: number): [number, number] {
  const r = document.querySelector('.frame')!.getBoundingClientRect()
  const left = (r.left - cam.x) / cam.s, top = (r.top - cam.y) / cam.s, w = r.width / cam.s, h = r.height / cam.s
  return [left + w / 2 + x * h, top + h / 2 - y * h]
}

/** Type into a text box the way a person would. */
async function typeInto(input: HTMLInputElement, text: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  for (let i = 1; i <= text.length; i++) {
    set.call(input, text.slice(0, i))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await sleep(45 + Math.random() * 45)
  }
}

/** Move the cursor along while a value changes, like dragging a slider. */
async function drag(dx: number, dy: number, ms: number, onStep: (k: number) => void) {
  const from = { ...pos }
  const t0 = performance.now()
  ripple()
  for (;;) {
    const k = Math.min(1, (performance.now() - t0) / ms)
    const e = ease(k)
    pos.x = from.x + dx * e
    pos.y = from.y + dy * e
    placeCursor()
    onStep(e)
    if (k >= 1) break
    await new Promise((r) => requestAnimationFrame(r))
  }
}

// ---- the script -------------------------------------------------------------------------------

async function drawEllipse(api: DemoApi, a: [number, number], b: [number, number]) {
  const [ax, ay] = fieldToPage(...a)
  await glide(...onScreen(ax, ay))
  await sleep(150)
  api.onOp({ op: 'add', layer: 'drawn', geom: fromDrag('ellipse', a, [a[0] + 0.01, a[1] - 0.01], false) })
  await sleep(60)
  const id = api.selected()
  const [bx, by] = fieldToPage(...b)
  const [sx, sy] = onScreen(ax, ay), [ex, ey] = onScreen(bx, by)
  await drag(ex - sx, ey - sy, 900, (k) => {
    const to: [number, number] = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
    api.onOp({ op: 'reshape', id, geom: fromDrag('ellipse', a, to, false) }, `demo-draw:${id}`)
  })
  // Like a real drag: back to Move once the shape is drawn.
  api.setTool('move')
  await sleep(60)
  return id
}

async function script(api: DemoApi) {
  t0 = performance.now()
  chapters.length = 0
  ;(window as unknown as { __demoClicks?: number[] }).__demoClicks = []
  // For the recorder: when step one began, on the wall clock (so chapters line up with the video).
  ;(window as unknown as { __demoT0?: number }).__demoT0 = performance.timeOrigin + t0

  // 1. Draw
  await caption('Draw a shape', 'Pick Ellipse in the dock, then drag on the canvas')
  await camera(1.7, 70, innerHeight / 2 - 60)
  await clickOn(find('button[aria-label="Ellipse"]'))
  await camera(1.15, innerWidth / 2 - 60, innerHeight / 2)
  await drawEllipse(api, [-0.32, 0.2], [-0.02, -0.12])
  await sleep(400)
  await caption('Add another', 'Let them overlap a little')
  await clickOn(find('button[aria-label="Ellipse"]'), 120)
  const second = await drawEllipse(api, [0.02, 0.12], [0.22, -0.08])
  await sleep(500)

  // 2. Melt
  await caption('Melt them together', 'Drag the diamond between two shapes')
  const handle = document.querySelector<HTMLElement>('.ce-melt')
  if (handle) {
    const [hx, hy] = centerOf(handle)
    await camera(1.6, hx, hy)
    await glide(...onScreen(...centerOf(handle)))
    const layer = api.stack().shapes.find((x) => x.id === second)
    const start = layer?.kind === 'drawn' ? layer.melt : 0.5
    await drag(130, 0, 1400, (k) => api.onOp({ op: 'reshape', id: second, melt: start + (0.95 - start) * k }, `melt:${second}`))
  }
  await sleep(700)
  await camera(1)

  // 3. Light and color
  await caption('Give it light', 'Effects, then Color map, then slide Light')
  await camera(1.6, innerWidth - 190, 230)
  await clickOn(find('.workspace__panel .segmented__item', 'Effects'))
  await clickOn(find('.workspace__panel [role="treeitem"]', 'Color map'))
  await sleep(200)
  const light = find('.workspace__panel .inline-slider', 'Light')
  const [lx, ly] = centerOf(light)
  await glide(...onScreen(lx - 80, ly))
  await drag(150, 0, 1300, (k) => api.onOp({ op: 'light', amount: 0.85 * k }, 'light:amount'))
  await sleep(250)
  const shine = find('.workspace__panel .inline-slider', 'Shine')
  const [shx, shy] = centerOf(shine)
  await glide(...onScreen(shx - 10, shy))
  await drag(60, 0, 800, (k) => api.onOp({ op: 'light', shine: 0.5 + 0.35 * k }, 'light:shine'))
  await sleep(400)
  await caption('Pick the colors', 'The palette sits under the light')
  const palette = document.querySelector<HTMLElement>('.workspace__panel .stops__bar')
  if (palette) await clickOn(palette, 100)
  api.patch({ color: { palette: ['#1b1f2e', '#6f7690', '#eef0f7'] } })
  await sleep(600)
  await camera(1)
  await sleep(1000)

  // 4. Keyframes
  await caption('Animate it with keyframes', 'Select a shape, then Add keyframe')
  await clickOn(find('.workspace__panel .segmented__item', 'Shapes'))
  await clickOn(find('.workspace__panel [role="treeitem"]', 'Ellipse'))
  const track = find('.timeline__track')
  const [, ty] = centerOf(track)
  // The right half of the timeline, where Add keyframe is, with the canvas above it.
  await camera(1.3, innerWidth * 0.66, ty - 90)
  await pressAt(track, 0.01)
  await clickOn(find('.timeline__add'), 500)
  await caption('Move the playhead, then the shape', 'Lazuli keys it where the playhead is')
  await pressAt(track, 0.5)
  await sleep(300)
  await camera(1)
  const moving = api.stack().shapes.find((x) => x.id === second)
  if (moving?.kind === 'drawn' && moving.geom.kind === 'ellipse') {
    const g = moving.geom
    const [px, py] = fieldToPage(g.x, g.y)
    await glide(...onScreen(px, py))
    const [ex, ey] = fieldToPage(g.x + 0.14, g.y + 0.14)
    await drag(ex - px, ey - py, 1100, (k) => api.onOp({ op: 'reshape', id: second, geom: { ...g, x: g.x + 0.14 * k, y: g.y + 0.14 * k } }, `demo-move:${second}`))
  }
  await sleep(500)
  await caption('Press play', 'It moves between the keyframes, on a loop')
  await clickOn(find('.timeline button[aria-label="Play"]'), 300)
  await glide(innerWidth * 0.5, innerHeight * 0.75, 900)
  await sleep(4200)

  // 5. Motion on its own
  await caption('Or let it drift on its own', 'Effects, then Motion, then Move')
  await clickOn(find('.workspace__panel .segmented__item', 'Effects'))
  await clickOn(find('.workspace__panel [role="treeitem"]', 'Motion'))
  await sleep(200)
  const move = document.querySelector<HTMLElement>('.workspace__panel .select-row')
  if (move) await clickOn(move, 100)
  api.onOp({ op: 'movement', move: 'drift' })
  await sleep(2600)

  // 6. Pencil
  await caption('Or sketch it in pencil', 'Add layer, then Lines')
  await clickOn(find('button[aria-label="Add layer"]'), 500)
  await clickOn(find('.menu__item', 'Lines'), 300)
  await sleep(2800)
  api.undo()
  await sleep(500)

  // 7. Code
  await caption("It's all shader code", 'Switch to Code to read or edit it')
  await clickOn(find('.modes button', 'Code'), 600)
  await sleep(3000)
  await clickOn(find('.modes button', 'Canvas'), 600)

  // 8. Start over
  await caption('Start over anytime', 'Select everything, then delete')
  await glide(innerWidth * 0.5, innerHeight * 0.5, 700)
  await keycaps('⌘', 'A')
  press('a', { metaKey: true })
  await sleep(1100)
  await keycaps('Delete')
  press('Backspace')
  await sleep(300)
  console.debug(`[demo] cleared: ${api.stack().shapes.length === 0}`)
  await sleep(900)

  // 9. Ask
  await caption('Or start from a sentence', 'Ask Lazuli, at the bottom of the dock')
  await clickOn(find('button[aria-label="Ask Lazuli"]'), 500)
  const input = find('input[aria-label="Describe a look"]') as HTMLInputElement
  await clickOn(input, 150)
  await typeInto(input, 'A glowing flower on dark')
  await sleep(300)
  await clickOn(find('.ask__form button[type="submit"]'), 200)
  for (let i = 0; i < 60 && !document.querySelector('.ask__result'); i++) await sleep(100)
  await sleep(1600)
  const keep = [...document.querySelectorAll<HTMLElement>('.ask__actions button')].find((b) => b.textContent?.includes('Keep'))
  if (keep) await clickOn(keep, 500)
  await clickOn(find('button[aria-label="Ask Lazuli"]'), 400)
  await sleep(1200)

  // 10. Export
  await caption('Put it on your site', 'Export, then copy')
  await clickOn(find('button[aria-label="Export"]'), 700)
  // Over to the dialog (and its Copy button), so the eye and a 9:16 crop both land on it.
  const copy = document.querySelector<HTMLElement>('.code-dialog .copy-button')
  if (copy) {
    const [cx, cy] = centerOf(copy)
    await glide(...onScreen(cx, cy), 900)
  }
  await sleep(2200)
  const close = document.querySelector<HTMLElement>('.code-dialog__close')
  if (close) await clickOn(close, 400)

  // A clean last shot: nothing selected, so no handles on the canvas.
  api.select(api.stack().background.id)
  await caption(new URLSearchParams(location.search).get('outro') || 'Made with Lazuli')
  await glide(innerWidth * 0.62, innerHeight * 0.62, 900)
  await sleep(3000)
  await caption(null)
  ;(window as unknown as { __demoDone?: unknown }).__demoDone = chapters.slice()
}

let running = false

/** Set the stage and wait for Space. Returns a cleanup. */
// ---- Reels: a 9:16 window that follows the action ---------------------------------------
// The window (as tall as the page) eases after the cursor, moving only when the cursor nears its
// edge. Captions and keys sit in its middle; its path goes to the recorder, which crops to it.

const reels = new URLSearchParams(location.search).has('reels')
const reel = { c: innerWidth / 2, v: 0 }

function followReel() {
  const w = (innerHeight * 9) / 16
  let last = performance.now(), logged = 0
  const step = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    // A dead zone in the middle; past it, a critically damped spring toward the cursor.
    const off = pos.x - reel.c, dead = w * 0.18
    const want = Math.abs(off) > dead ? pos.x - Math.sign(off) * dead : reel.c
    const k = 26, d = 2 * Math.sqrt(k)
    reel.v += (k * (want - reel.c) - d * reel.v) * dt
    reel.c += reel.v * dt
    reel.c = Math.min(innerWidth - w / 2, Math.max(w / 2, reel.c))
    document.documentElement.style.setProperty('--reel-x', `${reel.c}px`)
    if (running && now - logged > 33) {
      logged = now
      const log = ((window as unknown as { __demoReel?: number[][] }).__demoReel ??= [])
      log.push([Math.round((now - t0) / 10) / 100, Math.round(reel.c)])
    }
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

export function startDemo(api: () => DemoApi): () => void {
  buildOverlay()
  if (reels) {
    document.documentElement.classList.add('demo--reels')
    followReel()
  }
  const onKey = async (e: KeyboardEvent) => {
    if (e.key === 'r' || e.key === 'R') location.reload()
    if (e.key !== ' ' || running) return
    e.preventDefault()
    running = true
    overlay.querySelector('.demo-hint')?.remove()
    await sleep(600)
    try {
      await script(api())
    } catch (err) {
      console.error(err)
      await caption('The demo hit a snag. Press R to start over.')
    }
  }
  addEventListener('keydown', onKey)
  return () => {
    removeEventListener('keydown', onKey)
    overlay.remove()
    document.documentElement.classList.remove('demo')
  }
}
