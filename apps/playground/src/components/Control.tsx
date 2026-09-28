import * as Popover from '@radix-ui/react-popover'
import * as Toggle from '@radix-ui/react-toggle'
import { getPath, type ParamPath } from 'lazuli-bg'
import { useId, useState } from 'react'
import { HINTS } from '../controls'
import { CloseIcon } from '../icons'
import { PARAM, patchFor, round, type Config, type Patch } from '../state'
import { ColorPicker } from './ColorPicker'
import { InlineSlider } from './InlineSlider'
import { Row } from './Panel'
import { Segmented } from './Segmented'

export interface ControlProps {
  path: ParamPath
  config: Config
  set(patch: Patch): void
  compact: boolean
}

/** One row (or a few, for color lists) for a schema parameter. */
export function Control({ path, config, set, compact }: ControlProps) {
  const d = PARAM[path]
  const hint = HINTS[path] ?? {}
  const label = hint.label ?? d.label
  const value = getPath(config, path)
  const change = (v: unknown) => set(patchFor(path, v))
  const note = hint.note?.[String(value)]

  switch (d.kind) {
    case 'number': {
      const v = value as number
      if (hint.sqrt) {
        return (
          <InlineSlider
            label={label}
            value={Math.sqrt((v - d.min) / (d.max - d.min)) * 100}
            min={0}
            max={100}
            step={0.5}
            format={() => hint.format?.(v) ?? String(round(v))}
            onChange={(p) => change(round(d.min + (d.max - d.min) * (p / 100) ** 2))}
          />
        )
      }
      const step = hint.step ?? (d.int ? 1 : d.max - d.min <= 10 ? 0.05 : 1)
      return (
        <InlineSlider
          label={label}
          value={v}
          min={d.min}
          max={d.max}
          step={step}
          stepped={hint.stepped}
          format={hint.format ?? ((x) => String(step < 1 ? round(x) : Math.round(x)))}
          onChange={change}
        />
      )
    }
    case 'enum': {
      if (hint.switch) {
        return <SwitchRow label={label} on={value === hint.switch.on} onChange={(on) => change(on ? hint.switch!.on : hint.switch!.off)} />
      }
      if (d.options.length < 2) return null
      const labels = hint.options ?? Object.fromEntries(d.options.map((o) => [o, o[0].toUpperCase() + o.slice(1)]))
      const options = d.options.map((o) => ({ label: labels[o] ?? o, value: o }))
      return (
        <>
          <Row className="row--preset">
            <span className="row__label">{label}</span>
            <Segmented
              label={label}
              options={options}
              value={options.find((o) => o.value === value)?.label ?? ''}
              onChange={(l) => change(options.find((o) => o.label === l)!.value)}
            />
          </Row>
          {note && <p className="panel__hint">{note}</p>}
        </>
      )
    }
    case 'bool':
      return <SwitchRow label={label} on={value as boolean} onChange={change} />
    case 'color':
      return <ColorRow label={label} color={value as string} onChange={change} compact={compact} />
    case 'colors': {
      const list = value as string[]
      const labels = hint.colorLabels?.(list.length) ?? list.map((_, i) => `${label} ${i + 1}`)
      const order = list.map((_, i) => (hint.reverse ? list.length - 1 - i : i))
      return (
        <>
          {order.map((i) => (
            <ColorRow
              key={i}
              label={labels[i]}
              color={list[i]}
              compact={compact}
              onChange={(c) => change(list.map((x, j) => (j === i ? c : x)))}
              onRemove={list.length > d.minItems ? () => change(list.filter((_, j) => j !== i)) : undefined}
            />
          ))}
          {list.length < d.maxItems && (
            <button type="button" className="row row--button row--add" onClick={() => change([...list, list[list.length - 1]])}>
              <span className="row__label">Add color</span>
              <span className="row__plus" aria-hidden="true">
                +
              </span>
            </button>
          )}
        </>
      )
    }
  }
}

export function SwitchRow({ label, on, onChange }: { label: string; on: boolean; onChange(on: boolean): void }) {
  const id = useId()
  return (
    <Row className="row--switch">
      <span className="row__label" id={id}>
        {label}
      </span>
      <Toggle.Root className="switch" aria-labelledby={id} pressed={on} onPressedChange={onChange}>
        <span className="switch__knob" />
      </Toggle.Root>
    </Row>
  )
}

interface ColorRowProps {
  label: string
  color: string
  onChange(color: string): void
  onRemove?(): void
  compact: boolean
}

export function ColorRow({ label, color, onChange, onRemove, compact }: ColorRowProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="color-row">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger className="row row--button" data-active={open || undefined}>
          <span className="row__label">{label}</span>
          <span className="swatch" style={{ backgroundColor: color }} />
          <span className="visually-hidden">{color}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="popover popover--picker"
            side="bottom"
            align="start"
            sideOffset={compact ? 4 : -7}
            alignOffset={compact ? 0 : 9}
            collisionPadding={12}
          >
            <ColorPicker label={label} color={color} onChange={onChange} onClose={() => setOpen(false)} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {onRemove && (
        <button type="button" className="color-row__remove" onClick={onRemove} aria-label={`Remove ${label}`}>
          <CloseIcon width={10} height={10} />
        </button>
      )}
    </div>
  )
}
