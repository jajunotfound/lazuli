import * as Tooltip from '@radix-ui/react-tooltip'
import { createLazuli, type LazuliInstance } from 'lazuli-bg'
import { useEffect, useRef } from 'react'
import { CloseIcon, InfoIcon } from '../icons'
import type { Params } from '../state'

export const GITHUB_URL = 'https://github.com/REPLACE_ME/lazuli'
const AUTHOR_URL = 'https://elisha.ma'

export function WelcomeCard({ params, onClose }: { params: Params; onClose(): void }) {
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
            Generate soft, interactive shader backgrounds, then export the code.{' '}
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
          <Preview params={params} />
        </div>
      </section>
    </>
  )
}

/** A second, live engine instance inside the squircle, mirroring current settings. */
function Preview({ params }: { params: Params }) {
  const ref = useRef<HTMLDivElement>(null)
  const engine = useRef<LazuliInstance | null>(null)
  const initialParams = useRef(params)

  // Created once; later changes flow through set() below.
  useEffect(() => {
    engine.current = createLazuli(ref.current!, initialParams.current)
    return () => {
      engine.current?.destroy()
      engine.current = null
    }
  }, [])

  useEffect(() => {
    engine.current?.set(params)
  }, [params])

  return (
    <div className="welcome__preview" ref={ref}>
      <p className="welcome__caption">Hover or tap to see it react.</p>
    </div>
  )
}

export function AboutButton({ onClick }: { onClick(): void }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button type="button" className="about-button" onClick={onClick} aria-label="About Lazuli">
          <InfoIcon width={16} height={16} />
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
