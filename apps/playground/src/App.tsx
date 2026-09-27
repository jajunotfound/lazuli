import * as Tooltip from '@radix-ui/react-tooltip'
import { createLazuli, randomSeed, type LazuliInstance } from 'lazuli-bg'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CodeDialog } from './components/CodeDialog'
import { ColorsPanel, CursorPanel, MotionPanel, ShapesPanel, TexturePanel } from './components/panels'
import { Toolbar, type ToolbarItem } from './components/Toolbar'
import { AboutButton, WelcomeCard } from './components/Welcome'
import { CodeIcon, ColorsIcon, CursorIcon, HideIcon, MotionIcon, ShapesIcon, ShowIcon, ShuffleIcon, TextureIcon } from './icons'
import { hasSeenWelcome, markWelcomeSeen, readUrlParams, sectionDefaults, writeUrlParams, type PanelId, type Params } from './state'
import { useMediaQuery } from './useMediaQuery'

export function App() {
  const [params, setParams] = useState<Params>(readUrlParams)
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
  const initialParams = useRef(params)

  // ---- engine ------------------------------------------------------------
  // Created once per stage element; later updates go through set() below.
  useEffect(() => {
    if (!stage) return
    engine.current = createLazuli(stage, initialParams.current)
    return () => {
      engine.current?.destroy()
      engine.current = null
    }
  }, [stage])

  useEffect(() => {
    engine.current?.set({ ...params, respectReducedMotion: !speedTouched })
  }, [params, speedTouched, stage])

  // ---- URL ---------------------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => writeUrlParams(params), 200)
    return () => clearTimeout(t)
  }, [params])

  // ---- actions -----------------------------------------------------------
  const set = useCallback((patch: Partial<Params>) => {
    if ('speed' in patch) setSpeedTouched(true)
    setParams((p) => ({ ...p, ...patch }))
  }, [])

  const shuffle = useCallback(() => {
    setParams((p) => ({ ...p, seed: randomSeed() }))
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
  const panelProps = (id: PanelId) => ({ params, set, reset: () => set(sectionDefaults(id)) })

  const groups: ToolbarItem[][] = useMemo(
    () => [
      [{ kind: 'action', id: 'shuffle', label: 'Shuffle', icon: ShuffleIcon, onClick: shuffle, shortcut: 'R', flash: shuffleFlash }],
      [
        { kind: 'panel', id: 'colors', label: 'Colors', icon: ColorsIcon, content: <ColorsPanel {...panelProps('colors')} compact={compact} /> },
        { kind: 'panel', id: 'shapes', label: 'Shapes', icon: ShapesIcon, content: <ShapesPanel {...panelProps('shapes')} /> },
        { kind: 'panel', id: 'texture', label: 'Texture', icon: TextureIcon, content: <TexturePanel {...panelProps('texture')} /> },
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
    // panelProps closes over params and set, both listed.
    [params, set, shuffle, shuffleFlash, compact, coarse, toggleControls],
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

      {welcomeOpen ? <WelcomeCard params={params} onClose={closeWelcome} /> : <AboutButton onClick={() => setWelcomeOpen(true)} />}

      <CodeDialog open={codeOpen} onOpenChange={setCodeOpen} params={params} />
    </Tooltip.Provider>
  )
}
