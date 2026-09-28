// The GL side of Lazuli, shared by the live engine and offline capture (PNG, video):
// one context, a cache of compiled shader variants, and uniform upload by name.

import type { LazuliConfig } from './schema'
import { fragmentShader, variantKey, VERTEX_SHADER } from './shader'
import { toUniforms, type UniformValue, type UniformValues } from './uniforms'

type GL = WebGLRenderingContext | WebGL2RenderingContext

/** Per-frame state the engine owns: time and the smoothed pointer. */
export interface FrameState {
  time: number
  mouse: [number, number]
  vel: [number, number]
  active: number
  /** Device pixels per CSS pixel for the output (sizes given in CSS px scale by it). */
  dpr: number
}

export interface Renderer {
  readonly gl: GL
  /** Apply a config: recompute uniforms, and start compiling its shader variant if needed. */
  setConfig(config: LazuliConfig): void
  /** Draw one frame at the canvas's current buffer size. Returns false if no program is ready yet. */
  draw(frame: FrameState): boolean
  /** True while the wanted variant is still compiling (the previous one keeps drawing). */
  readonly pending: boolean
  destroy(): void
}

interface Program {
  program: WebGLProgram
  /** Kept until linking finishes, for its error log. */
  fs: WebGLShader | null
  linked: boolean
  failed: boolean
  uniforms: { name: string; loc: WebGLUniformLocation; type: number }[]
}

// KHR_parallel_shader_compile
const COMPLETION_STATUS_KHR = 0x91b1

export interface RendererOptions {
  /** Compile synchronously even if parallel compile is available (capture wants the frame now). */
  sync?: boolean
  preserveDrawingBuffer?: boolean
}

export function createRenderer(canvas: HTMLCanvasElement | OffscreenCanvas, config: LazuliConfig, opts: RendererOptions = {}): Renderer | null {
  const attrs: WebGLContextAttributes = {
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
  }
  const ctx = (canvas.getContext('webgl2', attrs) as GL | null) ?? (canvas.getContext('webgl', attrs) as GL | null)
  if (!ctx) return null
  const gl: GL = ctx
  const parallel = opts.sync ? null : gl.getExtension('KHR_parallel_shader_compile')

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)

  const cache = new Map<string, Program>()
  let current: Program | null = null
  let wanted: Program | null = null
  let values: UniformValues = {}

  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)

  function build(key: string, source: string): Program {
    const fs = compile(gl, gl.FRAGMENT_SHADER, source)
    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.bindAttribLocation(program, 0, 'a_pos')
    // With KHR_parallel_shader_compile nothing here blocks; status is read in finish().
    gl.linkProgram(program)
    const p: Program = { program, fs, linked: false, failed: false, uniforms: [] }
    cache.set(key, p)
    return p
  }

  /** Finish linking once the driver is done; false while still compiling or on failure. */
  function finish(p: Program): boolean {
    if (p.linked) return true
    if (p.failed) return false
    if (parallel && !gl.getProgramParameter(p.program, COMPLETION_STATUS_KHR)) return false
    const fs = p.fs
    p.fs = null
    if (!gl.getProgramParameter(p.program, gl.LINK_STATUS)) {
      if (!gl.isContextLost()) {
        console.error('[lazuli] Shader failed to build:', (fs && gl.getShaderInfoLog(fs)) || gl.getProgramInfoLog(p.program))
      }
      if (fs) gl.deleteShader(fs)
      p.failed = true
      return false
    }
    if (fs) gl.deleteShader(fs)
    const n = gl.getProgramParameter(p.program, gl.ACTIVE_UNIFORMS) as number
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p.program, i)!
      const name = info.name.replace(/\[0\]$/, '')
      p.uniforms.push({ name, loc: gl.getUniformLocation(p.program, info.name)!, type: info.type })
    }
    p.linked = true
    return true
  }

  function upload(p: Program, v: UniformValues) {
    gl.useProgram(p.program)
    for (const u of p.uniforms) {
      const x = v[u.name]
      if (x !== undefined) set(gl, u.loc, u.type, x)
    }
  }

  function use(p: Program) {
    current = p
    upload(p, values)
  }

  const renderer: Renderer = {
    gl,
    setConfig(c) {
      values = toUniforms(c)
      const key = variantKey(c.shape.type, c.texture.type)
      const p = cache.get(key) ?? build(key, fragmentShader(c.shape.type, c.texture.type))
      wanted = p
      if (finish(p)) use(p)
      else if (current) upload(current, values)
    },
    draw(frame) {
      if (wanted && wanted !== current && finish(wanted)) use(wanted)
      if (!current) return false
      const w = gl.drawingBufferWidth
      const h = gl.drawingBufferHeight
      gl.viewport(0, 0, w, h)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      upload(current, {
        u_res: [w, h],
        u_time: frame.time,
        u_mouse: frame.mouse,
        u_vel: frame.vel,
        u_active: frame.active,
        u_dpr: frame.dpr,
      })
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      return true
    },
    get pending() {
      return !!wanted && wanted !== current && !wanted.failed
    },
    destroy() {
      for (const p of cache.values()) gl.deleteProgram(p.program)
      cache.clear()
      gl.deleteShader(vs)
      gl.deleteBuffer(buffer)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
  renderer.setConfig(config)
  // The first variant failing means this GPU can't run Lazuli at all.
  return wanted && (wanted as Program).failed ? null : renderer
}

function set(gl: GL, loc: WebGLUniformLocation, type: number, v: UniformValue) {
  const a = typeof v === 'number' ? [v] : v
  switch (type) {
    case gl.FLOAT: return gl.uniform1fv(loc, a)
    case gl.FLOAT_VEC2: return gl.uniform2fv(loc, a)
    case gl.FLOAT_VEC3: return gl.uniform3fv(loc, a)
    case gl.FLOAT_VEC4: return gl.uniform4fv(loc, a)
    case gl.INT:
    case gl.BOOL: return gl.uniform1iv(loc, Array.from(a, Math.round))
  }
}

function compile(gl: GL, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}
