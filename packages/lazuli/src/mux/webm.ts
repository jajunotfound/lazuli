// A minimal WebM (Matroska) writer for one VP9 video track: EBML header, then a Segment
// with Info, Tracks and Clusters of SimpleBlocks. Clusters start at keyframes (and at
// least every ~30 s, since block times are 16-bit milliseconds from the cluster start).
// No Cues, so seeking scans; playback and editing work.

import type { Bytes, Sample } from './mp4'

export interface WebmTrack {
  width: number
  height: number
  fps: number
}

export function webm(track: WebmTrack, samples: Sample[]): Blob {
  const frameMs = 1000 / track.fps
  const header = el(0x1a45dfa3, [
    el(0x4286, uint(1)), // EBMLVersion
    el(0x42f7, uint(1)), // EBMLReadVersion
    el(0x42f2, uint(4)), // EBMLMaxIDLength
    el(0x42f3, uint(8)), // EBMLMaxSizeLength
    el(0x4282, text('webm')), // DocType
    el(0x4287, uint(4)), // DocTypeVersion
    el(0x4285, uint(2)), // DocTypeReadVersion
  ])
  const info = el(0x1549a966, [
    el(0x2ad7b1, uint(1_000_000)), // TimecodeScale: 1 ms
    el(0x4d80, text('lazuli-bg')), // MuxingApp
    el(0x5741, text('lazuli-bg')), // WritingApp
    el(0x4489, float64(samples.length * frameMs)), // Duration
  ])
  const tracks = el(0x1654ae6b, [
    el(0xae, [
      el(0xd7, uint(1)), // TrackNumber
      el(0x73c5, uint(1)), // TrackUID
      el(0x83, uint(1)), // TrackType: video
      el(0x9c, uint(0)), // FlagLacing
      el(0x86, text('V_VP9')), // CodecID
      el(0x23e383, uint(Math.round(1e9 / track.fps))), // DefaultDuration (ns)
      el(0xe0, [el(0xb0, uint(track.width)), el(0xba, uint(track.height))]), // Video
    ]),
  ])

  const clusters: Bytes[] = []
  let blocks: Bytes[] = []
  let start = 0
  const flush = () => {
    if (blocks.length) clusters.push(el(0x1f43b675, [el(0xe7, uint(start)), ...blocks]))
    blocks = []
  }
  samples.forEach((s, i) => {
    const t = Math.round(i * frameMs)
    if (i === 0 || (s.key && t - start > 0) || t - start > 30_000) {
      flush()
      start = t
    }
    const rel = t - start
    // SimpleBlock: track number (vint), int16 time from the cluster, flags (0x80 = key).
    blocks.push(el(0xa3, [new Uint8Array([0x81, (rel >> 8) & 255, rel & 255, s.key ? 0x80 : 0]), s.data]))
  })
  flush()

  const segment = el(0x18538067, [info, tracks, ...clusters])
  return new Blob([header, segment], { type: 'video/webm' })
}

// ---- EBML -------------------------------------------------------------------

function concat(parts: Bytes[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function idBytes(id: number): Bytes {
  const bytes: number[] = []
  for (let v = id; v > 0; v = Math.floor(v / 256)) bytes.unshift(v & 255)
  return new Uint8Array(bytes)
}

/** Element size as an 8-byte vint (always valid, keeps the writer simple). */
function size(n: number): Bytes {
  const out = new Uint8Array(8)
  out[0] = 0x01
  let v = n
  for (let i = 7; i >= 1; i--) {
    out[i] = v % 256
    v = Math.floor(v / 256)
  }
  return out
}

function el(id: number, body: Bytes | Bytes[]): Bytes {
  const content = Array.isArray(body) ? concat(body) : body
  return concat([idBytes(id), size(content.length), content])
}

function uint(v: number): Bytes {
  const bytes: number[] = []
  let x = v
  do {
    bytes.unshift(x % 256)
    x = Math.floor(x / 256)
  } while (x > 0)
  return new Uint8Array(bytes)
}

const text = (s: string): Bytes => new Uint8Array(new TextEncoder().encode(s))

function float64(v: number): Bytes {
  const out = new Uint8Array(8)
  new DataView(out.buffer).setFloat64(0, v)
  return out
}
