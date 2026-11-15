import { DEFAULT_SUN, type DrawnLayer, type Geometry, type Stack, type StackOp } from 'lazuli-bg'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { center, corners, ends, fromDrag, halfSize, hit, isField, moved, resized, toField, toScreen, type Box } from '../geom'

export type DrawTool = 'move' | 'pen' | 'ellipse' | 'rect'

interface CanvasEditorProps {
  stack: Stack
  /** Keyed layers while the timeline plays: they move, so no outline or handles for them. */
  moving?: string[]
  selected: string
  tool: DrawTool
  onSelect(id: string): void
  setTool(t: DrawTool): void
  /** Apply an op; `tag` merges a drag's many ops into one undo step. */
  onOp(op: StackOp, tag?: string): void
}

type Drag =
  | { kind: 'move'; id: string; from: [number, number]; geom: Geometry }
  | { kind: 'resize'; id: string; geom: Geometry }
  | { kind: 'vertex'; id: string; index: number; geom: Geometry }
  | { kind: 'melt'; id: string; x: number; melt: number }
  | { kind: 'sun' }
  | { kind: 'draw'; shape: 'ellipse' | 'rect'; from: [number, number]; to: [number, number]; square: boolean }

const PEN_CLOSE_PX = 10

/**
 * The overlay on the frame: draws new shapes (ellipse, rectangle, pen), selects and moves drawn
 * layers, resizes them by their corners, drags path points, and the melt handle between a shape
 * and the one below it. All edits go through stack ops, so undo and the rules still apply.
 */
