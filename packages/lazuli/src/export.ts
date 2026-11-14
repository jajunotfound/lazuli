// Export a stack as code you own: one fragment shader with every setting written in as a
// constant, and a small standalone page that runs it. Neither needs Lazuli.
//
// The shader keeps six live inputs, set by whoever runs it each frame:
//   u_res     canvas size in pixels
//   u_time    seconds × motion speed (wrapped to the loop length when motion.loop is set)
//   u_dpr     device pixels per CSS pixel (texture and dot sizes are in CSS px)
//   u_mouse   pointer in 0–1, y up;  u_vel  its velocity;  u_active  0–1 while it's over
// Everything else (palette, shapes, warps, background) is a constant.

import { stackFragment, stackUniforms } from './compile'
import { VERTEX_SHADER } from './shader'
import { stackToConfig, type Stack } from './stack'
import { cssBackground, type UniformValue } from './uniforms'

const LIVE = new Set(['u_res', 'u_time', 'u_dpr', 'u_mouse', 'u_vel', 'u_active'])
const SIZE: Record<string, number> = { float: 1, vec2: 2, vec3: 3, vec4: 4 }

/** A float literal GLSL accepts (always has a decimal point or exponent). */
function num(n: number): string {
  const s = String(Number(n.toFixed(6)))
  return /[.e]/.test(s) ? s : `${s}.0`
}

function literal(type: string, v: ArrayLike<number> | number, offset = 0): string {
  const n = SIZE[type]
  if (typeof v === 'number') return n === 1 ? num(v) : `${type}(${num(v)})`
  const parts = Array.from({ length: n }, (_, i) => num(v[offset + i] ?? 0))
  return n === 1 ? parts[0] : `${type}(${parts.join(', ')})`
}

/**
 * The stack's fragment shader with its settings written in. Single values become constants;
 * arrays (GLSL ES 1.00 has no constant arrays) become globals filled in at the top of main().
 */
