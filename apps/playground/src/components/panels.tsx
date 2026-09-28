import { isActive, type ParamPath } from 'lazuli-bg'
import type { ReactNode } from 'react'
import { HINTS } from '../controls'
import { MOTION_PRESETS, PARAM, SECTIONS, type Config, type Patch, type SectionId } from '../state'
import { Control } from './Control'
import { Panel, Row } from './Panel'
import { Segmented } from './Segmented'

export interface PanelProps {
  config: Config
  set(patch: Patch): void
  reset(): void
  compact: boolean
}

/** A section's active parameters, in schema-section order, with optional rows on top. */
export function SchemaPanel({ id, config, set, reset, compact, lead, footer }: PanelProps & { id: SectionId; lead?: ReactNode; footer?: ReactNode }) {
  const { title, paths } = SECTIONS[id]
  const shown = paths.filter((p: ParamPath) => !HINTS[p]?.hidden && isActive(PARAM[p], config))
  return (
    <Panel title={title} onReset={reset}>
      {lead}
      {shown.map((path) => (
        <Control key={path} path={path} config={config} set={set} compact={compact} />
      ))}
      {footer}
    </Panel>
  )
}

export function MotionPanel(props: PanelProps) {
  const speed = props.config.motion.speed
  const lead = (
    <Row className="row--preset">
      <span className="row__label">Preset</span>
      <Segmented
        label="Motion preset"
        options={MOTION_PRESETS}
        value={MOTION_PRESETS.find((p) => Math.abs(p.value - speed) < 1e-6)?.label ?? ''}
        onChange={(l) => props.set({ motion: { speed: MOTION_PRESETS.find((p) => p.label === l)!.value } })}
      />
    </Row>
  )
  return <SchemaPanel id="motion" {...props} lead={lead} />
}

export function CursorPanel({ touch, ...props }: PanelProps & { touch: boolean }) {
  const hint = <p className="panel__hint">{touch ? 'Drag over the canvas to try it.' : 'Move over the canvas to try it.'}</p>
  return <SchemaPanel id="cursor" {...props} footer={hint} />
}
