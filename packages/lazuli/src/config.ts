import { normalizeHex } from './color'
import {
  cloneConfig,
  DEFAULT_CONFIG,
  getPath,
  isActive,
  PARAMS,
  setPath,
  type CursorMode,
  type LazuliConfig,
  type ParamDef,
  type ShapeType,
} from './schema'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K] }

/** A partial config: any subset of sections and fields. */
export type ConfigPatch = DeepPartial<LazuliConfig>

/**
 * The v1 flat parameters, still accepted everywhere (options, set(), attributes, URLs).
 * When both a v1 key and its v2 path are given, the v2 value wins.
 */
export interface LegacyParams {
  core?: string
  edge?: string
  ground?: string
  count?: number | string
  size?: number | string
  softness?: number | string
  /** v1 grain amount, 0–100. */
  texture?: number | string
  speed?: number | string
  cursor?: CursorMode
  strength?: number | string
  respectReducedMotion?: boolean
}

/** What createLazuli(), set() and the element accept. */
export type LazuliInput = Omit<ConfigPatch, 'shape' | 'texture' | 'cursor'> &
  Omit<LegacyParams, 'texture' | 'cursor'> & {
    /** Shape type, or `{ type }`. */
    shape?: ShapeType | ConfigPatch['shape']
    /** Texture settings, or a v1 grain amount (number). */
    texture?: ConfigPatch['texture'] | number | string
    /** Cursor settings, or a v1 mode ('push' | 'pull'). */
    cursor?: ConfigPatch['cursor'] | CursorMode
  }

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Map v1 flat keys onto v2 paths. Returns [path, raw value] pairs. */
function legacyEntries(input: Record<string, unknown>): [string, unknown][] {
  const out: [string, unknown][] = []
  const edge = input.edge
  const core = input.core
  if (edge != null || core != null) {
    // Either color alone keeps the other from the current palette; filled in by the caller.
    out.push(['color.palette', { edge, core }])
  }
  if (input.ground != null) {
    out.push(['background.type', 'solid'], ['background.color', input.ground])
  }
  if (input.count != null) out.push(['blobs.count', input.count])
  if (input.size != null) out.push(['blobs.size', input.size])
  if (input.softness != null) out.push(['blobs.softness', input.softness])
  const tex = input.texture
  if (typeof tex === 'number' || (typeof tex === 'string' && tex.trim() !== '' && Number.isFinite(Number(tex)))) {
    const amount = Number(tex)
    out.push(['texture.type', amount > 0 ? 'grain' : 'none'], ['texture.intensity', amount])
  }
  if (input.speed != null) out.push(['motion.speed', input.speed])
  if (typeof input.cursor === 'string') out.push(['cursor.mode', input.cursor])
  if (input.strength != null) out.push(['cursor.strength', input.strength])
  if (typeof input.respectReducedMotion === 'boolean') {
    out.push(['motion.reducedMotion', input.respectReducedMotion ? 'respect' : 'ignore'])
  }
  return out
}

