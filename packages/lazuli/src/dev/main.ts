// Bare test page for the engine: full-screen instance plus a small boxed one,
// with a raw input for every parameter in the schema. Not part of the published build.
import { createLazuli, DEFAULT_CONFIG, getPath, isActive, PARAMS, type LazuliInput, type ParamDef } from '../index'

const bg = createLazuli(document.getElementById('bg')!, { motion: { reducedMotion: 'ignore' } })
const box = createLazuli(document.getElementById('box')!, { motion: { reducedMotion: 'ignore' } })
const panel = document.getElementById('panel') as HTMLFormElement

function patch(d: ParamDef, value: unknown): LazuliInput {
  const [s, k] = d.path.split('.')
  return (k === undefined ? { [s]: value } : { [s]: { [k]: value } }) as LazuliInput
}

function apply(p: LazuliInput) {
  bg.set(p)
  box.set(p)
  render()
}

function input(d: ParamDef): HTMLElement {
  const v = getPath(bg.config, d.path)
  switch (d.kind) {
    case 'number': {
      const el = Object.assign(document.createElement('input'), {
        type: Number.isFinite(d.min) ? 'range' : 'number',
        min: String(d.min),
        max: String(d.max),
        step: d.int ? '1' : String((d.max - d.min) / 200 || 1),
        value: String(v),
      })
      el.oninput = () => apply(patch(d, Number(el.value)))
      return el
    }
    case 'enum': {
      const el = document.createElement('select')
      for (const o of d.options) el.append(new Option(o, o, false, o === v))
      el.onchange = () => apply(patch(d, el.value))
      return el
    }
    case 'bool': {
      const el = Object.assign(document.createElement('input'), { type: 'checkbox', checked: v as boolean })
      el.onchange = () => apply(patch(d, el.checked))
      return el
    }
    case 'color': {
      const el = Object.assign(document.createElement('input'), { type: 'color', value: v as string })
      el.oninput = () => apply(patch(d, el.value))
      return el
    }
    case 'colors': {
      const el = Object.assign(document.createElement('input'), { type: 'text', value: (v as string[]).join(',') })
      el.onchange = () => apply(patch(d, el.value))
      return el
    }
  }
}

function render() {
  panel.replaceChildren()
  for (const d of PARAMS) {
    if (!isActive(d, bg.config)) continue
    const out = document.createElement('output')
    const v = getPath(bg.config, d.path)
    out.textContent = v === getPath(DEFAULT_CONFIG, d.path) ? '' : '•'
    panel.append(label(d.path), input(d), out)
  }
  const row = document.createElement('div')
  row.className = 'row'
  const shuffle = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Shuffle (R)' })
  shuffle.onclick = doShuffle
  const destroy = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Destroy box' })
  destroy.onclick = () => box.destroy()
  row.append(shuffle, destroy)
  panel.append(row)
}

function doShuffle() {
  const seed = bg.shuffle()
  box.set({ seed })
  render()
}

addEventListener('keydown', (e) => {
  if (e.key === 'r' && !(e.target instanceof HTMLInputElement)) doShuffle()
})

function label(text: string) {
  return Object.assign(document.createElement('span'), { textContent: text })
}

render()
Object.assign(window, { lazuli: { bg, box } })
