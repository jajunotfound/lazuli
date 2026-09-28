// Two checks that need a real GPU context, reported as JSON in window.bench:
//  - loops: with motion.loop set, the frame at t = period matches t = 0.
//  - timing: GPU time per frame for each shape and texture at a given size.
// Not part of the published build.
import { resolveConfig, type LazuliInput } from '../config'
import { createRenderer, type FrameState } from '../renderer'

const frame = (time: number, dpr: number): FrameState => ({ time, mouse: [0.5, 0.5], vel: [0, 0], active: 0, dpr })

function pixels(input: LazuliInput, time: number, w: number, h: number): Uint8Array {
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h })
  const r = createRenderer(canvas, resolveConfig(input), { sync: true, preserveDrawingBuffer: true })!
  r.draw(frame(time, 1))
  const out = new Uint8Array(w * h * 4)
  r.gl.readPixels(0, 0, w, h, r.gl.RGBA, r.gl.UNSIGNED_BYTE, out)
  r.destroy()
  return out
}

function maxDiff(a: Uint8Array, b: Uint8Array): number {
  let m = 0
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]))
  return m
}

const LOOPED: LazuliInput[] = [
  { shape: 'blobs' },
  { shape: 'waves' },
  { shape: 'bands' },
  { shape: 'rings', rings: { sources: 2 } },
  { shape: 'dots' },
  { shape: 'nodal' },
  { shape: 'blobs', texture: { type: 'noise' } },
]

function loops() {
  return LOOPED.map((input) => {
    const cfg = { ...input, motion: { loop: 7, speed: 0.6 }, texture: { type: 'none' as const, ...(input.texture as object) } }
    const period = 7 * 0.6
    const a = pixels(cfg, 0, 320, 200)
    const b = pixels(cfg, period, 320, 200)
    const mid = pixels(cfg, period / 2, 320, 200)
    return { config: JSON.stringify(input), seam: maxDiff(a, b), moves: maxDiff(a, mid) }
  })
}

const TIMED: [string, LazuliInput][] = [
  ['blobs (default)', {}],
  ['waves', { shape: 'waves' }],
  ['bands', { shape: 'bands' }],
  ['rings ×3', { shape: 'rings', rings: { sources: 3 } }],
  ['dots hex', { shape: 'dots' }],
  ['dots jitter', { shape: 'dots', dots: { grid: 'square', jitter: 50 } }],
  ['nodal', { shape: 'nodal' }],
  ['noise', { texture: { type: 'noise' } }],
  ['paper', { texture: { type: 'paper' } }],
  ['halftone', { texture: { type: 'halftone' } }],
  ['dither', { texture: { type: 'dither' } }],
  ['waves + halftone', { shape: 'waves', texture: { type: 'halftone' } }],
  ['dots + halftone', { shape: 'dots', texture: { type: 'halftone' } }],
]

function timing(w: number, h: number, frames = 40) {
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h })
  const r = createRenderer(canvas, resolveConfig({}), { sync: true })!
  const px = new Uint8Array(4)
  const rows = TIMED.map(([name, input]) => {
    r.setConfig(resolveConfig(input))
    // Warm up (compile, first upload), then time draws; reading a pixel waits for the GPU.
    for (let i = 0; i < 5; i++) r.draw(frame(i * 0.1, 2))
    r.gl.readPixels(0, 0, 1, 1, r.gl.RGBA, r.gl.UNSIGNED_BYTE, px)
    const t0 = performance.now()
    for (let i = 0; i < frames; i++) {
      r.draw(frame(i * 0.016, 2))
      r.gl.readPixels(0, 0, 1, 1, r.gl.RGBA, r.gl.UNSIGNED_BYTE, px)
    }
    return { name, ms: +((performance.now() - t0) / frames).toFixed(2) }
  })
  const info = r.gl.getExtension('WEBGL_debug_renderer_info')
  const gpu = info ? String(r.gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown'
  r.destroy()
  return { gpu, size: `${w}x${h}`, rows }
}

const q = new URLSearchParams(location.search)
const result: Record<string, unknown> = {}
if (q.has('loops')) result.loops = loops()
if (q.has('timing')) result.timing = timing(Number(q.get('w') ?? 2880), Number(q.get('h') ?? 1800))
Object.assign(window, { bench: result })
document.getElementById('out')!.textContent = JSON.stringify(result, null, 2)
