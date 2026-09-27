import * as ToggleGroup from '@radix-ui/react-toggle-group'

interface SegmentedProps<T extends string> {
  label: string
  options: readonly { label: T; value?: unknown }[]
  /** Selected option label, or '' when none matches (e.g. slider dragged off a preset). */
  value: T | ''
  onChange(label: T): void
  className?: string
}

export function Segmented<T extends string>({ label, options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      className={`segmented ${className ?? ''}`}
      aria-label={label}
      value={value}
      // Clicking the selected item would clear it; keep a preset selected instead.
      onValueChange={(v) => v && onChange(v as T)}
    >
      {options.map((o) => (
        <ToggleGroup.Item key={o.label} value={o.label} className="segmented__item">
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
