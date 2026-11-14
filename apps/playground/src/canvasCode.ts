// The canvas as code, both ways. `writeCode` turns the stack's drawn shapes, palette and
// background into a small GLSL-like text; `readCode` reads that text back (or an edited copy)
// and `applyCode` folds it into the stack. Only Lazuli's own shape language is understood:
// ellipse, box and polygon, joined by melt, cut or intersect, then palette and background.

import { cleanGeometry, type CombineMode, type DrawnLayer, type Geometry, type Stack } from 'lazuli-bg'

const n = (v: number) => String(Number(v.toFixed(3)))
const vec2 = (a: number, b: number) => `vec2(${n(a)}, ${n(b)})`
const JOIN: Record<CombineMode, string> = { merge: 'melt', add: 'melt', cut: 'cut', intersect: 'intersect' }
const FROM_JOIN: Record<string, CombineMode> = { melt: 'merge', cut: 'cut', intersect: 'intersect' }

/** One shape as code, e.g. `ellipse(p, vec2(0.1, 0), vec2(0.2, 0.15))`. */
export function shapeCode(l: DrawnLayer): string {
  const g = l.geom
  // Warps wrap the point, front warp outermost: swirl(noise(p)).
  const p = l.warps.filter((w) => w.visible).reduceRight((acc, w) => `${w.type}(${acc})`, 'p')
  if (g.kind === 'ellipse') return `ellipse(${p}, ${vec2(g.x, g.y)}, ${vec2(g.rx, g.ry)}${g.angle ? `, ${n(g.angle)}` : ''})`
  if (g.kind === 'rect') return `box(${p}, ${vec2(g.x, g.y)}, ${vec2(g.w, g.h)}, ${n(g.radius)}${g.angle ? `, ${n(g.angle)}` : ''})`
  return `polygon(${p}, ${g.points.map(([x, y]) => vec2(x, y)).join(', ')})`
}

const drawnBackToFront = (s: Stack) => s.shapes.filter((x): x is DrawnLayer => x.kind === 'drawn').reverse()

export function writeCode(s: Stack): string {
  const back = drawnBackToFront(s)
  const out = ['// Your canvas as code. Type to change it; Alt-drag a number to slide it.', '']
  out.push('float field(vec2 p) {')
  back.forEach((l, i) => {
    const note = `// ${l.name}${l.visible ? '' : ' (hidden)'}`
    out.push(i === 0 ? `  float d = ${shapeCode(l)}; ${note}` : `  d = ${JOIN[l.combine]}(d, ${shapeCode(l)}, ${n(l.melt)}); ${note}`)
  })
  if (!back.length) out.push('  float d = 1e9; // nothing drawn yet')
  out.push('  return d;', '}', '')
  out.push('vec4 color(vec2 p) {')
  out.push(`  return palette(field(p), ${n(back[back.length - 1]?.soft ?? 0.3)}); // softness`)
  out.push('}', '')
  const light = s.color.light ?? { amount: 0, shine: 0.5 }
  out.push(`light(${n(light.amount)}, ${n(light.shine)}); // 0 = flat color, 1 = chrome; then shine`)
  out.push(`palette(${s.color.settings.palette.join(', ')});`)
  const bg = s.background.settings
  out.push(`background(${bg.type === 'solid' ? bg.color : bg.type === 'gradient' ? bg.gradient.join(', ') : 'none'});`)
  const generated = s.shapes.filter((x) => x.kind === 'shape')
  if (generated.length) out.push('', `// plus ${generated.map((x) => x.name).join(', ')}: built-in shapes (delete this line to remove them)`)
  return out.join('\n')
}

// ---- reading -----------------------------------------------------------------------

export interface CodeError {
  line: number
  message: string
}

interface ParsedShape {
  geom: Geometry
  join: CombineMode
  melt: number
  name?: string
  hidden: boolean
  /** The shape's own code, to tell an untouched shape from an edited one. */
  source: string
}

export interface ParsedCode {
  shapes: ParsedShape[]
  soft?: number
  palette?: string[]
  background?: string[] | 'none'
  light?: { amount: number; shine: number }
  /** Built-in (generated) shapes stay only while the "// plus …" line is in the text. */
  keepBuiltIn: boolean
}

