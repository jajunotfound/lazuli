import * as Dialog from '@radix-ui/react-dialog'
import type { LazuliInstance } from 'lazuli-bg'
import { snapshot } from 'lazuli-bg/capture'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { elementSnippet, htmlFile, jsSnippet } from '../exportCode'
import { CheckIcon, CloseIcon, CopyIcon } from '../icons'
import type { Config } from '../state'
import { Segmented } from './Segmented'

const TABS = [{ label: 'HTML file' }, { label: 'Web component' }, { label: 'JavaScript' }, { label: 'Image' }] as const
type Tab = (typeof TABS)[number]['label']

const DESCRIPTIONS: Record<Tab, string> = {
  'HTML file': 'A standalone file you can drop into any website or embed.',
  'Web component': 'Install the package, then use the element anywhere.',
  JavaScript: 'Install the package and create the background from code.',
  Image: 'A still of the current frame, without the pointer.',
}

const SCALES = [{ label: '1×' }, { label: '2×' }, { label: '3×' }] as const
type Scale = (typeof SCALES)[number]['label']

interface CodeDialogProps {
  open: boolean
  onOpenChange(open: boolean): void
  config: Config
  engine: RefObject<LazuliInstance | null>
}

export function CodeDialog({ open, onOpenChange, config, engine }: CodeDialogProps) {
  const [tab, setTab] = useState<Tab>('HTML file')
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLPreElement>(null)

  const code = useMemo(() => {
    if (tab === 'HTML file') return { shown: htmlFile(config, true), full: htmlFile(config) }
    if (tab === 'Web component') return { shown: elementSnippet(config), full: elementSnippet(config) }
    if (tab === 'JavaScript') return { shown: jsSnippet(config), full: jsSnippet(config) }
    return null
  }, [tab, config])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  useEffect(() => setCopied(false), [tab])

  const copy = async () => {
    if (!code) return
    if (await copyText(code.full)) setCopied(true)
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
          {code ? (
            <>
              <div className="code-block">
                <pre ref={codeRef} tabIndex={0} aria-label={`${tab} code`}>
                  <code>{code.shown}</code>
                </pre>
              </div>
              <button type="button" className="copy-button" onClick={copy} data-copied={copied || undefined}>
                {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
                <span aria-live="polite">{copied ? 'Copied' : 'Copy code'}</span>
              </button>
            </>
          ) : (
            <ImageExport engine={engine} config={config} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ImageExport({ engine, config }: { engine: RefObject<LazuliInstance | null>; config: Config }) {
  const [scale, setScale] = useState<Scale>('2×')
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const factor = Number(scale[0])
  const canvas = engine.current?.canvas
  const w = Math.round((canvas?.clientWidth ?? 0) * factor)
  const h = Math.round((canvas?.clientHeight ?? 0) * factor)

  // A small render of the same frame, so you can see what you'll get.
  useEffect(() => {
    const e = engine.current
    if (!e) return
    let url: string | null = null
    let cancelled = false
    snapshot(e, { scale: 0.5 })
      .then((b) => {
        if (cancelled) return
        url = URL.createObjectURL(b)
        setPreview(url)
      })
      .catch(() => setPreview(null))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [engine, config])

  const download = async () => {
    const e = engine.current
    if (!e) return
    setBusy(true)
    setError(null)
    try {
      const blob = await snapshot(e, { scale: factor })
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: `lazuli-${w}x${h}.png` })
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^\[lazuli\] /, '') : 'The image could not be rendered.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="image-preview" data-transparent={config.background.type === 'transparent' || undefined}>
        {preview && <img src={preview} alt="Preview of the exported image" />}
      </div>
      <div className="image-options">
        <span className="image-options__label">Size</span>
        <Segmented<Scale> label="Image size" options={SCALES} value={scale} onChange={setScale} />
        <span className="image-options__size">
          {w} × {h} px
        </span>
      </div>
      {error && <p className="code-dialog__error">{error}</p>}
      <button type="button" className="copy-button" onClick={download} disabled={busy}>
        <span aria-live="polite">{busy ? 'Rendering…' : 'Download PNG'}</span>
      </button>
    </>
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
