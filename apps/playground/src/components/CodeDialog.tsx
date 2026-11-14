import type { Mood } from './Mascot'
import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useMemo, useRef, useState } from 'react'
import { elementSnippet, htmlFile, jsSnippet } from '../exportCode'
import { CheckIcon, CloseIcon, CopyIcon } from '../icons'
import type { Config } from '../state'
import { Segmented } from './Segmented'

const TABS = [{ label: 'HTML file' }, { label: 'Web component' }, { label: 'JavaScript' }] as const
type Tab = (typeof TABS)[number]['label']

const DESCRIPTIONS: Record<Tab, string> = {
  'HTML file': 'A standalone file you can drop into any website or embed.',
  'Web component': 'Install the package, then use the element anywhere.',
  JavaScript: 'Install the package and create the background from code.',
}

interface CodeDialogProps {
  open: boolean
  onOpenChange(open: boolean): void
  config: Config
  /** Lazuli reacts: happy when the code is copied. */
  onMood?(mood: Mood | null, ms?: number): void
}

export function CodeDialog({ open, onOpenChange, config, onMood }: CodeDialogProps) {
  const [tab, setTab] = useState<Tab>('HTML file')
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLPreElement>(null)

  const code = useMemo(() => {
    if (tab === 'HTML file') return { shown: htmlFile(config, true), full: htmlFile(config) }
    if (tab === 'Web component') return { shown: elementSnippet(config), full: elementSnippet(config) }
    return { shown: jsSnippet(config), full: jsSnippet(config) }
  }, [tab, config])

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
              <Dialog.Title className="code-dialog__title">Get code</Dialog.Title>
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
