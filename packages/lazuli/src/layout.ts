// Seeded blob layout. Computed on the CPU (not with a sin-hash in the shader) so a seed
// gives the same arrangement on every GPU, and so layouts can be composed like the
// Paper design: an anchor blob, an overlapping companion, a small satellite drop,
// then up to three extra shapes.

export const MAX_BLOBS = 6

/** Per blob: center (uv, x later scaled by aspect), radius (height units), x-squash. */
export interface Blob {
  x: number
  y: number
  r: number
  fx: number
  /** Orbit frequencies, amplitude (height units) and phase. */
  f1: number
  f2: number
  amp: number
  phase: number
}

/** mulberry32 over a hash of the seed's first three decimals. */
function rng(seed: number): () => number {
  let a = Math.imul(Math.round(seed * 1000) | 0, 0x9e3779b1) ^ 0x85ebca6b
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The blob layout for a seed. With `satellite: false` the small drop is left out and the
 * next extra blob takes its place; the anchor, companion and extras stay where they were.
 */
export function layoutFromSeed(seed: number, { satellite: sat = true }: { satellite?: boolean } = {}): Blob[] {
  const rand = rng(seed)
  const u = (lo: number, hi: number) => lo + (hi - lo) * rand()
  const sign = () => (rand() < 0.5 ? -1 : 1)
  const motion = (lo: number, hi: number) => ({ f1: u(0.3, 0.8), f2: u(0.3, 0.8), amp: u(lo, hi), phase: u(0, Math.PI * 2) })

  const anchor: Blob = { x: u(0.3, 0.7), y: u(0.35, 0.65), r: u(0.22, 0.32), fx: u(0.75, 1.35), ...motion(0.04, 0.09) }
  const companion: Blob = {
    x: anchor.x + sign() * u(0.05, 0.16),
    y: anchor.y + sign() * u(0.06, 0.2),
    r: u(0.16, 0.26),
    fx: u(0.5, 1.3),
    ...motion(0.04, 0.09),
  }
  const angle = u(0, Math.PI * 2)
  const dist = u(0.18, 0.3)
  const satellite: Blob = {
    x: anchor.x + Math.cos(angle) * dist,
    y: anchor.y + Math.sin(angle) * dist,
    r: u(0.045, 0.085),
    fx: u(0.9, 1.1),
    ...motion(0.06, 0.12),
  }
  const blobs = [anchor, companion, satellite]
  while (blobs.length < MAX_BLOBS + 1) {
    blobs.push({ x: u(0.2, 0.8), y: u(0.2, 0.8), r: u(0.08, 0.24), fx: u(0.7, 1.3), ...motion(0.05, 0.12) })
  }
  if (!sat) blobs.splice(2, 1)
  return blobs.slice(0, MAX_BLOBS)
}

export const MAX_WAVES = 8

/** Per ribbon: phase, speed, second-harmonic amount (0–1) and its phase. */
export function wavesFromSeed(seed: number): Float32Array {
  const rand = rng(seed + 0.101)
  const out = new Float32Array(MAX_WAVES * 4)
  for (let i = 0; i < MAX_WAVES; i++) {
    out.set([rand() * Math.PI * 2, 0.6 + rand() * 0.6, 0.3 + rand() * 0.7, rand() * Math.PI * 2], i * 4)
  }
  return out
}

/** Extra ring sources (index 1 and 2; source 0 is the center parameter), uv with y up. */
export function ringSourcesFromSeed(seed: number): Float32Array {
  const rand = rng(seed + 0.202)
  const out = new Float32Array(3 * 2)
  for (let i = 1; i < 3; i++) out.set([0.15 + rand() * 0.7, 0.15 + rand() * 0.7], i * 2)
  return out
}

/** An offset into the noise field, so each seed modulates dots and bands differently. */
export function noiseOffsetFromSeed(seed: number): [number, number] {
  const rand = rng(seed + 0.303)
  return [rand() * 100, rand() * 100]
}

/** Pack for the shader: u_blob[i] = (x, y, r, fx), u_orbit[i] = (f1, f2, amp, phase). */
export function packLayout(blobs: Blob[]): { blob: Float32Array; orbit: Float32Array } {
  const blob = new Float32Array(MAX_BLOBS * 4)
  const orbit = new Float32Array(MAX_BLOBS * 4)
  blobs.forEach((b, i) => {
    blob.set([b.x, b.y, b.r, b.fx], i * 4)
    orbit.set([b.f1, b.f2, b.amp, b.phase], i * 4)
  })
  return { blob, orbit }
}
