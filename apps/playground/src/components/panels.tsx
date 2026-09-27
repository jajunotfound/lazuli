import * as Popover from '@radix-ui/react-popover'
import * as Toggle from '@radix-ui/react-toggle'
import { RANGES } from 'lazuli-bg'
import { useState } from 'react'
import { MOTION_PRESETS, round, TEXTURE_PRESETS, type Params } from '../state'
import { ColorPicker } from './ColorPicker'
import { InlineSlider } from './InlineSlider'
import { Panel, Row } from './Panel'
import { Segmented } from './Segmented'

export interface PanelProps {
  params: Params
  set(patch: Partial<Params>): void
  reset(): void
}

const MAX_SPEED = RANGES.speed[1]

const COLOR_ROWS = [
  { key: 'core', label: 'Core' },
  { key: 'edge', label: 'Edge' },
  { key: 'ground', label: 'Ground' },
] as const

export function ColorsPanel({ params, set, reset, compact }: PanelProps & { compact: boolean }) {
  const [editing, setEditing] = useState<(typeof COLOR_ROWS)[number]['key'] | null>(null)
  return (
    <Panel title="Color" onReset={reset}>
      {COLOR_ROWS.map(({ key, label }) => (
        <Popover.Root key={key} open={editing === key} onOpenChange={(o) => setEditing(o ? key : null)}>
          <Popover.Trigger className="row row--button" data-active={editing === key || undefined}>
            <span className="row__label">{label}</span>
            <span className="swatch" style={{ backgroundColor: params[key] }} />
            <span className="visually-hidden">{params[key]}</span>
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
              <ColorPicker label={label} color={params[key]} onChange={(c) => set({ [key]: c })} onClose={() => setEditing(null)} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ))}
    </Panel>
  )
}

export function ShapesPanel({ params, set, reset }: PanelProps) {
  return (
    <Panel title="Shapes" onReset={reset}>
      <InlineSlider label="Count" value={params.count} min={RANGES.count[0]} max={RANGES.count[1]} step={1} stepped onChange={(count) => set({ count })} />
      <InlineSlider label="Size" value={params.size} min={RANGES.size[0]} max={RANGES.size[1]} step={1} format={(v) => `${Math.round(v)}%`} onChange={(size) => set({ size })} />
      <InlineSlider label="Softness" value={params.softness} min={0} max={100} step={1} format={(v) => String(Math.round(v))} onChange={(softness) => set({ softness })} />
    </Panel>
  )
}

function presetFor<T extends { label: string; value: number }>(presets: readonly T[], value: number): T['label'] | '' {
  return presets.find((p) => Math.abs(p.value - value) < 1e-6)?.label ?? ''
}

export function TexturePanel({ params, set, reset }: PanelProps) {
  return (
    <Panel title="Texture" onReset={reset}>
      <Row className="row--preset">
        <span className="row__label">Preset</span>
        <Segmented
          label="Texture preset"
          options={TEXTURE_PRESETS}
          value={presetFor(TEXTURE_PRESETS, params.texture)}
          onChange={(l) => set({ texture: TEXTURE_PRESETS.find((p) => p.label === l)!.value })}
        />
      </Row>
      <InlineSlider label="Amount" value={params.texture} min={0} max={100} step={1} format={(v) => String(Math.round(v))} onChange={(texture) => set({ texture })} />
    </Panel>
  )
}

export function MotionPanel({ params, set, reset }: PanelProps) {
  return (
    <Panel title="Motion" onReset={reset}>
      <Row className="row--preset">
        <span className="row__label">Preset</span>
        <Segmented
          label="Motion preset"
          options={MOTION_PRESETS}
          value={presetFor(MOTION_PRESETS, params.speed)}
          onChange={(l) => set({ speed: MOTION_PRESETS.find((p) => p.label === l)!.value })}
        />
      </Row>
      {/* Square-root scale: finer control at the slow end, where most backgrounds live. */}
      <InlineSlider
        label="Speed"
        value={Math.sqrt(params.speed / MAX_SPEED) * 100}
        min={0}
        max={100}
        step={0.5}
        format={() => `${params.speed.toFixed(2)}×`}
        onChange={(v) => set({ speed: round(MAX_SPEED * (v / 100) ** 2) })}
      />
    </Panel>
  )
}

export function CursorPanel({ params, set, reset, touch }: PanelProps & { touch: boolean }) {
  return (
    <Panel title="Cursor" onReset={reset}>
      <Row className="row--switch">
        <span className="row__label" id="pull-in-label">
          Pull in
        </span>
        <Toggle.Root
          className="switch"
          aria-labelledby="pull-in-label"
          pressed={params.cursor === 'pull'}
          onPressedChange={(on) => set({ cursor: on ? 'pull' : 'push' })}
        >
          <span className="switch__knob" />
        </Toggle.Root>
      </Row>
      <InlineSlider
        label="Strength"
        value={params.strength}
        min={0}
        max={100}
        step={1}
        format={(v) => (v === 0 ? 'Off' : String(Math.round(v)))}
        onChange={(strength) => set({ strength })}
      />
      <p className="panel__hint">{touch ? 'Drag over the canvas to try it.' : 'Move over the canvas to try it.'}</p>
    </Panel>
  )
}
