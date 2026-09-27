// Bare test page for the engine: full-screen instance plus a small boxed one,
// with raw inputs for every parameter. Not part of the published build.
import { createLazuli, DEFAULTS, RANGES, type LazuliParams } from '../index'

const bg = createLazuli(document.getElementById('bg')!, { respectReducedMotion: false })
const box = createLazuli(document.getElementById('box')!, { respectReducedMotion: false })
const panel = document.getElementById('panel') as HTMLFormElement

type NumKey = keyof typeof RANGES
const steps: Record<NumKey, number> = { count: 1, size: 1, softness: 1, texture: 1, speed: 0.01, strength: 1 }

function apply(patch: Partial<LazuliParams>) {
  bg.set(patch)
  box.set(patch)
}

for (const key of ['core', 'edge', 'ground'] as const) {
  const input = Object.assign(document.createElement('input'), { type: 'color', value: DEFAULTS[key] })
  input.oninput = () => apply({ [key]: input.value })
  panel.append(label(key), input, document.createElement('span'))
}

for (const key of Object.keys(RANGES) as NumKey[]) {
  const [min, max] = RANGES[key]
  const input = Object.assign(document.createElement('input'), {
    type: 'range', min: String(min), max: String(max), step: String(steps[key]), value: String(DEFAULTS[key]),
  })
  const out = document.createElement('output')
  out.textContent = input.value
  input.oninput = () => {
    out.textContent = input.value
    apply({ [key]: Number(input.value) })
  }
  panel.append(label(key), input, out)
}

const row = document.createElement('div')
row.className = 'row'
const pull = Object.assign(document.createElement('input'), { type: 'checkbox', id: 'pull' })
pull.onchange = () => apply({ cursor: pull.checked ? 'pull' : 'push' })
const pullLabel = Object.assign(document.createElement('label'), { htmlFor: 'pull', textContent: 'pull in' })
const shuffle = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Shuffle (R)' })
const seedOut = document.createElement('output')
seedOut.textContent = `seed ${bg.params.seed}`
const doShuffle = () => {
  const seed = bg.shuffle()
  box.set({ seed })
  seedOut.textContent = `seed ${seed}`
}
shuffle.onclick = doShuffle
const destroy = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Destroy box' })
destroy.onclick = () => {
  box.destroy()
  destroy.disabled = true
}
row.append(pull, pullLabel, shuffle, destroy, seedOut)
panel.append(row)

addEventListener('keydown', (e) => {
  if (e.key === 'r' && !(e.target instanceof HTMLInputElement)) doShuffle()
})

function label(text: string) {
  return Object.assign(document.createElement('span'), { textContent: text })
}

Object.assign(window, { lazuli: { bg, box } })
