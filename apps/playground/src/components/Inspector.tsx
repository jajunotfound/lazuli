import * as Popover from '@radix-ui/react-popover'
import * as Toggle from '@radix-ui/react-toggle'
import { findLayer, getPath, PARAMS, type CombineMode, type Layer, type LazuliInput, type ParamPath, type Stack, type StackOp } from 'lazuli-bg'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { HINTS } from '../controls'
import { CloseIcon } from '../icons'
import { layerPaths, layerView, SCENE_ID } from '../layerEdit'
import { patchFor, round, type Config } from '../state'
import { ColorPicker } from './ColorPicker'
import { InlineSlider } from './InlineSlider'
import { Segmented } from './Segmented'

interface InspectorProps {
  stack: Stack
  selected: string
  onPatch(patch: LazuliInput): void
  onOp(op: StackOp, tag?: string): void
  canDo(op: StackOp): boolean
  /** Inside the code workspace's Properties tab instead of floating on the right. */
  embedded?: boolean
}

const COMBINE: { value: CombineMode; label: string }[] = [
  { value: 'merge', label: 'Merge' },
  { value: 'add', label: 'Add' },
  { value: 'cut', label: 'Cut' },
  { value: 'intersect', label: 'Intersect' },
]

/** The right panel: the selected layer's settings in a label | control grid. */
export function Inspector({ stack, selected, onPatch, onOp, canDo, embedded }: InspectorProps) {
  const found = selected === SCENE_ID ? null : findLayer(stack, selected)
  const layer: Layer | 'scene' = found?.layer ?? 'scene'
  const view = layerView(stack, selected)
  const paths = layerPaths(layer, view)
  const title = layer === 'scene' ? 'Motion' : layer.name
  const isShape = layer !== 'scene' && layer.kind === 'shape'
  const drawn = layer !== 'scene' && layer.kind === 'drawn' ? layer : null
  const backmost = (isShape || !!drawn) && stack.shapes.filter((x) => x.visible).slice(-1)[0]?.id === selected
  const removable = layer !== 'scene' && canDo({ op: 'delete', id: selected })
  const duplicable = layer !== 'scene' && canDo({ op: 'duplicate', id: selected })

  return (
    <aside className={embedded ? 'inspector inspector--embedded' : 'inspector'} aria-label="Inspector">
      <div className="inspector__head">
        {layer === 'scene' || layer.kind === 'color' || layer.kind === 'background' ? (
          <h2 className="inspector__title">{title}</h2>
        ) : (
          <NameInput key={selected} value={title} onCommit={(name) => onOp({ op: 'rename', id: selected, name })} />
        )}
        <div className="inspector__acts">
          {isShape && (
            <IconAction label="Shuffle (⇧R)" onClick={() => onPatch({ seed: Math.round(Math.random() * 1e8) / 10 })}>
              <path d="M2 4h3.5c1.5 0 2.3.6 3.2 2l1.6 2.6c.9 1.4 1.7 2 3.2 2H14M2 12h3.5c1.5 0 2.3-.6 3.2-2M12 2l2 2-2 2M12 8.6l2 2-2 2" />
            </IconAction>
          )}
          {duplicable && (
            <IconAction label="Duplicate" onClick={() => onOp({ op: 'duplicate', id: selected })}>
              <rect x="5" y="5" width="9" height="9" rx="2" />
              <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
            </IconAction>
          )}
          {removable && (
            <IconAction label="Delete (⌫)" onClick={() => onOp({ op: 'delete', id: selected })}>
              <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
            </IconAction>
          )}
        </div>
      </div>

      <div className="inspector__body">
        {(isShape || drawn) && !backmost && (
          <SelectField
            label="Combine"
            value={(layer as { combine: CombineMode }).combine}
            options={COMBINE}
            onChange={(v) => onOp({ op: 'combine', id: selected, combine: v as CombineMode })}
          />
        )}
        {drawn && (
          <>
            <NumberField label="Melt" value={Math.round(drawn.melt * 100)} min={0} max={100} step={1} format={(v) => String(Math.round(v))} onChange={(v) => onOp({ op: 'reshape', id: selected, melt: v / 100 }, `melt:${selected}`)} />
            <NumberField label="Softness" value={Math.round(drawn.soft * 100)} min={0} max={100} step={1} format={(v) => String(Math.round(v))} onChange={(v) => onOp({ op: 'reshape', id: selected, soft: v / 100 }, `soft:${selected}`)} />
            {drawn.geom.kind !== 'path' && (
              <NumberField
                label="Rotation"
                value={Math.round((drawn.geom.angle * 180) / Math.PI)}
                min={-180}
                max={180}
                step={1}
                format={(v) => `${Math.round(v)}°`}
                onChange={(v) => drawn.geom.kind !== 'path' && onOp({ op: 'reshape', id: selected, geom: { ...drawn.geom, angle: (v * Math.PI) / 180 } }, `turn:${selected}`)}
              />
            )}
            {drawn.geom.kind === 'rect' && (
              <NumberField
                label="Corner"
                value={Math.round(drawn.geom.radius * 1000)}
                min={0}
                max={Math.round(Math.min(drawn.geom.w, drawn.geom.h) * 1000)}
                step={1}
                format={(v) => String(Math.round(v))}
                onChange={(v) => drawn.geom.kind === 'rect' && onOp({ op: 'reshape', id: selected, geom: { ...drawn.geom, radius: v / 1000 } }, `corner:${selected}`)}
              />
            )}
          </>
        )}
        {layer !== 'scene' && layer.kind === 'color' && (
          <>
            <NumberField label="Light" value={Math.round((stack.color.light?.amount ?? 0) * 100)} min={0} max={100} step={1} format={(v) => (v === 0 ? 'Flat' : String(Math.round(v)))} onChange={(v) => onOp({ op: 'light', amount: v / 100 }, 'light:amount')} />
            <NumberField label="Shine" value={Math.round((stack.color.light?.shine ?? 0.5) * 100)} min={0} max={100} step={1} format={(v) => String(Math.round(v))} onChange={(v) => onOp({ op: 'light', shine: v / 100 }, 'light:shine')} />
          </>
        )}
        {paths.map((p) => (
          <Field key={p} path={p} view={view} set={onPatch} />
        ))}
        {layer !== 'scene' && layer.kind === 'warp' && layer.type !== 'cursor' && (
          <>
            <NumberField label="Strength" value={layer.strength} min={0} max={100} step={1} format={(v) => String(Math.round(v))} onChange={(v) => onOp({ op: 'tune', id: selected, strength: v })} />
            <NumberField label="Size" value={layer.size} min={0} max={100} step={1} format={(v) => String(Math.round(v))} onChange={(v) => onOp({ op: 'tune', id: selected, size: v })} />
          </>
        )}
      </div>
    </aside>
  )
}

