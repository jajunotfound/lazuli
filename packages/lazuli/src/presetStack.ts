// A preset as a layer stack: its config as a one-shape stack, then its layer operations.

import { presetConfig } from './config'
import { PRESETS, type PresetId } from './presets'
import { applyOp, configToStack, type Stack, type StackOp } from './stack'

export function presetStack(id: PresetId): Stack {
  let s = configToStack(presetConfig(id))
  const layers = (PRESETS[id] as { layers?: readonly StackOp[] }).layers ?? []
  for (const op of layers) {
    const r = applyOp(s, op)
    if (!r.ok) throw new Error(`[lazuli] preset ${id}: ${op.op} failed (${r.error})`)
    s = r.stack
  }
  return s
}

/** True when the preset is more than its config (extra shapes or warps). */
export function presetHasLayers(id: PresetId): boolean {
  return ((PRESETS[id] as { layers?: readonly StackOp[] }).layers?.length ?? 0) > 0
}
