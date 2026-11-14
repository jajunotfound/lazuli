import * as Slider from '@radix-ui/react-slider'
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

interface InlineSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange(value: number): void
  format?(value: number): string
}

/**
 * The whole 40px row is the slider: a darker fill grows from the left with a thin handle at its
 * edge, label on the left, value on the right. The handle hides while the fill's edge is over
 * the label or the value, so it never cuts through the words. Radix keeps the thumb inside the track, so the
 * thumb center sits at 9px + p·(width − 18px); the fill uses the same formula.
 */
export function InlineSlider({ label, value, min, max, step, onChange, format = String }: InlineSliderProps) {
  const [dragging, setDragging] = useState(false)
  const [under, setUnder] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const valueRef = useRef<HTMLSpanElement>(null)
  const p = (value - min) / (max - min)
  const text = format(value)

  useLayoutEffect(() => {
    const r = root.current, l = labelRef.current, v = valueRef.current
    if (!r || !l || !v) return
    const edge = 9 + p * (r.clientWidth - 18)
    // Over the words at either end: the label on the left or the value on the right.
    setUnder(edge < l.offsetLeft + l.offsetWidth + 8 || edge > v.offsetLeft - 8)
  }, [p, label, text])

  return (
    <Slider.Root
      ref={root}
      className="inline-slider"
      data-dragging={dragging || undefined}
      data-under={under || undefined}
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
      <span className="inline-slider__label" ref={labelRef} aria-hidden="true">
        {label}
      </span>
      <span className="inline-slider__value" ref={valueRef} aria-hidden="true">
        {text}
      </span>
      <Slider.Thumb className="inline-slider__thumb" aria-label={label} aria-valuetext={text} />
    </Slider.Root>
  )
}
