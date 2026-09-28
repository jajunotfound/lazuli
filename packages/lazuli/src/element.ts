import { fromFlat, LEGACY_KEYS, resolveConfig, type LazuliInput } from './config'
import { createLazuli, type LazuliInstance } from './engine'
import { isPreset } from './presets'
import { DEFAULT_CONFIG, getPath, PARAMS } from './schema'

export const TAG_NAME = 'lazuli-bg'

const ATTRS = [...new Set([...PARAMS.map((d) => d.attr), ...LEGACY_KEYS, 'config', 'preset'])]

// Base class is resolved lazily so importing this module on a server (no DOM) doesn't throw.
const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement

/**
 * `<lazuli-bg>`: fills its nearest positioned ancestor and sits behind that
 * ancestor's content. Every parameter has an attribute (`shape`, `blobs-count`,
 * `color-palette="#4c78d8,#1f48a8"`, `background-type="transparent"`, …; see
 * PARAMS), plus `config='{…json…}'` for a whole config at once. The v1 names
 * (`core`, `edge`, `ground`, `count`, `size`, `softness`, `texture`, `speed`,
 * `cursor`, `strength`) still work. `preset="silk"` starts from a preset.
 * Precedence: individual attribute > `config` > `preset` > defaults.
 * `reduced-motion="ignore"` opts out of slowing down for users who prefer
 * reduced motion.
 */
export class LazuliElement extends Base {
  static get observedAttributes() {
    return ATTRS
  }

  #instance: LazuliInstance | null = null
  #surface: HTMLDivElement

  constructor() {
    super()
    const root = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host { display: block; position: absolute; inset: 0; z-index: -1; overflow: hidden; }
      :host([hidden]) { display: none; }
      div { position: absolute; inset: 0; }
    `
    this.#surface = document.createElement('div')
    root.append(style, this.#surface)
  }

  /** The running engine instance, or null while disconnected. */
  get instance() {
    return this.#instance
  }

  connectedCallback() {
    if (this.#instance) return
    this.#instance = createLazuli(this.#surface, this.#readAttributes())
  }

  disconnectedCallback() {
    this.#instance?.destroy()
    this.#instance = null
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    if (!this.#instance) return
    if (name === 'config' || name === 'preset') {
      this.#instance.set(resolveConfig(this.#readAttributes()))
      return
    }
    if (value !== null) {
      this.#instance.set(fromFlat({ [name]: value }, 'attr'))
      return
    }
    // Removed: back to what `config` / `preset` (or the default) says for that parameter.
    const d = PARAMS.find((p) => p.attr === name)
    if (d) this.#instance.set(fromFlat({ [name]: String(getPath(this.#base(), d.path)) }, 'attr'))
  }

  /** New random seed; reflected to the `seed` attribute. */
  shuffle(): number {
    const seed = this.#instance?.shuffle() ?? 0
    this.setAttribute('seed', String(seed))
    return seed
  }

  /** What the `config` and `preset` attributes describe, before individual attributes. */
  #base() {
    const preset = this.getAttribute('preset')
    return resolveConfig({ ...this.#configAttribute(), ...(isPreset(preset) ? { preset } : {}) }, DEFAULT_CONFIG)
  }

  #configAttribute(): LazuliInput {
    const raw = this.getAttribute('config')
    if (!raw) return {}
    try {
      return JSON.parse(raw) as LazuliInput
    } catch {
      console.warn('[lazuli] Ignoring the config attribute: it is not valid JSON.')
      return {}
    }
  }

  #readAttributes(): LazuliInput {
    const record: Record<string, string> = {}
    for (const name of ATTRS) {
      const v = this.getAttribute(name)
      if (v !== null && name !== 'config' && name !== 'preset') record[name] = v
    }
    return resolveConfig(fromFlat(record, 'attr'), this.#base())
  }
}

/** Register `<lazuli-bg>`. Safe to call more than once and on the server. */
export function defineLazuliElement(tagName = TAG_NAME) {
  if (typeof customElements === 'undefined' || customElements.get(tagName)) return
  customElements.define(tagName, class extends LazuliElement {})
}

declare global {
  interface HTMLElementTagNameMap {
    'lazuli-bg': LazuliElement
  }
}
