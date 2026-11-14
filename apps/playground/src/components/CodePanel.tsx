import type { Stack } from 'lazuli-bg'
import { useRef, useState, type ReactNode } from 'react'
import { CheckIcon, CopyIcon } from '../icons'
import { CodeEditor } from './CodeEditor'

interface CodePanelProps {
  stack: Stack
  /** A valid edit in the code: the stack it describes. */
  onApply(next: Stack): void
  /** The selected layer's settings, shown in the Properties tab. */
  properties: ReactNode
}

/** The code workspace's left pane: the canvas as editable code, and the selected layer's Properties. */
export function CodePanel({ stack, onApply, properties }: CodePanelProps) {
  const [tab, setTab] = useState<'code' | 'props'>('code')
  const [copied, setCopied] = useState(false)
  const text = useRef<() => string>(() => '')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text.current())
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard blocked: the text can still be selected in the editor.
    }
  }

  return (
    <aside className="code-panel" aria-label="Code">
      <div className="code-panel__intro">
        <h2 className="code-panel__title">Code</h2>
        <p className="code-panel__sub">The shader behind your canvas.</p>
      </div>
      <div className="code-panel__tabs">
        <div className="tabs-pill" role="tablist" aria-label="Code panel">
          <button type="button" role="tab" aria-selected={tab === 'code'} onClick={() => setTab('code')}>
            Code
          </button>
          <button type="button" role="tab" aria-selected={tab === 'props'} onClick={() => setTab('props')}>
            Properties
          </button>
        </div>
        <span className="code-panel__file">canvas.glsl</span>
      </div>
      {/* Kept mounted so undo history and the cursor survive a trip to Properties. */}
      <div className="code-panel__body" hidden={tab !== 'code'}>
        <CodeEditor stack={stack} onApply={onApply} textRef={text} />
      </div>
      {tab === 'props' && <div className="code-panel__props">{properties}</div>}
      <div className="code-panel__foot">
        <span>Updates live · ⌥ drag a number to scrub</span>
        {tab === 'code' && (
          <button type="button" className="code-panel__copy" onClick={copy}>
            {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </aside>
  )
}
