import { DEFAULTS, PARAM_KEYS, resolveParams, type LazuliParams } from 'lazuli-bg'

export type Params = LazuliParams
export type PanelId = 'colors' | 'shapes' | 'texture' | 'motion' | 'cursor'

/** Which params each popover's Reset restores. */
export const SECTION_KEYS: Record<PanelId, (keyof Params)[]> = {
  colors: ['core', 'edge', 'ground'],
  shapes: ['count', 'size', 'softness'],
  texture: ['texture'],
  motion: ['speed'],
  cursor: ['cursor', 'strength'],
}

export function sectionDefaults(id: PanelId): Partial<Params> {
  return Object.fromEntries(SECTION_KEYS[id].map((k) => [k, DEFAULTS[k]]))
}

export const TEXTURE_PRESETS = [
  { label: 'None', value: 0 },
  { label: 'Fine', value: 35 },
  { label: 'Heavy', value: 80 },
] as const

export const MOTION_PRESETS = [
  { label: 'Still', value: 0 },
  { label: 'Calm', value: 0.35 },
  { label: 'Lively', value: 0.9 },
] as const

export const SWATCHES = ['#1f48a8', '#6b4ee6', '#f0508c', '#ff8a3d', '#ffc93c', '#3cc6a0', '#1a1a1a', '#d9dee8']

// ---- URL state --------------------------------------------------------------
// Only non-default values go in the query string, colors without the "#".

export function readUrlParams(): Params {
  const q = new URLSearchParams(location.search)
  const raw: Record<string, string> = {}
  for (const key of PARAM_KEYS) {
    const v = q.get(key)
    if (v === null) continue
    raw[key] = key === 'core' || key === 'edge' || key === 'ground' ? `#${v.replace(/^#/, '')}` : v
  }
  return resolveParams(raw)
}

export function toQuery(p: Params): string {
  const q = new URLSearchParams()
  for (const key of PARAM_KEYS) {
    if (p[key] === DEFAULTS[key]) continue
    const v = p[key]
    q.set(key, typeof v === 'string' ? v.replace(/^#/, '') : String(round(v)))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export function writeUrlParams(p: Params) {
  const next = `${location.pathname}${toQuery(p)}${location.hash}`
  if (next !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, '', next)
}

export const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits

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
