// Keyframed drawn layers: the stack as it is at time t of the loop (0–1). Between keyframes the
// values ease in and out; the loop wraps from the last keyframe back to the first.

import type { DrawnKey, DrawnLayer, Geometry, Stack } from './stack'

const ease = (x: number) => x * x * (3 - 2 * x)
const mix = (a: number, b: number, k: number) => a + (b - a) * k

function mixGeom(a: Geometry, b: Geometry, k: number): Geometry {
  if (a.kind === 'ellipse' && b.kind === 'ellipse') return { kind: 'ellipse', x: mix(a.x, b.x, k), y: mix(a.y, b.y, k), rx: mix(a.rx, b.rx, k), ry: mix(a.ry, b.ry, k), angle: mix(a.angle, b.angle, k) }
  if (a.kind === 'rect' && b.kind === 'rect') return { kind: 'rect', x: mix(a.x, b.x, k), y: mix(a.y, b.y, k), w: mix(a.w, b.w, k), h: mix(a.h, b.h, k), radius: mix(a.radius, b.radius, k), angle: mix(a.angle, b.angle, k) }
  if (a.kind === 'path' && b.kind === 'path' && a.points.length === b.points.length) {
    return { kind: 'path', points: a.points.map(([x, y], i) => [mix(x, b.points[i][0], k), mix(y, b.points[i][1], k)]) }
  }
  return k < 0.5 ? a : b
}

/** A layer's values at time t from its keyframes (sorted by t). */
export function keyAt(keys: readonly DrawnKey[], t: number): Omit<DrawnKey, 't'> {
  if (keys.length === 1) return keys[0]
  const sorted = [...keys].sort((a, b) => a.t - b.t)
  let i = sorted.findIndex((k) => k.t > t)
  if (i === -1) i = 0
  const b = sorted[i]
  const a = sorted[(i - 1 + sorted.length) % sorted.length]
  const span = (b.t - a.t + 1) % 1 || 1
  const k = ease(((t - a.t + 1) % 1) / span)
  return { geom: mixGeom(a.geom, b.geom, k), melt: mix(a.melt, b.melt, k), soft: mix(a.soft, b.soft, k) }
}

/** The stack at time t (0–1 of the loop). Layers without keyframes stay as they are. */
export function animateStack(s: Readonly<Stack>, t: number): Stack {
  const keys = s.keys
  if (!keys || !Object.keys(keys).length) return s as Stack
  return {
    ...s,
    shapes: s.shapes.map((x) => {
      const k = x.kind === 'drawn' ? keys[x.id] : undefined
      return k?.length ? ({ ...x, ...keyAt(k, t) } as DrawnLayer) : x
    }),
  }
}

export const hasKeys = (s: Readonly<Stack>) => !!s.keys && Object.values(s.keys).some((k) => k.length > 0)
