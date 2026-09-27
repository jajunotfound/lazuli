import * as Slider from '@radix-ui/react-slider'
import { useState, type CSSProperties } from 'react'

interface InlineSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange(value: number): void
  format?(value: number): string
  /** Show a dot at each step ahead of the handle (for small integer ranges). */
  stepped?: boolean
}

/**
 * The whole 48px row is the slider: a darker fill grows from the left with a
 * thin handle at its edge, label on the left, value on the right.
 * Radix keeps the thumb inside the track, so the thumb center sits at
 * 9px + p·(width − 18px); the fill and step dots use the same formula.
 */
export function InlineSlider({ label, value, min, max, step, onChange, format = String, stepped }: InlineSliderProps) {
  const [dragging, setDragging] = useState(false)
  const p = (value - min) / (max - min)
  const text = format(value)

  const dots: number[] = []
  if (stepped) for (let v = min; v <= max; v += step) if (v > value) dots.push((v - min) / (max - min))

  return (
    <Slider.Root
      className="inline-slider"
      data-dragging={dragging || undefined}
      style={{ '--p': p } as CSSProperties}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => onChange(v)}
      onPointerDown={() => setDragging(true)}
      onValueCommit={() => setDragging(false)}
      onLostPointerCapture={() => setDragging(false)}
    >
      <Slider.Track className="inline-slider__track">
        <span className="inline-slider__fill" />
      </Slider.Track>
      {dots.map((d) => (
        <span key={d} className="inline-slider__dot" style={{ '--d': d } as CSSProperties} aria-hidden="true" />
      ))}
      <span className="inline-slider__label" aria-hidden="true">
        {label}
      </span>
      <span className="inline-slider__value" aria-hidden="true">
        {text}
      </span>
      <Slider.Thumb className="inline-slider__thumb" aria-label={label} aria-valuetext={text} />
    </Slider.Root>
  )
}
