import * as Tooltip from '@radix-ui/react-tooltip'
import { applyOp, createLazuli, findLayer, presetStack, stackToConfig, type LazuliInput, type LazuliInstance, type PresetId, type Stack, type StackOp } from 'lazuli-bg'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CanvasEditor, type DrawTool } from './components/CanvasEditor'
import { CodeDialog } from './components/CodeDialog'
import { Entrance } from './components/Entrance'
import { Inspector } from './components/Inspector'
import { Layers } from './components/Layers'
import type { Mood } from './components/Mascot'
import { PresetGrid } from './components/PresetsPanel'
import { Toolbar, type ToolbarItem } from './components/Toolbar'
import { AboutButton, WelcomeCard } from './components/Welcome'
import { BackgroundIcon, CodeIcon, ColorsIcon, EllipseIcon, HideIcon, LayersIcon, MotionIcon, MoveIcon, PenIcon, PresetsIcon, RectIcon, ShapesIcon, ShowIcon, TextureIcon } from './icons'
import { moved } from './geom'
import { patchLayer, SCENE_ID } from './layerEdit'
import { hasSeenWelcome, markMet, markWelcomeSeen, readUrlStack, shouldMeet, writeUrlStack, type PanelId } from './state'
import { useMediaQuery } from './useMediaQuery'

type FrameSize = 'wide' | 'square' | 'phone' | 'fill'
/** Frame shapes to preview in: what the shader will fill on a page. Fill is the whole window. */
const SIZES: Record<FrameSize, { label: string; ratio: number }> = {
  wide: { label: '16:9', ratio: 16 / 9 },
  square: { label: 'Square', ratio: 1 },
  phone: { label: 'Phone', ratio: 9 / 19.5 },
  fill: { label: 'Fill', ratio: 16 / 9 },
}

interface History {
  past: Stack[]
  present: Stack
  future: Stack[]
  /** Edits with the same tag in quick succession (a slider drag) are one undo step. */
  tag: string | null
  at: number
}

const MERGE_MS = 600
const MAX_UNDO = 100

