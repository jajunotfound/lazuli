import { PRESETS } from 'lazuli-bg'
import { useRef, useState } from 'react'
import { ShuffleIcon } from '../icons'
import type { Frame } from './Frames'
import { readImage } from './Frames'
import { Segmented } from './Segmented'

// The selected frame's own properties, docked on the right (the dock on the left keeps editing
// its look). Same panel styles as the popovers.
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
  onChange(patch: Partial<Frame>): void
  onAddPattern(): void
  onRemovePattern(): void
  onShuffle(): void
  onDuplicate(): void
  onDelete(): void
  onCode(): void
}

export function FramePanel({ frame, onChange, onAddPattern, onRemovePattern, onShuffle, onDuplicate, onDelete, onCode }: FramePanelProps) {
  const file = useRef<HTMLInputElement>(null)
  const [ratio, setRatio] = useState<RatioLabel>(() => matchRatio(frame))
  const current = ratio === 'Free' ? 'Free' : matchRatio(frame) === ratio ? ratio : 'Free'

  const setSize = (w: number, h: number) => {
    // Resize around the center so the frame stays where you're looking.
    onChange({ w, h, x: frame.x + (frame.w - w) / 2, y: frame.y + (frame.h - h) / 2 })
  }
  const pickRatio = (label: RatioLabel) => {
    setRatio(label)
    const r = RATIOS.find((o) => o.label === label)!.r
    if (r) setSize(frame.w, Math.round(frame.w / r))
  }
  const lookName = frame.config ? PRESETS[frame.preset ?? 'lazuli'].label : null

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
      <div className="frame-panel__size">
        <NumberRow label="W" value={frame.w} onChange={(w) => setSize(w, ratio !== 'Free' && current !== 'Free' ? Math.round(w / RATIOS.find((o) => o.label === ratio)!.r) : frame.h)} />
        <NumberRow label="H" value={frame.h} onChange={(h) => setSize(ratio !== 'Free' && current !== 'Free' ? Math.round(h * RATIOS.find((o) => o.label === ratio)!.r) : frame.w, h)} />
      </div>
      <Segmented label="Aspect ratio" options={RATIOS} value={current} onChange={pickRatio} />

      <div className="frame-panel__section">Fill</div>
      {frame.image ? (
        <div className="row frame-panel__fill">
          <img src={frame.image} alt="" />
          <span className="row__label">Image</span>
          <span className="frame-panel__fill-acts">
            <button type="button" className="frame-panel__chip" onClick={() => file.current?.click()}>
              Replace
            </button>
            <button type="button" className="frame-panel__chip" onClick={() => onChange({ image: undefined })}>
              Remove
            </button>
          </span>
        </div>
      ) : (
        <button type="button" className="row row--button frame-panel__add" onClick={() => file.current?.click()}>
          <span className="row__label">Image</span>
          <span className="row__value">Add…</span>
        </button>
      )}
      {lookName ? (
        <div className="row frame-panel__fill">
          <span className="frame-panel__swatch" style={{ background: `radial-gradient(circle at 40% 38%, ${frame.config!.color.palette[0]}, ${frame.config!.color.palette[frame.config!.color.palette.length - 1]})` }} />
          <span className="row__label">{lookName}</span>
          <span className="frame-panel__fill-acts">
            <button type="button" className="icon-button" onClick={onShuffle} aria-label="Shuffle" title="Shuffle · R">
              <ShuffleIcon width={16} height={16} />
            </button>
            {frame.image && (
              <button type="button" className="frame-panel__chip" onClick={onRemovePattern}>
                Remove
              </button>
            )}
          </span>
        </div>
      ) : (
        <button type="button" className="row row--button frame-panel__add" onClick={onAddPattern}>
          <span className="row__label">Pattern</span>
          <span className="row__value">Add…</span>
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
      <span className="row__label">{label}</span>
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
