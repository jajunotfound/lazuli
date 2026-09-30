import type { PresetId } from 'lazuli-bg'
import { useRef, useState } from 'react'
import type { Config } from '../state'
import { readImage, type Frame } from './Frames'
import { PresetGrid } from './PresetsPanel'

// The selected frame's own panel, docked on the right: name, size, source image, look, code.
// The dock on the left keeps editing the look in detail.
const RATIOS = [
  { label: 'Free', r: 0 },
  { label: '16:9', r: 16 / 9 },
  { label: '1:1', r: 1 },
  { label: '4:5', r: 4 / 5 },
  { label: '9:16', r: 9 / 16 },
] as const
type RatioLabel = (typeof RATIOS)[number]['label']

interface FramePanelProps {
  frame: Frame
  config: Config
  onChange(patch: Partial<Frame>): void
  onPreset(id: PresetId): void
  onDuplicate(): void
  onDelete(): void
  onCode(): void
}

export function FramePanel({ frame, config, onChange, onPreset, onDuplicate, onDelete, onCode }: FramePanelProps) {
  const file = useRef<HTMLInputElement>(null)
  // A picked ratio stays locked while the frame still matches it (W/H edits keep it).
  const [locked, setLocked] = useState<RatioLabel>(() => matchRatio(frame))
  const ratio = locked !== 'Free' && matchRatio(frame) === locked ? locked : 'Free'
  const r = RATIOS.find((o) => o.label === ratio)!.r

  const setSize = (w: number, h: number) => onChange({ w, h, x: frame.x + (frame.w - w) / 2, y: frame.y + (frame.h - h) / 2 })
  const pickRatio = (label: RatioLabel) => {
    setLocked(label)
    const k = RATIOS.find((o) => o.label === label)!.r
    if (k) setSize(frame.w, Math.round(frame.w / k))
  }

  return (
    <aside className="panel frame-panel" aria-label="Frame">
      <div className="panel__head">
        <h2 className="panel__title">Frame</h2>
        <span className="frame-panel__acts">
          <button type="button" className="icon-button" onClick={onDuplicate} aria-label="Duplicate frame">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" />
              <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
            </svg>
          </button>
          <button type="button" className="icon-button" onClick={onDelete} aria-label="Delete frame">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
            </svg>
          </button>
        </span>
      </div>

      <label className="row frame-panel__name">
        <span className="visually-hidden">Name</span>
        <input value={frame.name} onChange={(e) => onChange({ name: e.target.value })} spellCheck={false} />
      </label>

      <div className="frame-panel__section">Size</div>
      <div className="frame-panel__pair">
        <NumberRow label="W" value={frame.w} onChange={(w) => setSize(w, r ? Math.round(w / r) : frame.h)} />
        <NumberRow label="H" value={frame.h} onChange={(h) => setSize(r ? Math.round(h * r) : frame.w, h)} />
      </div>
      <div className="frame-panel__seg" role="group" aria-label="Aspect ratio">
        {RATIOS.map((o) => (
          <button key={o.label} type="button" aria-pressed={o.label === ratio} onClick={() => pickRatio(o.label)}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="frame-panel__section">Source</div>
      {frame.image ? (
        <div className="row frame-panel__image">
          <img src={frame.image} alt="" />
          <span className="frame-panel__image-name" />
          <button type="button" className="frame-panel__chip" onClick={() => file.current?.click()}>
            Replace
          </button>
          <button type="button" className="frame-panel__chip" onClick={() => onChange({ image: undefined })}>
            Remove
          </button>
        </div>
      ) : (
        <button type="button" className="row frame-panel__add" onClick={() => file.current?.click()}>
          <span>Shape</span>
          <span className="frame-panel__add-hint">Use an image…</span>
        </button>
      )}
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) readImage(f).then(({ src }) => onChange({ image: src }))
        }}
      />

      <div className="frame-panel__section">Look</div>
      <PresetGrid className="presets--3" config={config} preset={frame.preset ?? (frame.config ? null : 'lazuli')} onPick={onPreset} />

      <button type="button" className="frame-panel__code" onClick={onCode}>
        Get code
      </button>
    </aside>
  )
}

function NumberRow({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    const v = Math.round(Number(draft))
    if (draft !== null && Number.isFinite(v) && v >= 40) onChange(Math.min(v, 4000))
    setDraft(null)
  }
  return (
    <label className="row frame-panel__num">
      <span className="frame-panel__num-label">{label}</span>
      <input
        inputMode="numeric"
        value={draft ?? String(Math.round(value))}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            onChange(Math.max(40, Math.round(value) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)))
          }
        }}
      />
    </label>
  )
}

function matchRatio(f: Frame): RatioLabel {
  const r = f.w / f.h
  return RATIOS.find((o) => o.r && Math.abs(o.r - r) < 0.01)?.label ?? 'Free'
}
