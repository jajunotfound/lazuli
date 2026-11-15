// Drawn geometry on screen. Field units: the frame is 1 high, origin at its center, y up
// (the same space the shader draws drawn layers in).

import { textLayout, type Geometry } from 'lazuli-bg'

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export const toField = (b: Box, cx: number, cy: number): [number, number] => [
  (cx - b.left - b.width / 2) / b.height,
  -(cy - b.top - b.height / 2) / b.height,
]

/** Field point → overlay pixels (relative to the frame's top-left). */
export const toScreen = (b: Box, x: number, y: number): [number, number] => [b.width / 2 + x * b.height, b.height / 2 - y * b.height]

/** A gradient's two points (fullest, then where it fades out). */
export const ends = (g: Extract<Geometry, { kind: 'gradient' }>): [number, number][] => [[g.x1, g.y1], [g.x2, g.y2]]

/** Noise, cells and code layers fill the whole frame: nothing to drag or outline. */
export const isField = (g: Geometry): g is Extract<Geometry, { kind: 'noise' | 'cells' | 'code' }> => g.kind === 'noise' || g.kind === 'cells' || g.kind === 'code'

type Boxed = Extract<Geometry, { kind: 'ellipse' | 'rect' | 'text' }>
const boxed = (g: Geometry): g is Boxed => g.kind === 'ellipse' || g.kind === 'rect' || g.kind === 'text'

/** Half width and height of the shape's own box (text: its line, plus the stroke). */
export function halfSize(g: Boxed): [number, number] {
  if (g.kind === 'ellipse') return [g.rx, g.ry]
  if (g.kind === 'rect') return [g.w, g.h]
  const pad = (0.04 + g.weight * 0.14) * g.size
  return [(textLayout(g.text).width / 2) * g.size + pad, g.size / 2 + pad]
}

export function center(g: Geometry): [number, number] {
  if (isField(g)) return [0, 0]
  if (g.kind === 'gradient') return [(g.x1 + g.x2) / 2, (g.y1 + g.y2) / 2]
  if (g.kind !== 'path') return [g.x, g.y]
  const n = g.points.length
  return [g.points.reduce((a, p) => a + p[0], 0) / n, g.points.reduce((a, p) => a + p[1], 0) / n]
}

/** A point in the shape's own frame (unrotated, relative to its center). */
export function local(g: Geometry, x: number, y: number): [number, number] {
  const [cx, cy] = center(g)
  const a = boxed(g) ? -g.angle : 0
  const dx = x - cx, dy = y - cy
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]
}

/** Is the field point inside the shape (with a little slack, in field units)? */
export function hit(g: Geometry, x: number, y: number, slack = 0.01): boolean {
  if (isField(g)) return false
  if (g.kind === 'gradient') {
    // It fills the frame, so only its line picks it.
    const ex = g.x2 - g.x1, ey = g.y2 - g.y1
    const k = Math.min(1, Math.max(0, ((x - g.x1) * ex + (y - g.y1) * ey) / Math.max(ex * ex + ey * ey, 1e-9)))
    return Math.hypot(x - g.x1 - ex * k, y - g.y1 - ey * k) <= 0.015 + slack
  }
  if (g.kind === 'ellipse') {
    const [lx, ly] = local(g, x, y)
    return (lx / (g.rx + slack)) ** 2 + (ly / (g.ry + slack)) ** 2 <= 1
  }
  if (g.kind === 'rect' || g.kind === 'text') {
    const [lx, ly] = local(g, x, y)
    const [hx, hy] = halfSize(g)
    return Math.abs(lx) <= hx + slack && Math.abs(ly) <= hy + slack
  }
  let inside = false
  const p = g.points
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if (p[i][1] > y !== p[j][1] > y && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside
  }
  return inside
}

/** The same shape moved by (dx, dy). */
export function moved(g: Geometry, dx: number, dy: number): Geometry {
  if (isField(g)) return g
  if (g.kind === 'gradient') return { ...g, x1: g.x1 + dx, y1: g.y1 + dy, x2: g.x2 + dx, y2: g.y2 + dy }
  if (g.kind === 'path') return { ...g, points: g.points.map(([x, y]) => [x + dx, y + dy]) }
  return { ...g, x: g.x + dx, y: g.y + dy }
}

/** Ellipse or rect resized so a corner handle sits at the field point (center stays put). */
export function resized(g: Geometry, x: number, y: number, square = false): Geometry {
  if (g.kind === 'text') {
    // Text keeps its proportions: the size follows whichever side the handle pulls further.
    const [lx, ly] = local(g, x, y).map(Math.abs)
    const [hx, hy] = halfSize(g)
    return { ...g, size: Math.min(2, Math.max(0.02, g.size * Math.max(lx / hx, ly / hy))) }
  }
  if (g.kind !== 'ellipse' && g.kind !== 'rect') return g
  let [lx, ly] = local(g, x, y).map((v) => Math.max(0.01, Math.abs(v)))
  if (square) lx = ly = Math.max(lx, ly)
  return g.kind === 'ellipse' ? { ...g, rx: lx, ry: ly } : { ...g, w: lx, h: ly, radius: Math.min(g.radius, lx, ly) }
}

/** The four corners of an ellipse's or rect's box, in field units (rotated). */
export function corners(g: Geometry): [number, number][] {
  if (!boxed(g)) return []
  const [hx, hy] = halfSize(g)
  const c = Math.cos(g.angle), s = Math.sin(g.angle)
  return [[-hx, hy], [hx, hy], [hx, -hy], [-hx, -hy]].map(([u, v]) => [g.x + u * c - v * s, g.y + u * s + v * c])
}

/** A shape from a dragged box (two field points). */
export function fromDrag(kind: 'ellipse' | 'rect', a: [number, number], b: [number, number], square: boolean): Geometry {
  let hx = Math.abs(b[0] - a[0]) / 2, hy = Math.abs(b[1] - a[1]) / 2
  if (square) hx = hy = Math.max(hx, hy)
  const x = a[0] + Math.sign(b[0] - a[0] || 1) * hx, y = a[1] + Math.sign(b[1] - a[1] || 1) * hy
  hx = Math.max(hx, 0.01)
  hy = Math.max(hy, 0.01)
  return kind === 'ellipse' ? { kind, x, y, rx: hx, ry: hy, angle: 0 } : { kind, x, y, w: hx, h: hy, radius: Math.min(0.02, hx, hy), angle: 0 }
}
