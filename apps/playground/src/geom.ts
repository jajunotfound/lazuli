// Drawn geometry on screen. Field units: the frame is 1 high, origin at its center, y up
// (the same space the shader draws drawn layers in).

import type { Geometry } from 'lazuli-bg'

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

export function center(g: Geometry): [number, number] {
  if (g.kind !== 'path') return [g.x, g.y]
  const n = g.points.length
  return [g.points.reduce((a, p) => a + p[0], 0) / n, g.points.reduce((a, p) => a + p[1], 0) / n]
}

/** A point in the shape's own frame (unrotated, relative to its center). */
export function local(g: Geometry, x: number, y: number): [number, number] {
  const [cx, cy] = center(g)
  const a = g.kind === 'path' ? 0 : -g.angle
  const dx = x - cx, dy = y - cy
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]
}

/** Is the field point inside the shape (with a little slack, in field units)? */
export function hit(g: Geometry, x: number, y: number, slack = 0.01): boolean {
  if (g.kind === 'ellipse') {
    const [lx, ly] = local(g, x, y)
    return (lx / (g.rx + slack)) ** 2 + (ly / (g.ry + slack)) ** 2 <= 1
  }
  if (g.kind === 'rect') {
    const [lx, ly] = local(g, x, y)
    return Math.abs(lx) <= g.w + slack && Math.abs(ly) <= g.h + slack
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
  if (g.kind === 'path') return { ...g, points: g.points.map(([x, y]) => [x + dx, y + dy]) }
  return { ...g, x: g.x + dx, y: g.y + dy }
}

/** Ellipse or rect resized so a corner handle sits at the field point (center stays put). */
export function resized(g: Geometry, x: number, y: number, square = false): Geometry {
  if (g.kind === 'path') return g
  let [lx, ly] = local(g, x, y).map((v) => Math.max(0.01, Math.abs(v)))
  if (square) lx = ly = Math.max(lx, ly)
  return g.kind === 'ellipse' ? { ...g, rx: lx, ry: ly } : { ...g, w: lx, h: ly, radius: Math.min(g.radius, lx, ly) }
}

/** The four corners of an ellipse's or rect's box, in field units (rotated). */
export function corners(g: Geometry): [number, number][] {
  if (g.kind === 'path') return []
  const hx = g.kind === 'ellipse' ? g.rx : g.w
  const hy = g.kind === 'ellipse' ? g.ry : g.h
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
