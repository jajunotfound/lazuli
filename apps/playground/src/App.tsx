import * as Tooltip from '@radix-ui/react-tooltip'
import { PRESETS, presetConfig, randomSeed, resolveConfig, type LazuliInstance, type PresetId } from 'lazuli-bg'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CodeDialog } from './components/CodeDialog'
import { Entrance } from './components/Entrance'
import { FramePanel } from './components/FramePanel'
import { Frames, readImage, toWorld, type Camera, type Frame } from './components/Frames'
import type { Mood } from './components/Mascot'
import { PresetsPanel } from './components/PresetsPanel'
import { CursorPanel, MotionPanel, SchemaPanel } from './components/panels'
import { Toolbar, type ToolbarItem } from './components/Toolbar'
import { AboutButton, WelcomeCard } from './components/Welcome'
import { BackgroundIcon, CodeIcon, ColorsIcon, CursorIcon, FrameIcon, HideIcon, MotionIcon, PresetsIcon, SelectIcon, ShapesIcon, ShowIcon, TextureIcon } from './icons'
import {
  hasSeenWelcome,
  markMet,
  markWelcomeSeen,
  readUrlState,
  sectionDefaults,
  shouldMeet,
  writeUrlState,
  type Config,
  type PanelId,
  type Patch,
  type SectionId,
} from './state'
import { useMediaQuery } from './useMediaQuery'