// One shader built from a layer stack: layers on the left, the selected layer on the right,
// the live preview filling the screen behind both.
export function App() {
  const [initial] = useState(readUrlStack)
  const [hist, setHist] = useState<History>(() => ({ past: [], present: initial.stack, future: [], tag: null, at: 0 }))
  const stack = hist.present
  const [preset, setPreset] = useState<PresetId | null>(initial.preset)
  const [selected, setSelected] = useState<string>(() => initial.stack.shapes[0].id)

  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const engine = useRef<LazuliInstance | null>(null)
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null)
  const [tool, setTool] = useState<DrawTool>('move')
  const [size, setSize] = useState<FrameSize>('wide')
  const [codeOpen, setCodeOpen] = useState(false)
  const [meeting, setMeeting] = useState(shouldMeet)
  const [revealed, setRevealed] = useState(() => !meeting)
  const [welcomeOpen, setWelcomeOpen] = useState(() => !hasSeenWelcome())
  const [controlsHidden, setControlsHidden] = useState(false)
  // Reduced-motion users get a near-still pattern until they pick a speed themselves.
  const [speedTouched, setSpeedTouched] = useState(false)

  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const compact = useMediaQuery('(max-width: 640px)')
  const coarse = useMediaQuery('(pointer: coarse)')
  const config = useMemo(() => stackToConfig(stack), [stack])

  // ---- history -----------------------------------------------------------
  const commit = useCallback((next: Stack, tag: string | null = null) => {
    setHist((h) => {
      const now = performance.now()
      const merge = tag !== null && tag === h.tag && now - h.at < MERGE_MS
      return { past: merge ? h.past : [...h.past, h.present].slice(-MAX_UNDO), present: next, future: [], tag, at: now }
    })
  }, [])
  const undo = useCallback(() => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], tag: null, at: 0 } : h)), [])
  const redo = useCallback(() => setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), tag: null, at: 0 } : h)), [])

  // Keep the selection on a layer that exists (undo can remove it).
  useEffect(() => {
    if (selected === SCENE_ID) return
    const ids = new Set([stack.color.id, stack.background.id, stack.cursor?.id, ...stack.textures.map((t) => t.id), ...stack.shapes.flatMap((s) => [s.id, ...s.warps.map((w) => w.id)])])
    if (!ids.has(selected)) setSelected(stack.shapes[0].id)
  }, [stack, selected])

  // ---- engine ------------------------------------------------------------
  const live = useCallback((s: Stack): Stack => (speedTouched ? { ...s, motion: { ...s.motion, reducedMotion: 'ignore' } } : s), [speedTouched])
  const liveRef = useRef(live)
  liveRef.current = live
  const stackRef = useRef(stack)
  stackRef.current = stack

  useEffect(() => {
    if (!stage) return
    const e = createLazuli(stage, stackToConfig(stackRef.current))
    e.setStack(liveRef.current(stackRef.current))
    engine.current = e
    return () => {
      e.destroy()
      engine.current = null
    }
  }, [stage])

  useEffect(() => {
    engine.current?.setStack(live(stack))
  }, [stack, live])

  useEffect(() => {
    const t = setTimeout(() => writeUrlStack(stack, preset), 250)
    return () => clearTimeout(t)
  }, [stack, preset])

  // ---- Lazuli's mood (the corner mascot) ---------------------------------
  const [mood, setMoodState] = useState<Mood>('look')
  const moodTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const setMood = useCallback((m: Mood | null, ms = 0) => {
    clearTimeout(moodTimer.current)
    setMoodState(m ?? 'look')
    if (m && ms) moodTimer.current = setTimeout(() => setMoodState('look'), ms)
  }, [])
  useEffect(() => {
    let sleepy = false
    let t = setTimeout(() => ((sleepy = true), setMood('sleepy')), 60_000)
    const wake = () => {
      clearTimeout(t)
      if (sleepy) {
        sleepy = false
        setMood('surprised', 1100)
      }
      t = setTimeout(() => ((sleepy = true), setMood('sleepy')), 60_000)
    }
    window.addEventListener('pointermove', wake)
    window.addEventListener('keydown', wake)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [setMood])

  // ---- editing -----------------------------------------------------------
  const canDo = useCallback((op: StackOp) => applyOp(stack, op).ok, [stack])

  const onOp = useCallback(
    (op: StackOp, tag?: string) => {
      const r = applyOp(stack, op)
      if (!r.ok) {
        setMood('oops', 1600)
        return
      }
      commit(r.stack, tag ?? (op.op === 'tune' ? `tune:${op.id}:${op.strength === undefined ? 'size' : 'strength'}` : null))
      // Select what was just made.
      if (op.op === 'add' || op.op === 'duplicate') {
        const before = new Set(JSON.stringify(stack).match(/"id":"[^"]+"/g))
        const made = JSON.stringify(r.stack).match(/"id":"[^"]+"/g)?.find((m) => !before.has(m))
        if (made) setSelected(made.slice(6, -1))
      }
    },
    [stack, commit, setMood],
  )

  const onPatch = useCallback(
    (patch: LazuliInput) => {
      if (selected === SCENE_ID && patch.motion?.speed !== undefined) setSpeedTouched(true)
      commit(patchLayer(stack, selected, patch), `patch:${selected}:${Object.keys(patch).join()}`)
    },
    [stack, selected, commit],
  )

  const pickPreset = useCallback(
    (id: PresetId) => {
      const next = presetStack(id)
      setPreset(id)
      commit(next)
      setSelected(next.shapes[0].id)
      setOpenPanel(null)
    },
    [commit],
  )

  const shuffle = useCallback(() => {
    const seed = Math.round(Math.random() * 1e8) / 10
    const sel = stack.shapes.find((s) => s.id === selected)
    commit({ ...stack, shapes: stack.shapes.map((s, i) => (!sel || s === sel ? { ...s, seed: seed + i * 7919 } : s)) })
    setMood('surprised', 1100)
  }, [stack, selected, commit, setMood])

  const closeWelcome = useCallback(() => {
    setWelcomeOpen(false)
    markWelcomeSeen()
  }, [])

  const toggleControls = useCallback(() => {
    setOpenPanel(null)
    setControlsHidden((h) => !h)
  }, [])

  // ---- keyboard ----------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || meeting) return
      const t = e.target as HTMLElement
      const typing = t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (e.altKey && !mod && !typing && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        // Move the selected layer up or down within its own group (shapes, textures, warps).
        const place = findLayer(stack, selected)?.place
        if (place && 'index' in place) {
          e.preventDefault()
          const op: StackOp = { op: 'move', id: selected, index: place.index + (e.key === 'ArrowUp' ? -1 : 1) }
          if (canDo(op)) onOp(op)
        }
        return
      }
      if (mod || e.altKey || typing || codeOpen) return
      if (e.key === 'Escape' && welcomeOpen) return closeWelcome()
      if ((e.key === 'Delete' || e.key === 'Backspace') && canDo({ op: 'delete', id: selected })) {
        e.preventDefault()
        return onOp({ op: 'delete', id: selected })
      }
      // Nudge the selected drawn shape: arrows, Shift for bigger steps.
      const sel = stack.shapes.find((x) => x.id === selected)
      if (sel?.kind === 'drawn' && e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 0.05 : 0.005
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowDown' ? -step : e.key === 'ArrowUp' ? step : 0
        return onOp({ op: 'reshape', id: sel.id, geom: moved(sel.geom, dx, dy) }, `nudge:${sel.id}`)
      }
      const key = e.key.toLowerCase()
      if (key === 'r' && e.shiftKey) shuffle()
      else if (key === 'v') setTool('move')
      else if (key === 'p') setTool('pen')
      else if (key === 'o') setTool('ellipse')
      else if (key === 'r') setTool('rect')
      else if (key === 'h') toggleControls()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [meeting, welcomeOpen, codeOpen, closeWelcome, shuffle, toggleControls, undo, redo, canDo, onOp, selected, stack])

  // Where the entrance sinks: the middle of the screen, measured once.
  const [meetTarget] = useState(() => ({ x: 0, y: 0, w: innerWidth, h: innerHeight }))
  const panels = !controlsHidden && !meeting

  // ---- the dock ----------------------------------------------------------
  // Presets and the layer list open beside the dock; the section tools jump straight to that
  // layer in the inspector, like the old panels; Get code and Hide close it out.
  const kindOf = (id: string) => (id === SCENE_ID ? 'scene' : findLayer(stack, id)?.layer.kind)
  const selKind = kindOf(selected)
  const jump = (id: string | undefined, add?: StackOp) => () => {
    if (id) setSelected(id)
    else if (add) onOp(add)
    setOpenPanel(null)
  }
  const groups: ToolbarItem[][] = [
    [
      { kind: 'action', id: 'tool-move', label: 'Move', icon: MoveIcon, shortcut: 'V', pressed: tool === 'move', onClick: () => setTool('move') },
      { kind: 'action', id: 'tool-pen', label: 'Pen', icon: PenIcon, shortcut: 'P', pressed: tool === 'pen', onClick: () => setTool('pen') },
      { kind: 'action', id: 'tool-ellipse', label: 'Ellipse', icon: EllipseIcon, shortcut: 'O', pressed: tool === 'ellipse', onClick: () => setTool('ellipse') },
      { kind: 'action', id: 'tool-rect', label: 'Rectangle', icon: RectIcon, shortcut: 'R', pressed: tool === 'rect', onClick: () => setTool('rect') },
    ],
    [
      { kind: 'panel', id: 'presets', label: 'Presets', icon: PresetsIcon, content: (
        <div className="panel panel--presets">
          <div className="panel__head">
            <h2 className="panel__title">Start from a preset</h2>
          </div>
          <PresetGrid stack={stack} preset={preset} onPick={pickPreset} />
        </div>
      ) },
      { kind: 'panel', id: 'layers', label: 'Layers', icon: LayersIcon, keepOpenOnCanvas: true, content: <Layers stack={stack} selected={selected} onSelect={setSelected} onOp={onOp} canDo={canDo} /> },
    ],
    [
      { kind: 'action', id: 'shape', label: 'Shape', icon: ShapesIcon, pressed: selKind === 'shape' || selKind === 'warp', onClick: jump(stack.shapes.find((x) => x.visible)?.id ?? stack.shapes[0].id) },
      { kind: 'action', id: 'color', label: 'Color', icon: ColorsIcon, pressed: selKind === 'color', onClick: jump(stack.color.id) },
      { kind: 'action', id: 'texture', label: 'Texture', icon: TextureIcon, pressed: selKind === 'texture', onClick: jump(stack.textures[0]?.id, { op: 'add', layer: 'texture', type: 'grain' }) },
      { kind: 'action', id: 'background', label: 'Background', icon: BackgroundIcon, pressed: selKind === 'background', onClick: jump(stack.background.id) },
      { kind: 'action', id: 'motion', label: 'Motion', icon: MotionIcon, pressed: selKind === 'scene', onClick: jump(SCENE_ID) },
    ],
    [
      { kind: 'action', id: 'code', label: 'Get code', icon: CodeIcon, onClick: () => setCodeOpen(true) },
      { kind: 'action', id: 'hide', label: 'Hide controls', icon: HideIcon, onClick: toggleControls, shortcut: 'H' },
    ],
  ]

  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={200}>
      <div
        className="stage"
        data-size={size}
        data-veiled={!revealed || undefined}
        onPointerDown={() => {
          if (welcomeOpen && !meeting) closeWelcome()
        }}
      >
        <div className="stage__fit">
          <div className="frame" ref={setStage} style={{ '--r': SIZES[size].ratio } as CSSProperties}>
            {panels && <CanvasEditor stack={stack} selected={selected} tool={tool} onSelect={setSelected} setTool={setTool} onOp={onOp} />}
          </div>
        </div>
        {panels && (
          <div className="sizes" role="group" aria-label="Frame size">
            {(Object.keys(SIZES) as FrameSize[]).map((k) => (
              <button key={k} type="button" aria-pressed={size === k} onClick={() => setSize(k)}>
                {SIZES[k].label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Toolbar groups={groups} open={openPanel} setOpen={setOpenPanel} compact={compact} magnify={!reducedMotion && !coarse} hidden={!panels} canvas={stage} />

      {panels && <Inspector stack={stack} selected={selected} onPatch={onPatch} onOp={onOp} canDo={canDo} />}

      {controlsHidden && (
        <button type="button" className="show-controls" onClick={toggleControls} aria-label="Show panels" aria-keyshortcuts="H">
          <ShowIcon width={16} height={16} />
        </button>
      )}

      {meeting && (
        <Entrance
          target={meetTarget}
          reduced={reducedMotion}
          onReveal={() => setRevealed(true)}
          onDone={() => {
            setMeeting(false)
            markMet()
          }}
        />
      )}

      {!meeting &&
        (welcomeOpen ? <WelcomeCard config={config} onClose={closeWelcome} /> : <AboutButton onClick={() => setWelcomeOpen(true)} mood={mood} reduced={reducedMotion} />)}

      <CodeDialog open={codeOpen} onOpenChange={setCodeOpen} stack={stack} onMood={setMood} />
    </Tooltip.Provider>
  )
}
