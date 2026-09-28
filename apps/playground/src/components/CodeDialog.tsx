import * as Dialog from '@radix-ui/react-dialog'
import type { LazuliInstance } from 'lazuli-bg'
import { record, snapshot } from 'lazuli-bg/capture'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { elementSnippet, htmlFile, jsSnippet } from '../exportCode'
import { CheckIcon, CloseIcon, CopyIcon } from '../icons'
import type { Config } from '../state'
import { Segmented } from './Segmented'

const TABS = [{ label: 'HTML file' }, { label: 'Web component' }, { label: 'JavaScript' }, { label: 'Image' }, { label: 'Video' }] as const
type Tab = (typeof TABS)[number]['label']

const DESCRIPTIONS: Record<Tab, string> = {
  'HTML file': 'A standalone file you can drop into any website or embed.',
  'Web component': 'Install the package, then use the element anywhere.',
  JavaScript: 'Install the package and create the background from code.',
  Image: 'A still of the current frame, without the pointer.',
  Video: 'Rendered frame by frame, so nothing drops. Set Motion › Loop for a seamless loop.',
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
          ) : tab === 'Image' ? (
            <ImageExport engine={engine} config={config} />
          ) : (
            <VideoExport engine={engine} config={config} />
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

const FORMATS = [{ label: 'MP4' }, { label: 'WebM' }] as const
const RATES = [{ label: '30 fps' }, { label: '60 fps' }] as const
const SECONDS = [{ label: '3 s' }, { label: '6 s' }, { label: '10 s' }] as const
const LOOPS = [{ label: '1 loop' }, { label: '2 loops' }, { label: '3 loops' }] as const
const VIDEO_SCALES = [{ label: '1×' }, { label: '2×' }] as const

function VideoExport({ engine, config }: { engine: RefObject<LazuliInstance | null>; config: Config }) {
  const [format, setFormat] = useState<(typeof FORMATS)[number]['label']>('MP4')
  const [rate, setRate] = useState<(typeof RATES)[number]['label']>('30 fps')
  const [length, setLength] = useState<string>(config.motion.loop > 0 ? '1 loop' : '6 s')
  const [scale, setScale] = useState<(typeof VIDEO_SCALES)[number]['label']>('1×')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const looping = config.motion.loop > 0
  const canvas = engine.current?.canvas
  const factor = Number(scale[0])
  // Even sizes (H.264), capped at 4K on the long side.
  const cap = Math.min(1, 3840 / Math.max(1, (canvas?.clientWidth ?? 1) * factor))
  const w = Math.floor(((canvas?.clientWidth ?? 0) * factor * cap) / 2) * 2
  const h = Math.floor(((canvas?.clientHeight ?? 0) * factor * cap) / 2) * 2
  const count = parseInt(length, 10)
  const seconds = looping ? count * config.motion.loop : count

  useEffect(() => {
    setLength(looping ? '1 loop' : '6 s')
  }, [looping])
  useEffect(() => () => abort.current?.abort(), [])

  const start = async () => {
    const e = engine.current
    if (!e) return
    abort.current = new AbortController()
    setError(null)
    setProgress(0)
    try {
      const blob = await record(e, {
        width: w,
        height: h,
        fps: parseInt(rate, 10),
        format: format === 'MP4' ? 'mp4' : 'webm',
        ...(looping ? { loops: count } : { duration: count }),
        pixelRatio: w / Math.max(1, canvas?.clientWidth ?? w),
        onProgress: setProgress,
        signal: abort.current.signal,
      })
      const url = URL.createObjectURL(blob)
      const ext = format === 'MP4' ? 'mp4' : 'webm'
      Object.assign(document.createElement('a'), { href: url, download: `lazuli-${w}x${h}.${ext}` }).click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message.replace(/^\[lazuli\] /, '') : 'The video could not be rendered.')
      }
    } finally {
      setProgress(null)
      abort.current = null
    }
  }

  const busy = progress !== null
  return (
    <>
      <div className="export-options">
        <div className="image-options">
          <span className="image-options__label">Format</span>
          <Segmented<(typeof FORMATS)[number]['label']> label="Video format" options={FORMATS} value={format} onChange={setFormat} />
        </div>
        <div className="image-options">
          <span className="image-options__label">Size</span>
          <Segmented<(typeof VIDEO_SCALES)[number]['label']> label="Video size" options={VIDEO_SCALES} value={scale} onChange={setScale} />
          <span className="image-options__size">
            {w} × {h}
          </span>
        </div>
        <div className="image-options">
          <span className="image-options__label">Rate</span>
          <Segmented<(typeof RATES)[number]['label']> label="Frame rate" options={RATES} value={rate} onChange={setRate} />
        </div>
        <div className="image-options">
          <span className="image-options__label">Length</span>
          <Segmented<string> label="Video length" options={looping ? LOOPS : SECONDS} value={length} onChange={setLength} />
          <span className="image-options__size">{Math.round(seconds * 10) / 10} s</span>
        </div>
      </div>
      {config.background.type === 'transparent' && <p className="panel__hint">Video has no transparency: the background renders as black.</p>}
      {error && <p className="code-dialog__error">{error}</p>}
      {busy ? (
        <button type="button" className="copy-button copy-button--progress" onClick={() => abort.current?.abort()} style={{ '--p': progress } as CSSProperties}>
          <span aria-live="polite">Rendering {Math.round((progress ?? 0) * 100)}% · Cancel</span>
        </button>
      ) : (
        <button type="button" className="copy-button" onClick={start}>
          <span>Render {format}</span>
        </button>
      )}
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