/** Split `a, f(b, c), d` at top-level commas. */
function splitArgs(s: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** The text inside the parentheses that open at `open`, or null if they never close. */
function inside(s: string, open: number): string | null {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++
    if (s[i] === ')' && --depth === 0) return s.slice(open + 1, i)
  }
  return null
}

const num = (s: string): number | null => (/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/.test(s.trim()) ? Number(s) : null)
function v2(s: string): [number, number] | null {
  const m = /^vec2\((.*)\)$/.exec(s.trim())
  if (!m) return null
  const [a, b] = splitArgs(m[1]).map(num)
  return a === null || b === null || a === undefined || b === undefined ? null : [a, b]
}

/** A shape expression → geometry, or an error message. */
function readShape(expr: string): { geom: Geometry; source: string } | string {
  const m = /\b(ellipse|box|polygon)\s*\(/.exec(expr)
  if (!m) return 'Expected ellipse(…), box(…) or polygon(…)'
  const open = m.index + m[0].length - 1
  const body = inside(expr, open)
  if (body === null) return 'A parenthesis is not closed'
  const args = splitArgs(body).slice(1) // the first argument is the point, p
  const source = expr.slice(m.index, open + body.length + 2)
  if (m[1] === 'ellipse') {
    const [c, r, a] = [v2(args[0] ?? ''), v2(args[1] ?? ''), args[2] === undefined ? 0 : num(args[2])]
    if (!c || !r || a === null) return 'ellipse(p, vec2(x, y), vec2(width, height), turn?)'
    const geom = cleanGeometry({ kind: 'ellipse', x: c[0], y: c[1], rx: r[0], ry: r[1], angle: a })
    return geom ? { geom, source } : 'That ellipse is out of range'
  }
  if (m[1] === 'box') {
    const [c, h, r, a] = [v2(args[0] ?? ''), v2(args[1] ?? ''), args[2] === undefined ? 0 : num(args[2]), args[3] === undefined ? 0 : num(args[3])]
    if (!c || !h || r === null || a === null) return 'box(p, vec2(x, y), vec2(width, height), corner?, turn?)'
    const geom = cleanGeometry({ kind: 'rect', x: c[0], y: c[1], w: h[0], h: h[1], radius: r, angle: a })
    return geom ? { geom, source } : 'That box is out of range'
  }
  const pts = args.map(v2)
  if (pts.some((x) => !x)) return 'polygon(p, vec2(x, y), vec2(x, y), …)'
  const geom = cleanGeometry({ kind: 'path', points: pts as [number, number][] })
  return geom ? { geom, source } : 'A polygon needs 3 to 32 points'
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function readCode(text: string): { code: ParsedCode } | { error: CodeError } {
  const code: ParsedCode = { shapes: [], keepBuiltIn: /^\s*\/\/ plus /m.test(text) }
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const comment = /\/\/\s*(.*)$/.exec(raw)?.[1] ?? ''
    const line = raw.replace(/\/\/.*$/, '').trim()
    const fail = (message: string) => ({ error: { line: i + 1, message } })
    if (!line || /^(float field|vec4 color)\s*\(vec2 p\)\s*\{$/.test(line) || line === '}' || line === 'return d;') continue
    if (/^float d = 1e9;$/.test(line)) continue
    let m: RegExpExecArray | null
    if ((m = /^float d = (.*);$/.exec(line))) {
      if (code.shapes.length) return fail('Only the first shape starts with "float d ="; join the rest with melt, cut or intersect')
      const s = readShape(m[1])
      if (typeof s === 'string') return fail(s)
      code.shapes.push({ ...s, join: 'merge', melt: 0.5, name: comment.replace(/\s*\(hidden\)$/, '') || undefined, hidden: /\(hidden\)/.test(comment) })
      continue
    }
    if ((m = /^d = (melt|cut|intersect)\s*\((.*)\);$/.exec(line))) {
      const args = splitArgs(m[2])
      if (args[0] !== 'd' || args.length !== 3) return fail(`${m[1]}(d, shape, amount)`)
      const s = readShape(args[1])
      if (typeof s === 'string') return fail(s)
      const melt = num(args[2])
      if (melt === null || melt < 0 || melt > 1) return fail('The amount is a number from 0 to 1')
      if (!code.shapes.length) return fail('Start with "float d = shape;" before joining')
      code.shapes.push({ ...s, join: FROM_JOIN[m[1]], melt, name: comment.replace(/\s*\(hidden\)$/, '') || undefined, hidden: /\(hidden\)/.test(comment) })
      continue
    }
    if ((m = /^return palette\(field\(p\),\s*(.*)\);$/.exec(line))) {
      const soft = num(m[1])
      if (soft === null || soft < 0 || soft > 1) return fail('Softness is a number from 0 to 1')
      code.soft = soft
      continue
    }
    if ((m = /^light\((.*)\);$/.exec(line))) {
      const [a, b] = splitArgs(m[1]).map(num)
      if (a === null || a === undefined || a < 0 || a > 1 || (b !== undefined && (b === null || b < 0 || b > 1))) return fail('light(amount, shine): numbers from 0 to 1')
      code.light = { amount: a, shine: b ?? 0.5 }
      continue
    }
    if ((m = /^palette\((.*)\);$/.exec(line))) {
      const stops = splitArgs(m[1])
      if (stops.length < 2 || stops.length > 5 || stops.some((c) => !HEX.test(c))) return fail('palette(#hex, #hex, …): 2 to 5 colors')
      code.palette = stops.map((c) => c.toLowerCase())
      continue
    }
    if ((m = /^background\((.*)\);$/.exec(line))) {
      const stops = splitArgs(m[1])
      if (stops.length === 1 && stops[0] === 'none') code.background = 'none'
      else if (stops.length >= 1 && stops.length <= 3 && stops.every((c) => HEX.test(c))) code.background = stops.map((c) => c.toLowerCase())
      else return fail('background(#hex), background(#hex, #hex) or background(none)')
      continue
    }
    return fail('Lazuli doesn’t understand this line')
  }
  return { code }
}

/** The stack with the code's shapes, palette and background. Untouched shapes keep their exact values. */
export function applyCode(s: Stack, code: ParsedCode): Stack {
  const old = drawnBackToFront(s)
  const names = { ellipse: 'Ellipse', rect: 'Rectangle', path: 'Path' }
  let next = 1
  const taken = new Set(s.shapes.map((x) => x.id))
  const freshId = () => {
    while (taken.has(`drawn-${next}`)) next++
    taken.add(`drawn-${next}`)
    return `drawn-${next}`
  }
  const back: DrawnLayer[] = code.shapes.map((p, i) => {
    const was = old[i]
    if (was && shapeCode(was) === p.source) {
      // Same shape text as before: keep its exact numbers (the code shows them rounded).
      return { ...was, combine: i === 0 ? was.combine : p.join, melt: i === 0 ? was.melt : p.melt, name: p.name ?? was.name, visible: !p.hidden }
    }
    const base: DrawnLayer = was ?? { id: freshId(), kind: 'drawn', name: names[p.geom.kind], visible: true, geom: p.geom, melt: 0.5, combine: 'merge', soft: 0.3, warps: [] }
    return { ...base, geom: p.geom, combine: i === 0 ? base.combine : p.join, melt: i === 0 ? base.melt : p.melt, name: p.name ?? (was ? was.name : names[p.geom.kind]), visible: !p.hidden }
  })
  if (code.soft !== undefined && back.length) back[back.length - 1] = { ...back[back.length - 1], soft: code.soft }
  const out: Stack = { ...s, shapes: [...back.reverse(), ...(code.keepBuiltIn ? s.shapes.filter((x) => x.kind === 'shape') : [])] }
  if (code.light) out.color = { ...out.color, light: code.light }
  if (code.palette) out.color = { ...s.color, settings: { ...s.color.settings, palette: code.palette } }
  if (code.background) {
    const b = s.background.settings
    out.background = {
      ...s.background,
      settings:
        code.background === 'none'
          ? { ...b, type: 'transparent' }
          : code.background.length === 1
            ? { ...b, type: 'solid', color: code.background[0] }
            : { ...b, type: 'gradient', gradient: code.background },
    }
  }
  // Keyframes only for shapes that still exist.
  if (out.keys) out.keys = Object.fromEntries(Object.entries(out.keys).filter(([id]) => out.shapes.some((x) => x.id === id)))
  return out
}
