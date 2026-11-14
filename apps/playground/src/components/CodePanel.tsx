import type { DrawnLayer, Geometry, Stack, StackOp } from 'lazuli-bg'
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { CheckIcon, CloseIcon, CopyIcon } from '../icons'

interface CodePanelProps {
  stack: Stack
  onOp(op: StackOp, tag?: string): void
  onClose(): void
}

type NumKey = 'x' | 'y' | 'a' | 'b' | 'r' | 'angle' | 'melt' | 'soft'

// Pixels of drag per unit, per kind of number.
const SCRUB: Record<NumKey, number> = { x: 400, y: 400, a: 400, b: 400, r: 600, angle: 60, melt: 200, soft: 200 }
const RANGE: Record<NumKey, [number, number]> = { x: [-4, 4], y: [-4, 4], a: [0.01, 4], b: [0.01, 4], r: [0, 4], angle: [-6.3, 6.3], melt: [0, 1], soft: [0, 1] }

const f2 = (v: number) => v.toFixed(2)

/** Apply one changed number to a drawn layer as a stack op. */
function opFor(layer: DrawnLayer, k: NumKey, v: number): StackOp {
  if (k === 'melt') return { op: 'reshape', id: layer.id, melt: v }
  if (k === 'soft') return { op: 'reshape', id: layer.id, soft: v }
  const g = layer.geom
  let geom: Geometry = g
  if (g.kind === 'ellipse') geom = { ...g, ...({ x: { x: v }, y: { y: v }, a: { rx: v }, b: { ry: v }, angle: { angle: v } } as Record<string, Partial<typeof g>>)[k] }
  else if (g.kind === 'rect') geom = { ...g, ...({ x: { x: v }, y: { y: v }, a: { w: v }, b: { h: v }, r: { radius: v }, angle: { angle: v } } as Record<string, Partial<typeof g>>)[k] }
  return { op: 'reshape', id: layer.id, geom }
}

/**
 * Your canvas as code, beside it: the drawn shapes as distance functions, how each joins the
 * one below, then the palette. Numbers you can drag are highlighted; dragging one changes the
 * layer, so the canvas, the inspector and this text stay in step. Export has the full shader.
 */
