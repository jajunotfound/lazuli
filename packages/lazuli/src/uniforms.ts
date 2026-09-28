// Config → shader uniform values. Each program uploads only the uniforms it declares,
// so a value here for a shape or texture that isn't active is simply skipped.

import { hexToRgb } from './color'
import { layoutFromSeed, noiseOffsetFromSeed, packLayout, ringSourcesFromSeed, wavesFromSeed } from './layout'
import type { LazuliConfig, TextureType } from './schema'

export type UniformValue = number | number[] | Float32Array
export type UniformValues = Record<string, UniformValue>

// Fitted so Size 100% and Softness 50 reproduce Paper frame 01.
const SIZE_SCALE = 0.91
const SOFT_MIN = 0.02
const SOFT_SPAN = 2.16 // softness 50 → 1.1, the widest band that keeps the ground clean
// Texture strength at intensity 100, per type. Paper shows no visible grain at the default
// (Fine = 35), so grain stays a whisper there. Halftone and dither mix 0–1 toward the screen.
const TEXTURE_SCALE: Record<TextureType, number> = { none: 0, grain: 0.07, noise: 0.22, paper: 0.16, halftone: 1, dither: 1 }
const CURSOR_RADIUS = 0.045 // falloff σ² in height units
const CURSOR_SMEAR = 1.6
const MAX_STOPS = 5
const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'difference']

const flat = (colors: string[], n: number) => {
  const out = new Float32Array(n * 3)
  colors.slice(0, n).forEach((c, i) => out.set(hexToRgb(c), i * 3))
  return out
}

/** Layouts are cached per seed (and satellite); they only change on shuffle. */
let layoutCache: { key: string; packed: ReturnType<typeof packLayout> } | null = null
function blobLayout(seed: number, satellite: boolean) {
  const key = `${seed}|${satellite}`
  if (layoutCache?.key !== key) layoutCache = { key, packed: packLayout(layoutFromSeed(seed, { satellite })) }
  return layoutCache.packed
}

const deg = (v: number) => (v * Math.PI) / 180
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function toUniforms(c: LazuliConfig): UniformValues {
  const bg = c.background
  const bgColors = bg.type === 'gradient' ? bg.gradient : [bg.color]
  const layout = blobLayout(c.seed, c.blobs.satellite)
  const { waves: w, bands: k, rings: r, dots: o, nodal: n } = c
  const kSeed = noiseOffsetFromSeed(c.seed)
  // n = m is blank everywhere; step to the next mode.
  const nodalM = n.m === n.n ? (n.n < 12 ? n.n + 1 : n.n - 1) : n.m
  const tex = c.texture
  return {
    u_pull: (c.cursor.mode === 'pull' ? -1 : 1) * (c.cursor.strength / 100),
    u_cursorR: CURSOR_RADIUS,
    u_smear: CURSOR_SMEAR,

    u_pal: flat(c.color.palette, MAX_STOPS),
    u_palN: c.color.palette.length,
    u_mapping: c.color.mapping === 'cycle' ? 1 : 0,
    u_steps: c.color.steps,
    u_blend: BLEND_MODES.indexOf(c.color.blend),
    u_opacity: c.color.opacity / 100,
    u_fade: c.color.fade / 100,

    u_bgType: bg.type === 'solid' ? 0 : bg.type === 'gradient' ? 1 : 2,
    u_bg: flat(bgColors, 3),
    u_bgN: bgColors.length,
    u_bgKind: bg.kind === 'radial' ? 1 : 0,
    u_bgAngle: (bg.angle * Math.PI) / 180,
    // GL's y axis points up; the public center is measured from the top.
    u_bgCenter: [bg.centerX / 100, 1 - bg.centerY / 100],

    u_texIntensity: (tex.intensity / 100) * TEXTURE_SCALE[tex.type],
    u_texScale: Math.round(tex.scale),
    // 50 → linear, 0 → soft (γ 4), 100 → hard (γ 0.25).
    u_texGamma: 2 ** ((50 - tex.contrast) / 25),
    u_texAnimated: tex.animated ? 1 : 0,
    u_texTarget: tex.target === 'pattern' ? 1 : 0,
    u_texMono: tex.mono ? 1 : 0,
    u_texOctaves: tex.octaves,
    u_texAngle: (tex.angle * Math.PI) / 180,
    u_texDotShape: ['dot', 'line', 'square'].indexOf(tex.dotShape),
    u_texMatrix: ['bayer4', 'bayer8', 'ign'].indexOf(tex.matrix),
    u_texLevels: tex.levels,
    u_texFibers: tex.fibers / 100,

    u_count: c.blobs.count,
    u_size: (c.blobs.size / 100) * SIZE_SCALE,
    u_soft: SOFT_MIN + (c.blobs.softness / 100) * SOFT_SPAN,
    u_blob: layout.blob,
    u_orbit: layout.orbit,
    u_stretch: c.blobs.stretch / 100,
    u_merge: c.blobs.merge / 100,
    u_wobble: (c.blobs.wobble / 100) * 0.07, // 50 → v1's 0.035

    u_wCount: w.count,
    u_wAmp: (w.amplitude / 100) * 0.3,
    u_wK: (Math.PI * 2) / lerp(0.3, 3, w.wavelength / 100),
    u_wHalf: (w.thickness / 100) * 0.2,
    u_wSoft: w.softness / 100,
    u_wSpread: lerp(0.03, 0.3, w.spread / 100),
    u_wTwist: (w.twist / 100) * Math.PI,
    u_wAngle: deg(w.angle),
    u_wave: wavesFromSeed(c.seed),

    u_kCount: k.count,
    u_kAngle: deg(k.angle),
    u_kHalf: k.width / 200,
    u_kSoft: k.softness / 100,
    u_kWarp: (k.warp / 100) * 0.3,
    u_kWarpFreq: lerp(0.5, 6, k.warpScale / 100),
    u_kSeed: kSeed,

    u_rCount: r.count,
    u_rSpacing: (r.spacing / 100) * 0.25,
    u_rThick: r.thickness / 100,
    u_rSoft: r.softness / 100,
    u_rSources: r.sources,
    u_rDist: (r.distortion / 100) * 0.25,
    u_rCenter: [r.centerX / 100, 1 - r.centerY / 100],
    u_rSrc: ringSourcesFromSeed(c.seed),

    u_oSpacing: o.spacing,
    u_oSize: o.size / 100,
    u_oSoft: o.softness / 100,
    u_oHex: o.grid === 'hex' ? 1 : 0,
    u_oJitter: o.jitter / 100,
    u_oMod: o.modulation / 100,
    u_oSeed: kSeed,

    u_nN: n.n,
    u_nM: nodalM,
    u_nHalf: (n.thickness / 100) * 0.12,
    u_nSoft: n.softness / 100,
    u_nScale: n.scale / 100,
    u_nRegions: n.style === 'regions' ? 1 : 0,
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
