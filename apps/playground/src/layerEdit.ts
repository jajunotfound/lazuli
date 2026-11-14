// Connects layers to the schema-driven controls. Each layer is edited through a "view": the flat
// config it would be on its own. Controls read the view and send config patches; patchLayer
// resolves a patch against the view (so ranges and clamping come from the engine) and writes
// the result back into that layer only.

import {
  findLayer,
  isActive,
  PARAMS,
  resolveConfig,
  stackToConfig,
  type Layer,
  type LazuliInput,
  type ParamPath,
  type ShapeType,
  type Stack,
} from 'lazuli-bg'
import type { Config } from './state'

const SHAPE_KEYS = ['blobs', 'waves', 'bands', 'rings', 'dots', 'nodal'] as const
export const SHAPE_LABELS: Record<ShapeType, string> = { blobs: 'Blobs', waves: 'Waves', bands: 'Bands', rings: 'Rings', dots: 'Dots', nodal: 'Plate' }

/** Pseudo-layer for the stack-wide settings (motion, quality). */
export const SCENE_ID = 'scene'

/** The flat config a layer would be on its own. */
export function layerView(stack: Stack, id: string): Config {
  const base = stackToConfig(stack)
  const found = findLayer(stack, id)
  if (!found) return base
  const l = found.layer
  if (l.kind === 'shape') return { ...base, ...structuredClone(l.settings), shape: { type: l.type }, seed: l.seed }
  if (l.kind === 'texture') return { ...base, texture: structuredClone(l.settings) }
  if (l.kind === 'warp' && l.type === 'cursor') return { ...base, cursor: { mode: l.mode, strength: l.strength, radius: l.radius, smear: l.smear, follow: l.follow } }
  return base
}

/** Apply a config patch to one layer (or the scene), leaving every other layer as it was. */
export function patchLayer(stack: Stack, id: string, patch: LazuliInput): Stack {
  const next = structuredClone(stack)
  const view = resolveConfig(patch, layerView(stack, id))
  if (id === SCENE_ID) {
    next.motion = view.motion
    next.quality = view.quality
    return next
  }
  const found = findLayer(next, id)
  if (!found) return stack
  const l = found.layer
  if (l.kind === 'shape') {
    const renamed = l.name === SHAPE_LABELS[l.type]
    for (const k of SHAPE_KEYS) (l.settings as unknown as Record<string, unknown>)[k] = view[k]
    l.type = view.shape.type
    l.seed = view.seed
    if (renamed) l.name = SHAPE_LABELS[l.type]
  } else if (l.kind === 'texture') {
    if (view.texture.type !== 'none') l.settings = view.texture as typeof l.settings
  } else if (l.kind === 'color') l.settings = view.color
  else if (l.kind === 'background') l.settings = view.background
  else if (l.kind === 'warp' && l.type === 'cursor' && view.cursor.mode !== 'off') {
    Object.assign(l, { mode: view.cursor.mode, strength: view.cursor.strength, radius: view.cursor.radius, smear: view.cursor.smear, follow: view.cursor.follow })
  }
  return next
}

const bySection = (prefix: string) => PARAMS.filter((d) => d.path.startsWith(prefix)).map((d) => d.path)

/** The parameters the inspector shows for a layer, in order, active ones only. */
export function layerPaths(layer: Layer | 'scene', view: Config): ParamPath[] {
  let paths: ParamPath[]
  if (layer === 'scene') paths = ['motion.speed', 'motion.direction', 'motion.loop', 'motion.reducedMotion', 'quality']
  else if (layer.kind === 'shape') paths = ['shape.type', ...bySection(`${layer.type}.`)]
  else if (layer.kind === 'texture') paths = bySection('texture.')
  else if (layer.kind === 'color') paths = bySection('color.')
  else if (layer.kind === 'background') paths = bySection('background.')
  else if (layer.kind === 'warp' && layer.type === 'cursor') paths = bySection('cursor.')
  else paths = []
  // Direction shows for the scene whenever any shape moves along it.
  return paths.filter((p) => p === 'motion.direction' || isActive(PARAMS.find((d) => d.path === p)!, view))
}