export function CodePanel({ stack, onOp, onClose }: CodePanelProps) {
  const [copied, setCopied] = useState(false)
  const scrub = useRef<{ layer: DrawnLayer; k: NumKey; x: number; v: number } | null>(null)
  const body = useRef<HTMLDivElement>(null)

  const visible = stack.shapes.filter((x) => x.visible)
  const drawn = visible.filter((x): x is DrawnLayer => x.kind === 'drawn')
  const back = [...drawn].reverse() // back to front, the order they're joined in

  const kw = (t: string) => <span className="tk-kw">{t}</span>
  const fn = (t: string) => <span className="tk-fn">{t}</span>
  const cm = (t: string) => <span className="tk-cm">{t}</span>
  const st = (t: string) => <span className="tk-st">{t}</span>
  const num = (layer: DrawnLayer, k: NumKey, v: number) => (
    <span className="tk-num" data-id={layer.id} data-k={k} title="Drag sideways">
      {f2(v)}
    </span>
  )

  const call = (l: DrawnLayer): ReactNode => {
    const g = l.geom
    // Warps nest front-outermost: the front warp bends last, e.g. swirl(noise(p)).
    const p = l.warps.filter((w) => w.visible).reduceRight<ReactNode>((acc, w) => <>{fn(w.type)}({acc})</>, 'p')
    if (g.kind === 'ellipse') {
      return (
        <>
          {fn('ellipse')}({p}, {kw('vec2')}({num(l, 'x', g.x)}, {num(l, 'y', g.y)}), {kw('vec2')}({num(l, 'a', g.rx)}, {num(l, 'b', g.ry)}){g.angle ? <>, {num(l, 'angle', g.angle)}</> : null})
        </>
      )
    }
    if (g.kind === 'rect') {
      return (
        <>
          {fn('box')}({p}, {kw('vec2')}({num(l, 'x', g.x)}, {num(l, 'y', g.y)}), {kw('vec2')}({num(l, 'a', g.w)}, {num(l, 'b', g.h)}), {num(l, 'r', g.radius)})
        </>
      )
    }
    return (
      <>
        {fn('polygon')}({p}, {st(`${g.points.length} points`)})
      </>
    )
  }
  const join = { merge: 'melt', add: 'melt', cut: 'cut', intersect: 'intersect' } as const

  const lines: ReactNode[] = [cm('// Your canvas as code. Drag a highlighted number sideways.'), '']
  if (back.length) {
    lines.push(<>{kw('float')} {fn('field')}({kw('vec2')} p) {'{'}</>)
    back.forEach((l, i) => {
      lines.push(i === 0 ? <>  {kw('float')} d = {call(l)}; {cm(`// ${l.name}`)}</> : <>  d = {fn(join[l.combine])}(d, {call(l)}, {num(l, 'melt', l.melt)}); {cm(`// ${l.name}`)}</>)
    })
    lines.push(<>  {kw('return')} d;</>, '}', '')
    const front = drawn[0]
    lines.push(<>{kw('vec4')} {fn('color')}({kw('vec2')} p) {'{'}</>)
    lines.push(<>  {kw('float')} d = {fn('field')}(p);</>)
    lines.push(<>  {kw('return')} {fn('palette')}(d, {num(front, 'soft', front.soft)}); {cm('// softness')}</>)
    lines.push('}')
  } else {
    lines.push(cm('// No drawn shapes yet: pick Pen, Ellipse or Rectangle and draw on the canvas.'))
  }
  lines.push('')
  lines.push(<>{cm('// palette')} {stack.color.settings.palette.map((c, i) => <span key={c + i}>{i ? ' → ' : ''}{st(c)}</span>)}</>)
  const bg = stack.background.settings
  lines.push(<>{cm('// background')} {bg.type === 'solid' ? st(bg.color) : bg.type === 'gradient' ? bg.gradient.map((c, i) => <span key={c + i}>{i ? ' → ' : ''}{st(c)}</span>) : cm('transparent')}</>)
  const generated = visible.filter((x) => x.kind === 'shape')
  if (generated.length) lines.push(cm(`// plus ${generated.map((x) => x.name).join(', ')} (built-in shapes, in the full shader)`))

  const onDown = (e: ReactPointerEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.tk-num')
    if (!el) return
    const layer = drawn.find((x) => x.id === el.dataset.id)
    if (!layer) return
    const k = el.dataset.k as NumKey
    scrub.current = { layer, k, x: e.clientX, v: parseFloat(el.textContent ?? '0') }
    body.current?.setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  const onMove = (e: ReactPointerEvent) => {
    const s = scrub.current
    if (!s) return
    const [lo, hi] = RANGE[s.k]
    const v = Math.min(hi, Math.max(lo, s.v + (e.clientX - s.x) / SCRUB[s.k]))
    // Re-read the layer so a drag on one number doesn't undo another change.
    const layer = stack.shapes.find((x): x is DrawnLayer => x.id === s.layer.id && x.kind === 'drawn') ?? s.layer
    onOp(opFor(layer, s.k, v), `code:${s.layer.id}:${s.k}`)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body.current?.innerText ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard blocked: the text is still selectable.
    }
  }

  return (
    <aside className="code-panel" aria-label="Code">
      <div className="code-panel__head">
        <span className="code-panel__file">canvas.glsl</span>
        <div className="code-panel__acts">
          <button type="button" className="icon-action" onClick={copy} aria-label="Copy code" title="Copy code">
            {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
          </button>
          <button type="button" className="icon-action" onClick={onClose} aria-label="Close code (C)" title="Close code (C)">
            <CloseIcon width={12} height={12} />
          </button>
        </div>
      </div>
      <div className="code-panel__body" ref={body} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (scrub.current = null)}>
        {lines.map((l, i) => (
          <div className="code-line" key={i}>
            <span className="code-line__n">{i + 1}</span>
            <span className="code-line__t">{l}</span>
          </div>
        ))}
      </div>
      <div className="code-panel__foot">Drag a highlighted number to change the canvas. Export has the full shader.</div>
    </aside>
  )
}
