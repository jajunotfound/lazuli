import type { Mood } from './Mascot'
import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useMemo, useRef, useState } from 'react'
import { elementSnippet, glslFile, htmlFile, shadertoyFile } from '../exportCode'
import { CheckIcon, CloseIcon, CopyIcon } from '../icons'
import type { Stack } from 'lazuli-bg'
import { Segmented } from './Segmented'

// Two jobs: put it on a website, or take the shader. Each has one quieter extra
// (a standalone HTML file; the Shadertoy wrapper) instead of tabs of its own.
const TABS = [{ label: 'Website' }, { label: 'Shader' }] as const
type Tab = (typeof TABS)[number]['label']

interface CodeDialogProps {
  open: boolean
  onOpenChange(open: boolean): void
  stack: Stack
  /** Lazuli reacts: happy when the code is copied. */
  onMood?(mood: Mood | null, ms?: number): void
}

export function CodeDialog({ open, onOpenChange, stack, onMood }: CodeDialogProps) {
  const [tab, setTab] = useState<Tab>('Website')
  const [shadertoy, setShadertoy] = useState(false)
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLPreElement>(null)

  const code = useMemo(() => {
    const text = tab === 'Website' ? elementSnippet(stack) : shadertoy ? shadertoyFile(stack) : glslFile(stack)
    return { shown: text, full: text }
  }, [tab, shadertoy, stack])

  const downloadHtml = () => {
    const url = URL.createObjectURL(new Blob([htmlFile(stack)], { type: 'text/html' }))
    Object.assign(document.createElement('a'), { href: url, download: 'lazuli.html' }).click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  useEffect(() => setCopied(false), [tab, shadertoy])

  const copy = async () => {
    if (await copyText(code.full)) {
      setCopied(true)
      onMood?.('happy', 1800)
    }
    else if (codeRef.current) selectContents(codeRef.current) // let the user press ⌘C / Ctrl+C
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="code-dialog">
          <div className="code-dialog__head">
            <div>
              <Dialog.Title className="code-dialog__title">Export</Dialog.Title>
              <Dialog.Description className="visually-hidden">Copy the code for this canvas.</Dialog.Description>
            </div>
            <Dialog.Close className="code-dialog__close" aria-label="Close">
              <CloseIcon width={12} height={12} />
            </Dialog.Close>
          </div>
          <Segmented<Tab> label="Export format" className="segmented--tabs" options={TABS} value={tab} onChange={setTab} />
          <div className="code-block">
            <pre ref={codeRef} tabIndex={0} aria-label={`${tab} code`}>
              <code>{code.shown}</code>
            </pre>
          </div>
          <div className="code-dialog__actions">
            {tab === 'Website' ? (
              <button type="button" className="button-quiet" onClick={downloadHtml}>
                Download HTML
              </button>
            ) : (
              <label className="code-dialog__toggle">
                <input type="checkbox" checked={shadertoy} onChange={(e) => setShadertoy(e.target.checked)} />
                Shadertoy
              </label>
            )}
            <button type="button" className="copy-button" onClick={copy} data-copied={copied || undefined}>
              {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
              <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API blocked (insecure context, permissions): try the legacy path.
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
  document.body.append(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok
}

function selectContents(el: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
  el.focus()
}
