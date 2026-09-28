import {
  DEFAULT_CONFIG,
  fromFlat,
  getPath,
  PARAMS,
  resolveConfig,
  toFlat,
  type LazuliConfig,
  type LazuliInput,
  type ParamPath,
} from 'lazuli-bg'

export type Config = LazuliConfig
export type Patch = LazuliInput
export type PanelId = 'colors' | 'shapes' | 'texture' | 'background' | 'motion' | 'cursor'

/** Which parameters each popover shows (when active) and its Reset restores, in display order. */
export const SECTIONS: Record<PanelId, { title: string; paths: ParamPath[] }> = {
  colors: { title: 'Color', paths: ['color.palette', 'color.mapping', 'color.steps', 'color.blend', 'color.opacity', 'color.fade'] },
  shapes: { title: 'Shapes', paths: ['blobs.count', 'blobs.size', 'blobs.softness'] },
  texture: {
    title: 'Texture',
    paths: ['texture.type', 'texture.intensity', 'texture.scale', 'texture.contrast', 'texture.target', 'texture.animated', 'texture.mono'],
  },
  background: {
    title: 'Background',
    paths: ['background.type', 'background.color', 'background.gradient', 'background.kind', 'background.angle', 'background.centerX', 'background.centerY'],
  },
  motion: { title: 'Motion', paths: ['motion.speed'] },
  cursor: { title: 'Cursor', paths: ['cursor.mode', 'cursor.strength'] },
}

/** Patch that puts one path back to its default. */
export function patchFor(path: ParamPath, value: unknown): Patch {
  const [s, k] = path.split('.')
  return (k === undefined ? { [s]: value } : { [s]: { [k]: value } }) as Patch
}

export function sectionDefaults(id: PanelId): Patch {
  let out: Patch = {}
  for (const path of SECTIONS[id].paths) out = merge(out, patchFor(path, getPath(DEFAULT_CONFIG, path)))
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

export const TEXTURE_PRESETS = [
  { label: 'None', patch: { texture: { type: 'none' } } },
  { label: 'Fine', patch: { texture: { type: 'grain', intensity: 35 } } },
  { label: 'Heavy', patch: { texture: { type: 'grain', intensity: 80 } } },
] as const satisfies readonly { label: string; patch: Patch }[]

export function texturePreset(c: Config): (typeof TEXTURE_PRESETS)[number]['label'] | '' {
  if (c.texture.type === 'none' || c.texture.intensity === 0) return 'None'
  if (c.texture.type !== 'grain') return ''
  return c.texture.intensity === 35 ? 'Fine' : c.texture.intensity === 80 ? 'Heavy' : ''
}

export const MOTION_PRESETS = [
  { label: 'Still', value: 0 },
  { label: 'Calm', value: 0.35 },
  { label: 'Lively', value: 0.9 },
] as const

export const SWATCHES = ['#1f48a8', '#6b4ee6', '#f0508c', '#ff8a3d', '#ffc93c', '#3cc6a0', '#1a1a1a', '#d9dee8']

// ---- URL state --------------------------------------------------------------
// Only active, non-default values go in the query string, under the schema's short keys
// (colors without the "#"). v1 links (`?core=…&count=4`) still read through the legacy names.

export function readUrlConfig(): Config {
  const q = new URLSearchParams(location.search)
  return resolveConfig(fromFlat(Object.fromEntries(q), 'url'))
}

export function toQuery(c: Config): string {
  const q = new URLSearchParams(toFlat(c, 'url'))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export function writeUrlConfig(c: Config) {
  const next = `${location.pathname}${toQuery(c)}${location.hash}`
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