function IconAction({ label, onClick, children }: { label: string; onClick(): void; children: ReactNode }) {
  return (
    <button type="button" className="icon-action" onClick={onClick} aria-label={label} title={label}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  )
}

function NameInput({ value, onCommit }: { value: string; onCommit(v: string): void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const commit = () => (text.trim() ? text.trim() !== value && onCommit(text.trim()) : setText(value))
  return (
    <input
      className="inspector__name"
      aria-label="Layer name"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setText(value)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}

// ---- fields -------------------------------------------------------------------

const PARAM = Object.fromEntries(PARAMS.map((d) => [d.path, d]))

/** One parameter as a label | control row, typed by its schema entry. */
function Field({ path, view, set }: { path: ParamPath; view: Config; set(p: LazuliInput): void }) {
  const d = PARAM[path]
  const hint = HINTS[path] ?? {}
  const label = hint.label ?? d.label
  const value = getPath(view, path)
  const change = (v: unknown) => set(patchFor(path, v))

  switch (d.kind) {
    case 'number': {
      // Steps picks from a few choices (Smooth or 2–8 bands): a menu, not a slider.
      if (path === 'color.steps') {
        const options = [{ value: '0', label: 'Smooth' }, ...[2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: `${n} bands` }))]
        return <SelectField label={label} value={String(value)} options={options} onChange={(v) => change(Number(v))} />
      }
      const step = hint.step ?? (d.int ? 1 : d.max - d.min <= 10 ? 0.05 : 1)
      const fmt = hint.format ?? ((x: number) => String(step < 1 ? round(x) : Math.round(x)))
      return <NumberField label={label} value={value as number} min={d.min} max={d.max} step={step} sqrt={hint.sqrt} stepped={hint.stepped && d.max - d.min <= 8} format={fmt} onChange={change} />
    }
    case 'enum': {
      const labels = hint.options ?? Object.fromEntries(d.options.map((o) => [o, o[0].toUpperCase() + o.slice(1)]))
      // A texture layer always has a texture: "None" is deleting the layer.
      const options = Object.entries(labels)
        .filter(([v]) => !(path === 'texture.type' && v === 'none'))
        .map(([v, l]) => ({ value: v, label: l }))
      if (options.length < 2) return null
      if (options.length <= 3 && options.every((o) => o.label.length <= 8)) {
        return (
          <Row label={label}>
            <Segmented
              label={label}
              className="segmented--mini"
              options={options}
              value={options.find((o) => o.value === value)?.label ?? ''}
              onChange={(l) => change(options.find((o) => o.label === l)!.value)}
            />
          </Row>
        )
      }
      return <SelectField label={label} value={String(value)} options={options} onChange={change} />
    }
    case 'bool':
      return <SwitchField label={label} on={value as boolean} onChange={change} />
    case 'color':
      return <ColorField label={label} color={value as string} onChange={change} />
    case 'colors': {
      const list = value as string[]
      const labels = hint.colorLabels?.(list.length, view) ?? list.map((_, i) => `${label} ${i + 1}`)
      return <StopsField label={path === 'color.palette' ? 'Palette' : label} colors={list} labels={labels} min={d.minItems} max={d.maxItems} reverse={hint.reverse} onChange={change} />
    }
  }
}

