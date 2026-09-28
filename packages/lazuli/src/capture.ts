// Offline rendering for exports. Frames are drawn on a separate canvas and context
// with a fixed time and no pointer, so the live background is never disturbed and
// the same input always gives the same image.

import { resolveConfig, type LazuliInput } from './config'
import type { LazuliInstance } from './engine'
import { mp4, type Sample } from './mux/mp4'
import { webm } from './mux/webm'
import { createRenderer } from './renderer'
import type { LazuliConfig } from './schema'

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
  renderer.draw({
    time: opts.time ?? instance?.time ?? 0,
    mouse: [0.5, 0.5],
    vel: [0, 0],
    active: 0,
    dpr: opts.pixelRatio ?? (opts.width ? width / cssW : scale),
  })
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

export interface RecordOptions {
  /** Output size in pixels (rounded down to even numbers, which H.264 needs). Default 1920×1080. */
  width?: number
  height?: number
  /** Frames per second. Default 30. */
  fps?: number
  /** Seconds to record. Default: one loop when motion.loop is set, else 6. */
  duration?: number
  /** With motion.loop set: how many whole loops (overrides duration). */
  loops?: number
  /** 'mp4' (H.264) or 'webm' (VP9). Default 'mp4'. */
  format?: 'mp4' | 'webm'
  /** Bits per second. Default scales with size and frame rate (~8 Mbit/s at 1080p30). */
  bitrate?: number
  /** Device pixels per CSS pixel the video stands for (sizes given in CSS px scale by it). */
  pixelRatio?: number
  /** Called with 0–1 as frames are encoded. */
  onProgress?(progress: number): void
  signal?: AbortSignal
}

const CODECS = {
  mp4: ['avc1.640033', 'avc1.4d0033', 'avc1.42e033', 'avc1.640028', 'avc1.42e01f'],
  webm: ['vp09.00.51.08', 'vp09.00.41.08', 'vp09.00.10.08', 'vp8'],
}

/**
 * Render a video offline, frame by frame at a fixed time step (so nothing is dropped, however
 * heavy the config), encode it with WebCodecs, and mux it to MP4 or WebM. No pointer. A
 * transparent background comes out over black (neither format keeps alpha here).
 */
export async function record(source: LazuliInstance | LazuliInput, opts: RecordOptions = {}): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('[lazuli] Video export needs WebCodecs (Chrome 94+, Safari 16.4+, Firefox 130+).')
  }
  const instance = isInstance(source) ? source : null
  const config: LazuliConfig = instance ? instance.config : resolveConfig(source as LazuliInput)
  const format = opts.format ?? 'mp4'
  const fps = opts.fps ?? 30
  const width = Math.max(2, Math.floor((opts.width ?? 1920) / 2) * 2)
  const height = Math.max(2, Math.floor((opts.height ?? 1080) / 2) * 2)
  const loop = config.motion.loop
  const seconds = loop > 0 ? loop * (opts.loops ?? (opts.duration ? opts.duration / loop : 1)) : (opts.duration ?? 6)
  const frames = Math.max(1, Math.round(seconds * fps))
  const bitrate = opts.bitrate ?? Math.round(8_000_000 * ((width * height) / (1920 * 1080)) * (fps / 30))

  const codec = await pickCodec(format, width, height, fps, bitrate)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const renderer = createRenderer(canvas, config, { sync: true, preserveDrawingBuffer: true })
  if (!renderer) throw new Error('[lazuli] WebGL is unavailable, so the video cannot be rendered.')

  const samples: Sample[] = []
  let description: Uint8Array<ArrayBuffer> | null = null
  let failure: Error | null = null
  const encoder = new VideoEncoder({
    output(chunk, meta) {
      const data = new Uint8Array(chunk.byteLength)
      chunk.copyTo(data)
      samples.push({ data, key: chunk.type === 'key' })
      const d = meta?.decoderConfig?.description
      if (d && !description) {
        const view = ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : new Uint8Array(d)
        description = new Uint8Array(view) // copy: the encoder may reuse its buffer
      }
    },
    error(e) {
      failure = e instanceof Error ? e : new Error(String(e))
    },
  })
  encoder.configure({
    codec,
    width,
    height,
    bitrate,
    framerate: fps,
    ...(format === 'mp4' ? { avc: { format: 'avc' as const } } : {}),
  })

  try {
    const start = loop > 0 ? 0 : (instance?.time ?? 0)
    const period = loop * config.motion.speed
    const dpr = opts.pixelRatio ?? width / 1280
    for (let i = 0; i < frames; i++) {
      if (opts.signal?.aborted) throw new DOMException('Recording was cancelled.', 'AbortError')
      if (failure) throw failure
      let time = start + (i / fps) * config.motion.speed
      if (loop > 0 && period > 0) time %= period
      renderer.draw({ time, mouse: [0.5, 0.5], vel: [0, 0], active: 0, dpr })
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) })
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
      frame.close()
      // Don't queue more than a few frames ahead of the encoder.
      while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 1))
      opts.onProgress?.((i + 1) / frames)
    }
    await encoder.flush()
    if (failure) throw failure
  } finally {
    if (encoder.state !== 'closed') encoder.close()
    renderer.destroy()
  }

  if (format === 'mp4') {
    if (!description) throw new Error('[lazuli] The encoder gave no H.264 configuration.')
    return mp4({ width, height, fps, avcC: description }, samples)
  }
  return webm({ width, height, fps }, samples)
}

async function pickCodec(format: 'mp4' | 'webm', width: number, height: number, fps: number, bitrate: number): Promise<string> {
  for (const codec of CODECS[format]) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps, ...(format === 'mp4' ? { avc: { format: 'avc' } } : {}) }
    try {
      if ((await VideoEncoder.isConfigSupported(config)).supported) return codec
    } catch {
      // Some browsers throw instead of reporting unsupported.
    }
  }
  throw new Error(`[lazuli] This browser can't encode ${format === 'mp4' ? 'H.264 (MP4)' : 'VP9 (WebM)'} at ${width}×${height}. Try the other format or a smaller size.`)
}