// The page is a canvas of frames (Figma-style). It opens with one frame holding the look from the
// URL (or the default Lazuli). The dock on the left edits the active frame's look; the panel on
// the right edits the selected frame itself.
export function App() {
  const [initial] = useState(readUrlState)
  const [frames, setFrames] = useState<Frame[]>(() => [{ id: 'frame-1', name: initial.preset ? presetLabel(initial.preset) : 'Lazuli', ...firstBox(), config: initial.config, preset: initial.preset ?? undefined }])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The frame the dock edits: the selected one, else the last one selected.
  const [activeId, setActiveId] = useState('frame-1')
  const [tool, setTool] = useState<'select' | 'frame'>('select')
  const frameCount = useRef(1)
  const frameEngines = useRef(new Map<string, LazuliInstance>())

  const [workspace, setWorkspace] = useState<HTMLDivElement | null>(null)
  // Pan and zoom over the canvas, Figma-style.
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 1 })
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  const [panning, setPanning] = useState(false)
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null)
  const [codeOpen, setCodeOpen] = useState(false)
  const [meeting, setMeeting] = useState(shouldMeet)
  const [revealed, setRevealed] = useState(() => !meeting)
  const [welcomeOpen, setWelcomeOpen] = useState(() => !hasSeenWelcome())
  const [controlsHidden, setControlsHidden] = useState(false)
  // Reduced-motion users get a near-still pattern until they pick a speed themselves.
  const [speedTouched, setSpeedTouched] = useState(false)

  const compact = useMediaQuery('(max-width: 640px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const coarse = useMediaQuery('(pointer: coarse)')

  const active = frames.find((f) => f.id === activeId) ?? frames[0]
  const selected = frames.find((f) => f.id === selectedId) ?? null
  const config = active?.config ?? DEFAULT
  const preset = active?.preset ?? null

  // ---- Lazuli's mood (the corner mascot) ---------------------------------
  const [mood, setMoodState] = useState<Mood>('look')
  const moodTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const setMood = useCallback((m: Mood | null, ms = 0) => {
    clearTimeout(moodTimer.current)
    setMoodState(m ?? 'look')
    if (m && ms) moodTimer.current = setTimeout(() => setMoodState('look'), ms)
  }, [])
  // Nodding off after a minute without input; the next move startles it awake.
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

  // ---- URL: the active frame's look ---------------------------------------
  useEffect(() => {
    if (!active?.config) return
    const t = setTimeout(() => writeUrlState(active.config!, active.preset ?? null), 200)
    return () => clearTimeout(t)
  }, [active])

  // ---- frames ------------------------------------------------------------
  const updateFrame = useCallback((id: string, patch: Partial<Frame>) => {
    setFrames((fs) =>
      fs.map((f) => {
        if (f.id !== id) return f
        const next = { ...f, ...patch }
        // Over an image, the pattern's background goes transparent so it sits on the picture.
        return next
      }),
    )
  }, [])
  const setFrameConfig = useCallback((id: string, next: (c: Config, f: Frame) => Config) => {
    setFrames((fs) => fs.map((f) => (f.id === id ? { ...f, config: next(f.config ?? DEFAULT, f) } : f)))
  }, [])

  const select = useCallback((id: string | null) => {
    setSelectedId(id)
    if (id) setActiveId(id)
  }, [])

  const addFrame = useCallback(
    (box: Pick<Frame, 'x' | 'y' | 'w' | 'h'>, extra: Partial<Frame> = {}) => {
      const n = ++frameCount.current
      const f: Frame = { id: `frame-${n}`, name: `Frame ${n}`, ...box, ...extra }
      setFrames((fs) => [...fs, f])
      select(f.id)
      setTool('select')
    },
    [select],
  )

  // An image goes into the frame it was dropped on, or becomes a new frame sized to the image.
  const placeImage = useCallback(
    (id: string | null, src: string, at: { x: number; y: number; w: number; h: number }) => {
      if (id) {
        updateFrame(id, { image: src })
        select(id)
        return
      }
      const k = Math.min(1, 480 / at.w, 360 / at.h)
      const w = Math.round(at.w * k), h = Math.round(at.h * k)
      addFrame({ x: at.x - w / 2, y: at.y - h / 2, w, h }, { image: src })
    },
    [updateFrame, select, addFrame],
  )

  const removeFrame = useCallback((id: string) => {
    setFrames((fs) => {
      const rest = fs.filter((f) => f.id !== id)
      if (rest.length) setActiveId((a) => (a === id ? rest[rest.length - 1].id : a))
      return rest
    })
    setSelectedId(null)
  }, [])

  const duplicateFrame = useCallback(
    (id: string) => {
      const f = frames.find((x) => x.id === id)
      if (f) addFrame({ x: f.x + 32, y: f.y + 32, w: f.w, h: f.h }, { image: f.image, config: f.config, preset: f.preset, name: `${f.name} copy` })
    },
    [frames, addFrame],
  )

  const registerEngine = useCallback((id: string, e: LazuliInstance | null) => {
    if (e) frameEngines.current.set(id, e)
    else frameEngines.current.delete(id)
  }, [])
  const engine = useMemo(() => ({ get current() { return frameEngines.current.get(activeId) ?? null } }), [activeId])

  // Paste an image: into the selected frame, or a new frame in the middle of the screen.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (!file) return
      e.preventDefault()
      const at = toWorld(cameraRef.current, innerWidth / 2, innerHeight / 2)
      readImage(file).then(({ src, w, h }) => placeImage(selectedId, src, { ...at, w, h }))
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [selectedId, placeImage])

  // ---- camera: pinch / ⌘-scroll zooms, scroll pans, space-drag or middle-drag pans -----
  useEffect(() => {
    if (!workspace) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.target instanceof Node) || !workspace.contains(e.target)) return
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) setCamera((c) => zoomAt(c, Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY))
      else setCamera((c) => ({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY }))
    }
    let space = false
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault()
        space = true
        setPanning(true)
      }
      const mod = e.metaKey || e.ctrlKey
      const mid = { x: innerWidth / 2, y: innerHeight / 2 }
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        setCamera((c) => zoomAt(c, 1.25, mid.x, mid.y))
      } else if (mod && e.key === '-') {
        e.preventDefault()
        setCamera((c) => zoomAt(c, 0.8, mid.x, mid.y))
      } else if (mod && e.key === '0') {
        e.preventDefault()
        setCamera((c) => zoomAt(c, 1 / c.z, mid.x, mid.y))
      } else if (e.shiftKey && e.code === 'Digit1') {
        setCamera(fitCamera(framesRef.current))
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        space = false
        setPanning(false)
      }
    }
    const onDown = (e: PointerEvent) => {
      if (!(space || e.button === 1)) return
      e.preventDefault()
      e.stopPropagation()
      let last = { x: e.clientX, y: e.clientY }
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - last.x, dy = ev.clientY - last.y
        last = { x: ev.clientX, y: ev.clientY }
        setCamera((c) => ({ ...c, x: c.x + dx, y: c.y + dy }))
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    workspace.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      workspace.removeEventListener('pointerdown', onDown, true)
    }
  }, [workspace])
  const framesRef = useRef(frames)
  framesRef.current = frames

  // ---- look actions (the dock) -------------------------------------------
  const set = useCallback(
    (patch: Patch) => {
      if (patch.motion?.speed !== undefined) setSpeedTouched(true)
      setFrameConfig(activeId, (c) => resolveConfig(patch, c))
    },
    [activeId, setFrameConfig],
  )

  const pickPreset = useCallback(
    (id: PresetId) => {
      setFrames((fs) =>
        fs.map((f) =>
          f.id === activeId
            ? { ...f, preset: id, config: presetConfig(id), name: isDefaultName(f) ? presetLabel(id) : f.name }
            : f,
        ),
      )
    },
    [activeId],
  )

  const shuffle = useCallback(() => {
    setFrameConfig(activeId, (c) => resolveConfig({ seed: randomSeed() }, c))
    setMood('surprised', 1100)
  }, [activeId, setFrameConfig, setMood])

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
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || meeting) return
      const t = e.target as HTMLElement
      if (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      if (e.key === 'Escape' && welcomeOpen && !openPanel && !codeOpen) {
        closeWelcome()
        return
      }
      if (codeOpen) return
      if (e.key === 'Escape' && !openPanel && (tool === 'frame' || selectedId)) {
        if (tool === 'frame') setTool('select')
        else setSelectedId(null)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !openPanel) {
        removeFrame(selectedId)
        return
      }
      const key = e.key.toLowerCase()
      if (key === 'v') setTool('select')
      else if (key === 'f') setTool((x) => (x === 'frame' ? 'select' : 'frame'))
      else if (key === 'r') shuffle()
      else if (key === 'h') toggleControls()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [meeting, welcomeOpen, openPanel, codeOpen, closeWelcome, shuffle, toggleControls, tool, selectedId, removeFrame])

  // ---- toolbar -----------------------------------------------------------
  const base = preset ? presetConfig(preset) : undefined
  const panelProps = (id: SectionId) => ({ config, set, compact, reset: () => set(sectionDefaults(id, base)) })

  const groups: ToolbarItem[][] = useMemo(
    () => [
      [
        { kind: 'action', id: 'select', label: 'Select', icon: SelectIcon, onClick: () => setTool('select'), shortcut: 'V', pressed: tool === 'select' },
        { kind: 'action', id: 'frame', label: 'Frame', icon: FrameIcon, onClick: () => setTool((x) => (x === 'frame' ? 'select' : 'frame')), shortcut: 'F', pressed: tool === 'frame' },
      ],
      [
        { kind: 'panel', id: 'presets', label: 'Presets', icon: PresetsIcon, content: <PresetsPanel config={config} preset={preset} onPick={pickPreset} /> },
        { kind: 'panel', id: 'colors', label: 'Colors', icon: ColorsIcon, content: <SchemaPanel id="colors" {...panelProps('colors')} /> },
        { kind: 'panel', id: 'shapes', label: 'Shapes', icon: ShapesIcon, content: <SchemaPanel id="shapes" {...panelProps('shapes')} /> },
        { kind: 'panel', id: 'texture', label: 'Texture', icon: TextureIcon, content: <SchemaPanel id="texture" {...panelProps('texture')} /> },
        { kind: 'panel', id: 'background', label: 'Background', icon: BackgroundIcon, content: <SchemaPanel id="background" {...panelProps('background')} /> },
      ],
      [
        { kind: 'panel', id: 'motion', label: 'Motion', icon: MotionIcon, content: <MotionPanel {...panelProps('motion')} /> },
        {
          kind: 'panel',
          id: 'cursor',
          label: 'Cursor',
          icon: CursorIcon,
          keepOpenOnCanvas: true,
          content: <CursorPanel {...panelProps('cursor')} touch={coarse} />,
        },
      ],
      [
        { kind: 'action', id: 'code', label: 'Get code', icon: CodeIcon, onClick: () => setCodeOpen(true) },
        { kind: 'action', id: 'hide', label: 'Hide controls', icon: HideIcon, onClick: toggleControls, shortcut: 'H' },
      ],
    ],
    // panelProps closes over config, set and compact, all listed.
    [config, preset, set, pickPreset, compact, coarse, toggleControls, tool],
  )

  // Where the entrance sinks: the first frame.
  const [meetTarget] = useState(() => frames[0])

  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={200}>
      <div className="workspace" ref={setWorkspace} data-panning={panning || undefined}>
      <div
        className="canvas"
        style={{
          backgroundSize: `${dotStep(camera.z)}px ${dotStep(camera.z)}px`,
          backgroundPosition: `${camera.x}px ${camera.y}px`,
        }}
        onPointerDown={() => {
          if (welcomeOpen && !meeting) closeWelcome()
          setSelectedId(null)
        }}
        aria-hidden="true"
      />

      <Frames
        frames={frames}
        selected={selectedId}
        drawing={tool === 'frame'}
        veiled={!revealed}
        liftReducedMotion={speedTouched}
        onDraw={addFrame}
        camera={camera}
        onSelect={(id) => {
          if (welcomeOpen && !meeting) closeWelcome()
          select(id)
        }}
        onChange={updateFrame}
        onImage={placeImage}
        registerEngine={registerEngine}
      />
      </div>

      <Toolbar
        groups={groups}
        open={openPanel}
        setOpen={setOpenPanel}
        compact={compact}
        magnify={!reducedMotion && !coarse}
        hidden={controlsHidden || meeting}
        canvas={workspace}
      />

      {selected && !controlsHidden && (
        <FramePanel
          key={selected.id}
          frame={selected}
          config={selected.config ?? DEFAULT}
          onChange={(patch) => updateFrame(selected.id, patch)}
          onPreset={pickPreset}
          onDuplicate={() => duplicateFrame(selected.id)}
          onDelete={() => removeFrame(selected.id)}
          onCode={() => setCodeOpen(true)}
        />
      )}

      {controlsHidden && (
        <button type="button" className="show-controls" onClick={toggleControls} aria-label="Show controls" aria-keyshortcuts="H">
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

      {!meeting && !controlsHidden && (
        <div className="zoom" role="group" aria-label="Zoom">
          <button type="button" onClick={() => setCamera((c) => zoomAt(c, 0.8, innerWidth / 2, innerHeight / 2))} aria-label="Zoom out" aria-keyshortcuts="Meta+-">
            −
          </button>
          <button type="button" className="zoom__value" onClick={() => setCamera(fitCamera(frames))} title="Zoom to fit · ⇧1">
            {Math.round(camera.z * 100)}%
          </button>
          <button type="button" onClick={() => setCamera((c) => zoomAt(c, 1.25, innerWidth / 2, innerHeight / 2))} aria-label="Zoom in" aria-keyshortcuts="Meta+=">
            +
          </button>
        </div>
      )}

      <CodeDialog open={codeOpen} onOpenChange={setCodeOpen} config={config} engine={engine} onMood={setMood} />
    </Tooltip.Provider>
  )
}

