import { createLazuli, type LazuliInstance } from './engine'
import { PARAM_KEYS, type LazuliParams } from './params'

export const TAG_NAME = 'lazuli-bg'

const ATTRS = [...PARAM_KEYS, 'reduced-motion'] as const

// Base class is resolved lazily so importing this module on a server (no DOM) doesn't throw.
const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement

/**
 * `<lazuli-bg>`: fills its nearest positioned ancestor and sits behind that
 * ancestor's content. Attributes mirror the parameters (`core`, `edge`,
 * `ground`, `count`, `size`, `softness`, `texture`, `speed`, `cursor`,
 * `strength`, `seed`). `reduced-motion="ignore"` opts out of slowing down for
 * users who prefer reduced motion.
 */
export class LazuliElement extends Base {
  static get observedAttributes() {
    return ATTRS as unknown as string[]
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
    this.#instance = createLazuli(this.#surface, {
      ...this.#readAttributes(),
      respectReducedMotion: this.getAttribute('reduced-motion') !== 'ignore',
    })
  }

  disconnectedCallback() {
    this.#instance?.destroy()
    this.#instance = null
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    if (!this.#instance) return
    if (name === 'reduced-motion') {
      this.#instance.set({ respectReducedMotion: value !== 'ignore' })
    } else if (value !== null) {
      this.#instance.set({ [name]: value } as Partial<LazuliParams>)
    }
  }

  /** New random seed; reflected to the `seed` attribute. */
  shuffle(): number {
    const seed = this.#instance?.shuffle() ?? 0
    this.setAttribute('seed', String(seed))
    return seed
  }

  #readAttributes(): Partial<LazuliParams> {
    const out: Record<string, string> = {}
    for (const key of PARAM_KEYS) {
      const v = this.getAttribute(key)
      if (v !== null) out[key] = v
    }
    return out as Partial<LazuliParams>
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
