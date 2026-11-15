import * as Tooltip from '@radix-ui/react-tooltip'
import { animateStack, applyOp, createLazuli, findLayer, hasKeys, presetStack, stackToConfig, type LazuliInput, type LazuliInstance, type PresetId, type Stack, type StackOp } from 'lazuli-bg'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CanvasEditor, type DrawTool } from './components/CanvasEditor'
import { CodeDialog } from './components/CodeDialog'
import { CodePanel } from './components/CodePanel'
import { Timeline } from './components/Timeline'
import { Entrance } from './components/Entrance'
import { Inspector } from './components/Inspector'
import { Layers } from './components/Layers'
import type { Mood } from './components/Mascot'
import { ExampleGrid } from './components/ExampleGrid'
import { PresetGrid } from './components/PresetsPanel'
import { exampleStack, type Example } from './examples'
import { Toolbar, type ToolbarItem } from './components/Toolbar'
import { AboutButton, WelcomeCard } from './components/Welcome'
import { EllipseIcon, ExportIcon, HideIcon, LayersIcon, LazuliIcon, MoveIcon, PenIcon, PresetsIcon, RectIcon, ShowIcon } from './icons'
import { AskLazuli } from './components/AskLazuli'
import { Segmented } from './components/Segmented'
import { moved } from './geom'
import { patchLayer, SCENE_ID } from './layerEdit'
import { blankStack, hasSeenWelcome, markMet, markWelcomeSeen, readUrlStack, shouldMeet, writeUrlStack, type PanelId } from './state'
import { useMediaQuery } from './useMediaQuery'

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
  const [selected, setSelected] = useState<string>(() => initial.stack.shapes[0]?.id ?? initial.stack.background.id)

  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  // The workspace: the canvas fills the window, and everything else floats over it (the dock, the
  // stack panel with the selected layer's settings under its row, the timeline).
  const [stackOpen, setStackOpen] = useState(true)
  const [tab, setTab] = useState<'shapes' | 'effects'>('shapes')
  const engine = useRef<LazuliInstance | null>(null)
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null)
  const [tool, setTool] = useState<DrawTool>('move')
  const [editorOpen, setEditorOpen] = useState(false)
  // The timeline's playhead (0–1 of the loop) and whether it's running.
  const timeRef = useRef(0)
  const playingRef = useRef(true)
  const [playing, setPlaying] = useState(true)
  const [codeOpen, setCodeOpen] = useState(false)
  const [meeting, setMeeting] = useState(shouldMeet)
  // Agent first: an empty canvas opens Ask Lazuli once, after the entrance (if any) is done.
  const askedOnLoad = useRef(false)
  useEffect(() => {
    if (meeting || askedOnLoad.current) return
    askedOnLoad.current = true
    if (hist.present.shapes.length === 0) setOpenPanel('ask')
    // Only on the way in: later empties come from New canvas, which opens it itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting])
  const [revealed, setRevealed] = useState(() => !meeting)
  const [welcomeOpen, setWelcomeOpen] = useState(() => !hasSeenWelcome())
  const [controlsHidden, setControlsHidden] = useState(false)
  // Reduced-motion users get a near-still pattern until they pick a speed themselves.
  const [speedTouched, setSpeedTouched] = useState(false)

  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const compact = useMediaQuery('(max-width: 640px)')
  const coarse = useMediaQuery('(pointer: coarse)')
  const config = useMemo(() => stackToConfig(stack), [stack])
  // What the canvas overlay outlines: keyed shapes where they are at the playhead.
  const view = hasKeys(stack) ? animateStack(stack, timeRef.current) : stack

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
    if (!ids.has(selected)) setSelected(stack.shapes[0]?.id ?? stack.background.id)
  }, [stack, selected])

  // ---- engine ------------------------------------------------------------
  // The timeline plays the keyframes here, so the engine gets each moment without them.
  const live = useCallback((s: Stack): Stack => {
    const out = s.keys ? { ...s, keys: undefined } : s
    return speedTouched ? { ...out, motion: { ...out.motion, reducedMotion: 'ignore' } } : out
  }, [speedTouched])
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
    engine.current?.setStack(live(hasKeys(stack) ? animateStack(stack, timeRef.current) : stack))
  }, [stack, live])

  // Shapes and their warps live on the Shapes tab; everything that finishes them on Effects.
  const isShapeLayer = (id: string) => stack.shapes.some((x) => x.id === id || x.warps.some((w) => w.id === id))
  useEffect(() => {
    setTab(isShapeLayer(selected) ? 'shapes' : 'effects')
    // Only when the selection changes (a tab click can show the other side).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])
  const pickTab = (t: 'shapes' | 'effects') => {
    setTab(t)
    if (t === 'shapes' && !isShapeLayer(selected) && stack.shapes[0]) setSelected(stack.shapes[0].id)
    if (t === 'effects' && isShapeLayer(selected)) setSelected(stack.color.id)
  }

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
      let next = r.stack
      // Auto-key: paused on the timeline, an edit to a keyed shape updates its key at the playhead.
      if (op.op === 'reshape' && !playingRef.current && next.keys?.[op.id]?.length) {
        const layer = next.shapes.find((x) => x.id === op.id)
        if (layer?.kind === 'drawn') {
          const t = timeRef.current
          const keys = next.keys[op.id].filter((k) => Math.abs(k.t - t) >= 0.02)
          next = { ...next, keys: { ...next.keys, [op.id]: [...keys, { t, geom: layer.geom, melt: layer.melt, soft: layer.soft }].sort((a, b) => a.t - b.t) } }
        }
      }
      commit(next, tag ?? (op.op === 'tune' ? `tune:${op.id}:${op.strength === undefined ? 'size' : 'strength'}` : null))
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
      setSelected(next.shapes[0]?.id ?? next.background.id)
      setOpenPanel(null)
    },
    [commit],
  )

  const pickExample = useCallback(
    (e: Example) => {
      const next = exampleStack(e)
      setPreset(null)
      commit(next)
      setSelected(next.shapes[0]?.id ?? next.background.id)
      setOpenPanel(null)
    },
    [commit],
  )

  /** Clear everything (preset included) and start from an empty canvas. */
  const newCanvas = useCallback(() => {
    const blank = blankStack()
    setPreset(null)
    commit(blank)
    setSelected(blank.background.id)
    // Agent first: a fresh canvas asks what to make (the drawing tools are right there too).
    setOpenPanel('ask')
    setTool('ellipse')
  }, [commit])

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
      else if (key === 'c') setEditorOpen((o) => !o)
      else if (key === 'h') toggleControls()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [meeting, welcomeOpen, codeOpen, closeWelcome, shuffle, toggleControls, undo, redo, canDo, onOp, selected, stack])

  // Where the entrance sinks: the middle of the screen, measured once.
  const [meetTarget] = useState(() => ({ x: 0, y: 0, w: innerWidth, h: innerHeight }))
  const panels = !controlsHidden && !meeting

  // ---- the dock ----------------------------------------------------------
  // Three groups, by what you're doing: draw, organise, output. Color, background and motion
  // live in the Layers list (and a click on empty canvas selects the background).
  const groups: ToolbarItem[][] = [
    [
      { kind: 'action', id: 'tool-move', label: 'Move', icon: MoveIcon, shortcut: 'V', pressed: tool === 'move', onClick: () => setTool('move') },
      { kind: 'action', id: 'tool-pen', label: 'Pen', icon: PenIcon, shortcut: 'P', pressed: tool === 'pen', onClick: () => setTool('pen') },
      { kind: 'action', id: 'tool-ellipse', label: 'Ellipse', icon: EllipseIcon, shortcut: 'O', pressed: tool === 'ellipse', onClick: () => setTool('ellipse') },
      { kind: 'action', id: 'tool-rect', label: 'Rectangle', icon: RectIcon, shortcut: 'R', pressed: tool === 'rect', onClick: () => setTool('rect') },
    ],
    [
      { kind: 'action', id: 'layers', label: stackOpen ? 'Hide layers' : 'Show layers', icon: LayersIcon, pressed: stackOpen, onClick: () => setStackOpen((o) => !o) },
      { kind: 'panel', id: 'presets', label: 'Presets', icon: PresetsIcon, content: (
        <div className="panel panel--presets">
          <div className="panel__head">
            <h2 className="panel__title">Presets</h2>
            <button type="button" className="panel__new" onClick={newCanvas}>
              New canvas
            </button>
          </div>
          <h3 className="panel__sub">Examples</h3>
          <ExampleGrid onPick={pickExample} />
          <h3 className="panel__sub">Built-in</h3>
          <PresetGrid stack={stack} preset={preset} onPick={pickPreset} />
        </div>
      ) },
    ],
    [
      { kind: 'action', id: 'export', label: 'Export', icon: ExportIcon, onClick: () => setCodeOpen(true) },
      { kind: 'action', id: 'hide', label: 'Hide controls', icon: HideIcon, onClick: toggleControls, shortcut: 'H' },
    ],
    [
      { kind: 'panel', id: 'ask', label: 'Ask Lazuli', icon: LazuliIcon, keepOpenOnCanvas: true, content: <AskLazuli stack={stack} onApply={(next, tag) => commit(next, tag)} /> },
    ],
  ]

  const modes = (
    <div className="modes" role="group" aria-label="View">
      <button type="button" aria-pressed={!editorOpen} onClick={() => setEditorOpen(false)}>
        Canvas
      </button>
      <button type="button" aria-pressed={editorOpen} onClick={() => setEditorOpen(true)} title="Code (C)">
        Code
      </button>
    </div>
  )

  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={200}>
      <div
        className="stage"
        data-editor={(panels && editorOpen) || undefined}
        data-veiled={!revealed || undefined}
        data-panels={panels || undefined}
        onPointerDown={() => {
          if (welcomeOpen && !meeting) closeWelcome()
        }}
      >
        <div className="workspace">
          <div className="workspace__canvas">
            {panels && !editorOpen && modes}
            <div className="stage__area">
              <div className="canvas-col">
                <div className="frame" ref={setStage}>
                  {panels && <CanvasEditor stack={view} moving={playing && hasKeys(stack) ? Object.keys(stack.keys ?? {}) : []} selected={selected} tool={tool} onSelect={setSelected} setTool={setTool} onOp={onOp} />}
                </div>
              </div>
            </div>
            {panels && !editorOpen && (
              <div className="canvas-tools">
                <button type="button" className="canvas-tools__btn" aria-pressed={stack.quality === 'high'} onClick={() => onPatch({ quality: stack.quality === 'high' ? 'auto' : 'high' })} title={stack.quality === 'high' ? 'Full resolution (on)' : 'Full resolution'}>
                  HQ
                </button>
                <button type="button" className="canvas-tools__btn" onClick={toggleControls} aria-label="Just the canvas (H)" title="Just the canvas (H)">
                  <ShowIcon width={14} height={14} />
                </button>
              </div>
            )}
          </div>
          {panels && stackOpen && !editorOpen && (
            <aside className="workspace__panel" aria-label="Stack">
              <Layers
                stack={stack}
                selected={selected}
                onSelect={setSelected}
                onOp={onOp}
                canDo={canDo}
                filter={tab}
                title={<Segmented<'Shapes' | 'Effects'> label="Show" className="segmented--tabs" options={[{ label: 'Shapes' }, { label: 'Effects' }]} value={tab === 'shapes' ? 'Shapes' : 'Effects'} onChange={(v) => pickTab(v === 'Shapes' ? 'shapes' : 'effects')} />}
                inline={(id) => <Inspector inline stack={stack} selected={id} onPatch={onPatch} onOp={onOp} canDo={canDo} onOpenCode={() => setEditorOpen(true)} />}
                onShuffle={shuffle}
              />
            </aside>
          )}
        </div>
        {panels && <Timeline stack={stack} selected={selected} engine={engine} live={live} time={timeRef} playing={playingRef} onKeys={(keys) => commit({ ...stack, keys })} onPlaying={setPlaying} />}
      </div>

      {/* Code mode is a workspace: the dock tucks away, the editor and its Properties take the left. */}
      <Toolbar groups={groups} open={openPanel} setOpen={setOpenPanel} compact={compact} magnify={!reducedMotion && !coarse} hidden={!panels || editorOpen} canvas={stage} />

      {panels && editorOpen && (
        <>
          <CodePanel stack={stack} onApply={(next) => commit(next, 'code-edit')} properties={<Inspector embedded stack={stack} selected={selected} onPatch={onPatch} onOp={onOp} canDo={canDo} />} />
          <div className="code-topbar">
            {modes}
            <button type="button" className="button-primary" onClick={() => setCodeOpen(true)}>
              Export
            </button>
          </div>
        </>
      )}



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
