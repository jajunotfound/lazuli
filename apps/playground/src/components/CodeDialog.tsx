import type { Mood } from './Mascot'
import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useMemo, useRef, useState } from 'react'
import { elementSnippet, glslFile, htmlFile, jsSnippet, shadertoyFile } from '../exportCode'
import { CheckIcon, CloseIcon, CopyIcon } from '../icons'
import type { Stack } from 'lazuli-bg'
import { Segmented } from './Segmented'

const TABS = [{ label: 'HTML file' }, { label: 'Web component' }, { label: 'JavaScript' }, { label: 'GLSL' }, { label: 'Shadertoy' }] as const
type Tab = (typeof TABS)[number]['label']

const DESCRIPTIONS: Record<Tab, string> = {
  'HTML file': 'One file, no dependencies. Open it anywhere.',
  'Web component': 'Drop it into any site with one tag.',
  JavaScript: 'For apps that set things up in code.',
  GLSL: 'The raw shader, ready for your own renderer.',
  Shadertoy: 'Paste it into a new Shadertoy.',
}

interface CodeDialogProps {
  open: boolean
  onOpenChange(open: boolean): void
  stack: Stack
  /** Lazuli reacts: happy when the code is copied. */
  onMood?(mood: Mood | null, ms?: number): void
}

export function CodeDialog({ open, onOpenChange, stack, onMood }: CodeDialogProps) {
  const [tab, setTab] = useState<Tab>('HTML file')
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLPreElement>(null)

  const code = useMemo(() => {
    const text = tab === 'HTML file' ? htmlFile(stack) : tab === 'Web component' ? elementSnippet(stack) : tab === 'JavaScript' ? jsSnippet(stack) : tab === 'GLSL' ? glslFile(stack) : shadertoyFile(stack)
    return { shown: text, full: text }
  }, [tab, stack])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  useEffect(() => setCopied(false), [tab])

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
              <Dialog.Description className="code-dialog__desc">{DESCRIPTIONS[tab]}</Dialog.Description>
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
          <button type="button" className="copy-button" onClick={copy} data-copied={copied || undefined}>
            {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
            <span aria-live="polite">{copied ? 'Copied' : 'Copy code'}</span>
          </button>
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
