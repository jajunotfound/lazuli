// Offline still rendering (used for preset thumbnails). Frames are drawn on a separate canvas and context
// with a fixed time and no pointer, so the live background is never disturbed and
// the same input always gives the same image.

import { resolveConfig, type LazuliInput } from './config'
import type { LazuliInstance } from './engine'
import { createRenderer } from './renderer'
import { animateStack, hasKeys, keyPhase } from './animate'
import type { Stack } from './stack'

export interface SnapshotOptions {
  /** Output size in pixels. Defaults to the instance's canvas size × `scale`. */
  width?: number
  height?: number
  /** Multiplier on the instance's CSS size when width/height aren't given. Default 2. */
  scale?: number
  /** Animation time to render. Defaults to the instance's current time (0 for a plain config). */
  time?: number
  /** Device pixels per CSS pixel the image stands for. Defaults to `scale`. */
  pixelRatio?: number
  /** Render this layer stack instead of the config (which then only sets the size defaults). */
  stack?: Stack
}

/**
 * Render one frame to a PNG. Pass a running instance (uses its config, time and size)
 * or a config. Transparent backgrounds give a PNG with alpha.
 */
export async function snapshot(source: LazuliInstance | LazuliInput, opts: SnapshotOptions = {}): Promise<Blob> {
  const instance = isInstance(source) ? source : null
  const config = instance ? instance.config : resolveConfig(source as LazuliInput)
  const scale = opts.scale ?? 2
  const cssW = instance?.canvas.clientWidth || 1280
  const cssH = instance?.canvas.clientHeight || 832
  const width = Math.max(1, Math.round(opts.width ?? cssW * scale))
  const height = Math.max(1, Math.round(opts.height ?? cssH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const renderer = createRenderer(canvas, config, { sync: true, preserveDrawingBuffer: true })
  if (!renderer) throw new Error('[lazuli] WebGL is unavailable, so the image cannot be rendered.')
  const max = renderer.gl.getParameter(renderer.gl.MAX_VIEWPORT_DIMS) as Int32Array
  if (width > max[0] || height > max[1]) {
    renderer.destroy()
    throw new Error(`[lazuli] ${width}×${height} is larger than this GPU can render (${max[0]}×${max[1]}).`)
  }
  const time = opts.time ?? instance?.time ?? 0
  if (opts.stack) renderer.setStack(hasKeys(opts.stack) ? animateStack(opts.stack, keyPhase(opts.stack, time)) : opts.stack)
  const drawn = renderer.draw({
    time,
    mouse: [0.5, 0.5],
    vel: [0, 0],
    active: 0,
    dpr: opts.pixelRatio ?? (opts.width ? width / cssW : scale),
  })
  if (!drawn) {
    renderer.destroy()
    throw new Error('[lazuli] The shader could not be built, so the image cannot be rendered.')
  }
  try {
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('[lazuli] The image could not be encoded.'))), 'image/png'),
    )
  } finally {
    renderer.destroy()
  }
}

function isInstance(v: unknown): v is LazuliInstance {
  return !!v && typeof v === 'object' && 'canvas' in v && 'config' in v && typeof (v as LazuliInstance).set === 'function'
}
