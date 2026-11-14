import { snapshot } from 'lazuli-bg/capture'
import { useEffect, useState } from 'react'
import { EXAMPLES, exampleStack, type Example } from '../examples'

const THUMB_W = 200
const THUMB_H = 113

// Rendered once per page load, one at a time (each render opens its own GL context).
const thumbs = new Map<string, string>()
let rendering: Promise<void> | null = null
function renderThumbs(onEach: () => void): Promise<void> {
  rendering ??= (async () => {
    for (const e of EXAMPLES) {
      if (thumbs.has(e.id)) continue
      try {
        const blob = await snapshot({}, { width: THUMB_W, height: THUMB_H, pixelRatio: THUMB_W / 1280, time: 1.5, stack: exampleStack(e) })
        thumbs.set(e.id, URL.createObjectURL(blob))
      } catch {
        // No WebGL: the card shows its name only.
      }
      onEach()
    }
  })()
  return rendering
}

/** Starting points drawn with the tool; picking one replaces the canvas. */
export function ExampleGrid({ onPick }: { onPick(e: Example): void }) {
  const [, redraw] = useState(0)
  useEffect(() => {
    void renderThumbs(() => redraw((n) => n + 1))
  }, [])
  return (
    <div className="presets" role="list">
      {EXAMPLES.map((e) => {
        const src = thumbs.get(e.id)
        return (
          <button key={e.id} type="button" role="listitem" className="preset" onClick={() => onPick(e)}>
            <span className="preset__thumb">{src && <img src={src} alt="" />}</span>
            <span className="preset__label">{e.name}</span>
          </button>
        )
      })}
    </div>
  )
}
