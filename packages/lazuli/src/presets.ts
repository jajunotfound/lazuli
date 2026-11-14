// Starting looks. Each is a patch over the defaults (and default seed), applied before any
// explicit values, so `preset="silk"` plus an attribute changes just that one thing. `layers`
// are stack operations on top (warps, more shapes) that show what the layer builder does; see
// presetStack().
// Frozen 2026-11-14 (test/presets.test.ts): a published preset must never change, or every
// embed using it changes with it. Add a new preset instead. Exports write the full values.

import type { ConfigPatch } from './config'
import type { StackOp } from './stack'

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
    layers: [
      { op: 'add', layer: 'warp', type: 'noise', parent: 'shape-1' },
      { op: 'tune', id: 'warp-1', strength: 16, size: 90 },
    ],
  },
  ripple: {
    label: 'Ripple',
    config: {
      shape: { type: 'rings' },
      rings: { count: 10, spacing: 34, thickness: 45, softness: 60, distortion: 25, centerX: 35, centerY: 45 },
      color: { palette: ['#7fd1c7', '#127a82'], fade: 45 },
      background: { color: '#f3fbfa' },
    },
    layers: [
      { op: 'add', layer: 'warp', type: 'ripple', parent: 'shape-1' },
      { op: 'tune', id: 'warp-1', strength: 22, size: 75 },
    ],
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
    layers: [
      { op: 'add', layer: 'warp', type: 'swirl', parent: 'shape-1' },
      { op: 'tune', id: 'warp-1', strength: 22, size: 85 },
    ],
  },
  paper: {
    label: 'Paper',
    config: {
      blobs: { softness: 65 },
      color: { palette: ['#9ab8a6', '#3f6e5a'], fade: 20 },
      background: { color: '#f4efe4' },
      texture: { type: 'paper', intensity: 70 },
    },
    // Fine noise on the edges, like torn paper.
    layers: [
      { op: 'add', layer: 'warp', type: 'noise', parent: 'shape-1' },
      { op: 'tune', id: 'warp-1', strength: 14, size: 15 },
    ],
  },
  night: {
    label: 'Night',
    config: {
      blobs: { count: 4 },
      color: { palette: ['#5b7cfa', '#9f5bfa', '#f08bd0'], blend: 'screen', fade: 25 },
      background: { type: 'gradient', gradient: ['#060816', '#141a3a'], angle: 160 },
      texture: { type: 'grain', intensity: 45 },
    },
    // A slow swirl, like a galaxy.
    layers: [
      { op: 'add', layer: 'warp', type: 'swirl', parent: 'shape-1' },
      { op: 'tune', id: 'warp-1', strength: 30, size: 70 },
    ],
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
  orbit: {
    label: 'Orbit',
    config: {
      blobs: { count: 4, size: 115, softness: 40 },
      color: { palette: ['#ffb38a', '#e8577a', '#6b2fa8'], fade: 25 },
      background: { color: '#fff4ec' },
      texture: { type: 'grain', intensity: 30 },
    },
    // Rings cut through the blobs, like a planet's.
    layers: [
      { op: 'add', layer: 'shape', type: 'rings' },
      { op: 'combine', id: 'shape-2', combine: 'cut' },
    ],
  },
} as const satisfies Record<string, { label: string; config: ConfigPatch; layers?: readonly StackOp[] }>

export type PresetId = keyof typeof PRESETS

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[]

export function isPreset(v: unknown): v is PresetId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PRESETS, v)
}
