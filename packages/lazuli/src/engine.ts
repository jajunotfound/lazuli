import { resolveConfig, type LazuliInput } from './config'
import { createRenderer, type Renderer } from './renderer'
import type { LazuliConfig } from './schema'
import { cssBackground } from './uniforms'

export interface LazuliInstance {
  /** Update any subset of the config (nested v2 sections or v1 flat keys). Invalid values are ignored. */
  set(input: LazuliInput): void
  /** Pick a random seed (new arrangement). Returns the new seed. */
  shuffle(): number
  /** Current resolved config. */
  readonly config: Readonly<LazuliConfig>
  /** Animation time (seconds scaled by speed); what capture renders by default. */
  readonly time: number
  /** The canvas being drawn into. */
  readonly canvas: HTMLCanvasElement
  /** Stop rendering and release listeners, observers and the GL context. */
  destroy(): void
}

const MAX_DPR = 2
const MAX_DT = 0.05
const MIN_DT = 1 / 1000
const REDUCED_SPEED = 0.05

/** Per-frame easing from the prototype, corrected so it feels the same at any refresh rate. */
const ease = (k: number, frames: number) => 1 - Math.pow(1 - k, frames)

export function randomSeed(): number {
  return Math.round(Math.random() * 1e8) / 10
}

export function createLazuli(element: HTMLElement, input: LazuliInput = {}): LazuliInstance {
  let config = resolveConfig(input)

  // ---- canvas -------------------------------------------------------------
  const ownCanvas = !(element instanceof HTMLCanvasElement)
  const canvas = ownCanvas ? document.createElement('canvas') : (element as HTMLCanvasElement)
  const restorePosition = element.style.position
  if (ownCanvas) {
    canvas.setAttribute('aria-hidden', 'true')
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'none',
    })
    if (getComputedStyle(element).position === 'static') element.style.position = 'relative'
    element.prepend(canvas)
  }
  // Painted until the first frame lands, and whenever WebGL is missing.
  const paintFallback = () => (canvas.style.background = cssBackground(config))
  paintFallback()

  // ---- GL -----------------------------------------------------------------
  let renderer: Renderer | null = createRenderer(canvas, config)
  const hasGL = renderer !== null
  if (!hasGL) {
    console.warn('[lazuli] WebGL is unavailable, so the background shows its color only.')
  }

  // ---- sizing -------------------------------------------------------------
  let dpr = 1
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
    if (w === canvas.width && h === canvas.height) return
    canvas.width = w
    canvas.height = h
    dirty = true
  }

  // ---- pointer ------------------------------------------------------------
  const target = { x: 0.5, y: 0.5 }
  const mouse = { x: 0.5, y: 0.5 }
  const vel = { x: 0, y: 0 }
  let active = 0
  let hovering = false // mouse/pen inside the element
  let touching = false // touch pointer down inside the element

  function locate(e: PointerEvent): boolean {
    const r = canvas.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1
    if (inside || touching) {
      target.x = x
      target.y = 1 - y // GL's y axis points up
      // Coming back after the effect fully faded: jump there instead of streaking across.
      if (active < 0.01) {
        mouse.x = target.x
        mouse.y = target.y
      }
    }
    return inside
  }

  const onMove = (e: PointerEvent) => {
    const inside = locate(e)
    if (e.pointerType !== 'touch') hovering = inside
  }
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return
    touching = false // so locate() treats this as a fresh press
    touching = locate(e)
  }
  const onUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') touching = false
  }
  const onOut = (e: PointerEvent) => {
    if (!e.relatedTarget && e.pointerType !== 'touch') hovering = false
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  window.addEventListener('pointerup', onUp, { passive: true })
  window.addEventListener('pointercancel', onUp, { passive: true })
  document.addEventListener('pointerout', onOut, { passive: true })

  // ---- reduced motion -----------------------------------------------------
  const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
  const effectiveSpeed = () =>
    config.motion.reducedMotion === 'respect' && motionQuery?.matches
      ? Math.min(config.motion.speed, REDUCED_SPEED)
      : config.motion.speed

  // ---- loop ---------------------------------------------------------------
  let time = 0
  let last = 0
  let raf = 0
  let dirty = true
  let onScreen = true
  let destroyed = false

  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    // Two frames can share a timestamp; a zero dt would divide velocity by zero.
    const dt = last ? Math.min(Math.max((now - last) / 1000, MIN_DT), MAX_DT) : 1 / 60
    last = now
    const frames = dt * 60

    const speed = effectiveSpeed()
    time += dt * speed

    const px = mouse.x
    const py = mouse.y
    const km = ease(0.12, frames)
    mouse.x += (target.x - mouse.x) * km
    mouse.y += (target.y - mouse.y) * km
    const kv = ease(0.25, frames)
    vel.x += ((mouse.x - px) / frames - vel.x) * kv
    vel.y += ((mouse.y - py) / frames - vel.y) * kv
    // NaN would stick forever through the easing and blank the canvas; never let it in.
    if (!Number.isFinite(vel.x) || !Number.isFinite(vel.y)) vel.x = vel.y = 0
    active += ((hovering || touching ? 1 : 0) - active) * ease(0.06, frames)
    if (active < 1e-4) active = 0

    // Nothing moves: frozen shapes, no pointer. Skip the draw.
    const still = speed === 0 && active === 0 && Math.abs(vel.x) + Math.abs(vel.y) < 1e-6
    if (still && !dirty && !renderer?.pending) return
    draw()
  }

  function draw() {
    if (!renderer) return
    const drawn = renderer.draw({ time, mouse: [mouse.x, mouse.y], vel: [vel.x, vel.y], active, dpr })
    if (drawn) dirty = false
  }

  function updateRunning() {
    const shouldRun = hasGL && !destroyed && onScreen && document.visibilityState !== 'hidden' && renderer !== null
    if (shouldRun && !raf) {
      last = 0
      raf = requestAnimationFrame(frame)
    } else if (!shouldRun && raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
  resizeObserver?.observe(canvas)
  if (!resizeObserver) window.addEventListener('resize', resize)
  resize()

  const intersectionObserver =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          onScreen = entries[entries.length - 1].isIntersecting
          updateRunning()
        })
      : null
  intersectionObserver?.observe(canvas)

  document.addEventListener('visibilitychange', updateRunning)

  // Context loss (GPU reset, too many contexts): wait for restore, then rebuild.
  const onLost = (e: Event) => {
    e.preventDefault()
    renderer = null
    updateRunning()
  }
  const onRestored = () => {
    renderer = createRenderer(canvas, config)
    if (renderer) {
      dirty = true
      updateRunning()
    }
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  updateRunning()

  // ---- public -------------------------------------------------------------
  return {
    set(next) {
      if (destroyed) return
      config = resolveConfig(next, config)
      paintFallback()
      renderer?.setConfig(config)
      dirty = true
    },
    shuffle() {
      const seed = randomSeed()
      this.set({ seed })
      return seed
    },
    get config() {
      return config
    },
    get time() {
      return time
    },
    canvas,
    destroy() {
      if (destroyed) return
      destroyed = true
      updateRunning()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('visibilitychange', updateRunning)
      window.removeEventListener('resize', resize)
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      renderer?.destroy()
      renderer = null
      if (ownCanvas) {
        canvas.remove()
        element.style.position = restorePosition
      }
    },
  }
}
