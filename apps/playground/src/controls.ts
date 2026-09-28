import type { ParamPath } from 'lazuli-bg'

/** Playground-only presentation of a parameter; ranges and defaults come from the engine schema. */
export interface Hint {
  label?: string
  format?(v: number): string
  step?: number
  /** Dots at each step (small integer ranges). */
  stepped?: boolean
  /** Square-root slider scale: finer control at the low end. */
  sqrt?: boolean
  /** Enum option labels, in display order. */
  options?: Record<string, string>
  /** Show a two-option enum as an on/off switch. */
  switch?: { on: string; off: string }
  /** Row labels for a color list, in list order. */
  colorLabels?(count: number): string[]
  /** List the colors last-first (the palette shows its densest stop on top, like Paper's Core above Edge). */
  reverse?: boolean
  /** Not shown as a control (a custom row covers it). */
  hidden?: boolean
  /** Shown under the control while it has this value. */
  note?: Record<string, string>
}

const pct = (v: number) => `${Math.round(v)}%`
const int = (v: number) => String(Math.round(v))

export const HINTS: Partial<Record<ParamPath, Hint>> = {
  'blobs.count': { stepped: true },
  'blobs.size': { format: pct },

  'color.palette': {
    reverse: true,
    colorLabels: (n) => (n === 2 ? ['Edge', 'Core'] : Array.from({ length: n }, (_, i) => `Stop ${i + 1}`)),
  },
  'color.opacity': { format: pct },

  // The None / Fine / Heavy preset row picks the type.
  'texture.type': { hidden: true },
  'texture.scale': { step: 1, format: (v) => `${Math.round(v)}×` },
  'texture.target': { label: 'Applies to', options: { all: 'All', pattern: 'Shapes' } },

  'background.type': {
    options: { solid: 'Solid', gradient: 'Gradient', transparent: 'None' },
    note: { transparent: 'Transparent: whatever is behind the canvas shows through.' },
  },
  'background.gradient': { colorLabels: (n) => Array.from({ length: n }, (_, i) => `Stop ${i + 1}`) },
  'background.kind': { options: { linear: 'Linear', radial: 'Radial' } },
  'background.angle': { step: 1, format: (v) => `${Math.round(v)}°` },
  'background.centerX': { format: pct },
  'background.centerY': { format: pct },

  'motion.speed': { sqrt: true, format: (v) => `${v.toFixed(2)}×` },

  'cursor.mode': { label: 'Pull in', switch: { on: 'pull', off: 'push' } },
  'cursor.strength': { format: (v) => (v === 0 ? 'Off' : int(v)) },
}
