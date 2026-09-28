// Starting looks. Each is a patch over the defaults (and default seed), applied before any
// explicit values, so `preset="silk"` plus an attribute changes just that one thing.
// Provisional: tuned by eye until the v2 Paper design; once published, a preset must never
// change, or every embed using it changes with it. Exports always write the full values.

import type { ConfigPatch } from './config'

export const PRESETS = {
  lazuli: { label: 'Lazuli', config: {} },
  silk: {
    label: 'Silk',
    config: {
      shape: { type: 'waves' },
      waves: { count: 4, amplitude: 35, wavelength: 70, thickness: 45, softness: 80, spread: 40, twist: 25, angle: -12 },
      color: { palette: ['#f6c1d9', '#b388ff', '#5b3fd1'], fade: 20 },
      background: { type: 'gradient', gradient: ['#fff7fb', '#efe9ff'], angle: 160 },
      texture: { type: 'grain', intensity: 30 },
    },
  },
  ripple: {
    label: 'Ripple',
    config: {
      shape: { type: 'rings' },
      rings: { count: 10, spacing: 34, thickness: 45, softness: 60, distortion: 25, centerX: 35, centerY: 45 },
      color: { palette: ['#7fd1c7', '#127a82'], fade: 45 },
      background: { color: '#f3fbfa' },
    },
  },
  screen: {
    label: 'Screen',
    config: {
      blobs: { count: 4, size: 110 },
      color: { palette: ['#ff7a59', '#e2375b'] },
      background: { color: '#fff6ea' },
      texture: { type: 'halftone', intensity: 100, scale: 2, angle: 30 },
    },
  },
  stripe: {
    label: 'Stripe',
    config: {
      shape: { type: 'bands' },
      bands: { count: 9, angle: 20, width: 45, softness: 10, warp: 45, warpScale: 30 },
      color: { palette: ['#ffd35c', '#ff8a3d', '#e84a5f'], steps: 3, fade: 0 },
      background: { color: '#fffaf0' },
      texture: { type: 'none' },
    },
  },
  paper: {
    label: 'Paper',
    config: {
      blobs: { softness: 65 },
      color: { palette: ['#9ab8a6', '#3f6e5a'], fade: 20 },
      background: { color: '#f4efe4' },
      texture: { type: 'paper', intensity: 70 },
    },
  },
  night: {
    label: 'Night',
    config: {
      blobs: { count: 4 },
      color: { palette: ['#5b7cfa', '#9f5bfa', '#f08bd0'], blend: 'screen', fade: 25 },
      background: { type: 'gradient', gradient: ['#060816', '#141a3a'], angle: 160 },
      texture: { type: 'grain', intensity: 45 },
    },
  },
  plate: {
    label: 'Plate',
    config: {
      shape: { type: 'nodal' },
      nodal: { n: 3, m: 7, thickness: 14, softness: 30, scale: 90 },
      color: { palette: ['#d8cfb8', '#fffaf0'], fade: 30 },
      background: { color: '#15130f' },
      texture: { type: 'grain', intensity: 40 },
    },
  },
  glass: {
    label: 'Glass',
    config: {
      color: { opacity: 70 },
      background: { type: 'transparent' },
      texture: { type: 'none' },
    },
  },
} as const satisfies Record<string, { label: string; config: ConfigPatch }>

export type PresetId = keyof typeof PRESETS

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[]

export function isPreset(v: unknown): v is PresetId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PRESETS, v)
}