/** v2 nested input → [path, raw value] pairs for every known path present. */
function nestedEntries(input: Record<string, unknown>): [string, unknown][] {
  const out: [string, unknown][] = []
  for (const d of PARAMS) {
    const [s, k] = d.path.split('.')
    const section = input[s]
    if (k === undefined) {
      if (section !== undefined) out.push([d.path, section])
    } else if (isObject(section) && section[k] !== undefined) {
      out.push([d.path, section[k]])
    }
  }
  if (typeof input.shape === 'string') out.push(['shape.type', input.shape])
  return out
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Coerce a loosely typed value (attributes and URLs are strings) to a valid one, or `fallback`. */
export function coerce(d: ParamDef, raw: unknown, fallback: unknown): unknown {
  switch (d.kind) {
    case 'number': {
      const n = typeof raw === 'string' ? parseFloat(raw) : raw
      if (typeof n !== 'number' || !Number.isFinite(n)) return fallback
      const c = clamp(n, d.min, d.max)
      return d.int ? Math.round(c) : c
    }
    case 'enum':
      return d.options.includes(String(raw)) ? String(raw) : fallback
    case 'bool':
      if (typeof raw === 'boolean') return raw
      if (raw === '' || raw === 'true' || raw === '1') return true
      if (raw === 'false' || raw === '0') return false
      return fallback
    case 'color':
      return normalizeHex(raw, fallback as string)
    case 'colors': {
      const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[\s,]+|-(?=#?[0-9a-f])/i) : null
      if (!list) return fallback
      const colors = list.map((c) => normalizeHex(c, '')).filter(Boolean).slice(0, d.maxItems)
      return colors.length >= d.minItems ? colors : fallback
    }
  }
}

/**
 * Merge a partial, loosely typed input onto `base`, validating and clamping every value.
 * Accepts v2 nested sections and the v1 flat keys; v2 wins when both are present.
 */
export function resolveConfig(input: LazuliInput = {}, base: Readonly<LazuliConfig> = DEFAULT_CONFIG): LazuliConfig {
  const out = cloneConfig(base)
  const raw = input as Record<string, unknown>
  const entries = [...legacyEntries(raw), ...nestedEntries(raw)]
  for (const [path, value] of entries) {
    const d = PARAMS.find((p) => p.path === path)!
    let v = value
    if (path === 'color.palette' && isObject(value) && ('edge' in value || 'core' in value)) {
      // v1 edge/core: replace the outermost and densest stops.
      const pal = [...out.color.palette]
      if (value.edge != null) pal[0] = normalizeHex(value.edge, pal[0])
      if (value.core != null) pal[pal.length - 1] = normalizeHex(value.core, pal[pal.length - 1])
      v = pal
    }
    setPath(out, d.path, coerce(d, v, getPath(out, d.path)))
  }
  return out
}

export type FlatKey = 'attr' | 'url'

/**
 * Flat string records (element attributes, URL query) → input. Unknown keys are ignored;
 * v1 names (`core`, `count`, `texture="35"`, …) pass through to the legacy mapping.
 */
export function fromFlat(record: Record<string, string | null | undefined>, key: FlatKey): LazuliInput {
  const out: Record<string, unknown> = {}
  for (const d of PARAMS) {
    const v = record[d[key]]
    if (v == null) continue
    const [s, k] = d.path.split('.')
    if (k === undefined) out[s] = v
    else ((out[s] ??= {}) as Record<string, unknown>)[k] = key === 'url' && (d.kind === 'color' || d.kind === 'colors') ? hashColors(v) : v
  }
  for (const k of LEGACY_KEYS) {
    const v = record[k]
    if (v == null) continue
    if (k === 'texture' || k === 'cursor') {
      if (out[k] === undefined) out[k] = v
    } else {
      out[k] = key === 'url' && (k === 'core' || k === 'edge' || k === 'ground') ? hashColors(v) : v
    }
  }
  return out as LazuliInput
}

/** URL colors drop the "#"; put it back (single color or a "-"-joined list). */
const hashColors = (v: string) => v.split('-').map((c) => `#${c.replace(/^#/, '')}`).join(',')

export const LEGACY_KEYS = ['core', 'edge', 'ground', 'count', 'size', 'softness', 'texture', 'speed', 'cursor', 'strength'] as const

export interface FlatOptions {
  /** Only values that differ from `base` (default: the defaults). */
  onlyChanged?: boolean
  /** Only parameters that currently have an effect (default true). */
  onlyActive?: boolean
  base?: Readonly<LazuliConfig>
}

const round = (v: number) => (Number.isInteger(v) ? v : Math.round(v * 100) / 100)

function equal(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i])
  if (typeof a === 'number' && typeof b === 'number') return round(a) === round(b)
  return a === b
}

/** Serialize one value for an attribute or the URL. */
export function formatValue(d: ParamDef, v: unknown, key: FlatKey): string {
  if (d.kind === 'colors') {
    const list = v as string[]
    return key === 'url' ? list.map((c) => c.slice(1)).join('-') : list.join(',')
  }
  if (d.kind === 'color') return key === 'url' ? (v as string).slice(1) : (v as string)
  if (typeof v === 'number') return String(d.path === 'seed' ? v : round(v))
  return String(v)
}

/** Config → flat record for attributes or the URL, in schema order. */
export function toFlat(c: Readonly<LazuliConfig>, key: FlatKey, opts: FlatOptions = {}): [string, string][] {
  const { onlyChanged = true, onlyActive = true, base = DEFAULT_CONFIG } = opts
  const out: [string, string][] = []
  for (const d of PARAMS) {
    if (onlyActive && !isActive(d, c as LazuliConfig)) continue
    const v = getPath(c as LazuliConfig, d.path)
    if (onlyChanged && equal(v, getPath(base as LazuliConfig, d.path))) continue
    out.push([d[key], formatValue(d, v, key)])
  }
  return out
}

/** Nested patch holding only the active values that differ from `base`. */
export function diffConfig(c: Readonly<LazuliConfig>, base: Readonly<LazuliConfig> = DEFAULT_CONFIG): ConfigPatch {
  const out: Record<string, unknown> = {}
  for (const d of PARAMS) {
    if (!isActive(d, c as LazuliConfig)) continue
    const v = getPath(c as LazuliConfig, d.path)
    if (equal(v, getPath(base as LazuliConfig, d.path))) continue
    const [s, k] = d.path.split('.')
    const val = typeof v === 'number' && d.path !== 'seed' ? round(v) : v
    if (k === undefined) out[s] = val
    else ((out[s] ??= {}) as Record<string, unknown>)[k] = val
  }
  return out as ConfigPatch
}
