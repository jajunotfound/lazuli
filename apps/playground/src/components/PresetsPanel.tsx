import { PRESET_IDS, PRESETS, presetConfig, type PresetId } from 'lazuli-bg'
import { snapshot } from 'lazuli-bg/capture'
import { useEffect, useState } from 'react'
import type { Config } from '../state'

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
        const blob = await snapshot(presetConfig(id), { width: THUMB_W, height: THUMB_H, pixelRatio: THUMB_W / 1280 })
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
  config: Config
  preset: PresetId | null
  onPick(id: PresetId): void
}

export function PresetsPanel({ config, preset, onPick }: PresetsPanelProps) {
  const [, redraw] = useState(0)
  useEffect(() => {
    void renderThumbs(() => redraw((n) => n + 1))
  }, [])
  const unchanged = preset !== null && JSON.stringify(presetConfig(preset)) === JSON.stringify(config)

  return (
    <div className="panel panel--presets">
      <div className="panel__head">
        <h2 className="panel__title">Presets</h2>
      </div>
      <div className="presets" role="list">
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
      <p className="panel__hint">Starts over from the preset. Edits after that are kept on top of it.</p>
    </div>
  )
}
