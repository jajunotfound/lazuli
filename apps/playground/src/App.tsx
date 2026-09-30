import * as Tooltip from '@radix-ui/react-tooltip'
import { createLazuli, presetConfig, randomSeed, resolveConfig, type LazuliInstance, type PresetId } from 'lazuli-bg'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CodeDialog } from './components/CodeDialog'
import { Frames, readImage, type Frame } from './components/Frames'
import { PresetsPanel } from './components/PresetsPanel'
import { CursorPanel, MotionPanel, SchemaPanel } from './components/panels'
import { Toolbar, type ToolbarItem } from './components/Toolbar'
import { AboutButton, WelcomeCard } from './components/Welcome'
import { BackgroundIcon, CodeIcon, ColorsIcon, CursorIcon, FrameIcon, HideIcon, MotionIcon, PresetsIcon, ShapesIcon, ShowIcon, ShuffleIcon, TextureIcon } from './icons'
import { hasSeenWelcome, markWelcomeSeen, readUrlState, sectionDefaults, writeUrlState, type Config, type PanelId, type Patch, type SectionId } from './state'
import { useMediaQuery } from './useMediaQuery'

export function App() {
  const [initial] = useState(readUrlState)
  const [config, setConfig] = useState<Config>(initial.config)
  // The preset the current look started from: the base for Reset and for the URL.
  const [preset, setPreset] = useState<PresetId | null>(initial.preset)
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null)
  const [codeOpen, setCodeOpen] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(() => !hasSeenWelcome())
  const [controlsHidden, setControlsHidden] = useState(false)
  const [shuffleFlash, setShuffleFlash] = useState(false)
  // Reduced-motion users get a near-still background until they pick a speed themselves.
  const [speedTouched, setSpeedTouched] = useState(false)

  const compact = useMediaQuery('(max-width: 640px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const coarse = useMediaQuery('(pointer: coarse)')

  // ---- frames ------------------------------------------------------------
  const [frames, setFrames] = useState<Frame[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [frameTool, setFrameTool] = useState(false)
  const frameEngines = useRef(new Map<string, LazuliInstance>())
  const frameCount = useRef(0)
  const frame = frames.find((f) => f.id === selectedId) ?? null
  // While a frame is selected, the dock edits that frame; otherwise the background.
  const target = frame ? (frame.config ?? blankFrameConfig(frame)) : config
  const targetPreset = frame ? (frame.preset ?? null) : preset

  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const engine = useRef<LazuliInstance | null>(null)
  const initialConfig = useRef(config)

  // ---- engine ------------------------------------------------------------
  // Created once per stage element; later updates go through set() below.
  useEffect(() => {
    if (!stage) return
    engine.current = createLazuli(stage, initialConfig.current)
    return () => {
      engine.current?.destroy()
      engine.current = null
    }
  }, [stage])

  // The reduced-motion lift is the playground's own; it never reaches the exported config.
  useEffect(() => {
    engine.current?.set({ ...config, motion: { ...config.motion, reducedMotion: speedTouched ? 'ignore' : config.motion.reducedMotion } })
  }, [config, speedTouched, stage])

  // ---- URL ---------------------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => writeUrlState(config, preset), 200)
    return () => clearTimeout(t)
  }, [config, preset])

  // ---- actions -----------------------------------------------------------
  const updateFrame = useCallback((id: string, patch: Partial<Frame>) => {
    setFrames((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }, [])
  const setFrameConfig = useCallback((id: string, next: (c: Config, f: Frame) => Config) => {
    setFrames((fs) => fs.map((f) => (f.id === id ? { ...f, config: next(f.config ?? blankFrameConfig(f), f) } : f)))
  }, [])

  const set = useCallback(
    (patch: Patch) => {
      if (selectedId) return setFrameConfig(selectedId, (c) => resolveConfig(patch, c))
      if (patch.motion?.speed !== undefined) setSpeedTouched(true)
      setConfig((c) => resolveConfig(patch, c))
    },
    [selectedId, setFrameConfig],
  )

  const pickPreset = useCallback(
    (id: PresetId) => {
      if (selectedId) {
        updateFrame(selectedId, { preset: id })
        return setFrameConfig(selectedId, (_, f) => overImage(presetConfig(id), f))
      }
      setPreset(id)
      setConfig(presetConfig(id))
    },
    [selectedId, updateFrame, setFrameConfig],
  )

  const shuffle = useCallback(() => {
    if (selectedId) setFrameConfig(selectedId, (c) => resolveConfig({ seed: randomSeed() }, c))
    else setConfig((c) => resolveConfig({ seed: randomSeed() }, c))
    setShuffleFlash(true)
  }, [selectedId, setFrameConfig])

  const addFrame = useCallback((box: Pick<Frame, 'x' | 'y' | 'w' | 'h'>, image?: string) => {
    const f: Frame = { id: `frame-${++frameCount.current}`, name: `Frame ${frameCount.current}`, ...box, image }
    setFrames((fs) => [...fs, f])
    setSelectedId(f.id)
    setFrameTool(false)
  }, [])

  // An image goes into the frame it was dropped on, or becomes a new frame sized to the image.
  const placeImage = useCallback(
    (id: string | null, src: string, at: { x: number; y: number; w: number; h: number }) => {
      if (id) {
        updateFrame(id, { image: src })
        setFrames((fs) => fs.map((f) => (f.id === id && f.config ? { ...f, config: overImage(f.config, f) } : f)))
        setSelectedId(id)
        return
      }
      const k = Math.min(1, 480 / at.w, 360 / at.h)
      const w = Math.round(at.w * k), h = Math.round(at.h * k)
      addFrame({ x: at.x - w / 2, y: at.y - h / 2, w, h }, src)
    },
    [updateFrame, addFrame],
  )

  const removeFrame = useCallback((id: string) => {
    setFrames((fs) => fs.filter((f) => f.id !== id))
    setSelectedId(null)
  }, [])

  const registerEngine = useCallback((id: string, e: LazuliInstance | null) => {
    if (e) frameEngines.current.set(id, e)
    else frameEngines.current.delete(id)
  }, [])

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

  useEffect(() => {
    if (!shuffleFlash) return
    const t = setTimeout(() => setShuffleFlash(false), 160)
    return () => clearTimeout(t)
  }, [shuffleFlash])

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
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      const t = e.target as HTMLElement
      if (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      if (e.key === 'Escape' && welcomeOpen && !openPanel && !codeOpen) {
        closeWelcome()
        return
      }
      if (codeOpen) return
      if (e.key === 'Escape' && !openPanel && (frameTool || selectedId)) {
        if (frameTool) setFrameTool(false)
        else setSelectedId(null)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !openPanel) {
        removeFrame(selectedId)
        return
      }
      const key = e.key.toLowerCase()
      if (key === 'f') setFrameTool((t) => !t)
      else if (key === 'r') shuffle()
      else if (key === 'h') toggleControls()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [welcomeOpen, openPanel, codeOpen, closeWelcome, shuffle, toggleControls, frameTool, selectedId, removeFrame])

  // ---- toolbar -----------------------------------------------------------
  const base = targetPreset ? presetConfig(targetPreset) : undefined
  const panelProps = (id: SectionId) => ({ config: target, set, compact, reset: () => set(sectionDefaults(id, base)) })

  const groups: ToolbarItem[][] = useMemo(
    () => [
      [
        { kind: 'action', id: 'shuffle', label: 'Shuffle', icon: ShuffleIcon, onClick: shuffle, shortcut: 'R', flash: shuffleFlash },
        { kind: 'action', id: 'frame', label: 'Frame', icon: FrameIcon, onClick: () => setFrameTool((t) => !t), shortcut: 'F', pressed: frameTool },
      ],
      [
        { kind: 'panel', id: 'presets', label: 'Presets', icon: PresetsIcon, content: <PresetsPanel config={target} preset={targetPreset} onPick={pickPreset} /> },
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
    [target, targetPreset, set, pickPreset, shuffle, shuffleFlash, compact, coarse, toggleControls, frameTool],
  )

  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={200}>
      <div
        className="stage"
        ref={setStage}
        onPointerDown={() => {
          if (welcomeOpen) closeWelcome()
          setSelectedId(null)
        }}
        role="img"
        aria-label="Interactive gradient background preview"
      />

      <Frames
        frames={frames}
        selected={selectedId}
        drawing={frameTool}
        onDraw={addFrame}
        onSelect={setSelectedId}
        onChange={updateFrame}
        onImage={placeImage}
        registerEngine={registerEngine}
      />

      <Toolbar
        groups={groups}
        open={openPanel}
        setOpen={setOpenPanel}
        compact={compact}
        magnify={!reducedMotion && !coarse}
        hidden={controlsHidden}
        canvas={stage}
      />

      {controlsHidden && (
        <button type="button" className="show-controls" onClick={toggleControls} aria-label="Show controls" aria-keyshortcuts="H">
          <ShowIcon width={16} height={16} />
        </button>
      )}

      {welcomeOpen ? <WelcomeCard config={config} onClose={closeWelcome} /> : <AboutButton onClick={() => setWelcomeOpen(true)} />}

      <CodeDialog
        open={codeOpen}
        onOpenChange={setCodeOpen}
        config={target}
        engine={frame ? { current: frameEngines.current.get(frame.id) ?? null } : engine}
      />
    </Tooltip.Provider>
  )
}

// A frame with no look yet starts from the defaults; over an image, the background goes transparent
// so the pattern sits on the picture.
function blankFrameConfig(f: Frame): Config {
  return overImage(resolveConfig({}), f)
}
function overImage(c: Config, f: Frame): Config {
  return f.image ? resolveConfig({ background: { type: 'transparent' } }, c) : c
}
