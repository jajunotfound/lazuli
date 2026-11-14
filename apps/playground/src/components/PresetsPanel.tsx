import { PRESET_IDS, PRESETS, presetConfig, presetStack, type PresetId, type Stack } from 'lazuli-bg'
import { snapshot } from 'lazuli-bg/capture'
import { useEffect, useState } from 'react'

const THUMB_W = 200
const THUMB_H = 130

// Rendered once per page load, one at a time (each render opens its own GL context).
const thumbs = new Map<PresetId, string>()
let rendering: Promise<void> | null = null
function renderThumbs(onEach: () => void): Promise<void> {
  rendering ??= (async () => {
    for (const id of PRESET_IDS) {
      if (thumbs.has(id)) continue
      try {
        // Stand in for a ~1280px-wide scene, so CSS-pixel sizes (dots, grain) scale down with it.
        const blob = await snapshot({}, { width: THUMB_W, height: THUMB_H, pixelRatio: THUMB_W / 1280, stack: presetStack(id) })
        thumbs.set(id, URL.createObjectURL(blob))
      } catch {
        // No WebGL: the card shows its name only.
      }
      onEach()
    }
  })()
  return rendering
}

interface PresetsPanelProps {
  stack: Stack
  preset: PresetId | null
  onPick(id: PresetId): void
}

export function PresetsPanel({ stack, preset, onPick }: PresetsPanelProps) {
  return (
    <div className="panel panel--presets">
      <div className="panel__head">
        <h2 className="panel__title">Presets</h2>
      </div>
      <PresetGrid stack={stack} preset={preset} onPick={onPick} />
      <p className="panel__hint">Starts over from the preset. Edits after that are kept on top of it.</p>
    </div>
  )
}

/** The preset cards alone (also used in the frame panel). */
export function PresetGrid({ stack, preset, onPick, className = '' }: PresetsPanelProps & { className?: string }) {
  const [, redraw] = useState(0)
  useEffect(() => {
    void renderThumbs(() => redraw((n) => n + 1))
  }, [])
  const unchanged = preset !== null && JSON.stringify(presetStack(preset)) === JSON.stringify(stack)

  return (
    <div className={`presets ${className}`} role="list">
      {PRESET_IDS.map((id) => {
        const src = thumbs.get(id)
        return (
          <button
            key={id}
            type="button"
            role="listitem"
            className="preset"
            aria-current={id === preset || undefined}
            data-edited={(id === preset && !unchanged) || undefined}
            onClick={() => onPick(id)}
          >
            <span className="preset__thumb" data-transparent={presetConfig(id).background.type === 'transparent' || undefined}>
              {src && <img src={src} alt="" />}
            </span>
            <span className="preset__label">{PRESETS[id].label}</span>
          </button>
        )
      })}
    </div>
  )
}
