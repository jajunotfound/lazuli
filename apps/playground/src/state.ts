import {
  DEFAULT_CONFIG,
  fromFlat,
  getPath,
  isPreset,
  PARAMS,
  presetConfig,
  resolveConfig,
  toFlat,
  type LazuliConfig,
  type LazuliInput,
  type ParamPath,
  type PresetId,
} from 'lazuli-bg'

export type Config = LazuliConfig
export type Patch = LazuliInput
export type SectionId = 'colors' | 'shapes' | 'texture' | 'background' | 'motion' | 'cursor'
export type PanelId = SectionId | 'presets'

/** Which parameters each popover shows (when active) and its Reset restores, in display order. */
export const SECTIONS: Record<SectionId, { title: string; paths: ParamPath[] }> = {
  colors: { title: 'Color', paths: ['color.palette', 'color.mapping', 'color.steps', 'color.blend', 'color.opacity', 'color.fade'] },
  shapes: {
    title: 'Shapes',
    paths: [
      'shape.type',
      'blobs.count', 'blobs.size', 'blobs.softness', 'blobs.stretch', 'blobs.merge', 'blobs.wobble', 'blobs.satellite',
      'waves.count', 'waves.amplitude', 'waves.wavelength', 'waves.thickness', 'waves.softness', 'waves.spread', 'waves.twist', 'waves.angle',
      'bands.count', 'bands.angle', 'bands.width', 'bands.softness', 'bands.warp', 'bands.warpScale',
      'rings.count', 'rings.spacing', 'rings.thickness', 'rings.softness', 'rings.sources', 'rings.centerX', 'rings.centerY', 'rings.distortion',
      'dots.grid', 'dots.spacing', 'dots.size', 'dots.softness', 'dots.modulation', 'dots.jitter',
      'nodal.style', 'nodal.n', 'nodal.m', 'nodal.thickness', 'nodal.softness', 'nodal.scale',
    ],
  },
  texture: {
    title: 'Texture',
    paths: [
      'texture.type',
      'texture.intensity',
      'texture.scale',
      'texture.contrast',
      'texture.octaves',
      'texture.fibers',
      'texture.angle',
      'texture.dotShape',
      'texture.matrix',
      'texture.levels',
      'texture.target',
      'texture.animated',
      'texture.mono',
    ],
  },
  background: {
    title: 'Background',
    paths: ['background.type', 'background.color', 'background.gradient', 'background.kind', 'background.angle', 'background.centerX', 'background.centerY'],
  },
  motion: { title: 'Motion', paths: ['motion.speed', 'motion.direction', 'motion.loop', 'quality'] },
  cursor: { title: 'Cursor', paths: ['cursor.mode', 'cursor.strength', 'cursor.radius', 'cursor.smear', 'cursor.follow'] },
}

/** Patch that puts one path back to its default. */
export function patchFor(path: ParamPath, value: unknown): Patch {
  const [s, k] = path.split('.')
  return (k === undefined ? { [s]: value } : { [s]: { [k]: value } }) as Patch
}

/** Reset a section to its values in `base` (the chosen preset, or the defaults). */
export function sectionDefaults(id: SectionId, base: Config = DEFAULT_CONFIG as Config): Patch {
  let out: Patch = {}
  for (const path of SECTIONS[id].paths) out = merge(out, patchFor(path, getPath(base, path)))
  return out
}

export function merge(a: Patch, b: Patch): Patch {
  const out: Record<string, unknown> = { ...a }
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k]
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && prev && typeof prev === 'object' ? { ...prev, ...v } : v
  }
  return out as Patch
}

export const MOTION_PRESETS = [
  { label: 'Still', value: 0 },
  { label: 'Calm', value: 0.35 },
  { label: 'Lively', value: 0.9 },
] as const

export const SWATCHES = ['#1f48a8', '#6b4ee6', '#f0508c', '#ff8a3d', '#ffc93c', '#3cc6a0', '#1a1a1a', '#d9dee8']

// ---- URL state --------------------------------------------------------------
// The preset you started from (`p=silk`), then only active values that differ from it,
// under the schema's short keys (colors without the "#"). v1 links (`?core=…&count=4`)
// still read through the legacy names.

export function readUrlState(): { config: Config; preset: PresetId | null } {
  const q = Object.fromEntries(new URLSearchParams(location.search))
  return { config: resolveConfig(fromFlat(q, 'url')), preset: isPreset(q.p) ? q.p : null }
}

export function toQuery(c: Config, preset: PresetId | null): string {
  const base = preset ? presetConfig(preset) : DEFAULT_CONFIG
  const q = new URLSearchParams([...(preset ? [['p', preset]] : []), ...toFlat(c, 'url', { base })])
  const s = q.toString()
  return s ? `?${s}` : ''
}

export function writeUrlState(c: Config, preset: PresetId | null) {
  const next = `${location.pathname}${toQuery(c, preset)}${location.hash}`
  if (next !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, '', next)
}

export const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits

/** Every parameter the schema defines, by path, for the controls. */
export const PARAM = Object.fromEntries(PARAMS.map((d) => [d.path, d])) as Record<ParamPath, (typeof PARAMS)[number]>

// ---- first-visit flag ------------------------------------------------------

const WELCOME_KEY = 'lazuli:welcome-seen'

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1'
  } catch {
    return false
  }
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(WELCOME_KEY, '1')
  } catch {
    // Storage blocked (private mode, sandbox): the card just shows again next time.
  }
}
