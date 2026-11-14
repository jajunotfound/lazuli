import * as Tooltip from '@radix-ui/react-tooltip'
import { createLazuli, layoutFromSeed, type LazuliInstance } from 'lazuli-bg'
import { useEffect, useRef, type CSSProperties } from 'react'
import { CloseIcon } from '../icons'
import { Mascot, type Mood } from './Mascot'
import type { Config } from '../state'

export const GITHUB_URL = 'https://github.com/jajunotfound/lazuli'
const AUTHOR_URL = 'https://elisha.ma'
const PREVIEW_ZOOM = 2.4

export function WelcomeCard({ config, onClose }: { config: Config; onClose(): void }) {
  return (
    <>
      {/* Dim layer: clicking the canvas area closes the card. */}
      <div className="welcome-dim" onPointerDown={onClose} aria-hidden="true" />
      <section className="welcome" aria-labelledby="welcome-title">
        <div className="welcome__card welcome__intro">
          <div className="welcome__head">
            <span className="welcome__mark" aria-hidden="true" />
            <h1 className="welcome__name" id="welcome-title">
              Lazuli
            </h1>
            <button type="button" className="icon-button welcome__close" onClick={onClose} aria-label="Close welcome card">
              <CloseIcon width={14} height={14} />
            </button>
          </div>
          <p className="welcome__text">
            Draw soft, living shaders. Take the code anywhere.{' '}
            <span className="welcome__links">
              <a href={AUTHOR_URL} target="_blank" rel="noreferrer">
                Made by jaju
              </a>
              <span aria-hidden="true"> · </span>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                View on GitHub
              </a>
            </span>
          </p>
        </div>
        <div className="welcome__card welcome__preview-card">
          <Preview config={config} />
        </div>
      </section>
    </>
  )
}

/** A second, live engine instance inside the squircle, mirroring current settings. */
function Preview({ config }: { config: Config }) {
  const ref = useRef<HTMLDivElement>(null)
  const engine = useRef<LazuliInstance | null>(null)
  const initialConfig = useRef(config)

  // Created once; later changes flow through set() below.
  useEffect(() => {
    engine.current = createLazuli(ref.current!, initialConfig.current)
    return () => {
      engine.current?.destroy()
      engine.current = null
    }
  }, [])

  useEffect(() => {
    engine.current?.set(config)
  }, [config])

  // Paper frames the preview as a close-up of the shapes, not the whole scene: render
  // into a larger stage and center the main mass (between anchor and companion) in the squircle.
  const [anchor, companion] = layoutFromSeed(config.seed)
  const cx = (anchor.x * 2 + companion.x) / 3
  const cy = 1 - (anchor.y * 2 + companion.y) / 3 // layout y points up
  const clamp = (v: number) => Math.min(0, Math.max(1 - PREVIEW_ZOOM, v))
  const stage: CSSProperties = {
    width: `${PREVIEW_ZOOM * 100}%`,
    height: `${PREVIEW_ZOOM * 100}%`,
    left: `${clamp(0.5 - cx * PREVIEW_ZOOM) * 100}%`,
    top: `${clamp(0.5 - cy * PREVIEW_ZOOM) * 100}%`,
  }

  return (
    <div className="welcome__preview">
      <div className="welcome__preview-stage" ref={ref} style={stage} />
      <p className="welcome__caption">Move over it.</p>
    </div>
  )
}

// Lazuli lives in the corner: it is the About button, and it reacts to what you do.
export function AboutButton({ onClick, mood, reduced }: { onClick(): void; mood: Mood; reduced: boolean }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button type="button" className="about-button" onClick={onClick} aria-label="About Lazuli">
          <Mascot size={40} mood={mood} reduced={reduced} />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" side="left" sideOffset={8}>
          About Lazuli
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
