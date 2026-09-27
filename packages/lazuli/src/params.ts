export type CursorMode = 'push' | 'pull'

/** Public, human-friendly parameters. Every field is optional when passed in. */
export interface LazuliParams {
  /** Color of the dense center of the shapes. Hex, e.g. `#1f48a8`. */
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

// Defaults come from the Paper design: colors from the Color panel (frame 05), panel
// values from frames 07–10, and the seed whose layout reproduces frame 01.
export const DEFAULTS: Readonly<LazuliParams> = Object.freeze({
  core: '#1f48a8',
  edge: '#4c78d8',
  ground: '#ffffff',
  count: 3,
  size: 100,
  softness: 50,
  texture: 35,
  speed: 0.35,
  cursor: 'push',
  strength: 60,
  seed: 7226165.5,
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
}

// Fitted so Size 100% and Softness 50 reproduce Paper frame 01.
const SIZE_SCALE = 0.91
// Paper shows no visible grain at the default (Fine = 35), so keep it a whisper there.
const GRAIN_SCALE = 0.07
const SOFT_MIN = 0.02
const SOFT_SPAN = 2.16 // softness 50 → 1.1, the widest band that keeps the ground clean

export function toUniforms(p: LazuliParams): Uniforms {
  return {
    deep: hexToRgb(p.core),
    mid: hexToRgb(p.edge),
    bg: hexToRgb(p.ground),
    count: p.count,
    size: (p.size / 100) * SIZE_SCALE,
    soft: SOFT_MIN + (p.softness / 100) * SOFT_SPAN,
    grain: (p.texture / 100) * GRAIN_SCALE,
    pull: (p.cursor === 'pull' ? -1 : 1) * (p.strength / 100),
  }
}
