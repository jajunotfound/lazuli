import * as Tooltip from '@radix-ui/react-tooltip'
import { PRESETS, presetConfig, randomSeed, resolveConfig, type LazuliInstance, type PresetId } from 'lazuli-bg'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CodeDialog } from './components/CodeDialog'
import { Entrance } from './components/Entrance'
import { FramePanel } from './components/FramePanel'
import { Frames, readImage, type Frame } from './components/Frames'
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
  const config = active?.config ?? blankConfig(active)
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
        if ('image' in patch && next.config) next.config = patch.image ? overImage(next.config) : next.config
        return next
      }),
    )
  }, [])
  const setFrameConfig = useCallback((id: string, next: (c: Config, f: Frame) => Config) => {
    setFrames((fs) => fs.map((f) => (f.id === id ? { ...f, config: next(f.config ?? blankConfig(f), f) } : f)))
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
      readImage(file).then(({ src, w, h }) => placeImage(selectedId, src, { x: innerWidth / 2, y: innerHeight / 2, w, h }))
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [selectedId, placeImage])

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
            ? { ...f, preset: id, config: f.image ? overImage(presetConfig(id)) : presetConfig(id), name: isDefaultName(f) ? presetLabel(id) : f.name }
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
      <div className="workspace" ref={setWorkspace}>
      <div
        className="canvas"
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
          onChange={(patch) => updateFrame(selected.id, patch)}
          onAddPattern={() => setFrameConfig(selected.id, (c) => c)}
          onRemovePattern={() => updateFrame(selected.id, { config: undefined, preset: undefined })}
          onShuffle={shuffle}
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

// A frame with no look yet starts from the defaults (transparent over an image).
function blankConfig(f?: Frame): Config {
  const c = resolveConfig({})
  return f?.image ? overImage(c) : c
}

function overImage(c: Config): Config {
  return resolveConfig({ background: { type: 'transparent' } }, c)
}
