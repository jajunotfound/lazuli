import * as Popover from '@radix-ui/react-popover'
import { findLayer, type Layer, type ShapeType, type Stack, type StackOp, type TextureType } from 'lazuli-bg'
import { useState, type DragEvent, type ReactNode } from 'react'
import { SCENE_ID, SHAPE_LABELS } from '../layerEdit'

interface LayersProps {
  stack: Stack
  selected: string
  onSelect(id: string): void
  onOp(op: StackOp): void
  canDo(op: StackOp): boolean
  /** Extra controls in the header (Presets). */
  header?: ReactNode
  /** Replaces the "Layers" title (the Shapes | Effects tabs). */
  title?: ReactNode
  /** Only part of the stack: the shapes (and their warps), or everything that finishes them. */
  filter?: 'shapes' | 'effects'
  /** The selected layer's properties, shown right under its row. */
  inline?(id: string): ReactNode
}

const SHAPES: ShapeType[] = ['blobs', 'waves', 'bands', 'rings', 'dots', 'nodal']
const TEXTURES: { type: Exclude<TextureType, 'none'>; label: string }[] = [
  { type: 'grain', label: 'Grain' },
  { type: 'noise', label: 'Noise' },
  { type: 'paper', label: 'Paper' },
  { type: 'halftone', label: 'Halftone' },
  { type: 'hatch', label: 'Lines' },
  { type: 'dither', label: 'Dither' },
]
const WARPS = [
  { type: 'swirl', label: 'Swirl' },
  { type: 'noise', label: 'Noise' },
  { type: 'ripple', label: 'Ripple' },
  { type: 'twist', label: 'Twist' },
  { type: 'kaleido', label: 'Kaleido' },
  { type: 'repeat', label: 'Repeat' },
] as const

/** Which list a layer reorders within: shapes, textures, or one shape's warps. */
function listOf(stack: Stack, id: string): string | null {
  const f = findLayer(stack, id)
  if (!f) return null
  const p = f.place
  return p.list === 'warps' ? `warps:${stack.shapes[p.shape].id}` : p.list === 'shapes' || p.list === 'textures' ? p.list : null
}

function indexIn(stack: Stack, id: string): number {
  const p = findLayer(stack, id)?.place
  return p && 'index' in p ? p.index : -1
}

