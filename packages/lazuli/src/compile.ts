// Stack → one fragment shader. Each visible shape layer gets its own copy of its shape chunk,
// with every top-level name (uniforms, constants, functions) suffixed by its position, so two
// shapes of the same type can live in one program. A generated shapeColor() draws them back to
// front. Everything else (palette, cursor, texture, background) is shared, as before.
//
// Milestone 2: shapes stack with plain "over" compositing, and only the front visible texture
// is drawn. Combine modes and warps come in later milestones (docs/plans/layer-builder.md).

import { assembleShader, NEEDS_COMMON, SHAPE_CHUNKS, SHAPE_COMMON } from './shader'
import type { ShapeType } from './schema'
import { stackKey, stackToConfig, type CombineMode, type DrawnLayer, type ShapeEntry, type ShapeLayer, type Stack, type WarpLayer } from './stack'
import { globalUniforms, shapeUniforms, type UniformValues } from './uniforms'

/** The chunk with comments and everything inside braces removed: only top-level text is left. */
function topLevel(chunk: string): string {
  const src = chunk.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  let out = ''
  let depth = 0
  for (const ch of src) {
    if (ch === '{') depth++
    if (depth === 0) out += ch
    if (ch === '}') depth--
  }
  return out
}

/**
 * Top-level names a chunk declares: uniforms, constants and functions. Found by brace depth,
 * not line starts, because builds minify the GLSL onto few lines.
 */
function declaredNames(chunk: string): string[] {
  const top = topLevel(chunk)
  const names = new Set<string>()
  for (const m of top.matchAll(/\buniform\s+\w+\s+(\w+)\s*(?:\[\d+\])?\s*;/g)) names.add(m[1])
  for (const m of top.matchAll(/\bconst\s+\w+\s+(\w+)\s*=/g)) names.add(m[1])
  for (const m of top.matchAll(/\b\w+\s+(\w+)\s*\(/g)) names.add(m[1])
  return [...names]
}

const renamedCache = new Map<string, string>()

/** The chunk for `type` with every top-level name suffixed `_<i>`. */
export function renamedChunk(type: ShapeType, i: number): string {
  const key = `${type}#${i}`
  let out = renamedCache.get(key)
  if (out === undefined) {
    out = SHAPE_CHUNKS[type]
    for (const name of declaredNames(SHAPE_CHUNKS[type])) out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), `${name}_${i}`)
    renamedCache.set(key, out)
  }
  return out
}

// Warps bend the space a shape is drawn in. Each takes p (height units, aspect-corrected), its
// packed settings k and the time, and returns the point to sample the shape at. Time goes
// through lf()/drift() so warps loop seamlessly with motion.loop.
const WARPS = /* glsl */ `
vec2 warpCenter() { return vec2(0.5 * u_res.x / u_res.y, 0.5); }

// k.x: turn at the center (radians), k.y: reach.
vec2 swirlWarp(vec2 p, vec4 k, float t) {
  vec2 c = warpCenter();
  vec2 d = p - c;
  float a = k.x * exp(-dot(d, d) / (k.y * k.y)) * (1.0 + 0.15 * sin(t * lf(0.25)));
  float s = sin(a), co = cos(a);
  return c + mat2(co, s, -s, co) * d;
}

// k.x: displacement, k.y: frequency (features per height).
vec2 noiseWarp(vec2 p, vec4 k, float t) {
  vec2 q = p * k.y + drift(vec2(0.35, 0.22), t);
  return p + k.x * (vec2(noise(q), noise(q + vec2(17.3, 9.1))) - 0.5);
}

// k.x: amplitude, k.y: rings per height. Waves travel outward from the center.
vec2 rippleWarp(vec2 p, vec4 k, float t) {
  vec2 d = p - warpCenter();
  float r = length(d);
  float w = sin(r * k.y - t * lf(1.6)) * k.x;
  return p + (r > 1e-4 ? d / r : vec2(0.0)) * w;
}

// The pointer on one shape: k = (pull, reach σ², smear, swirl). Same math as the stack-wide cursor.
vec2 cursorWarp(vec2 p, vec4 k, float t) {
  float aspect = u_res.x / u_res.y;
  vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);
  vec2 d = p - m;
  float fall = exp(-dot(d, d) / k.y) * u_active;
  if (k.w < 0.5) p += d * fall * 0.9 * k.x;
  else {
    float a = k.x * fall * 2.5;
    p = m + mat2(cos(a), sin(a), -sin(a), cos(a)) * d;
  }
  return p - vec2(u_vel.x * aspect, u_vel.y) * fall * k.z;
}
`

