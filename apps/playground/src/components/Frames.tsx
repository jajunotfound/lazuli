import { createLazuli, resolveConfig, type LazuliInstance, type PresetId } from 'lazuli-bg'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { Config } from '../state'

// Frames work like Figma's: draw one with the Frame tool, it starts empty (white), and you fill
// it with a look (preset) and/or an image. With an image, the image is the source: its light and
// dark take the look's palette, steps and texture. Frames live in world coordinates; the camera
// (pan + zoom) maps them to the screen.
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

export interface Camera {
  x: number
  y: number
  z: number
}

type Box = Pick<Frame, 'x' | 'y' | 'w' | 'h'>
type Corner = 'nw' | 'ne' | 'sw' | 'se'

const MIN = 40
const DEFAULT_W = 480
const DEFAULT_H = 320

export const toWorld = (cam: Camera, sx: number, sy: number) => ({ x: (sx - cam.x) / cam.z, y: (sy - cam.y) / cam.z })

interface FramesProps {
  frames: Frame[]
  selected: string | null
  camera: Camera
  /** Frame tool on: the next drag (or click) on the canvas draws a frame. */
  drawing: boolean
  /** Hidden until the entrance reveals them. */
  veiled?: boolean
  /** The playground lifts the reduced-motion cap once the user picks a speed. */
  liftReducedMotion?: boolean
  onDraw(box: Box): void
  onSelect(id: string | null): void
  onChange(id: string, patch: Partial<Frame>): void
  /** An image dropped on a frame (id) or on empty canvas (id null, at world x/y). */
  onImage(id: string | null, src: string, at: { x: number; y: number; w: number; h: number }): void
  registerEngine(id: string, engine: LazuliInstance | null): void
}

export function Frames({ frames, selected, camera, drawing, veiled, liftReducedMotion = false, onDraw, onSelect, onChange, onImage, registerEngine }: FramesProps) {
  const [draft, setDraft] = useState<Box | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null | undefined>(undefined)
  const cam = useRef(camera)
  cam.current = camera

  // ---- drawing -------------------------------------------------------------
  const startDraw = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const a = toWorld(cam.current, e.clientX, e.clientY)
    let box: Box | null = null
    const move = (ev: PointerEvent) => {
      const b = toWorld(cam.current, ev.clientX, ev.clientY)
      box = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
      setDraft(box)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDraft(null)
      // A click (or a tiny drag) places a default-size frame centered on the pointer.
      if (!box || box.w < MIN || box.h < MIN) onDraw({ x: a.x - DEFAULT_W / 2, y: a.y - DEFAULT_H / 2, w: DEFAULT_W, h: DEFAULT_H })
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
      const at = toWorld(cam.current, e.clientX, e.clientY)
      readImage(file).then(({ src, w, h }) => onImage(id, src, { ...at, w, h }))
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

  const world = { transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})`, '--inv': 1 / camera.z } as CSSProperties

  return (
    <>
      {drawing && <div className="frame-draw" onPointerDown={startDraw} aria-hidden="true" />}
      <div className="frames" data-veiled={veiled || undefined}>
        <div className="frames__world" style={world}>
          {frames.map((f) => (
            <FrameView
              key={f.id}
              frame={f}
              zoom={camera.z}
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
      </div>
    </>
  )
}

function FrameView({
  frame,
  zoom,
  selected,
  dropping,
  lift,
  onSelect,
  onChange,
  registerEngine,
}: {
  frame: Frame
  zoom: number
  selected: boolean
  dropping: boolean
  lift: boolean
  onSelect(): void
  onChange(patch: Partial<Frame>): void
  registerEngine(id: string, engine: LazuliInstance | null): void
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [engine, setEngine] = useState<LazuliInstance | null>(null)
  const filled = !!frame.config || !!frame.image
  const config = frame.config ?? DEFAULT

  // One engine per filled frame; created when the frame gets a look or an image.
  useEffect(() => {
    if (!host) return
    const e = createLazuli(host, live(config, lift))
    setEngine(e)
    registerEngine(frame.id, e)
    return () => {
      e.destroy()
      setEngine(null)
      registerEngine(frame.id, null)
    }
    // Later config changes go through set() below.
  }, [host, frame.id, registerEngine])

  useEffect(() => {
    engine?.set(live(config, lift))
  }, [engine, config, lift])

  useEffect(() => {
    if (!engine) return
    if (!frame.image) return engine.setImage(null)
    let current = true
    const img = new Image()
    img.onload = () => current && engine.setImage(img)
    img.src = frame.image
    return () => {
      current = false
    }
  }, [engine, frame.image])

  // Drag the frame by its body or its name; resize from the corners. Screen deltas ÷ zoom.
  const drag = (e: ReactPointerEvent, corner?: Corner) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelect()
    const start = { x: e.clientX, y: e.clientY }
    const from = { x: frame.x, y: frame.y, w: frame.w, h: frame.h }
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) / zoom, dy = (ev.clientY - start.y) / zoom
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
        {filled && <div className="frame__pattern" ref={setHost} />}
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

const DEFAULT = resolveConfig({})

function live(c: Config, lift: boolean): Config {
  return lift ? { ...c, motion: { ...c.motion, reducedMotion: 'ignore' } } : c
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
