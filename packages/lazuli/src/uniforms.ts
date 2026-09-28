// Config → shader uniform values. Each program uploads only the uniforms it declares,
// so a value here for a shape or texture that isn't active is simply skipped.

import { hexToRgb } from './color'
import { layoutFromSeed, packLayout } from './layout'
import type { LazuliConfig } from './schema'

export type UniformValue = number | number[] | Float32Array
export type UniformValues = Record<string, UniformValue>

// Fitted so Size 100% and Softness 50 reproduce Paper frame 01.
const SIZE_SCALE = 0.91
const SOFT_MIN = 0.02
const SOFT_SPAN = 2.16 // softness 50 → 1.1, the widest band that keeps the ground clean
// Paper shows no visible grain at the default (Fine = 35), so keep it a whisper there.
const GRAIN_SCALE = 0.07
const CURSOR_RADIUS = 0.045 // falloff σ² in height units
const CURSOR_SMEAR = 1.6
const MAX_STOPS = 5

const flat = (colors: string[], n: number) => {
  const out = new Float32Array(n * 3)
  colors.slice(0, n).forEach((c, i) => out.set(hexToRgb(c), i * 3))
  return out
}

/** Layouts are cached per seed; they only change on shuffle. */
let layoutCache: { seed: number; packed: ReturnType<typeof packLayout> } | null = null
function blobLayout(seed: number) {
  if (layoutCache?.seed !== seed) layoutCache = { seed, packed: packLayout(layoutFromSeed(seed)) }
  return layoutCache.packed
}

export function toUniforms(c: LazuliConfig): UniformValues {
  const bg = c.background
  const bgColors = bg.type === 'gradient' ? bg.gradient : [bg.color]
  const layout = blobLayout(c.seed)
  const tex = c.texture
  return {
    u_pull: (c.cursor.mode === 'pull' ? -1 : 1) * (c.cursor.strength / 100),
    u_cursorR: CURSOR_RADIUS,
    u_smear: CURSOR_SMEAR,

    u_pal: flat(c.color.palette, MAX_STOPS),
    u_palN: c.color.palette.length,
    u_opacity: c.color.opacity / 100,
    u_fade: c.color.fade / 100,

    u_bgType: bg.type === 'solid' ? 0 : bg.type === 'gradient' ? 1 : 2,
    u_bg: flat(bgColors, 3),
    u_bgN: bgColors.length,
    u_bgKind: bg.kind === 'radial' ? 1 : 0,
    u_bgAngle: (bg.angle * Math.PI) / 180,
    // GL's y axis points up; the public center is measured from the top.
    u_bgCenter: [bg.centerX / 100, 1 - bg.centerY / 100],

    u_texIntensity: tex.type === 'none' ? 0 : (tex.intensity / 100) * GRAIN_SCALE,
    u_texScale: Math.round(tex.scale),
    // 50 → linear, 0 → soft (γ 4), 100 → hard (γ 0.25).
    u_texGamma: 2 ** ((50 - tex.contrast) / 25),
    u_texAnimated: tex.animated ? 1 : 0,
    u_texTarget: tex.target === 'pattern' ? 1 : 0,
    u_texMono: tex.mono ? 1 : 0,

    u_count: c.blobs.count,
    u_size: (c.blobs.size / 100) * SIZE_SCALE,
    u_soft: SOFT_MIN + (c.blobs.softness / 100) * SOFT_SPAN,
    u_blob: layout.blob,
    u_orbit: layout.orbit,
  }
}

/** CSS equivalent of the background, painted behind the canvas until the first frame (and without WebGL). */
export function cssBackground(c: LazuliConfig): string {
  const bg = c.background
  if (bg.type === 'transparent') return 'transparent'
  if (bg.type === 'solid') return bg.color
  const stops = bg.gradient.join(', ')
  return bg.kind === 'linear'
    ? `linear-gradient(${bg.angle}deg, ${stops})`
    : `radial-gradient(circle farthest-corner at ${bg.centerX}% ${bg.centerY}%, ${stops})`
}
