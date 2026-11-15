// Stack → one fragment shader. Each visible shape layer gets its own copy of its shape chunk,
// with every top-level name (uniforms, constants, functions) suffixed by its position, so two
// shapes of the same type can live in one program. A generated shapeColor() draws them back to
// front. Everything else (palette, cursor, texture, background) is shared, as before.
//
// Milestone 2: shapes stack with plain "over" compositing, and only the front visible texture
// is drawn. Combine modes and warps come in later milestones (docs/plans/layer-builder.md).

import { MAX_TEXT_SEGMENTS, textLayout, textStroke } from './font'
import { assembleShader, NEEDS_COMMON, SHAPE_CHUNKS, SHAPE_COMMON } from './shader'
import type { ShapeType } from './schema'
import { DEFAULT_SUN, stackKey, stackToConfig, type CombineMode, type MoveMode, type DrawnLayer, type ShapeEntry, type ShapeLayer, type Stack, type WarpLayer } from './stack'
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

// k.x: copies around the center. Space folds like a kaleidoscope.
vec2 kaleidoWarp(vec2 p, vec4 k, float t) {
  vec2 c = warpCenter();
  vec2 d = p - c;
  float s = 6.2831853 / k.x;
  float a = abs(mod(atan(d.y, d.x), s) - 0.5 * s);
  return c + length(d) * vec2(cos(a), sin(a));
}

// k.x: tile size (height units). The shape repeats across the frame.
vec2 repeatWarp(vec2 p, vec4 k, float t) {
  vec2 c = warpCenter();
  return c + mod(p - c + 0.5 * k.x, k.x) - 0.5 * k.x;
}

