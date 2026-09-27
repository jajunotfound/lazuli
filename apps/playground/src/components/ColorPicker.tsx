import { HexColorInput, HexColorPicker } from 'react-colorful'
import { CloseIcon, EyedropperIcon } from '../icons'
import { SWATCHES } from '../state'

interface EyeDropperCtor {
  new (): { open(): Promise<{ sRGBHex: string }> }
}
const EyeDropper = (globalThis as { EyeDropper?: EyeDropperCtor }).EyeDropper

interface ColorPickerProps {
  label: string
  color: string
  onChange(color: string): void
  onClose(): void
}

export function ColorPicker({ label, color, onChange, onClose }: ColorPickerProps) {
  const pickFromScreen = async () => {
    if (!EyeDropper) return
    try {
      const { sRGBHex } = await new EyeDropper().open()
      onChange(sRGBHex.toLowerCase())
    } catch {
      // Cancelled with Esc.
    }
  }

  return (
    <div className="picker">
      <div className="picker__head">
        <span className="picker__title">{label}</span>
        <button type="button" className="icon-button picker__close" onClick={onClose} aria-label={`Close ${label.toLowerCase()} color picker`}>
          <CloseIcon width={14} height={14} />
        </button>
      </div>
      <HexColorPicker color={color} onChange={onChange} className="picker__area" />
      <div className="picker__fields">
        {EyeDropper && (
          <button type="button" className="picker__eyedropper" onClick={pickFromScreen} aria-label="Pick a color from the screen">
            <EyedropperIcon width={14} height={14} />
          </button>
        )}
        <label className="picker__hex">
          <span aria-hidden="true">#</span>
          <HexColorInput color={color} onChange={onChange} aria-label={`${label} hex value`} spellCheck={false} />
          <span className="picker__alpha" aria-hidden="true">
            100%
          </span>
        </label>
      </div>
      <div className="picker__swatches" role="group" aria-label="Preset colors">
        {SWATCHES.map((s) => (
          <button
            key={s}
            type="button"
            className="picker__swatch"
            style={{ backgroundColor: s, color: s }}
            aria-label={s}
            aria-pressed={s === color.toLowerCase()}
            onClick={() => onChange(s)}
          />
        ))}
      </div>
    </div>
  )
}
