// Lazuli's stroke font: each glyph is a few polylines on a 4 × 6 grid (x 0–4, y 0 baseline to 6
// cap height). Text is drawn as the distance to these segments, thickened by the weight, so it
// stays a field: it melts, cuts, bends and animates like any drawn shape, and exports as plain GLSL.
// Round letters are octagons; the weight rounds them off. Capitals only (lowercase draws as capitals).

type Line = number[][]

const O: Line = [[1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 1], [3, 0], [1, 0]]
const P: Line = [[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]]
const DOT = (x: number, y: number): Line => [[x, y], [x, y]]

const GLYPHS: Record<string, Line[]> = {
  A: [[[0, 0], [2, 6], [4, 0]], [[0.7, 2.1], [3.3, 2.1]]],
  B: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]], [[3, 3], [4, 2], [4, 1], [3, 0], [0, 0]]],
  C: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1]]],
  D: [[[0, 0], [0, 6], [2.5, 6], [4, 4.5], [4, 1.5], [2.5, 0], [0, 0]]],
  E: [[[4, 6], [0, 6], [0, 0], [4, 0]], [[0, 3], [3, 3]]],
  F: [[[4, 6], [0, 6], [0, 0]], [[0, 3], [3, 3]]],
  G: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 3], [2, 3]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[1, 0], [1, 6]]],
  J: [[[4, 6], [4, 1], [3, 0], [1, 0], [0, 1]]],
  K: [[[0, 0], [0, 6]], [[4, 6], [0, 2]], [[1.4, 3.4], [4, 0]]],
  L: [[[0, 6], [0, 0], [4, 0]]],
  M: [[[0, 0], [0, 6], [2, 3], [4, 6], [4, 0]]],
  N: [[[0, 0], [0, 6], [4, 0], [4, 6]]],
  O: [O],
  P: [P],
  Q: [O, [[2.5, 1.5], [4, 0]]],
  R: [P, [[2, 3], [4, 0]]],
  S: [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 4], [1, 3], [3, 3], [4, 2], [4, 1], [3, 0], [1, 0], [0, 1]]],
  T: [[[0, 6], [4, 6]], [[2, 6], [2, 0]]],
  U: [[[0, 6], [0, 1], [1, 0], [3, 0], [4, 1], [4, 6]]],
  V: [[[0, 6], [2, 0], [4, 6]]],
  W: [[[0, 6], [1, 0], [2, 4], [3, 0], [4, 6]]],
  X: [[[0, 0], [4, 6]], [[0, 6], [4, 0]]],
  Y: [[[0, 6], [2, 3], [4, 6]], [[2, 3], [2, 0]]],
  Z: [[[0, 6], [4, 6], [0, 0], [4, 0]]],
  '0': [O, [[1.2, 1.5], [2.8, 4.5]]],
  '1': [[[0, 5], [1, 6], [1, 0]]],
  '2': [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [0, 0], [4, 0]]],
  '3': [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3], [1.5, 3]], [[3, 3], [4, 2], [4, 1], [3, 0], [1, 0], [0, 1]]],
  '4': [[[3, 0], [3, 6], [0, 2], [4, 2]]],
  '5': [[[4, 6], [0, 6], [0, 3], [3, 3], [4, 2], [4, 1], [3, 0], [1, 0], [0, 1]]],
  '6': [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]]],
  '7': [[[0, 6], [4, 6], [1.5, 0]]],
  '8': [[[1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3], [1, 3], [0, 2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3]]],
  '9': [[[4, 3], [1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 1], [3, 0], [1, 0], [0, 1]]],
  '.': [DOT(0, 0)],
  ',': [[[0.4, 0.3], [0, -1]]],
  '!': [[[0, 6], [0, 2]], DOT(0, 0)],
  '?': [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [2, 2.6], [2, 1.8]], DOT(2, 0)],
  "'": [[[0, 6], [0, 4.5]]],
  ':': [DOT(0, 0), DOT(0, 3.5)],
  '-': [[[0, 3], [2.5, 3]]],
  '+': [[[0, 3], [3, 3]], [[1.5, 1.5], [1.5, 4.5]]],
  '/': [[[0, 0], [3, 6]]],
  '=': [[[0, 2], [3, 2]], [[0, 4], [3, 4]]],
}

/** At most this many segments per text layer (the shader's loop bound). */
export const MAX_TEXT_SEGMENTS = 64
export const MAX_TEXT_LENGTH = 24
// Room between letters: enough that the heaviest weight's strokes don't touch.
const GAP = 2.8
const SPACE = 4

/** Characters the font can draw (after uppercasing), plus space. */
export const textChars = (text: string) => [...text.toUpperCase()].filter((c) => c === ' ' || c in GLYPHS).join('')

/**
 * The text's segments [x1, y1, x2, y2] in cap-height units, centered on the origin, and its
 * width. Stops before a glyph that would go past MAX_TEXT_SEGMENTS.
 */
export function textLayout(text: string): { segments: number[][]; width: number } {
  const placed: number[][] = []
  let pen = 0
  for (const c of textChars(text)) {
    if (c === ' ') {
      pen += SPACE
      continue
    }
    const lines = GLYPHS[c]
    const xs = lines.flat().map((p) => p[0])
    const lo = Math.min(...xs), hi = Math.max(...xs)
    const segs = lines.flatMap((l) => (l.length === 2 ? [[...l[0], ...l[1]]] : l.slice(1).map((p, i) => [...l[i], ...p])))
    if (placed.length + segs.length > MAX_TEXT_SEGMENTS) break
    for (const [x1, y1, x2, y2] of segs) placed.push([x1 - lo + pen, y1, x2 - lo + pen, y2])
    pen += hi - lo + GAP
  }
  const width = Math.max(pen - GAP, 0)
  const segments = placed.map(([x1, y1, x2, y2]) => [(x1 - width / 2) / 6, (y1 - 3) / 6, (x2 - width / 2) / 6, (y2 - 3) / 6])
  return { segments, width: width / 6 }
}

/** Stroke half-width in cap heights for a weight 0–1. */
export const textStroke = (weight: number) => 0.04 + weight * 0.14
