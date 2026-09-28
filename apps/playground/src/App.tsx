import * as Tooltip from '@radix-ui/react-tooltip'
import { createLazuli, presetConfig, randomSeed, resolveConfig, type LazuliInstance, type PresetId } from 'lazuli-bg'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CodeDialog } from './components/CodeDialog'
import { PresetsPanel } from './components/PresetsPanel'
import { CursorPanel, MotionPanel, SchemaPanel } from './components/panels'
import { Toolbar, type ToolbarItem } from './components/Toolbar'
import { AboutButton, WelcomeCard } from './components/Welcome'
import { BackgroundIcon, CodeIcon, ColorsIcon, CursorIcon, HideIcon, MotionIcon, PresetsIcon, ShapesIcon, ShowIcon, ShuffleIcon, TextureIcon } from './icons'
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
  const set = useCallback((patch: Patch) => {
    if (patch.motion?.speed !== undefined) setSpeedTouched(true)
    setConfig((c) => resolveConfig(patch, c))
  }, [])

  const pickPreset = useCallback((id: PresetId) => {
    setPreset(id)
    setConfig(presetConfig(id))
  }, [])

  const shuffle = useCallback(() => {
    setConfig((c) => resolveConfig({ seed: randomSeed() }, c))
    setShuffleFlash(true)
  }, [])

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
      const key = e.key.toLowerCase()
      if (key === 'r') shuffle()
      else if (key === 'h') toggleControls()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [welcomeOpen, openPanel, codeOpen, closeWelcome, shuffle, toggleControls])

  // ---- toolbar -----------------------------------------------------------
  const base = preset ? presetConfig(preset) : undefined
  const panelProps = (id: SectionId) => ({ config, set, compact, reset: () => set(sectionDefaults(id, base)) })

  const groups: ToolbarItem[][] = useMemo(
    () => [
      [{ kind: 'action', id: 'shuffle', label: 'Shuffle', icon: ShuffleIcon, onClick: shuffle, shortcut: 'R', flash: shuffleFlash }],
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
    [config, preset, set, pickPreset, shuffle, shuffleFlash, compact, coarse, toggleControls],
  )

  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={200}>
      <div
        className="stage"
        ref={setStage}
        onPointerDown={() => welcomeOpen && closeWelcome()}
        role="img"
        aria-label="Interactive gradient background preview"
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

      <CodeDialog open={codeOpen} onOpenChange={setCodeOpen} config={config} engine={engine} />
    </Tooltip.Provider>
  )
}
