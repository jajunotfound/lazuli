// Stack → one fragment shader. Each visible shape layer gets its own copy of its shape chunk,
// with every top-level name (uniforms, constants, functions) suffixed by its position, so two
// shapes of the same type can live in one program. A generated shapeColor() draws them back to
// front. Everything else (palette, cursor, texture, background) is shared, as before.
//
// Milestone 2: shapes stack with plain "over" compositing, and only the front visible texture
// is drawn. Combine modes and warps come in later milestones (docs/plans/layer-builder.md).

import { assembleShader, NEEDS_COMMON, SHAPE_CHUNKS, SHAPE_COMMON } from './shader'
import type { ShapeType } from './schema'
import { stackKey, stackToConfig, type ShapeLayer, type Stack } from './stack'
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

  // Back to front: the last shape in the list is the furthest back.
  let body: string
  if (shapes.length === 0) body = '  return vec4(0.0);'
  else if (shapes.length === 1) body = '  return shapeColor_0(p, t);'
  else {
    const lines = [`  vec4 P = shapeColor_${shapes.length - 1}(p, t);`, '  vec4 L;']
    for (let i = shapes.length - 2; i >= 0; i--) lines.push(`  L = shapeColor_${i}(p, t); P = L + P * (1.0 - L.a);`)
    lines.push('  return P;')
    body = lines.join('\n')
  }
  parts.push(`vec4 shapeColor(vec2 p, float t) {\n${body}\n}`)

  const tex = s.textures.find((x) => x.visible)?.settings.type ?? 'none'
  return assembleShader(parts.join('\n'), tex)
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
