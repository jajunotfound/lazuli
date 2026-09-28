// Geometric seed search: find seeds whose t=0 layout matches frame 01's three blobs.
import { layoutFromSeed } from '../../packages/lazuli/src/layout.ts'

// Frame 01 targets in uv (y up) + gaussian radius (height units) + x-squash.
// Visible edge of exp(-d²/r²) at field 0.5 is 0.833·r.
const T = [
  { x: 0.4034, y: 0.3984, r: 0.2439, fx: 1.217 }, // tall deep blob → anchor (pixel-optimized)
  { x: 0.5127, y: 0.6136, r: 0.2215, fx: 0.637 }, // wide blob     → companion
  { x: 0.5933, y: 0.3121, r: 0.0621, fx: 1.06 }, // drop           → satellite
]
const W = [1, 1, 1.5] // the drop is small but defining

const N = Number(process.argv[2] ?? 3_000_000)
const top: [number, number][] = []
for (let i = 0; i < N; i++) {
  const seed = i / 10
  const L = layoutFromSeed(seed)
  let cost = 0
  for (let k = 0; k < 3; k++) {
    const a = L[k], t = T[k]
    cost += W[k] * ((a.x - t.x) ** 2 * 10 + (a.y - t.y) ** 2 * 10 + ((a.r - t.r) / t.r) ** 2 * 0.5 + (a.fx - t.fx) ** 2 * 0.5)
  }
  if (top.length < 10 || cost < top[top.length - 1][0]) {
    top.push([cost, seed])
    top.sort((a, b) => a[0] - b[0])
    if (top.length > 10) top.pop()
  }
}
for (const [c, s] of top) {
  const L = layoutFromSeed(s).slice(0, 3).map((b) => [b.x, b.y, b.r, b.fx].map((v) => v.toFixed(3)).join(' '))
  console.log(c.toFixed(5), s, '|', L.join(' | '))
}