/** The left panel: the stack as a list, frontmost first, like a design tool's layers. */
export function Layers({ stack, selected, onSelect, onOp, canDo, header, title, filter, inline }: LayersProps) {
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  // Double-click a name to rename it in place.
  const [renaming, setRenaming] = useState<string | null>(null)

  const selShape = (() => {
    const f = findLayer(stack, selected)
    if (!f) return null
    if (f.layer.kind === 'shape') return f.layer.id
    return f.place.list === 'warps' ? stack.shapes[f.place.shape].id : null
  })()

  const dragProps = (id: string) => {
    const list = listOf(stack, id)
    if (!list) return {}
    return {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        setDrag(id)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', id)
      },
      onDragOver: (e: DragEvent) => {
        if (drag && drag !== id && listOf(stack, drag) === list) {
          e.preventDefault()
          setOver(id)
        }
      },
      onDragLeave: () => setOver((o) => (o === id ? null : o)),
      onDrop: (e: DragEvent) => {
        e.preventDefault()
        if (drag && drag !== id && listOf(stack, drag) === list) onOp({ op: 'move', id: drag, index: indexIn(stack, id) })
        setDrag(null)
        setOver(null)
      },
      onDragEnd: () => {
        setDrag(null)
        setOver(null)
      },
    }
  }

  const row = (layer: Layer | null, opts: { id: string; name: string; kind: string; depth?: number; hideable?: boolean; visible?: boolean; meta?: string }) => (
    <li key={opts.id} role="none">
      <div
        role="treeitem"
        aria-selected={selected === opts.id}
        tabIndex={selected === opts.id ? 0 : -1}
        className="layer"
        data-depth={opts.depth || undefined}
        data-hidden={opts.visible === false || undefined}
        data-dragging={drag === opts.id || undefined}
        data-over={over === opts.id || undefined}
        onClick={() => onSelect(opts.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(opts.id)
          }
        }}
        {...(layer ? dragProps(opts.id) : {})}
      >
        <LayerIcon kind={opts.kind} />
        {renaming === opts.id ? (
          <input
            className="layer__rename"
            autoFocus
            defaultValue={opts.name}
            aria-label="Layer name"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setRenaming(null)
            }}
            onBlur={(e) => {
              const name = e.target.value.trim()
              if (renaming && name && name !== opts.name) onOp({ op: 'rename', id: opts.id, name })
              setRenaming(null)
            }}
          />
        ) : (
          <span className="layer__name" onDoubleClick={() => layer && setRenaming(opts.id)} title={layer ? 'Double-click to rename' : undefined}>
            {opts.name}
          </span>
        )}
        {opts.meta && <span className="layer__meta">{opts.meta}</span>}
        {opts.hideable && (
          <button
            type="button"
            className="layer__eye"
            aria-label={opts.visible ? `Hide ${opts.name}` : `Show ${opts.name}`}
            aria-pressed={opts.visible === false}
            onClick={(e) => {
              e.stopPropagation()
              onOp({ op: 'hide', id: opts.id, visible: !opts.visible })
            }}
          >
            <EyeIcon off={opts.visible === false} />
          </button>
        )}
      </div>
      {inline && selected === opts.id && <div className="layer__props">{inline(opts.id)}</div>}
    </li>
  )

  const backmost = stack.shapes[stack.shapes.length - 1]?.id
  return (
    <nav className="layers" aria-label="Layers">
      <div className="layers__head">
        {title ?? <h2 className="layers__title">Layers</h2>}
        <div className="layers__acts">
          {header}
          <Popover.Root open={addOpen} onOpenChange={setAddOpen}>
            <Popover.Trigger className="icon-action" aria-label="Add layer" title="Add layer">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className="popover menu add-menu" side="bottom" align="end" sideOffset={6} collisionPadding={12}>
                <AddGroup title="Draw">
                  <AddItem label="Ellipse" op={{ op: 'add', layer: 'drawn', geom: { kind: 'ellipse', x: 0, y: 0, rx: 0.16, ry: 0.16, angle: 0 } }} canDo={canDo} onOp={onOp} close={() => setAddOpen(false)} />
                  <AddItem label="Rectangle" op={{ op: 'add', layer: 'drawn', geom: { kind: 'rect', x: 0, y: 0, w: 0.18, h: 0.12, radius: 0.02, angle: 0 } }} canDo={canDo} onOp={onOp} close={() => setAddOpen(false)} />
                  <AddItem label="Text" op={{ op: 'add', layer: 'drawn', geom: { kind: 'text', text: 'HELLO', x: 0, y: 0, size: 0.2, weight: 0.4, angle: 0 } }} canDo={canDo} onOp={onOp} close={() => setAddOpen(false)} />
                  <AddItem label="Gradient" op={{ op: 'add', layer: 'drawn', geom: { kind: 'gradient', x1: -0.6, y1: 0.2, x2: 0.6, y2: -0.2, radial: false } }} canDo={canDo} onOp={onOp} close={() => setAddOpen(false)} />
                  <AddItem label="Code" op={{ op: 'add', layer: 'drawn', geom: { kind: 'code', name: freeName(stack), glsl: 'return length(q) - 0.2 + 0.03 * sin(atan(q.y, q.x) * 6.0 + t * 2.0);' } }} canDo={canDo} onOp={onOp} close={() => setAddOpen(false)} />
                  <AddItem label="Noise" op={{ op: 'add', layer: 'drawn', geom: { kind: 'noise', scale: 3, level: 0.5 } }} canDo={canDo} onOp={onOp} close={() => setAddOpen(false)} />
                  <AddItem label="Cells" op={{ op: 'add', layer: 'drawn', geom: { kind: 'cells', scale: 5, gap: 0.2 } }} canDo={canDo} onOp={onOp} close={() => setAddOpen(false)} />
                </AddGroup>
                <AddGroup title="Built-in">
                  {SHAPES.map((t) => (
                    <AddItem key={t} label={SHAPE_LABELS[t]} op={{ op: 'add', layer: 'shape', type: t }} canDo={canDo} onOp={onOp} close={() => setAddOpen(false)} />
                  ))}
                </AddGroup>
                <AddGroup title="Texture">
                  {TEXTURES.map((t) => (
                    <AddItem key={t.type} label={t.label} op={{ op: 'add', layer: 'texture', type: t.type }} canDo={canDo} onOp={onOp} close={() => setAddOpen(false)} />
                  ))}
                </AddGroup>
                <AddGroup title={selShape ? `Warp ${findLayer(stack, selShape)?.layer.name}` : 'Warp · select a shape first'}>
                  {WARPS.map((w) => (
                    <AddItem
                      key={w.type}
                      label={w.label}
                      op={selShape ? { op: 'add', layer: 'warp', type: w.type, parent: selShape } : null}
                      canDo={canDo}
                      onOp={onOp}
                      close={() => setAddOpen(false)}
                    />
                  ))}
                  <AddItem label="Cursor on this shape" op={selShape ? { op: 'add', layer: 'cursor', parent: selShape } : null} canDo={canDo} onOp={onOp} close={() => setAddOpen(false)} />
                </AddGroup>
                <AddGroup title="Whole canvas">
                  <AddItem label="Cursor" op={{ op: 'add', layer: 'cursor' }} canDo={canDo} onOp={onOp} close={() => setAddOpen(false)} />
                </AddGroup>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>

      <ul className="layers__list" role="tree" aria-label="Layer stack">
        {filter !== 'shapes' && (
          <>
            {row(null, { id: SCENE_ID, name: 'Motion', kind: 'scene', meta: stack.move ? stack.move[0].toUpperCase() + stack.move.slice(1) : undefined })}
            <li role="none" className="layers__rule" aria-hidden="true" />
            {stack.textures.map((t) => row(t, { id: t.id, name: t.name, kind: 'texture', hideable: true, visible: t.visible }))}
            {row(stack.color, { id: stack.color.id, name: stack.color.name, kind: 'color' })}
            {stack.cursor && row(stack.cursor, { id: stack.cursor.id, name: stack.cursor.name, kind: 'cursor', hideable: true, visible: stack.cursor.visible })}
          </>
        )}
        {filter === 'shapes' && stack.shapes.length === 0 && (
          <li role="none" className="layers__empty">
            Nothing drawn yet. Pick a tool on the dock, or ask Lazuli.
          </li>
        )}
        {filter !== 'effects' && stack.shapes.map((s) => [
          row(s, { id: s.id, name: s.name, kind: s.kind === 'drawn' ? s.geom.kind : 'shape', hideable: true, visible: s.visible, meta: s.id === backmost ? undefined : s.combine === 'merge' ? undefined : COMBINE_LABEL[s.combine] }),
          ...s.warps.map((w) => row(w, { id: w.id, name: w.name, kind: 'warp', depth: 1, hideable: true, visible: w.visible })),
        ])}
        {filter !== 'shapes' && row(stack.background, { id: stack.background.id, name: stack.background.name, kind: 'background' })}
      </ul>
    </nav>
  )
}

