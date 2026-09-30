import { createLazuli, type LazuliInstance } from 'lazuli-bg'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PresetId } from 'lazuli-bg'
import type { Config } from '../state'

// Frames work like Figma's: draw one with the Frame tool, it starts empty (white), and you fill
// it with an image, a preset, or both (the pattern then renders over the image).
export interface Frame {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  image?: string
  config?: Config
  preset?: PresetId
}

type Box = Pick<Frame, 'x' | 'y' | 'w' | 'h'>
type Corner = 'nw' | 'ne' | 'sw' | 'se'

const MIN = 40
const DEFAULT_W = 480
const DEFAULT_H = 320

interface FramesProps {
  frames: Frame[]
  selected: string | null
  /** Frame tool on: the next drag (or click) on the canvas draws a frame. */
  drawing: boolean
  /** Hidden until the entrance reveals them. */
  veiled?: boolean
  /** The playground lifts the reduced-motion cap once the user picks a speed. */
  liftReducedMotion?: boolean
  onDraw(box: Box): void
  onSelect(id: string | null): void
  onChange(id: string, patch: Partial<Frame>): void
  /** An image dropped on a frame (id) or on empty canvas (id null, at x/y). */
  onImage(id: string | null, src: string, at: { x: number; y: number; w: number; h: number }): void
  registerEngine(id: string, engine: LazuliInstance | null): void
}

export function Frames({ frames, selected, drawing, veiled, liftReducedMotion = false, onDraw, onSelect, onChange, onImage, registerEngine }: FramesProps) {
  const [draft, setDraft] = useState<Box | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null | undefined>(undefined)

  // ---- drawing -------------------------------------------------------------
  const startDraw = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const x0 = e.clientX, y0 = e.clientY
    let box: Box | null = null
    const move = (ev: PointerEvent) => {
      const x = Math.min(x0, ev.clientX), y = Math.min(y0, ev.clientY)
      box = { x, y, w: Math.abs(ev.clientX - x0), h: Math.abs(ev.clientY - y0) }
      setDraft(box)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDraft(null)
      // A click (or a tiny drag) places a default-size frame centered on the pointer.
      if (!box || box.w < MIN || box.h < MIN) onDraw({ x: x0 - DEFAULT_W / 2, y: y0 - DEFAULT_H / 2, w: DEFAULT_W, h: DEFAULT_H })
      else onDraw(box)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // ---- dropping images -----------------------------------------------------
  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files')
    const frameAt = (e: DragEvent) => (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-frame]')?.dataset.frame ?? null : null)
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDropTarget(frameAt(e))
    }
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDropTarget(undefined)
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDropTarget(undefined)
      const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (!file) return
      const id = frameAt(e)
      readImage(file).then(({ src, w, h }) => onImage(id, src, { x: e.clientX, y: e.clientY, w, h }))
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [onImage])

  return (
    <>
      {drawing && <div className="frame-draw" onPointerDown={startDraw} aria-hidden="true" />}
      <div className="frames" data-drop={dropTarget === null || undefined} data-veiled={veiled || undefined}>
        {frames.map((f) => (
          <FrameView
            key={f.id}
            frame={f}
            selected={f.id === selected}
            dropping={dropTarget === f.id}
            lift={liftReducedMotion}
            onSelect={() => onSelect(f.id)}
            onChange={(patch) => onChange(f.id, patch)}
            registerEngine={registerEngine}
          />
        ))}
        {draft && <div className="frame frame--draft" style={{ left: draft.x, top: draft.y, width: draft.w, height: draft.h }} />}
      </div>
    </>
  )
}

function FrameView({
  frame,
  selected,
  dropping,
  lift,
  onSelect,
  onChange,
  registerEngine,
}: {
  frame: Frame
  selected: boolean
  dropping: boolean
  lift: boolean
  onSelect(): void
  onChange(patch: Partial<Frame>): void
  registerEngine(id: string, engine: LazuliInstance | null): void
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const engine = useRef<LazuliInstance | null>(null)
  const hasPattern = !!frame.config

  // One engine per frame with a pattern; created when the frame gets a config.
  useEffect(() => {
    if (!host || !hasPattern) return
    engine.current = createLazuli(host, live(frame.config!, lift))
    registerEngine(frame.id, engine.current)
    return () => {
      engine.current?.destroy()
      engine.current = null
      registerEngine(frame.id, null)
    }
    // frame.config changes go through set() below.
  }, [host, hasPattern, frame.id, registerEngine])

  useEffect(() => {
    if (frame.config) engine.current?.set(live(frame.config, lift))
  }, [frame.config, lift])

  // Drag the frame by its body or its name; resize from the corners.
  const drag = (e: ReactPointerEvent, corner?: Corner) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelect()
    const start = { x: e.clientX, y: e.clientY }
    const from = { x: frame.x, y: frame.y, w: frame.w, h: frame.h }
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y
      if (!corner) return onChange({ x: from.x + dx, y: from.y + dy })
      const west = corner === 'nw' || corner === 'sw', north = corner === 'nw' || corner === 'ne'
      const w = Math.max(MIN, from.w + (west ? -dx : dx)), h = Math.max(MIN, from.h + (north ? -dy : dy))
      onChange({ w, h, x: west ? from.x + from.w - w : from.x, y: north ? from.y + from.h - h : from.y })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      className="frame"
      data-frame={frame.id}
      data-selected={selected || undefined}
      data-dropping={dropping || undefined}
      style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }}
    >
      <div className="frame__name" onPointerDown={(e) => drag(e)}>
        {frame.name}
      </div>
      <div className="frame__body" onPointerDown={(e) => drag(e)}>
        {frame.image && <img className="frame__image" src={frame.image} alt="" draggable={false} />}
        {hasPattern && <div className="frame__pattern" ref={setHost} />}
      </div>
      {selected && (
        <>
          <span className="frame__size" aria-hidden="true">
            {Math.round(frame.w)} × {Math.round(frame.h)}
          </span>
          {(['nw', 'ne', 'sw', 'se'] as const).map((c) => (
            <span key={c} className={`frame__handle frame__handle--${c}`} onPointerDown={(e) => drag(e, c)} />
          ))}
        </>
      )}
    </div>
  )
}

export function readImage(file: File): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const src = String(reader.result)
      const img = new Image()
      img.onload = () => resolve({ src, w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = reject
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}

function live(c: Config, lift: boolean): Config {
  return lift ? { ...c, motion: { ...c.motion, reducedMotion: 'ignore' } } : c
}
