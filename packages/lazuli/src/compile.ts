// Stack → one fragment shader. Each visible shape layer gets its own copy of its shape chunk,
// with every top-level name (uniforms, constants, functions) suffixed by its position, so two
// shapes of the same type can live in one program. A generated shapeColor() draws them back to
// front. Everything else (palette, cursor, texture, background) is shared, as before.
//
// Milestone 2: shapes stack with plain "over" compositing, and only the front visible texture
// is drawn. Combine modes and warps come in later milestones (docs/plans/layer-builder.md).

import { assembleShader, NEEDS_COMMON, SHAPE_CHUNKS, SHAPE_COMMON } from './shader'
import type { ShapeType } from './schema'
import { stackKey, stackToConfig, type CombineMode, type ShapeLayer, type Stack } from './stack'
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

const visibleShapes = (s: Readonly<Stack>) => s.shapes.filter((x) => x.visible)

/** The fragment shader for a stack. Depends only on stackKey(s), so programs are cached by that. */
export function stackFragment(s: Readonly<Stack>): string {
  const shapes = visibleShapes(s)
  const parts: string[] = []
  if (shapes.some((x) => NEEDS_COMMON[x.type])) parts.push(SHAPE_COMMON)
  shapes.forEach((x, i) => parts.push(renamedChunk(x.type, i)))

  parts.push(composeShapes(shapes))

  const tex = s.textures.find((x) => x.visible)?.settings.type ?? 'none'
  return assembleShader(parts.join('\n'), tex)
}

/**
 * Visible shapes (front first, numbered by position) grouped for drawing: a Blobs layer set to
 * Merge melts into the Blobs layer right below it, so a run of them is one group whose fields
 * add up before one shading pass (the front layer's softness and merge). Every other layer is
 * a group of one.
 */
export function shapeGroups(shapes: readonly Pick<ShapeLayer, 'type' | 'combine'>[]): number[][] {
  const groups: number[][] = []
  for (let i = 0; i < shapes.length; i++) {
    const prev = groups[groups.length - 1]
    const above = shapes[i - 1]
    if (prev && above?.type === 'blobs' && above.combine === 'merge' && shapes[i].type === 'blobs') prev.push(i)
    else groups.push([i])
  }
  return groups
}

/**
 * How a group lands on what's below it, by the combine mode of its front layer. P is the
 * premultiplied color below, L the group's.
 *   merge      normal stacking (Blobs that merge have already melted into one group)
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

function composeShapes(shapes: readonly ShapeLayer[]): string {
  const groups = shapeGroups(shapes)
  const out: string[] = []
  const color = (g: number[]) => (g.length === 1 ? `shapeColor_${g[0]}(p, t)` : `group_${g[0]}(p, t)`)

  for (const g of groups) {
    if (g.length < 2) continue
    const lines = ['  float sum = 0.0, peak = 0.0, k;', '  vec3 cyc = vec3(0.0), c;']
    for (const i of g) lines.push(`  sum += blobsField_${i}(p, t, k, c); peak = max(peak, k); cyc += c;`)
    lines.push(`  return blobsShade_${g[0]}(sum, peak, cyc);`)
    out.push(`vec4 group_${g[0]}(vec2 p, float t) {\n${lines.join('\n')}\n}`)
  }

  let body: string
  if (groups.length === 0) body = '  return vec4(0.0);'
  else if (groups.length === 1) body = `  return ${color(groups[0])};`
  else {
    // Back to front: the last group is the furthest back.
    const lines = [`  vec4 P = ${color(groups[groups.length - 1])};`, '  vec4 L;']
    for (let k = groups.length - 2; k >= 0; k--) lines.push(`  L = ${color(groups[k])}; ${COMBINE[shapes[groups[k][0]].combine]}`)
    // Screening textures (halftone, dither) re-shade what the last shade() saw: hand them the
    // composite as one flat color instead of the front shape alone.
    lines.push('  g_cov = P.a; g_flat = P.rgb / max(P.a, 1e-4); g_isFlat = 1.0;', '  return P;')
    body = lines.join('\n')
  }
  out.push(`vec4 shapeColor(vec2 p, float t) {\n${body}\n}`)
  return out.join('\n')
}

/** The config one shape layer would be on its own (for its uniforms). */
function shapeConfig(base: ReturnType<typeof stackToConfig>, shape: ShapeLayer) {
  return { ...base, ...shape.settings, shape: { type: shape.type }, seed: shape.seed }
}

/** Uniform values for a stack, matching the names in stackFragment(s). */
export function stackUniforms(s: Readonly<Stack>): UniformValues {
  const base = stackToConfig(s)
  const out: UniformValues = globalUniforms(base)
  visibleShapes(s).forEach((shape, i) => {
    for (const [name, v] of Object.entries(shapeUniforms(shapeConfig(base, shape)))) out[`${name}_${i}`] = v
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