// k.x: turn per unit of distance from the center.
vec2 twistWarp(vec2 p, vec4 k, float t) {
  vec2 c = warpCenter();
  vec2 d = p - c;
  float a = k.x * length(d);
  float s = sin(a), co = cos(a);
  return c + mat2(co, s, -s, co) * d;
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
  if (w.type === 'kaleido') return [Math.round(lerp(2, 16, s)), 0, 0, 0]
  if (w.type === 'repeat') return [lerp(0.12, 0.8, z), 0, 0, 0]
  if (w.type === 'twist') return [(s - 0.5) * 24, 0, 0, 0]
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
vec2 cellHash(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float dIntersect(float a, float b, float k) { return -dUnion(-a, -b, k); }
// A field through the palette: coverage from the edge (w = softness), tone from depth.
vec4 drawnShade(float d, float w) {
  float cov = 1.0 - smoothstep(-0.25 * w, w, d);
  return shade(cov, clamp(-d / 0.16, 0.0, 1.0));
}

// Light: the field as a rounded surface (a quarter-circle bevel, deeper with more light), its
// normal from the field's slope g; the surface mirrors the palette, dark below and light above,
// plus a highlight. Flat inside the bevel reads as the palette's middle.
uniform float u_light; uniform float u_shine;
uniform float u_contours; uniform float u_glow;
uniform vec2 u_lightPos; uniform float u_lightFollow; uniform float u_shadow;
uniform float u_outline; uniform float u_sketch;
// The sun in field units (frame height 1, center origin): where it was put, or at the pointer.
vec2 sunAt() { return u_lightFollow > 0.5 ? (u_mouse - 0.5) * vec2(u_res.x / u_res.y, 1.0) : u_lightPos; }
// Around the shape: a glow fading out from the edge, and contour rings at even distances.
vec4 drawnFx(vec4 c, float d, vec2 q) {
  // An outline on the edge, in a deep tone of the palette; sketch makes it wobble and doubles it.
  if (u_outline > 0.0) {
    float wob = u_sketch * 0.008 * (noise(q * 26.0 + 3.0) - 0.5);
    float half_ = 0.5 * mix(0.8, 3.2, u_outline) * u_dpr;
    float e = 1.0 - smoothstep(half_ - 0.75, half_ + 0.75, abs(d + wob) * u_res.y);
    if (u_sketch > 0.05) e = max(e, 0.6 * (1.0 - smoothstep(half_ * 0.7 - 0.75, half_ * 0.7 + 0.75, abs(d - 1.6 * wob - 0.0025 * u_sketch) * u_res.y)));
    vec3 ink = shade(1.0, 0.0).rgb * 0.45;
    c = c * (1.0 - e) + vec4(ink * e, e);
  }
  if (d <= 0.0) return c;
  vec3 tint = shade(1.0, 0.5).rgb;
  if (u_glow > 0.0) {
    float g = u_glow * exp(-d * 9.0) * 0.8;
    c += vec4(tint * g, g) * (1.0 - c.a);
  }
  if (u_contours > 0.5) {
    float band = 0.5 + 0.5 * cos(d * u_contours * 6.2831853);
    float line = smoothstep(0.82, 0.97, band) * exp(-d * 3.0);
    c += vec4(tint * line, line) * (1.0 - c.a);
  }
  return c;
}
// Screening textures (dither, halftone) redraw what shading saw. Light, outline and glow shade
// every pixel along the way, so hand them the finished shape instead: its coverage and color.
vec4 drawnSeen(vec4 c) {
  g_cov = c.a; g_flat = c.rgb / max(c.a, 1e-4); g_isFlat = 2.0; // 2: a lit color, dithered as it is
  return c;
}
vec4 drawnLit(float d, vec2 g, float w, vec2 q) {
  float R = mix(0.03, 0.22, u_light);
  float x = clamp(-d / R, 0.0, 1.0);
  float h = sqrt(max(1.0 - (1.0 - x) * (1.0 - x), 1e-4));
  float slope = x < 1.0 ? (1.0 - x) / h : 0.0;
  vec3 n = normalize(vec3(g * slope, 1.0));
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  // Matte (lit from the sun) at shine 0, mirroring the palette like chrome at shine 1.
  vec3 l = normalize(vec3(sunAt() - q, 0.6));
  float env = clamp(0.5 + 0.5 * r.y + 0.15 * r.x, 0.0, 1.0);
  // A little wrap-around, so the side away from the sun still reads as round, not black.
  env = mix(clamp(dot(n, l) * 0.8 + 0.22, 0.0, 1.0), env, u_shine);
  vec3 col = shade(1.0, env).rgb;
  col += pow(max(dot(r, l), 0.0), mix(6.0, 90.0, u_shine)) * u_shine * 1.4;
  float cov = 1.0 - smoothstep(-0.25 * w, w, d);
  return vec4(clamp(col, 0.0, 1.0) * cov, cov);
}
`

/** `float drawn_i(vec2 p)`: the layer's signed distance, with its own uniforms. */
function drawnFunction(l: DrawnLayer, i: number): string {
  const head = `uniform float u_melt_${i}; uniform float u_soft_${i};`
  const center = 'vec2 q = p - vec2(0.5 * u_res.x / u_res.y, 0.5);'
  if (l.geom.kind === 'ellipse') {
    return `${head}\nuniform vec4 u_geo_${i}; uniform float u_ang_${i};\nfloat drawn_${i}(vec2 p, float t) {\n  ${center}\n  return sdEllipse(drawnTurn(u_ang_${i}) * (q - u_geo_${i}.xy), u_geo_${i}.zw);\n}`
  }
  if (l.geom.kind === 'rect') {
    return `${head}\nuniform vec4 u_geo_${i}; uniform vec2 u_rect_${i};\nfloat drawn_${i}(vec2 p, float t) {\n  ${center}\n  return sdRoundRect(drawnTurn(u_rect_${i}.y) * (q - u_geo_${i}.xy), u_geo_${i}.zw, u_rect_${i}.x);\n}`
  }
  if (l.geom.kind === 'code') {
    // Your own GLSL, as written (an expression without return is returned). The marker line lets
    // tools map a compile error back to a line of the code.
    const body = /\breturn\b/.test(l.geom.glsl) ? l.geom.glsl : `return ${l.geom.glsl.replace(/;\s*$/, '')};`
    return `${head}\nfloat drawn_${i}(vec2 p, float t) {\n  ${center}\n// code: ${l.geom.name}\n${body}\n}`
  }
  if (l.geom.kind === 'gradient') {
    // A ramp: s runs 0 at the first point to 1 at the second (along the line, or out from the
    // first point when radial). Fullest at the first point, the edge at the second.
    return `${head}\nuniform vec4 u_geo_${i}; uniform float u_rad_${i};\nfloat drawn_${i}(vec2 p, float t) {\n  ${center}\n  vec2 a = u_geo_${i}.xy, e = u_geo_${i}.zw - a;\n  float L = max(length(e), 1e-4);\n  float s = u_rad_${i} > 0.5 ? length(q - a) / L : dot(q - a, e) / (L * L);\n  return (s - 1.0) * 0.16;\n}`
  }
  if (l.geom.kind === 'text') {
    // Words: the distance to the font's segments (cap-height units), thickened by the weight.
    return `${head}
uniform vec4 u_geo_${i}; uniform float u_ang_${i}; uniform vec4 u_seg_${i}[${MAX_TEXT_SEGMENTS}]; uniform float u_nseg_${i};
float drawn_${i}(vec2 p, float t) {
  ${center}
  vec2 r = drawnTurn(u_ang_${i}) * (q - u_geo_${i}.xy) / u_geo_${i}.z;
  float d = 1e9;
  for (int m = 0; m < ${MAX_TEXT_SEGMENTS}; m++) {
    if (float(m) >= u_nseg_${i}) break;
    vec4 s = u_seg_${i}[m];
    vec2 e = s.zw - s.xy, w = r - s.xy;
    d = min(d, length(w - e * clamp(dot(w, e) / max(dot(e, e), 1e-9), 0.0, 1.0)));
  }
  return (d - u_geo_${i}.w) * u_geo_${i}.z;
}`
  }
  if (l.geom.kind === 'noise') {
    // Clouds: inside where the noise rises above the threshold; it drifts with time.
    return `${head}\nuniform vec2 u_geo_${i};\nfloat drawn_${i}(vec2 p, float t) {\n  ${center}\n  float v = fbm(q * u_geo_${i}.x + drift(vec2(0.12, 0.08), t), 4.0);\n  return (mix(0.72, 0.28, u_geo_${i}.y) - v) * 0.25;\n}`
  }
  if (l.geom.kind === 'cells') {
    // Tiles: distance to the nearest of many moving points, shrunk by the gap.
    return `${head}\nuniform vec2 u_geo_${i};\nfloat drawn_${i}(vec2 p, float t) {\n  ${center}\n  vec2 c = q * u_geo_${i}.x;\n  vec2 cell = floor(c), f = fract(c);\n  float f1 = 8.0;\n  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {\n    vec2 g = vec2(float(x), float(y));\n    vec2 o = 0.5 + 0.35 * sin(t * lf(0.1) + 6.2831853 * cellHash(cell + g));\n    f1 = min(f1, length(g + o - f));\n  }\n  return (f1 - (1.0 - u_geo_${i}.y) * 0.5) / u_geo_${i}.x;\n}`
  }
  // A closed polygon: points packed two per vec4, the first point repeated at the end.
  return `${head}
uniform vec4 u_pts_${i}[17]; uniform float u_npts_${i};
float drawn_${i}(vec2 p, float t) {
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
  } else if (g.kind === 'gradient') {
    out[`u_geo_${i}`] = [g.x1, g.y1, g.x2, g.y2]
    out[`u_rad_${i}`] = g.radial ? 1 : 0
  } else if (g.kind === 'text') {
    const { segments } = textLayout(g.text)
    const flat = new Float32Array(MAX_TEXT_SEGMENTS * 4)
    segments.forEach((sg, k) => flat.set(sg, k * 4))
    out[`u_geo_${i}`] = [g.x, g.y, g.size, textStroke(g.weight)]
    out[`u_ang_${i}`] = g.angle
    out[`u_seg_${i}`] = flat
    out[`u_nseg_${i}`] = segments.length
  } else if (g.kind === 'noise') {
    out[`u_geo_${i}`] = [g.scale, g.level]
  } else if (g.kind === 'cells') {
    out[`u_geo_${i}`] = [g.scale, g.gap]
  } else if (g.kind === 'path') {
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

  parts.push(composeShapes(shapes, s.move))

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

function composeShapes(shapes: readonly ShapeEntry[], move?: MoveMode): string {
  const groups = shapeGroups(shapes)
  const out: string[] = []
  const at = (i: number) => (visibleWarps(shapes[i]).length ? `warp_${i}(p, t)` : 'p')
  const color = (g: number[]) =>
    shapes[g[0]].kind === 'drawn' ? `field_${g[0]}(p, t)` : g.length === 1 ? `shapeColor_${g[0]}(${at(g[0])}, t)` : `group_${g[0]}(p, t)`

  for (const g of groups) {
    if (shapes[g[0]].kind === 'drawn') {
      // Back to front: start from the backmost drawn shape, join each one above it.
      const back = g[g.length - 1]
      // Moving on their own: each shape drifts on its own path, or breathes in and out.
      const call = (i: number) => {
        const k = (n: number) => (i * n + 0.5).toFixed(1)
        if (move === 'drift') return `drawn_${i}(${at(i)} - 0.035 * vec2(sin(t * 0.5 + ${k(2.1)}), cos(t * 0.4 + ${k(1.7)})), t)`
        if (move === 'breathe') return `(drawn_${i}(${at(i)}, t) - 0.012 * sin(t * 1.4 + ${k(2.0)}))`
        return `drawn_${i}(${at(i)}, t)`
      }
      const lines = [`  float d = ${call(back)};`]
      for (let m = g.length - 2; m >= 0; m--) {
        const i = g[m]
        lines.push(`  d = ${FIELD_OP[shapes[i].combine]}(d, ${call(i)}, u_melt_${i});`)
      }
      lines.push('  return d;')
      out.push(`float fieldD_${g[0]}(vec2 p, float t) {\n${lines.join('\n')}\n}`)
      // Flat color, or lit: the slope comes from the field one pixel either side.
      out.push(`vec4 field_${g[0]}(vec2 p, float t) {
  float d = fieldD_${g[0]}(p, t);
  vec2 q = p - vec2(0.5 * u_res.x / u_res.y, 0.5);
  if (u_light <= 0.0) {
    vec4 flat_ = drawnShade(d, u_soft_${g[0]});
    // Plain shapes already left the right coverage and tone for screening textures.
    if (u_outline <= 0.0 && u_glow <= 0.0 && u_contours <= 0.5) return flat_;
    return drawnSeen(drawnFx(flat_, d, q));
  }
  float e = 1.0 / u_res.y;
  vec2 g = vec2(fieldD_${g[0]}(p + vec2(e, 0.0), t) - fieldD_${g[0]}(p - vec2(e, 0.0), t), fieldD_${g[0]}(p + vec2(0.0, e), t) - fieldD_${g[0]}(p - vec2(0.0, e), t)) / (2.0 * e);
  vec4 c = drawnLit(d, g, u_soft_${g[0]}, q);
  // The shadow on the ground: step toward the sun, and if the shapes are there, it's shaded.
  if (u_shadow > 0.0 && d > 0.0) {
    float sd = fieldD_${g[0]}(p + normalize(sunAt() - q + 1e-4) * 0.06, t);
    float a = u_shadow * 0.45 * (1.0 - smoothstep(-0.03, 0.03, sd));
    c += vec4(shade(1.0, 0.0).rgb * a, a) * (1.0 - c.a);
  }
  return drawnSeen(drawnFx(c, d, q));
}`)
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
  out.u_light = s.color.light?.amount ?? 0
  out.u_shine = s.color.light?.shine ?? 0.5
  out.u_contours = s.color.look?.contours ?? 0
  out.u_glow = s.color.look?.glow ?? 0
  out.u_outline = s.color.look?.outline ?? 0
  out.u_sketch = s.color.look?.sketch ?? 0
  const light = s.color.light
  out.u_lightPos = [light?.x ?? DEFAULT_SUN[0], light?.y ?? DEFAULT_SUN[1]]
  out.u_lightFollow = light?.follow ? 1 : 0
  out.u_shadow = light?.shadow ?? 0
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
