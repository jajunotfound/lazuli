import { animateStack, hasKeys, type DrawnLayer, type LazuliInstance, type Stack } from 'lazuli-bg'
import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react'

interface TimelineProps {
  stack: Stack
  selected: string
  engine: MutableRefObject<LazuliInstance | null>
  /** The stack as the engine should draw it (reduced-motion tweaks). */
  live(s: Stack): Stack
  /** Where the playhead is (0–1 of the loop); App reads it to key edits at that moment. */
  time: MutableRefObject<number>
  playing: MutableRefObject<boolean>
  /** Replace the keyframes (one undo step). */
  onKeys(keys: Stack['keys']): void
  /** Told when playback starts or stops. */
  onPlaying?(playing: boolean): void
}

const LOOP_S = 6

/**
 * The loop under the canvas. Play runs the keyframes; dragging the bar scrubs (and pauses);
 * ◆ keys the selected shape as it is now at the playhead. While paused, editing a keyed shape
 * updates its key at the playhead.
 */
export function Timeline({ stack, selected, engine, live, time, playing, onKeys, onPlaying }: TimelineProps) {
  const [isPlaying, setPlaying] = useState(true)
  const head = useRef<HTMLSpanElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const stackRef = useRef(stack)
  stackRef.current = stack
  const liveRef = useRef(live)
  liveRef.current = live
  playing.current = isPlaying
  useEffect(() => onPlaying?.(isPlaying), [isPlaying, onPlaying])

  const loop = stack.motion.loop > 0 ? stack.motion.loop : LOOP_S
  const sel = stack.shapes.find((x): x is DrawnLayer => x.id === selected && x.kind === 'drawn')
  const keys = (sel && stack.keys?.[sel.id]) || []

  const show = (t: number) => {
    if (head.current) head.current.style.left = `${t * 100}%`
    const s = stackRef.current
    if (hasKeys(s)) engine.current?.setStack(liveRef.current(animateStack(s, t)))
  }

  // The clock: only while playing, and only does work when something has keyframes.
  useEffect(() => {
    if (!isPlaying) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      time.current = (time.current + (now - last) / 1000 / loop) % 1
      last = now
      show(time.current)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // show reads refs; the clock restarts only on play/pause and loop length.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, loop])

  // Paused: redraw the moment when the stack changes (an edit, an undo).
  useEffect(() => {
    if (!isPlaying) show(time.current)
  })

  const scrubTo = (e: { clientX: number }) => {
    const r = track.current!.getBoundingClientRect()
    time.current = Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width))
    show(time.current)
  }
  const onDown = (e: ReactPointerEvent) => {
    setPlaying(false)
    track.current!.setPointerCapture(e.pointerId)
    scrubTo(e)
  }

  const atKey = keys.find((k) => Math.abs(k.t - time.current) < 0.02)
  const toggleKey = () => {
    if (!sel) return
    const all = { ...(stack.keys ?? {}) }
    if (atKey) all[sel.id] = keys.filter((k) => k !== atKey)
    else all[sel.id] = [...keys, { t: time.current, geom: sel.geom, melt: sel.melt, soft: sel.soft }].sort((a, b) => a.t - b.t)
    if (!all[sel.id].length) delete all[sel.id]
    onKeys(all)
  }

  return (
    <div className="timeline">
      <button type="button" className="icon-action" onClick={() => setPlaying((p) => !p)} aria-label={isPlaying ? 'Pause' : 'Play'} title={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="3" height="10" rx="1" fill="currentColor" /><rect x="9" y="3" width="3" height="10" rx="1" fill="currentColor" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7.5-4.5L5 3.5Z" fill="currentColor" /></svg>
        )}
      </button>
      <span className="timeline__t">0s</span>
      <div className="timeline__track" ref={track} onPointerDown={onDown} onPointerMove={(e) => e.buttons === 1 && scrubTo(e)} role="slider" aria-label="Playhead" aria-valuemin={0} aria-valuemax={loop} aria-valuenow={Math.round(time.current * loop * 10) / 10}>
        <span className="timeline__line" />
        {keys.map((k, i) => (
          <span key={i} className="timeline__key" style={{ left: `${k.t * 100}%` }} title={`${(k.t * loop).toFixed(1)} s`} />
        ))}
        <span className="timeline__head" ref={head} />
      </div>
      <span className="timeline__t">Loop {loop}s</span>
      <button type="button" className="timeline__add" onClick={toggleKey} disabled={!sel} title={sel ? (atKey ? 'Remove this keyframe' : `Key ${sel.name} here`) : 'Select a drawn shape to key it'}>
        {atKey ? 'Remove key' : '◆ Key'}
      </button>
    </div>
  )
}
