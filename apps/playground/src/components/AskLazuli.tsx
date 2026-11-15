import type { Stack } from 'lazuli-bg'
import { useEffect, useRef, useState } from 'react'
import { ask, type AgentResult } from '../agent/agent'
import { AgentError, isReady, loadSettings, modelFor, PROVIDERS, providerInfo, saveSettings, type AgentSettings, type ProviderId } from '../agent/providers'
import { LazuliIcon } from '../icons'

interface AskLazuliProps {
  stack: Stack
  /** Put a stack on the canvas (one undo step). */
  onApply(next: Stack, tag: string): void
}

const START = ['A pencil sketch of melting blobs', 'Liquid chrome, slowly drifting', 'A glowing flower on dark']
const EDIT = ['Draw it in pencil', 'Warmer colors', 'Make it breathe']

type Status = { kind: 'idle' } | { kind: 'working'; lines: number } | { kind: 'error'; message: string; fix?: 'settings' }

/**
 * Ask Lazuli: describe a look and the agent builds it as layers you can keep working on. Lives on
 * the dock; opens by itself on an empty canvas.
 */
export function AskLazuli({ stack, onApply }: AskLazuliProps) {
  const [settings, setSettings] = useState<AgentSettings>(loadSettings)
  const [view, setView] = useState<'ask' | 'settings'>(() => (isReady(loadSettings()) ? 'ask' : 'settings'))
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [result, setResult] = useState<(AgentResult & { before: Stack; kept: boolean }) | null>(null)
  const [showCode, setShowCode] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const empty = stack.shapes.length === 0

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    if (view === 'ask') input.current?.focus()
  }, [view])

  const update = (s: AgentSettings) => {
    setSettings(s)
    saveSettings(s)
  }

  const go = async (prompt: string) => {
    const p = prompt.trim()
    if (!p || status.kind === 'working') return
    if (!isReady(settings)) return setView('settings')
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setStatus({ kind: 'working', lines: 0 })
    setResult(null)
    setShowCode(false)
    const before = stack
    try {
      const r = await ask(settings, before, p, { signal: ctl.signal, onText: (soFar) => setStatus({ kind: 'working', lines: soFar.split('\n').length }) })
      onApply(r.stack, 'agent')
      setResult({ ...r, before, kept: false })
      setText('')
      setStatus({ kind: 'idle' })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return setStatus({ kind: 'idle' })
      const err = e instanceof AgentError ? e : new AgentError('Something went wrong. Try again.')
      setStatus({ kind: 'error', message: err.message, fix: err.kind === 'key' ? 'settings' : undefined })
    }
  }

  const stop = () => {
    abort.current?.abort()
    setStatus({ kind: 'idle' })
  }

  const head = (
    <div className="ask__head">
      <span className="ask__face" aria-hidden="true">
        <LazuliIcon width={18} height={18} />
      </span>
      <h2 className="ask__title">Lazuli</h2>
      <button type="button" className="ask__link" onClick={() => setView(view === 'ask' ? 'settings' : 'ask')} aria-pressed={view === 'settings'}>
        {view === 'ask' ? 'Model' : 'Done'}
      </button>
    </div>
  )

  if (view === 'settings') {
    const info = providerInfo(settings.provider)
    return (
      <div className="panel ask">
        {head}
        <p className="ask__hello">{isReady(settings) ? 'Which model Lazuli thinks with.' : 'Lazuli needs a model to think with. A free Gemini key works well.'}</p>
        <div className="ask__providers" role="radiogroup" aria-label="Model">
          {PROVIDERS.map((p) => (
            <label key={p.id} className="ask__provider">
              <input type="radio" name="ask-provider" checked={settings.provider === p.id} onChange={() => update({ ...settings, provider: p.id as ProviderId })} />
              {p.name}
            </label>
          ))}
        </div>
        {info.needsKey && (
          <>
            <label className="ask__field">
              <span>Key</span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste it here"
                value={settings.keys[settings.provider] ?? ''}
                onChange={(e) => update({ ...settings, keys: { ...settings.keys, [settings.provider]: e.target.value } })}
              />
            </label>
            <p className="ask__note">
              Kept on this device only.{' '}
              {info.keyHelp && (
                <a href={info.keyHelp.href} target="_blank" rel="noreferrer">
                  {info.keyHelp.label}
                </a>
              )}
              {settings.keys[settings.provider] && (
                <>
                  {' · '}
                  <button type="button" className="ask__link" onClick={() => update({ ...settings, keys: { ...settings.keys, [settings.provider]: '' } })}>
                    Forget it
                  </button>
                </>
              )}
            </p>
          </>
        )}
        {settings.provider !== 'lazuli' && (
          <label className="ask__field">
            <span>Model</span>
            <input spellCheck={false} placeholder={info.defaultModel} value={settings.models[settings.provider] ?? ''} onChange={(e) => update({ ...settings, models: { ...settings.models, [settings.provider]: e.target.value } })} />
          </label>
        )}
        <button type="button" className="button-primary ask__done" disabled={!isReady(settings)} onClick={() => setView('ask')}>
          {isReady(settings) ? 'Back to asking' : 'Add a key to start'}
        </button>
      </div>
    )
  }

  const working = status.kind === 'working'
  return (
    <div className="panel ask">
      {head}
      <p className="ask__hello">{empty ? 'What should we make?' : 'What should change?'}</p>
      <form
        className="ask__form"
        onSubmit={(e) => {
          e.preventDefault()
          go(text)
        }}
      >
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={empty ? 'A pencil sketch, liquid chrome…' : 'Warmer, slower, in pencil…'} aria-label="Describe a look" disabled={working} />
        {working ? (
          <button type="button" className="button-quiet" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="button-primary" disabled={!text.trim()}>
            Make it
          </button>
        )}
      </form>
      {!working && !result && (
        <div className="ask__chips">
          {(empty ? START : EDIT).map((c) => (
            <button key={c} type="button" onClick={() => go(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      <div aria-live="polite">
        {working && (
          <p className="ask__status">
            <span className="ask__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {status.lines > 2 ? `Writing it… ${status.lines} lines` : 'Thinking it through'}
          </p>
        )}
        {status.kind === 'error' && (
          <p className="ask__error">
            {status.message}{' '}
            {status.fix === 'settings' && (
              <button type="button" className="ask__link" onClick={() => setView('settings')}>
                Open settings
              </button>
            )}
          </p>
        )}
        {result && !working && (
          <div className="ask__result">
            <p className="ask__made">{result.title}</p>
            {result.kept ? (
              <p className="ask__note">Kept. It’s ordinary layers now: drag, slide or ask for more.</p>
            ) : (
              <div className="ask__actions">
                <button type="button" className="button-primary" onClick={() => setResult({ ...result, kept: true })}>
                  Keep
                </button>
                <button
                  type="button"
                  className="button-quiet"
                  onClick={() => {
                    onApply(result.before, 'agent-undo')
                    setResult(null)
                  }}
                >
                  Undo
                </button>
                <button type="button" className="ask__link" aria-expanded={showCode} onClick={() => setShowCode(!showCode)}>
                  {showCode ? 'Hide code' : 'Show code'}
                </button>
              </div>
            )}
            {showCode && <pre className="ask__code">{result.code}</pre>}
          </div>
        )}
      </div>
      <p className="ask__foot">{providerInfo(settings.provider).name}{settings.provider !== 'lazuli' ? ` · ${modelFor(settings)}` : ''}</p>
    </div>
  )
}
