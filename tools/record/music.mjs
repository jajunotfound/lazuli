// Lazuli's tour music, made here (no samples, nothing licensed): slow airy pads on a four-chord
// loop, a few soft bell notes, a quiet low root, a little room, and a soft tick for each click.
//
// Usage: node tools/record/music.mjs <out.wav> <seconds> [clicks.json]   (clicks: [seconds, ...])

import { readFileSync, writeFileSync } from 'node:fs'

const [out = 'music.wav', secondsArg = '84', clicksFile] = process.argv.slice(2)
const SR = 44100
const seconds = Number(secondsArg)
const N = Math.ceil(seconds * SR)
const L = new Float32Array(N), R = new Float32Array(N)
const clicks = clicksFile ? JSON.parse(readFileSync(clicksFile, 'utf8')) : []

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)
// Dmaj9, Bm11, Gmaj9, A6/9: open, unresolved, calm.
const CHORDS = [
  [50, 57, 62, 66, 69, 76],
  [47, 54, 62, 66, 69, 73],
  [43, 50, 59, 62, 66, 69],
  [45, 52, 61, 64, 66, 71],
]
const BAR = 4.2 // seconds per chord

// Deterministic randomness, so every render is the same.
let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

function add(buf, start, fn, len) {
  const s0 = Math.max(0, Math.floor(start * SR)), s1 = Math.min(N, Math.floor((start + len) * SR))
  for (let i = s0; i < s1; i++) buf[i] += fn((i - s0) / SR)
}
const both = (start, fn, len, pan = 0) => {
  add(L, start, (t) => fn(t) * (1 - Math.max(0, pan)), len)
  add(R, start, (t) => fn(t) * (1 + Math.min(0, pan)), len)
}

// Pads: three slightly detuned soft voices per note, slow in, slow out, overlapping the next chord.
const bars = Math.ceil(seconds / BAR)
for (let b = 0; b < bars; b++) {
  const chord = CHORDS[b % CHORDS.length]
  const start = b * BAR
  const len = BAR + 2.2
  chord.slice(1).forEach((m, k) => {
    const f = hz(m)
    const pan = ((k % 2) * 2 - 1) * 0.25
    for (const d of [-0.12, 0, 0.11]) {
      const fd = f * 2 ** (d / 12), ph = rand() * 6.28
      both(start, (t) => {
        const env = Math.min(1, t / 1.6) * Math.min(1, (len - t) / 2.0)
        const wob = 1 + 0.002 * Math.sin(t * 0.7 + ph)
        return 0.018 * env * (Math.sin(6.283 * fd * wob * t + ph) + 0.18 * Math.sin(2 * 6.283 * fd * t + ph))
      }, len, pan)
    }
  })
  // The root, low and quiet.
  const root = hz(chord[0] - 12)
  both(start, (t) => 0.022 * Math.min(1, t / 1.2) * Math.min(1, (BAR + 1 - t) / 1.4) * Math.sin(6.283 * root * t), BAR + 1)
  // Bells: a few chord tones up high, each a soft sine with a long fade.
  for (let j = 0; j < 3; j++) {
    if (rand() < 0.35) continue
    const m = chord[2 + Math.floor(rand() * 4)] + 12
    const at = start + 0.4 + j * 1.3 + rand() * 0.3
    const f = hz(m)
    both(at, (t) => 0.035 * Math.exp(-t * 1.6) * (Math.sin(6.283 * f * t) + 0.25 * Math.sin(6.283 * f * 2.01 * t) * Math.exp(-t * 3)), 3.2, (rand() - 0.5) * 0.8)
  }
}

// Clicks: a short, soft wooden tick.
for (const c of clicks) {
  both(c, (t) => 0.09 * Math.exp(-t * 90) * Math.sin(6.283 * 1650 * t) + 0.03 * Math.exp(-t * 60) * (rand() * 2 - 1), 0.08)
}

// A small room: Schroeder reverb (four combs into two allpasses), mixed in quietly.
function reverb(x, offset) {
  const y = new Float32Array(N)
  for (const [ms, g] of [[29.7, 0.8], [37.1, 0.79], [41.1, 0.78], [43.7, 0.77]]) {
    const D = Math.floor(((ms + offset) / 1000) * SR), buf = new Float32Array(D)
    let p = 0, lp = 0
    for (let i = 0; i < N; i++) {
      const out = buf[p]
      lp = out * 0.6 + lp * 0.4 // damp the highs
      buf[p] = x[i] + lp * g
      p = (p + 1) % D
      y[i] += out * 0.25
    }
  }
  for (const ms of [5, 1.7]) {
    const D = Math.floor((ms / 1000) * SR), buf = new Float32Array(D)
    let p = 0
    for (let i = 0; i < N; i++) {
      const b = buf[p], v = y[i] + b * 0.5
      buf[p] = v
      y[i] = b - v * 0.5
      p = (p + 1) % D
    }
  }
  return y
}
const rl = reverb(L, 0), rr = reverb(R, 2.3)

// Mix, fade in and out, and bring the peak to about -4 dB.
let peak = 0
for (let i = 0; i < N; i++) {
  const t = i / SR
  const fade = Math.min(1, t / 1.5) * Math.min(1, (seconds - t) / 3)
  L[i] = (L[i] * 0.75 + rl[i] * 0.45) * fade
  R[i] = (R[i] * 0.75 + rr[i] * 0.45) * fade
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
}
const gain = 0.63 / (peak || 1)

// 16-bit stereo WAV.
const data = Buffer.alloc(N * 4)
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * gain * 32767))), i * 4)
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * gain * 32767))), i * 4 + 2)
}
const head = Buffer.alloc(44)
head.write('RIFF', 0)
head.writeUInt32LE(36 + data.length, 4)
head.write('WAVEfmt ', 8)
head.writeUInt32LE(16, 16)
head.writeUInt16LE(1, 20)
head.writeUInt16LE(2, 22)
head.writeUInt32LE(SR, 24)
head.writeUInt32LE(SR * 4, 28)
head.writeUInt16LE(4, 32)
head.writeUInt16LE(16, 34)
head.write('data', 36)
head.writeUInt32LE(data.length, 40)
writeFileSync(out, Buffer.concat([head, data]))
console.log(`wrote ${out} (${seconds.toFixed(1)} s, ${clicks.length} clicks)`)