const COMBINE_LABEL = { merge: 'Merge', add: 'Add', cut: 'Cut', intersect: 'Intersect' } as const

function AddGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="add-menu__group" role="group" aria-label={title}>
      <div className="add-menu__title">{title}</div>
      {children}
    </div>
  )
}

function AddItem({ label, op, canDo, onOp, close }: { label: string; op: StackOp | null; canDo(op: StackOp): boolean; onOp(op: StackOp): void; close(): void }) {
  const enabled = op !== null && canDo(op)
  return (
    <button
      type="button"
      className="menu__item"
      disabled={!enabled}
      onClick={() => {
        if (!op) return
        onOp(op)
        close()
      }}
    >
      {label}
    </button>
  )
}

function LayerIcon({ kind }: { kind: string }) {
  const paths: Record<string, ReactNode> = {
    scene: <path d="M3 8a5 5 0 1 0 10 0A5 5 0 0 0 3 8Zm4-2v4l3-2-3-2Z" />,
    texture: (
      <>
        <circle cx="5" cy="5" r=".6" />
        <circle cx="8" cy="6.5" r=".6" />
        <circle cx="11" cy="4.5" r=".6" />
        <circle cx="5.5" cy="9" r=".6" />
        <circle cx="9.5" cy="10" r=".6" />
        <circle cx="12" cy="8.5" r=".6" />
        <circle cx="7" cy="12" r=".6" />
      </>
    ),
    color: (
      <>
        <rect x="2.5" y="2.5" width="11" height="11" rx="3" />
        <path d="M2.5 9.5 9.5 2.5M6.5 13.5l7-7" />
      </>
    ),
    cursor: <path d="M4 3l8.5 4-3.7 1.3L7.5 12 4 3Z" />,
    shape: <path d="M8 2.8c2.6 0 5 1.6 5 4.5 0 3.3-2.6 5.9-5.6 5.9-2.5 0-4.4-1.8-4.4-4.4C3 5.6 5.2 2.8 8 2.8Z" />,
    warp: <path d="M8 8.2a.6.6 0 1 1 .6-.6M8.6 7.6A2 2 0 1 0 6 8a3.2 3.2 0 1 0 5.2-2.6A4.5 4.5 0 1 0 12 12" />,
    background: <rect x="2.5" y="2.5" width="11" height="11" rx="2" />,
    ellipse: <ellipse cx="8" cy="8" rx="5.5" ry="4" />,
    rect: <rect x="3" y="4.5" width="10" height="7" rx="1.5" />,
    path: <path d="M8 2.5l5 4-2 6.5H5L3 6.5l5-4Z" />,
    noise: <path d="M2.5 9c1.5-3 3.5-3 5 0s3.5 3 6 0M2.5 5.5c1.5-2 3.5-2 5 0s3.5 2 6 0" />,
    cells: <path d="M2.5 2.5h5v5h-5zM8.5 2.5h5v5h-5zM2.5 8.5h5v5h-5zM8.5 8.5h5v5h-5z" />,
    text: <path d="M3.5 4h9M8 4v8.5" />,
    code: <path d="M6 4.5 2.5 8 6 11.5M10 4.5l3.5 3.5L10 11.5" />,
    gradient: (
      <>
        <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
        <path d="M5.5 2.5v11M8.5 2.5v11" strokeDasharray="1.5 1.5" />
      </>
    ),
  }
  return (
    <svg className="layer__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[kind]}
    </svg>
  )
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {off ? (
        <path d="M2.5 2.5l11 11M6.6 6.7a2 2 0 0 0 2.7 2.7M4.2 4.6C2.9 5.6 2 7 1.5 8c1.2 2.4 3.6 4.5 6.5 4.5 1.3 0 2.5-.4 3.5-1M7 3.6c.3 0 .7-.1 1-.1 2.9 0 5.3 2.1 6.5 4.5-.4.8-.9 1.6-1.6 2.3" />
      ) : (
        <>
          <path d="M1.5 8C2.7 5.6 5.1 3.5 8 3.5s5.3 2.1 6.5 4.5c-1.2 2.4-3.6 4.5-6.5 4.5S2.7 10.4 1.5 8Z" />
          <circle cx="8" cy="8" r="2" />
        </>
      )}
    </svg>
  )
}

/** A function name no code layer uses yet: wobble, wobble2, … */
function freeName(s: Stack): string {
  const used = new Set(s.shapes.flatMap((x) => (x.kind === 'drawn' && x.geom.kind === 'code' ? [x.geom.name] : [])))
  let n = 1
  while (used.has(n === 1 ? 'wobble' : `wobble${n}`)) n++
  return n === 1 ? 'wobble' : `wobble${n}`
}