export function exportShader(stack: Readonly<Stack>): string {
  const values = stackUniforms(stack)
  const init: string[] = []
  let src = stackFragment(stack).replace(/uniform\s+(\w+)\s+(\w+)\s*(?:\[(\d+)\])?\s*;/g, (m, type: string, name: string, count?: string) => {
    if (LIVE.has(name)) return m
    const v = values[name] as UniformValue | undefined
    if (count) {
      for (let i = 0; i < Number(count); i++) init.push(`  ${name}[${i}] = ${literal(type, (v as ArrayLike<number>) ?? [], i * SIZE[type])};`)
      return `${type} ${name}[${count}];`
    }
    return `const ${type} ${name} = ${literal(type, (v as ArrayLike<number> | number) ?? 0)};`
  })
  src = src.replace(/void\s+main\s*\(\s*\)\s*\{/, (m) => `void lazuliInit() {\n${init.join('\n')}\n}\n\n${m}\n  lazuliInit();`)
  const s = stack.motion
  const header = [
    '// Lazuli shader (GLSL ES 1.00). Settings are written in; set these each frame:',
    `//   u_res (px), u_time = seconds × ${num(s.speed)}${s.loop > 0 ? ` wrapped to ${num(s.loop * s.speed)}` : ''},`,
    '//   u_dpr, u_mouse (0–1, y up), u_vel, u_active (0–1 while the pointer is over).',
  ]
  return `${header.join('\n')}\n${src}`
}

/** The same shader for shadertoy.com: mainImage, iResolution, iTime, iMouse. */
export function exportShadertoy(stack: Readonly<Stack>): string {
  const speed = stack.motion.speed
  const loop = stack.motion.loop > 0 ? stack.motion.loop * speed : 0
  let src = exportShader(stack)
    .replace(/^\/\/.*\n/gm, '')
    .replace(/precision\s+highp\s+float\s*;/, '')
    .replace(/uniform\s+\w+\s+(u_res|u_time|u_dpr|u_mouse|u_vel|u_active)\s*;/g, '')
    .replace(/void\s+main\s*\(\s*\)/, 'void mainImage(out vec4 fragColor, in vec2 fragCoord)')
    .replace(/gl_FragCoord/g, 'vec4(fragCoord, 0.0, 1.0)')
    .replace(/gl_FragColor/g, 'fragColor')
  const time = loop > 0 ? `mod(iTime * ${num(speed)}, ${num(loop)})` : `(iTime * ${num(speed)})`
  const defines = [
    '// Lazuli shader for Shadertoy. Drag on the image to push the shapes.',
    '#define u_res iResolution.xy',
    `#define u_time ${time}`,
    '#define u_dpr 1.0',
    '#define u_mouse (iMouse.xy / iResolution.xy)',
    '#define u_vel vec2(0.0)',
    '#define u_active (iMouse.z > 0.0 ? 1.0 : 0.0)',
  ]
  return `${defines.join('\n')}\n${src.trim()}\n`
}

/** The runtime of the standalone page: WebGL, the pointer and the clock. Kept small and readable. */
const BOOT = `
const canvas = document.getElementById('lazuli')
const gl = canvas.getContext('webgl2', OPTS) || canvas.getContext('webgl', OPTS)
if (gl) {
  const shader = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s))
    return s
  }
  const program = gl.createProgram()
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX))
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT))
  gl.bindAttribLocation(program, 0, 'a_pos')
  gl.linkProgram(program)
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const u = (n) => gl.getUniformLocation(program, n)
  const loc = { res: u('u_res'), time: u('u_time'), dpr: u('u_dpr'), mouse: u('u_mouse'), vel: u('u_vel'), active: u('u_active') }

  // Reduced motion: drift very slowly instead of not at all.
  const speed = matchMedia('(prefers-reduced-motion: reduce)').matches ? Math.min(SPEED, 0.05) : SPEED
  const ease = (k, frames) => 1 - (1 - k) ** frames
  const mouse = { x: 0.5, y: 0.5 }, target = { x: 0.5, y: 0.5 }, vel = { x: 0, y: 0 }
  let time = 0, active = 0, over = false, last = 0

  addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    over = x >= 0 && x <= 1 && y >= 0 && y <= 1
    if (over) Object.assign(target, { x, y: 1 - y })
    if (over && active < 0.01) Object.assign(mouse, target)
  })
  document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) over = false })

  const draw = (t) => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr)
    if (canvas.width !== w || canvas.height !== h) Object.assign(canvas, { width: w, height: h })
    gl.viewport(0, 0, w, h)
    gl.uniform2f(loc.res, w, h)
    gl.uniform1f(loc.time, t)
    gl.uniform1f(loc.dpr, dpr)
    gl.uniform2f(loc.mouse, mouse.x, mouse.y)
    gl.uniform2f(loc.vel, vel.x, vel.y)
    gl.uniform1f(loc.active, active)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  // For tools and tests: draw one frame at a given time.
  canvas.lazuliDraw = draw

  const frame = (now) => {
    requestAnimationFrame(frame)
    const dt = last ? Math.min(Math.max((now - last) / 1000, 0.001), 0.05) : 1 / 60
    last = now
    if (document.hidden) return
    const frames = dt * 60
    time += dt * speed
    if (PERIOD > 0) time %= PERIOD
    const px = mouse.x, py = mouse.y
    const km = ease(Math.min(0.12 * 3 ** ((FOLLOW - 50) / 50), 1), frames)
    mouse.x += (target.x - mouse.x) * km
    mouse.y += (target.y - mouse.y) * km
    vel.x += ((mouse.x - px) / frames - vel.x) * ease(0.25, frames)
    vel.y += ((mouse.y - py) / frames - vel.y) * ease(0.25, frames)
    active += ((over ? 1 : 0) - active) * ease(0.06, frames)
    draw(time)
  }
  requestAnimationFrame(frame)
}
`

/** A complete HTML page running the stack's shader full-window. No dependencies. */
export function exportHtml(stack: Readonly<Stack>): string {
  const c = stackToConfig(stack)
  const bg = cssBackground(c)
  const period = c.motion.loop > 0 && c.motion.speed > 0 ? c.motion.loop * c.motion.speed : 0
  const consts = [
    `const OPTS = { alpha: true, premultipliedAlpha: true, antialias: false }`,
    `const SPEED = ${c.motion.speed}`,
    `const PERIOD = ${period}`,
    `const FOLLOW = ${c.cursor.follow}`,
    `const VERTEX = ${JSON.stringify(VERTEX_SHADER.trim())}`,
    `const FRAGMENT = ${JSON.stringify(exportShader(stack))}`,
  ]
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Lazuli background</title>
<!-- Made with Lazuli. One WebGL fragment shader, no library. -->
<style>
  html, body { margin: 0; height: 100%; background: ${bg === 'transparent' ? 'none' : bg}; }
  #lazuli { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
</style>
<canvas id="lazuli"></canvas>
<script>
${consts.join('\n')}
${BOOT.trim()}
</script>
</html>
`
}
