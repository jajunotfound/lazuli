import { FRAGMENT_SHADER, VERTEX_SHADER } from './shader'
import { layoutFromSeed, packLayout } from './layout'
import { resolveParams, toUniforms, type LazuliOptions, type LazuliParams } from './params'

export interface LazuliInstance {
  /** Update any subset of parameters. Unknown or invalid values are ignored. */
  set(options: LazuliOptions): void
  /** Pick a random seed (new arrangement). Returns the new seed. */
  shuffle(): number
  /** Current resolved parameters. */
  readonly params: Readonly<LazuliParams>
  /** The canvas being drawn into. */
  readonly canvas: HTMLCanvasElement
  /** Stop rendering and release listeners, observers and the GL context. */
  destroy(): void
}

const UNIFORM_NAMES = [
  'u_res', 'u_time', 'u_mouse', 'u_vel', 'u_active', 'u_count', 'u_size',
  'u_soft', 'u_pull', 'u_grain', 'u_deep', 'u_mid', 'u_bg', 'u_blob', 'u_orbit',
] as const
type UniformName = (typeof UNIFORM_NAMES)[number]
type GL = WebGLRenderingContext | WebGL2RenderingContext

const MAX_DPR = 2
const MAX_DT = 0.05
const MIN_DT = 1 / 1000
const REDUCED_SPEED = 0.05

/** Per-frame easing from the prototype, corrected so it feels the same at any refresh rate. */
const ease = (k: number, frames: number) => 1 - Math.pow(1 - k, frames)

export function randomSeed(): number {
  return Math.round(Math.random() * 1e8) / 10
}

export function createLazuli(element: HTMLElement, options: LazuliOptions = {}): LazuliInstance {
  let params = resolveParams(options)
  let respectReducedMotion = options.respectReducedMotion ?? true

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
  canvas.style.backgroundColor = params.ground

  // ---- GL setup -----------------------------------------------------------
  let gl: GL | null = null
  let uniforms = {} as Record<UniformName, WebGLUniformLocation | null>
  let program: WebGLProgram | null = null
  let buffer: WebGLBuffer | null = null
  // Blob layout for the current seed; recomputed only when the seed changes.
  let layout = packLayout(layoutFromSeed(params.seed))
  let layoutSeed = params.seed

  function initGL(): boolean {
    const attrs: WebGLContextAttributes = { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' }
    gl = (canvas.getContext('webgl2', attrs) as GL | null) ?? (canvas.getContext('webgl', attrs) as GL | null)
    if (!gl) return false
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!vs || !fs) return false
    program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[lazuli] Shader program failed to link:', gl.getProgramInfoLog(program))
      return false
    }
    gl.useProgram(program)
    buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    uniforms = {} as typeof uniforms
    for (const name of UNIFORM_NAMES) uniforms[name] = gl.getUniformLocation(program, name)
    uploadParams()
    return true
  }

  function uploadParams() {
    if (!gl) return
    const u = toUniforms(params)
    gl.uniform3fv(uniforms.u_deep, u.deep)
    gl.uniform3fv(uniforms.u_mid, u.mid)
    gl.uniform3fv(uniforms.u_bg, u.bg)
    gl.uniform1f(uniforms.u_count, u.count)
    gl.uniform1f(uniforms.u_size, u.size)
    gl.uniform1f(uniforms.u_soft, u.soft)
    gl.uniform1f(uniforms.u_grain, u.grain)
    gl.uniform1f(uniforms.u_pull, u.pull)
    if (layoutSeed !== params.seed) {
      layout = packLayout(layoutFromSeed(params.seed))
      layoutSeed = params.seed
    }
    gl.uniform4fv(uniforms.u_blob, layout.blob)
    gl.uniform4fv(uniforms.u_orbit, layout.orbit)
  }

  const hasGL = initGL()
  if (!hasGL) {
    console.warn('[lazuli] WebGL is unavailable, so the background shows the ground color only.')
  }

  // ---- sizing -------------------------------------------------------------
  let width = 1
  let height = 1
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
    if (w === width && h === height) return
    width = w
    height = h
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
    respectReducedMotion && motionQuery?.matches ? Math.min(params.speed, REDUCED_SPEED) : params.speed

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
    if (still && !dirty) return
    draw()
  }

  function draw() {
    if (!gl) return
    dirty = false
    gl.viewport(0, 0, width, height)
    gl.uniform2f(uniforms.u_res, width, height)
    gl.uniform1f(uniforms.u_time, time)
    gl.uniform2f(uniforms.u_mouse, mouse.x, mouse.y)
    gl.uniform2f(uniforms.u_vel, vel.x, vel.y)
    gl.uniform1f(uniforms.u_active, active)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function updateRunning() {
    const shouldRun = hasGL && !destroyed && onScreen && document.visibilityState !== 'hidden' && gl !== null
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
    gl = null
    updateRunning()
  }
  const onRestored = () => {
    if (initGL()) {
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
      params = resolveParams(next, params)
      if (next.respectReducedMotion !== undefined) respectReducedMotion = next.respectReducedMotion
      canvas.style.backgroundColor = params.ground
      uploadParams()
      dirty = true
    },
    shuffle() {
      const seed = randomSeed()
      this.set({ seed })
      return seed
    },
    get params() {
      return params
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
      if (gl) {
        gl.deleteBuffer(buffer)
        gl.deleteProgram(program)
        gl.getExtension('WEBGL_lose_context')?.loseContext()
        gl = null
      }
      if (ownCanvas) {
        canvas.remove()
        element.style.position = restorePosition
      }
    },
  }
}

function compile(gl: GL, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[lazuli] Shader failed to compile:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}
