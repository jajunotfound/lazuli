export type CursorMode = 'push' | 'pull'

/** Public, human-friendly parameters. Every field is optional when passed in. */
export interface LazuliParams {
  /** Color of the dense center of the shapes. Hex, e.g. `#1f45a6`. */
  core: string
  /** Color of the soft outer edge of the shapes. */
  edge: string
  /** Background color behind the shapes. */
  ground: string
  /** Number of shapes, 1–6. */
  count: number
  /** Shape size in percent, 40–160. */
  size: number
  /** Edge softness, 0–100. */
  softness: number
  /** Film grain amount, 0–100. */
  texture: number
  /** Drift speed, 0–1.5. 0 freezes the shapes (pointer still works). */
  speed: number
  /** Whether the pointer pushes shapes away or pulls them in. */
  cursor: CursorMode
  /** Pointer influence, 0–100. 0 turns it off. */
  strength: number
  /** Layout seed. Any number; each one gives a different arrangement. */
  seed: number
}

export interface LazuliOptions extends Partial<LazuliParams> {
  /**
   * When true (default), users who prefer reduced motion get speed 0.05
   * regardless of `speed`. Set false to always use `speed`.
   */
  respectReducedMotion?: boolean
}

export const DEFAULTS: Readonly<LazuliParams> = Object.freeze({
  core: '#1f45a6',
  edge: '#4a74d4',
  ground: '#cdd6ea',
  count: 3,
  size: 100,
  softness: 45,
  texture: 23,
  speed: 0.35,
  cursor: 'push',
  strength: 60,
  seed: 4.2,
})

export const RANGES = {
  count: [1, 6],
  size: [40, 160],
  softness: [0, 100],
  texture: [0, 100],
  speed: [0, 1.5],
  strength: [0, 100],
} as const

export const PARAM_KEYS = Object.keys(DEFAULTS) as (keyof LazuliParams)[]

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Returns `#rrggbb` (lowercase) or `fallback` if the input isn't a hex color. */
export function normalizeHex(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const m = v.trim().match(HEX_RE)
  if (!m) return fallback
  let h = m[1].toLowerCase()
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  return '#' + h
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(normalizeHex(hex, '#000000').slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/**
 * Merge a partial, loosely typed input (numbers may be strings, as with HTML
 * attributes) onto `base`, clamping everything to its public range.
 */
export function resolveParams(
  input: Partial<Record<keyof LazuliParams, unknown>>,
  base: LazuliParams = DEFAULTS,
): LazuliParams {
  const out: LazuliParams = { ...base }
  if (input.core != null) out.core = normalizeHex(input.core, base.core)
  if (input.edge != null) out.edge = normalizeHex(input.edge, base.edge)
  if (input.ground != null) out.ground = normalizeHex(input.ground, base.ground)
  if (input.count != null) out.count = Math.round(clamp(num(input.count, base.count), ...RANGES.count))
  if (input.size != null) out.size = clamp(num(input.size, base.size), ...RANGES.size)
  if (input.softness != null) out.softness = clamp(num(input.softness, base.softness), ...RANGES.softness)
  if (input.texture != null) out.texture = clamp(num(input.texture, base.texture), ...RANGES.texture)
  if (input.speed != null) out.speed = clamp(num(input.speed, base.speed), ...RANGES.speed)
  if (input.strength != null) out.strength = clamp(num(input.strength, base.strength), ...RANGES.strength)
  if (input.seed != null) out.seed = num(input.seed, base.seed)
  if (input.cursor != null) out.cursor = input.cursor === 'pull' ? 'pull' : 'push'
  return out
}

export interface Uniforms {
  deep: [number, number, number]
  mid: [number, number, number]
  bg: [number, number, number]
  count: number
  size: number
  soft: number
  grain: number
  pull: number
  seed: number
}

export function toUniforms(p: LazuliParams): Uniforms {
  return {
    deep: hexToRgb(p.core),
    mid: hexToRgb(p.edge),
    bg: hexToRgb(p.ground),
    count: p.count,
    size: p.size / 100,
    soft: 0.05 + (p.softness / 100) * 0.95,
    grain: (p.texture / 100) * 0.15,
    pull: (p.cursor === 'pull' ? -1 : 1) * (p.strength / 100),
    seed: p.seed,
  }
}