export function CanvasEditor({ stack, moving = [], selected, tool, onSelect, setTool, onOp }: CanvasEditorProps) {
  const svg = useRef<SVGSVGElement>(null)
  const [box, setBox] = useState<Box>({ left: 0, top: 0, width: 1, height: 1 })
  const [drag, setDrag] = useState<Drag | null>(null)
  const [pen, setPen] = useState<[number, number][]>([])
  const [hover, setHover] = useState<[number, number] | null>(null)

  // Track the frame's size so field units map to pixels.
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBox({ left: r.left, top: r.top, width: r.width, height: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    addEventListener('scroll', measure, true)
    return () => {
      ro.disconnect()
      removeEventListener('scroll', measure, true)
    }
  }, [])

  // Leaving the pen tool drops an unfinished path.
  useEffect(() => {
    if (tool !== 'pen') setPen([])
  }, [tool])

  const drawn = stack.shapes.filter((x): x is DrawnLayer => x.kind === 'drawn' && x.visible)
  // The sun handle: only while drawn shapes are lit from a placed light.
  const light = stack.color.light
  const sun: [number, number] | null = drawn.length && light && light.amount > 0 && !light.follow ? [light.x ?? DEFAULT_SUN[0], light.y ?? DEFAULT_SUN[1]] : null
  const sel = drawn.find((x) => x.id === selected && !moving.includes(x.id)) ?? null
  // The drawn layer right below the selection, which the melt handle joins it to.
  const below = (() => {
    if (!sel) return null
    const i = stack.shapes.findIndex((x) => x.id === sel.id)
    const next = stack.shapes.slice(i + 1).find((x) => x.visible)
    return next?.kind === 'drawn' && sel.combine !== 'add' ? next : null
  })()

  const field = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect()
    return toField({ left: r.left, top: r.top, width: r.width, height: r.height }, e.clientX, e.clientY)
  }
  const px = (x: number, y: number) => toScreen(box, x, y)

  const closePen = (points = pen) => {
    if (points.length >= 3) onOp({ op: 'add', layer: 'drawn', geom: { kind: 'path', points: points.slice(0, 32) } })
    setPen([])
    setTool('move')
  }

  const onDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    const p = field(e)
    svg.current!.setPointerCapture(e.pointerId)
    if (tool === 'ellipse' || tool === 'rect') {
      setDrag({ kind: 'draw', shape: tool, from: p, to: p, square: e.shiftKey })
      return
    }
    if (tool === 'pen') {
      const first = pen[0]
      if (first && pen.length >= 3) {
        const [fx, fy] = px(first[0], first[1]), [qx, qy] = px(p[0], p[1])
        if (Math.hypot(fx - qx, fy - qy) < PEN_CLOSE_PX) return closePen()
      }
      setPen([...pen, p])
      return
    }
    // Move tool: handles of the selection first, then the frontmost shape under the pointer.
    const t = e.target as SVGElement
    if (sel && t.dataset.handle === 'corner') return setDrag({ kind: 'resize', id: sel.id, geom: sel.geom })
    if (sel && t.dataset.handle === 'vertex') return setDrag({ kind: 'vertex', id: sel.id, index: Number(t.dataset.index), geom: sel.geom })
    if (t.closest('[data-handle="sun"]')) return setDrag({ kind: 'sun' })
    if (sel && t.dataset.handle === 'melt') return setDrag({ kind: 'melt', id: sel.id, x: e.clientX, melt: sel.melt })
    const target = drawn.find((x) => hit(x.geom, p[0], p[1]))
    if (target) {
      onSelect(target.id)
      setDrag({ kind: 'move', id: target.id, from: p, geom: target.geom })
    } else {
      // Empty canvas: the background, like clicking the page in a design tool.
      onSelect(stack.background.id)
    }
  }

  const onMove = (e: ReactPointerEvent) => {
    const p = field(e)
    setHover(p)
    if (!drag) return
    if (drag.kind === 'draw') return setDrag({ ...drag, to: p, square: e.shiftKey })
    if (drag.kind === 'move') {
      return onOp({ op: 'reshape', id: drag.id, geom: moved(drag.geom, p[0] - drag.from[0], p[1] - drag.from[1]) }, `move:${drag.id}`)
    }
    if (drag.kind === 'resize') return onOp({ op: 'reshape', id: drag.id, geom: resized(drag.geom, p[0], p[1], e.shiftKey) }, `resize:${drag.id}`)
    if (drag.kind === 'vertex' && drag.geom.kind === 'gradient') {
      const g = drag.index === 0 ? { ...drag.geom, x1: p[0], y1: p[1] } : { ...drag.geom, x2: p[0], y2: p[1] }
      return onOp({ op: 'reshape', id: drag.id, geom: g }, `vertex:${drag.id}`)
    }
    if (drag.kind === 'vertex' && drag.geom.kind === 'path') {
      const points = drag.geom.points.map((q, i) => (i === drag.index ? p : q))
      return onOp({ op: 'reshape', id: drag.id, geom: { kind: 'path', points } }, `vertex:${drag.id}`)
    }
    if (drag.kind === 'sun') return onOp({ op: 'light', x: p[0], y: p[1] }, 'light:sun')
    if (drag.kind === 'melt') return onOp({ op: 'reshape', id: drag.id, melt: Math.min(1, Math.max(0, drag.melt + (e.clientX - drag.x) / 160)) }, `melt:${drag.id}`)
  }

  const onUp = () => {
    if (drag?.kind === 'draw') {
      const [ax, ay] = px(drag.from[0], drag.from[1]), [bx, by] = px(drag.to[0], drag.to[1])
      // A click without a drag makes a shape of a sensible size there.
      const tiny = Math.hypot(ax - bx, ay - by) < 4
      const [x, y] = drag.from
      const geom: Geometry = !tiny
        ? fromDrag(drag.shape, drag.from, drag.to, drag.square)
        : drag.shape === 'ellipse'
          ? { kind: 'ellipse', x, y, rx: 0.12, ry: 0.12, angle: 0 }
          : { kind: 'rect', x, y, w: 0.12, h: 0.12, radius: 0.02, angle: 0 }
      onOp({ op: 'add', layer: 'drawn', geom })
      setTool('move')
    }
    setDrag(null)
  }

  // Pen: Enter closes, Escape cancels.
  useEffect(() => {
    if (tool !== 'pen') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') closePen()
      if (e.key === 'Escape') setPen([])
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const outline = (g: Geometry, cls: string) => {
    if (isField(g)) return null
    if (g.kind === 'gradient') {
      const [[ax, ay], [bx, by]] = ends(g).map(([x, y]) => px(x, y))
      // A white halo under the line: the gradient paints the colour the line is drawn in.
      return (
        <g>
          <line className="ce-halo" x1={ax} y1={ay} x2={bx} y2={by} />
          <line className={cls} x1={ax} y1={ay} x2={bx} y2={by} />
          {g.radial && <circle className={cls} cx={ax} cy={ay} r={Math.hypot(bx - ax, by - ay)} strokeDasharray="4 4" />}
        </g>
      )
    }
    if (g.kind === 'path') return <polygon className={cls} points={g.points.map(([x, y]) => px(x, y).join(',')).join(' ')} />
    const [cx, cy] = px(g.x, g.y)
    const rot = `rotate(${(-g.angle * 180) / Math.PI} ${cx} ${cy})`
    if (g.kind === 'ellipse') return <ellipse className={cls} cx={cx} cy={cy} rx={g.rx * box.height} ry={g.ry * box.height} transform={rot} />
    if (g.kind === 'text') {
      const [hx, hy] = halfSize(g)
      return <rect className={cls} x={cx - hx * box.height} y={cy - hy * box.height} width={hx * 2 * box.height} height={hy * 2 * box.height} transform={rot} />
    }
    return <rect className={cls} x={cx - g.w * box.height} y={cy - g.h * box.height} width={g.w * 2 * box.height} height={g.h * 2 * box.height} rx={g.radius * box.height} transform={rot} />
  }

  const hovered = tool === 'move' && !drag && hover ? drawn.find((x) => x.id !== selected && !moving.includes(x.id) && hit(x.geom, hover[0], hover[1])) : undefined
  const draft = drag?.kind === 'draw' ? fromDrag(drag.shape, drag.from, drag.to, drag.square) : null

  return (
    <svg
      ref={svg}
      className="canvas-editor"
      data-tool={tool}
      viewBox={`0 0 ${box.width} ${box.height}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={() => tool === 'pen' && closePen(pen.slice(0, -1))}
      aria-label="Canvas"
    >
      {hovered && outline(hovered.geom, 'ce-hover')}
      {sel && tool === 'move' && (
        <g>
          {outline(sel.geom, 'ce-outline')}
          {isField(sel.geom)
            ? null
            : sel.geom.kind === 'gradient'
            ? ends(sel.geom).map(([x, y], i) => {
                const [sx, sy] = px(x, y)
                return <circle key={i} className="ce-handle ce-handle--stop" data-handle="vertex" data-index={i} cx={sx} cy={sy} r={i === 0 ? 6 : 5}>
                  <title>{i === 0 ? 'Fullest here' : 'Fades out here'}</title>
                </circle>
              })
            : sel.geom.kind === 'path'
            ? sel.geom.points.map(([x, y], i) => {
                const [sx, sy] = px(x, y)
                return <rect key={i} className="ce-handle" data-handle="vertex" data-index={i} x={sx - 4} y={sy - 4} width="8" height="8" />
              })
            : corners(sel.geom).map(([x, y], i) => {
                const [sx, sy] = px(x, y)
                return <rect key={i} className="ce-handle" data-handle="corner" x={sx - 4} y={sy - 4} width="8" height="8" />
              })}
          {below && (() => {
            const [ax, ay] = center(sel.geom), [bx, by] = center(below.geom)
            const [sx, sy] = px(ax, ay), [tx, ty] = px(bx, by)
            const mx = (sx + tx) / 2, my = (sy + ty) / 2
            return (
              <g>
                <line className="ce-link" x1={sx} y1={sy} x2={tx} y2={ty} />
                <rect className="ce-melt" data-handle="melt" x={mx - 6} y={my - 6} width="12" height="12" rx="2" transform={`rotate(45 ${mx} ${my})`}>
                  <title>Melt {Math.round(sel.melt * 100)}. Drag sideways.</title>
                </rect>
                <text className="ce-melt-label" x={mx + 12} y={my - 10}>
                  Melt {Math.round(sel.melt * 100)}
                </text>
              </g>
            )
          })()}
        </g>
      )}
      {sun && tool === 'move' && (() => {
        // The light, where it was put: drag it and the shading follows.
        const [sx, sy] = px(sun[0], sun[1])
        return (
          <g className="ce-sun" data-handle="sun">
            <circle cx={sx} cy={sy} r="18" fill="transparent" stroke="none" />
            <circle className="ce-sun__disc" cx={sx} cy={sy} r="7" />
            {[...Array(8)].map((_, i) => {
              const a = (i * Math.PI) / 4
              return <line key={i} className="ce-sun__ray" x1={sx + Math.cos(a) * 10.5} y1={sy + Math.sin(a) * 10.5} x2={sx + Math.cos(a) * 14.5} y2={sy + Math.sin(a) * 14.5} />
            })}
            <title>The light. Drag it.</title>
          </g>
        )
      })()}
      {draft && outline(draft, 'ce-draft')}
      {tool === 'pen' && pen.length > 0 && (
        <g>
          <polyline className="ce-draft" points={[...pen, ...(hover ? [hover] : [])].map(([x, y]) => px(x, y).join(',')).join(' ')} />
          {pen.map(([x, y], i) => {
            const [sx, sy] = px(x, y)
            return <circle key={i} className={i === 0 && pen.length >= 3 ? 'ce-pen-start' : 'ce-pen-point'} cx={sx} cy={sy} r={i === 0 ? 5 : 3.5} />
          })}
        </g>
      )}
    </svg>
  )
}
