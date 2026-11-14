// Export a stack as code you own: one fragment shader with every setting written in as a
// constant, and a small standalone page that runs it. Neither needs Lazuli.
//
// The shader keeps six live inputs, set by whoever runs it each frame:
//   u_res     canvas size in pixels
//   u_time    seconds × motion speed (wrapped to the loop length when motion.loop is set)
//   u_dpr     device pixels per CSS pixel (texture and dot sizes are in CSS px)
//   u_mouse   pointer in 0–1, y up;  u_vel  its velocity;  u_active  0–1 while it's over
// Everything else (palette, shapes, warps, background) is a constant.

import { animateStack, keyLoop } from './animate'
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
  const values = stackUniforms(animateStack(stack, 0))
  const keyed = keyedCode(stack)
  // Point and segment lists stop at their count: slots past it are never read (and keyframes
  // assign any slot that changes over the loop).
  const used = (name: string, count: number) => {
    const m = /^u_(pts|seg)_(\d+)$/.exec(name)
    if (!m) return count
    const n = Number(values[m[1] === 'pts' ? `u_npts_${m[2]}` : `u_nseg_${m[2]}`] ?? count)
    return Math.min(count, m[1] === 'pts' ? Math.ceil((n + 1) / 2) : n)
  }
  const init: string[] = []
  // One name per declaration first: `uniform float a, b;` becomes two declarations.
  const split = stackFragment(stack).replace(/uniform\s+(\w+)\s+([\w\s,\[\]]+?)\s*;/g, (m, type: string, names: string) =>
    names.includes(',') ? names.split(',').map((n) => `uniform ${type} ${n.trim()};`).join(' ') : m,
  )
  let src = split.replace(/uniform\s+(\w+)\s+(\w+)\s*(?:\[(\d+)\])?\s*;/g, (m, type: string, name: string, count?: string) => {
    if (LIVE.has(name)) return m
    const v = values[name] as UniformValue | undefined
    if (keyed.names.has(name) && !count) {
      init.push(`  ${name} = ${literal(type, (v as ArrayLike<number> | number) ?? 0)};`)
      return `${type} ${name};`
    }
    if (count) {
      for (let i = 0; i < used(name, Number(count)); i++) init.push(`  ${name}[${i}] = ${literal(type, (v as ArrayLike<number>) ?? [], i * SIZE[type])};`)
      return `${type} ${name}[${count}];`
    }
    return `const ${type} ${name} = ${literal(type, (v as ArrayLike<number> | number) ?? 0)};`
  })
  init.push(...keyed.lines)
  src = src.replace(/void\s+main\s*\(\s*\)\s*\{/, (m) => `void lazuliInit() {\n${init.join('\n')}\n}\n\n${m}\n  lazuliInit();`)
  const s = stack.motion
  const header = [
    '// Lazuli shader (GLSL ES 1.00). Settings are written in; set these each frame:',
    `//   u_res (px), u_time = seconds × ${num(s.speed)}${s.loop > 0 ? ` wrapped to ${num(s.loop * s.speed)}` : ''},`,
    '//   u_dpr, u_mouse (0–1, y up), u_vel, u_active (0–1 while the pointer is over).',
  ]
  return `${header.join('\n')}\n${src}`
}

const same = (a: ArrayLike<number> | number | undefined, b: ArrayLike<number> | number | undefined, from = 0, n = 1) => {
  for (let i = 0; i < n; i++) {
    const x = typeof a === 'number' ? a : (a?.[from + i] ?? 0)
    const y = typeof b === 'number' ? b : (b?.[from + i] ?? 0)
    if (Math.abs(x - y) > 1e-6) return false
  }
  return true
}

/**
 * Keyframes as GLSL: for each keyed layer, the values that change become globals eased between
 * keyframes on the loop's phase (the same easing as animateStack). Returns the global names and the
 * lines for lazuliInit().
 */