const visibleWarps = (shape: ShapeEntry) => shape.warps.filter((w) => w.visible)

/** `vec2 warp_i(p, t)`: the shape's warps, backmost first (the front warp bends last). */
function warpFunction(shape: ShapeEntry, i: number): string | null {
  const warps = visibleWarps(shape)
  if (!warps.length) return null
  const lines = warps.map((w, j) => `  p = ${w.type}Warp(p, u_warp_${i}_${j}, t);`).reverse()
  return `vec2 warp_${i}(vec2 p, float t) {\n${lines.join('\n')}\n  return p;\n}`
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** A warp's packed settings (vec4), from 0–100 Strength and Size. */
function warpValues(w: WarpLayer, base: ReturnType<typeof stackToConfig>): number[] {
  if (w.type === 'cursor') {
    const g = globalUniforms({ ...base, cursor: { mode: w.mode, strength: w.strength, radius: w.radius, smear: w.smear, follow: w.follow } })
    return [g.u_pull as number, g.u_cursorR as number, g.u_smear as number, g.u_cursorMode as number]
  }
  const s = w.strength / 100
  const z = w.size / 100
  if (w.type === 'swirl') return [s * 6, lerp(0.12, 1, z), 0, 0]
  if (w.type === 'noise') return [s * 0.3, lerp(8, 1, z), 0, 0]
  return [s * 0.04, lerp(90, 10, z), 0, 0]
}

const visibleShapes = (s: Readonly<Stack>) => s.shapes.filter((x) => x.visible)

// ---- drawn shapes -------------------------------------------------------------------------

/** Signed distances for drawn shapes (negative inside), in height units around the frame center. */
const DRAWN = /* glsl */ `
float sdEllipse(vec2 p, vec2 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-5);
}
float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
// One polygon edge: the nearest distance so far, and the crossing test for inside / outside.
void polyEdge(vec2 p, vec2 a, vec2 b, inout float d, inout float s) {
  vec2 e = b - a, w = p - a;
  vec2 q = w - e * clamp(dot(w, e) / max(dot(e, e), 1e-9), 0.0, 1.0);
  d = min(d, dot(q, q));
  bvec3 c = bvec3(p.y >= a.y, p.y < b.y, e.x * w.y > e.y * w.x);
  if (all(c) || all(not(c))) s = -s;
}
// Turns a point by -a, so the shape turns by a.
mat2 drawnTurn(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// Joining fields: k is the melt (0 = a hard edge).
float dUnion(float a, float b, float k) {
  if (k <= 1e-4) return min(a, b);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float dCut(float a, float b, float k) { return -dUnion(-a, b, k); }
float dIntersect(float a, float b, float k) { return -dUnion(-a, -b, k); }
// A field through the palette: coverage from the edge (w = softness), tone from depth.
vec4 drawnShade(float d, float w) {
  float cov = 1.0 - smoothstep(-0.25 * w, w, d);
  return shade(cov, clamp(-d / 0.16, 0.0, 1.0));
}
`

/** `float drawn_i(vec2 p)`: the layer's signed distance, with its own uniforms. */
function drawnFunction(l: DrawnLayer, i: number): string {
  const head = `uniform float u_melt_${i}; uniform float u_soft_${i};`
  const center = 'vec2 q = p - vec2(0.5 * u_res.x / u_res.y, 0.5);'
  if (l.geom.kind === 'ellipse') {
    return `${head}\nuniform vec4 u_geo_${i}; uniform float u_ang_${i};\nfloat drawn_${i}(vec2 p) {\n  ${center}\n  return sdEllipse(drawnTurn(u_ang_${i}) * (q - u_geo_${i}.xy), u_geo_${i}.zw);\n}`
  }
  if (l.geom.kind === 'rect') {
    return `${head}\nuniform vec4 u_geo_${i}; uniform vec2 u_rect_${i};\nfloat drawn_${i}(vec2 p) {\n  ${center}\n  return sdRoundRect(drawnTurn(u_rect_${i}.y) * (q - u_geo_${i}.xy), u_geo_${i}.zw, u_rect_${i}.x);\n}`
  }
  // A closed polygon: points packed two per vec4, the first point repeated at the end.
  return `${head}
uniform vec4 u_pts_${i}[17]; uniform float u_npts_${i};
float drawn_${i}(vec2 p) {
  ${center}
  float d = 1e9, s = 1.0;
  for (int m = 0; m < 16; m++) {
    if (float(2 * m) >= u_npts_${i}) break;
    vec4 c = u_pts_${i}[m];
    polyEdge(q, c.xy, c.zw, d, s);
    if (float(2 * m + 1) >= u_npts_${i}) break;
    polyEdge(q, c.zw, u_pts_${i}[m + 1].xy, d, s);
  }
  return s * sqrt(d);
}`
}

function drawnValues(l: DrawnLayer, i: number, out: UniformValues) {
  out[`u_melt_${i}`] = l.melt * 0.3
  out[`u_soft_${i}`] = 0.002 + l.soft * 0.12
  const g = l.geom
  if (g.kind === 'ellipse') {
    out[`u_geo_${i}`] = [g.x, g.y, g.rx, g.ry]
    out[`u_ang_${i}`] = g.angle
  } else if (g.kind === 'rect') {
    out[`u_geo_${i}`] = [g.x, g.y, g.w, g.h]
    out[`u_rect_${i}`] = [g.radius, g.angle]
  } else {
    const flat = new Float32Array(68)
    ;[...g.points, g.points[0]].forEach(([x, y], k) => flat.set([x, y], k * 2))
    out[`u_pts_${i}`] = flat
    out[`u_npts_${i}`] = g.points.length
  }
}

// ---- assembling the shapes -------------------------------------------------------------------

/** The fragment shader for a stack. Depends only on stackKey(s), so programs are cached by that. */
export function stackFragment(s: Readonly<Stack>): string {
  const shapes = visibleShapes(s)
  const parts: string[] = []
  if (shapes.some((x) => x.kind === 'shape' && NEEDS_COMMON[x.type])) parts.push(SHAPE_COMMON)
  shapes.forEach((x, i) => x.kind === 'shape' && parts.push(renamedChunk(x.type, i)))
  if (shapes.some((x) => x.kind === 'drawn')) parts.push(DRAWN)
  shapes.forEach((x, i) => x.kind === 'drawn' && parts.push(drawnFunction(x, i)))
  if (shapes.some((x) => visibleWarps(x).length)) parts.push(WARPS)
  shapes.forEach((x, i) => {
    const f = warpFunction(x, i)
    if (f) {
      parts.push(visibleWarps(x).map((_, j) => `uniform vec4 u_warp_${i}_${j};`).join(' '))
      parts.push(f)
    }
  })

  parts.push(composeShapes(shapes))

  const tex = s.textures.find((x) => x.visible)?.settings.type ?? 'none'
  return assembleShader(parts.join('\n'), tex)
}

type GroupInput = { kind?: ShapeEntry['kind']; type?: string; combine: CombineMode }

/**
 * Visible shapes (front first, numbered by position) grouped for drawing. A run of Blobs where
 * each upper one Merges is one group (fields add up, one shading pass). A run of drawn shapes
 * joined by Merge, Cut or Intersect is one field (smooth union / cut / intersection by each
 * layer's melt), shaded once. Every other layer is a group of one.
 */
export function shapeGroups(shapes: readonly GroupInput[]): number[][] {
  const groups: number[][] = []
  const drawn = (x?: GroupInput) => x?.kind === 'drawn'
  for (let i = 0; i < shapes.length; i++) {
    const prev = groups[groups.length - 1]
    const above = shapes[i - 1]
    const blobs = !drawn(above) && above?.type === 'blobs' && above.combine === 'merge' && !drawn(shapes[i]) && shapes[i].type === 'blobs'
    const field = drawn(above) && above!.combine !== 'add' && drawn(shapes[i])
    if (prev && (blobs || field)) prev.push(i)
    else groups.push([i])
  }
  return groups
}

/**
 * How a group lands on what's below it, by the combine mode of its backmost layer (the one that
 * touches what's below). P is the premultiplied color below, L the group's.
 *   merge      normal stacking (shapes that merge inside a group have already melted)
 *   add        colors add up, so overlaps glow
 *   cut        the shape punches a hole in everything below
 *   intersect  only the parts below that lie inside the shape stay
 */
const COMBINE: Record<CombineMode, string> = {
  merge: 'P = L + P * (1.0 - L.a);',
  add: 'P = min(P + L, vec4(1.0));',
  cut: 'P *= 1.0 - L.a;',
  intersect: 'P *= L.a;',
}
const FIELD_OP: Record<CombineMode, string> = { merge: 'dUnion', add: 'dUnion', cut: 'dCut', intersect: 'dIntersect' }

function composeShapes(shapes: readonly ShapeEntry[]): string {
  const groups = shapeGroups(shapes)
  const out: string[] = []
  const at = (i: number) => (visibleWarps(shapes[i]).length ? `warp_${i}(p, t)` : 'p')
  const color = (g: number[]) =>
    shapes[g[0]].kind === 'drawn' ? `field_${g[0]}(p, t)` : g.length === 1 ? `shapeColor_${g[0]}(${at(g[0])}, t)` : `group_${g[0]}(p, t)`

  for (const g of groups) {
    if (shapes[g[0]].kind === 'drawn') {
      // Back to front: start from the backmost drawn shape, join each one above it.
      const back = g[g.length - 1]
      const lines = [`  float d = drawn_${back}(${at(back)});`]
      for (let m = g.length - 2; m >= 0; m--) {
        const i = g[m]
        lines.push(`  d = ${FIELD_OP[shapes[i].combine]}(d, drawn_${i}(${at(i)}), u_melt_${i});`)
      }
      lines.push(`  return drawnShade(d, u_soft_${g[0]});`)
      out.push(`vec4 field_${g[0]}(vec2 p, float t) {\n${lines.join('\n')}\n}`)
      continue
    }
    if (g.length < 2) continue
    const lines = ['  float sum = 0.0, peak = 0.0, k;', '  vec3 cyc = vec3(0.0), c;']
    for (const i of g) lines.push(`  sum += blobsField_${i}(${at(i)}, t, k, c); peak = max(peak, k); cyc += c;`)
    lines.push(`  return blobsShade_${g[0]}(sum, peak, cyc);`)
    out.push(`vec4 group_${g[0]}(vec2 p, float t) {\n${lines.join('\n')}\n}`)
  }

  let body: string
  if (groups.length === 0) body = '  return vec4(0.0);'
  else if (groups.length === 1) body = `  return ${color(groups[0])};`
  else {
    // Back to front: the last group is the furthest back.
    const lines = [`  vec4 P = ${color(groups[groups.length - 1])};`, '  vec4 L;']
    for (let k = groups.length - 2; k >= 0; k--) lines.push(`  L = ${color(groups[k])}; ${COMBINE[shapes[groups[k][groups[k].length - 1]].combine]}`)
    // Screening textures (halftone, dither) re-shade what the last shade() saw: hand them the
    // composite as one flat color instead of the front shape alone.
    lines.push('  g_cov = P.a; g_flat = P.rgb / max(P.a, 1e-4); g_isFlat = 1.0;', '  return P;')
    body = lines.join('\n')
  }
  out.push(`vec4 shapeColor(vec2 p, float t) {\n${body}\n}`)
  return out.join('\n')
}

/** The config one generated shape layer would be on its own (for its uniforms). */
function shapeConfig(base: ReturnType<typeof stackToConfig>, shape: ShapeLayer) {
  return { ...base, ...shape.settings, shape: { type: shape.type }, seed: shape.seed }
}

/** Uniform values for a stack, matching the names in stackFragment(s). */
export function stackUniforms(s: Readonly<Stack>): UniformValues {
  const base = stackToConfig(s)
  const out: UniformValues = globalUniforms(base)
  // The pointer pushes every shape only when the cursor is the stack-wide one.
  if (!s.cursor?.visible) {
    out.u_pull = 0
    out.u_smear = 0
  }
  visibleShapes(s).forEach((shape, i) => {
    if (shape.kind === 'shape') for (const [name, v] of Object.entries(shapeUniforms(shapeConfig(base, shape)))) out[`${name}_${i}`] = v
    else drawnValues(shape, i, out)
    visibleWarps(shape).forEach((w, j) => (out[`u_warp_${i}_${j}`] = warpValues(w, base)))
  })
  return out
}

export interface CompiledStack {
  /** Program cache key: changes only when the structure does. */
  key: string
  fragment: string
  uniforms: UniformValues
}

export function compileStack(s: Readonly<Stack>): CompiledStack {
  return { key: stackKey(s), fragment: stackFragment(s), uniforms: stackUniforms(s) }
}