function Row({ label, children, id }: { label: string; children: ReactNode; id?: string }) {
  return (
    <div className="field">
      <span className="field__label" id={id}>
        {label}
      </span>
      <div className="field__control">{children}</div>
    </div>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  sqrt?: boolean
  /** Dots at each step (small integer ranges). */
  stepped?: boolean
  format(v: number): string
  onChange(v: number): void
}

/** The whole row is the slider (Lazuli's own): a fill grows from the left, label inside, value on the right. */
export function NumberField({ label, value, min, max, step, sqrt, format, onChange }: NumberFieldProps) {
  if (sqrt) {
    // Square-root scale: finer control near zero (speed).
    return (
      <InlineSlider
        label={label}
        value={Math.sqrt((value - min) / (max - min)) * 100}
        min={0}
        max={100}
        step={0.5}
        format={() => format(value)}
        onChange={(p) => onChange(round(min + (max - min) * (p / 100) ** 2))}
      />
    )
  }
  return <InlineSlider label={label} value={value} min={min} max={max} step={step} format={format} onChange={onChange} />
}

/** A row like the sliders: label on the left, the current option and a chevron on the right; the native menu opens on click. */
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange(v: string): void }) {
  const current = options.find((o) => o.value === value)?.label ?? value
  return (
    <label className="select-row">
      <span className="select-row__label">{label}</span>
      <span className="select-row__value">
        {current}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function SwitchField({ label, on, onChange }: { label: string; on: boolean; onChange(on: boolean): void }) {
  const id = useId()
  return (
    <Row label={label} id={id}>
      <Toggle.Root className="switch switch--mini" aria-labelledby={id} pressed={on} onPressedChange={onChange}>
        <span className="switch__knob" />
      </Toggle.Root>
    </Row>
  )
}

/** Swatch (opens the picker) and an editable hex value in one field. */
function ColorInput({ label, color, onChange }: { label: string; color: string; onChange(c: string): void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const commit = () => {
    const t = (text ?? '').trim().replace(/^#?/, '#').toLowerCase()
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(t)) onChange(t.length === 4 ? `#${[...t.slice(1)].map((c) => c + c).join('')}` : t)
    setText(null)
  }
  return (
    <div className="color-input">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger className="color-input__swatch" style={{ backgroundColor: color }} aria-label={`${label}: ${color}, open picker`} />
        <Popover.Portal>
          <Popover.Content className="popover popover--picker" side="left" align="start" sideOffset={12} collisionPadding={12}>
            <ColorPicker label={label} color={color} onChange={onChange} onClose={() => setOpen(false)} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <input
        className="color-input__hex"
        aria-label={`${label} hex`}
        value={text ?? color.slice(1).toUpperCase()}
        onFocus={(e) => {
          setText(color.slice(1).toUpperCase())
          requestAnimationFrame(() => e.target.select())
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        spellCheck={false}
      />
    </div>
  )
}

function ColorField({ label, color, onChange }: { label: string; color: string; onChange(c: string): void }) {
  return (
    <Row label={label}>
      <ColorInput label={label} color={color} onChange={onChange} />
    </Row>
  )
}

interface StopsFieldProps {
  label: string
  colors: string[]
  labels: string[]
  min: number
  max: number
  /** List the stops last-first (the palette shows its densest stop, Core, on top). */
  reverse?: boolean
  onChange(colors: string[]): void
}

/** A gradient bar over a list of stops: swatch + hex, remove, and "+" in the header. */
function StopsField({ label, colors, labels, min, max, reverse, onChange }: StopsFieldProps) {
  const order = colors.map((_, i) => (reverse ? colors.length - 1 - i : i))
  const add = () => {
    if (colors.length >= max) return
    const a = colors[colors.length - 2] ?? colors[0]
    const b = colors[colors.length - 1]
    onChange([...colors.slice(0, -1), mix(a, b), b])
  }
  return (
    <div className="stops">
      <div className="stops__head">
        <span className="field__label">{label}</span>
        {colors.length < max && (
          <button type="button" className="icon-action icon-action--small" onClick={add} aria-label={`Add a ${label.toLowerCase()} stop`} title="Add stop">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="stops__bar" style={{ backgroundImage: `linear-gradient(to right, ${(reverse ? [...colors].reverse() : colors).join(', ')})` }} aria-hidden="true" />
      {order.map((i) => (
        <div className="stops__row" key={i}>
          <span className="stops__label">{labels[i]}</span>
          <ColorInput label={labels[i]} color={colors[i]} onChange={(c) => onChange(colors.map((x, j) => (j === i ? c : x)))} />
          {colors.length > min ? (
            <button type="button" className="icon-action icon-action--small" onClick={() => onChange(colors.filter((_, j) => j !== i))} aria-label={`Remove ${labels[i]}`}>
              <CloseIcon width={10} height={10} />
            </button>
          ) : (
            <span className="icon-action--spacer" />
          )}
        </div>
      ))}
    </div>
  )
}

function mix(a: string, b: string): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (s: number) => Math.round((((pa >> s) & 255) + ((pb >> s) & 255)) / 2)
  return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')
}