// The first frame: 16:9, centered in the space between the dock and the frame panel.
function firstBox() {
  const vw = innerWidth, vh = innerHeight
  const left = vw > 900 ? 130 : 24, right = vw > 900 ? vw - 300 : vw - 24
  // About 60% of the free space: room around it to draw more frames.
  const w = Math.round(Math.max(240, Math.min((right - left) * 0.62, (vh - 240) * (16 / 9) * 0.75, 820)))
  const h = Math.round((w * 9) / 16)
  return { x: Math.round(left + (right - left - w) / 2), y: Math.round((vh - h) / 2), w, h }
}

function presetLabel(id: PresetId): string {
  return PRESETS[id].label
}

function isDefaultName(f: Frame): boolean {
  return /^Frame \d+$/.test(f.name) || (!!f.preset && f.name === presetLabel(f.preset)) || f.name === 'Lazuli'
}

// A frame with no look of its own (empty, or just an image) uses the defaults.
const DEFAULT = resolveConfig({})

// Canvas dots: 20px apart at 100%, doubling when zoomed out so they never turn into a haze.
function dotStep(z: number): number {
  let step = 20 * z
  while (step < 10) step *= 2
  return step
}

const clampZoom = (z: number) => Math.min(8, Math.max(0.1, z))

/** Zoom by factor k keeping the screen point (sx, sy) still. */
function zoomAt(c: Camera, k: number, sx: number, sy: number): Camera {
  const z = clampZoom(c.z * k)
  const f = z / c.z
  return { z, x: sx - (sx - c.x) * f, y: sy - (sy - c.y) * f }
}

/** Fit every frame in the space between the dock and the frame panel. */
function fitCamera(frames: Frame[]): Camera {
  if (!frames.length) return { x: 0, y: 0, z: 1 }
  const x0 = Math.min(...frames.map((f) => f.x)), y0 = Math.min(...frames.map((f) => f.y))
  const x1 = Math.max(...frames.map((f) => f.x + f.w)), y1 = Math.max(...frames.map((f) => f.y + f.h))
  const left = innerWidth > 900 ? 150 : 24, right = innerWidth > 900 ? innerWidth - 320 : innerWidth - 24
  const top = 72, bottom = innerHeight - 96
  const z = clampZoom(Math.min(1, (right - left) / (x1 - x0), (bottom - top) / (y1 - y0)))
  return { z, x: (left + right) / 2 - ((x0 + x1) / 2) * z, y: (top + bottom) / 2 - ((y0 + y1) / 2) * z }
}
