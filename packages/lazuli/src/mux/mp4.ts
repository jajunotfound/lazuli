// A minimal MP4 (ISO BMFF) writer for one H.264 video track at a constant frame rate:
// ftyp, mdat with every sample in one chunk, then moov with the sample tables. Samples
// are WebCodecs output in 'avc' format (length-prefixed NAL units), and the track's
// avcC box is the encoder's decoderConfig.description. Enough for players and editors.

/** Byte arrays backed by a plain ArrayBuffer (what Blob accepts). */
export type Bytes = Uint8Array<ArrayBuffer>

export interface Sample {
  data: Bytes
  key: boolean
}

export interface Mp4Track {
  width: number
  height: number
  fps: number
  /** avcC record (AVCDecoderConfigurationRecord) from the encoder. */
  avcC: Bytes
}

const TIMESCALE = 90000 // track ticks per second; divides evenly by 24, 25, 30, 50, 60

export function mp4(track: Mp4Track, samples: Sample[]): Blob {
  const delta = Math.round(TIMESCALE / track.fps)
  const duration = delta * samples.length
  const movieDuration = Math.round((duration / TIMESCALE) * 1000) // mvhd timescale 1000

  const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'))
  const mdatSize = 8 + samples.reduce((n, s) => n + s.data.length, 0)
  // Samples start right after ftyp and the mdat header.
  const chunkOffset = ftyp.length + 8

  const stbl = box(
    'stbl',
    full('stsd', 0, 0, u32(1), avc1(track)),
    full('stts', 0, 0, u32(1), u32(samples.length), u32(delta)),
    full('stss', 0, 0, u32(samples.filter((s) => s.key).length), ...samples.flatMap((s, i) => (s.key ? [u32(i + 1)] : []))),
    full('stsc', 0, 0, u32(1), u32(1), u32(samples.length), u32(1)),
    full('stsz', 0, 0, u32(0), u32(samples.length), ...samples.map((s) => u32(s.data.length))),
    full('stco', 0, 0, u32(1), u32(chunkOffset)),
  )
  const minf = box(
    'minf',
    full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)),
    box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))),
    stbl,
  )
  const mdia = box(
    'mdia',
    full('mdhd', 0, 0, u32(0), u32(0), u32(TIMESCALE), u32(duration), u16(0x55c4) /* 'und' */, u16(0)),
    full('hdlr', 0, 0, u32(0), str('vide'), u32(0), u32(0), u32(0), cstr('Lazuli')),
    minf,
  )
  const tkhd = full(
    'tkhd', 0, 3, // enabled, in movie
    u32(0), u32(0), u32(1), u32(0), u32(movieDuration),
    u32(0), u32(0), u16(0), u16(0), u16(0), u16(0),
    matrix(),
    u32(track.width << 16), u32(track.height << 16),
  )
  const mvhd = full(
    'mvhd', 0, 0,
    u32(0), u32(0), u32(1000), u32(movieDuration),
    u32(0x00010000), u16(0x0100), u16(0), u32(0), u32(0),
    matrix(),
    u32(0), u32(0), u32(0), u32(0), u32(0), u32(0),
    u32(2), // next track ID
  )
  const moov = box('moov', mvhd, box('trak', tkhd, mdia))

  const parts: BlobPart[] = [ftyp, concat(u32(mdatSize), str('mdat'))]
  for (const s of samples) parts.push(s.data)
  parts.push(moov)
  return new Blob(parts, { type: 'video/mp4' })
}

function avc1(t: Mp4Track): Bytes {
  return box(
    'avc1',
    new Uint8Array(6), u16(1), // reserved, data reference index
    u16(0), u16(0), u32(0), u32(0), u32(0), // pre-defined, reserved
    u16(t.width), u16(t.height),
    u32(0x00480000), u32(0x00480000), // 72 dpi
    u32(0), u16(1), // reserved, frame count
    new Uint8Array(32), // compressor name
    u16(0x0018), u16(0xffff), // depth, pre-defined -1
    box('avcC', t.avcC),
  )
}

// ---- bytes ----------------------------------------------------------------

function concat(...parts: Bytes[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function box(type: string, ...body: Bytes[]): Bytes {
  const content = concat(...body)
  return concat(u32(content.length + 8), str(type), content)
}

/** A "full box": version and 24-bit flags before the body. */
function full(type: string, version: number, flags: number, ...body: Bytes[]): Bytes {
  return box(type, new Uint8Array([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...body)
}

const u16 = (v: number) => new Uint8Array([(v >> 8) & 255, v & 255])
const u32 = (v: number) => new Uint8Array([(v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255])
const str = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)))
const cstr = (s: string) => concat(str(s), new Uint8Array([0]))
const matrix = () => concat(u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000))
