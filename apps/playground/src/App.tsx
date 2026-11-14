import * as Tooltip from '@radix-ui/react-tooltip'
import { createLazuli, presetConfig, randomSeed, resolveConfig, type LazuliInstance, type PresetId } from 'lazuli-bg'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CodeDialog } from './components/CodeDialog'
import { Entrance } from './components/Entrance'
import type { Mood } from './components/Mascot'
import { PresetsPanel } from './components/PresetsPanel'
import { CursorPanel, MotionPanel, SchemaPanel } from './components/panels'
import { Toolbar, type ToolbarItem } from './components/Toolbar'
import { AboutButton, WelcomeCard } from './components/Welcome'
import { BackgroundIcon, CodeIcon, ColorsIcon, CursorIcon, HideIcon, MotionIcon, PresetsIcon, ShapesIcon, ShowIcon, TextureIcon } from './icons'
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

// One shader, one full-screen preview. The toolbar edits it; Get code exports it.
export function App() {
  const [initial] = useState(readUrlState)
  const [config, setConfig] = useState<Config>(initial.config)
  const [preset, setPreset] = useState<PresetId | null>(initial.preset)

  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const engine = useRef<LazuliInstance | null>(null)
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

  // ---- engine ------------------------------------------------------------
  const live = useCallback(
    (c: Config): Config => (speedTouched ? { ...c, motion: { ...c.motion, reducedMotion: 'ignore' } } : c),
    [speedTouched],
  )
  const liveRef = useRef(live)
  liveRef.current = live
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    if (!stage) return
    const e = createLazuli(stage, liveRef.current(configRef.current))
    engine.current = e
    return () => {
      e.destroy()
      engine.current = null
    }
  }, [stage])

  useEffect(() => {
    engine.current?.set(live(config))
  }, [config, live])

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

  // ---- URL ---------------------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => writeUrlState(config, preset), 200)
    return () => clearTimeout(t)
  }, [config, preset])

  // ---- look actions ------------------------------------------------------
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
    setMood('surprised', 1100)
  }, [setMood])

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
      const key = e.key.toLowerCase()
      if (key === 'r') shuffle()
      else if (key === 'h') toggleControls()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [meeting, welcomeOpen, openPanel, codeOpen, closeWelcome, shuffle, toggleControls])

  // ---- toolbar -----------------------------------------------------------
  const base = preset ? presetConfig(preset) : undefined
  const panelProps = (id: SectionId) => ({ config, set, compact, reset: () => set(sectionDefaults(id, base)) })

  const groups: ToolbarItem[][] = useMemo(
    () => [
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
    [config, preset, set, pickPreset, compact, coarse, toggleControls],
  )

  // Where the entrance sinks: the middle of the screen, measured once.
  const [meetTarget] = useState(() => ({ x: 0, y: 0, w: innerWidth, h: innerHeight }))

  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={200}>
      <div
        className="stage"
        ref={setStage}
        data-veiled={!revealed || undefined}
        onPointerDown={() => {
          if (welcomeOpen && !meeting) closeWelcome()
        }}
        aria-hidden="true"
      />

      <Toolbar
        groups={groups}
        open={openPanel}
        setOpen={setOpenPanel}
        compact={compact}
        magnify={!reducedMotion && !coarse}
        hidden={controlsHidden || meeting}
        canvas={stage}
      />

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

      <CodeDialog open={codeOpen} onOpenChange={setCodeOpen} config={config} onMood={setMood} />
    </Tooltip.Provider>
  )
}