function keyedCode(stack: Readonly<Stack>): { names: Set<string>; lines: string[] } {
  const names = new Set<string>()
  const lines: string[] = []
  const span = keyLoop(stack) * stack.motion.speed
  const decl = new Map<string, { type: string; count: number }>()
  for (const m of stackFragment(stack).matchAll(/uniform\s+(\w+)\s+([^;]+);/g)) {
    for (const part of m[2].split(',')) {
      const d = /(\w+)\s*(?:\[(\d+)\])?/.exec(part.trim())
      if (d) decl.set(d[1], { type: m[1], count: Number(d[2] ?? 0) })
    }
  }
  for (const layer of stack.shapes) {
    const keys = layer.kind === 'drawn' && layer.visible ? stack.keys?.[layer.id] : undefined
    if (!keys || keys.length < 2) continue
    const times = [...new Set(keys.map((k) => k.t))].sort((a, b) => a - b)
    if (times.length < 2) continue
    const only: Stack = { ...stack, keys: { [layer.id]: keys } }
    const at = (t: number) => stackUniforms(animateStack(only, t))
    const frames = times.map(at)
    // Each moving value: a name, or one element of an array (vec4 u_pts_i[17]).
    const moving: { target: string; type: string; name: string; from: number }[] = []
    for (const name of Object.keys(frames[0])) {
      const d = decl.get(name)
      if (!d || LIVE.has(name)) continue
      const n = SIZE[d.type]
      for (let e = 0; e < Math.max(d.count, 1); e++) {
        const from = e * n
        if (frames.every((f) => same(f[name] as ArrayLike<number> | number, frames[0][name] as ArrayLike<number> | number, from, n))) continue
        moving.push({ target: d.count ? `${name}[${e}]` : name, type: d.type, name, from })
        if (!d.count) names.add(name)
      }
    }
    if (!moving.length) continue
    lines.push(`  { // keyframes: ${layer.name}`)
    lines.push(`    float ph = ${span > 0 ? `fract(u_time / ${num(span)})` : '0.0'};`)
    lines.push('    float k;')
    const n = times.length
    // The key each segment starts from decides its easing (the last key at that time, as keyAt picks).
    const easeAt = (i: number) => [...keys].sort((p, q) => p.t - q.t).filter((k) => k.t === times[i]).pop()?.ease
    const segment = (a: number, b: number, x: string, len: number) => {
      const mid = at(((times[a] + (((times[b] - times[a] + 1) % 1) || 1) / 2) % 1))
      const kind = easeAt(a)
      const k = kind === 'hold' ? '0.0' : kind === 'linear' ? `clamp((${x}) / ${num(len)}, 0.0, 1.0)` : `smoothstep(0.0, 1.0, (${x}) / ${num(len)})`
      const out = [`k = ${k};`]
      for (const m of moving) {
        const va = literal(m.type, frames[a][m.name] as ArrayLike<number> | number, m.from)
        const vb = literal(m.type, frames[b][m.name] as ArrayLike<number> | number, m.from)
        const size = SIZE[m.type]
        const avg = Array.from({ length: size }, (_, i) => {
          const pick = (f: typeof mid) => (typeof f[m.name] === 'number' ? (f[m.name] as number) : ((f[m.name] as ArrayLike<number>)[m.from + i] ?? 0))
          return (pick(frames[a]) + pick(frames[b])) / 2
        })
        // Values that ease (positions, sizes) mix; ones that can't (a path's point count) switch halfway.
        const eases = same(mid[m.name] as ArrayLike<number> | number, size === 1 && typeof mid[m.name] === 'number' ? avg[0] : padTo(avg, m.from), m.from, size)
        out.push(`${m.target} = ${eases ? `mix(${va}, ${vb}, k)` : `(k < 0.5 ? ${va} : ${vb})`};`)
      }
      return out.join(' ')
    }
    const wrap = times[0] + 1 - times[n - 1]
    lines.push(`    if (ph < ${num(times[0])}) { ${segment(n - 1, 0, `ph + ${num(1 - times[n - 1])}`, wrap)} }`)
    for (let i = 1; i < n; i++) lines.push(`    else if (ph < ${num(times[i])}) { ${segment(i - 1, i, `ph - ${num(times[i - 1])}`, times[i] - times[i - 1])} }`)
    lines.push(`    else { ${segment(n - 1, 0, `ph - ${num(times[n - 1])}`, wrap)} }`)
    lines.push('  }')
  }
  return { names, lines }
}

/** An array with `values` placed at `from` (so same() can compare one element of a uniform array). */
const padTo = (values: number[], from: number) => {
  const a = new Array(from + values.length).fill(0)
  values.forEach((v, i) => (a[from + i] = v))
  return a
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
