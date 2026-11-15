// The layer stack: what a Lazuli shader is built from. A stack compiles to one fragment shader
// (compile.ts). Its shape is fixed so illegal stacks can't be written down: Textures in front,
// then the one Color map, the optional stack-wide Cursor, the Shapes (each with its own Warps),
// and the Background last. Lists are frontmost first, like a Figma layers panel.
//
// Today's flat config (schema.ts) is still the public API: configToStack / stackToConfig
// convert between the two, and every config is a one-shape stack.

import { MAX_TEXT_LENGTH, textChars } from './font'
import { cloneConfig, DEFAULT_CONFIG, type CursorMode, type LazuliConfig, type ShapeType, type TextureType } from './schema'

export type ShapeSettings = Pick<LazuliConfig, 'blobs' | 'waves' | 'bands' | 'rings' | 'dots' | 'nodal'>
export type CombineMode = 'merge' | 'add' | 'cut' | 'intersect'
export type WarpType = 'cursor' | 'swirl' | 'noise' | 'ripple' | 'kaleido' | 'repeat' | 'twist'
export type ScreenTexture = 'halftone' | 'dither'

interface LayerBase {
  id: string
  name: string
  visible: boolean
}

export interface ShapeLayer extends LayerBase {
  kind: 'shape'
  type: ShapeType
  /** Layout seed for this shape. */
  seed: number
  /** How this shape combines with the shapes below it (milestone 3). */
  combine: CombineMode
  /** Settings for every shape type, so switching type and back restores them. */
  settings: ShapeSettings
  /** Front first. At most MAX_WARPS_PER_SHAPE. */
  warps: WarpLayer[]
}

export interface CursorWarp extends LayerBase {
  kind: 'warp'
  type: 'cursor'
  mode: Exclude<CursorMode, 'off'>
  strength: number
  radius: number
  smear: number
  follow: number
}

export interface FieldWarp extends LayerBase {
  kind: 'warp'
  type: Exclude<WarpType, 'cursor'>
  strength: number
  size: number
}

export type WarpLayer = CursorWarp | FieldWarp

/**
 * What a drawn layer is, in height units around the frame's center, y up (the frame is 1 high).
 * Ellipse and rect take half sizes; a path is a closed polygon (pen curves arrive as points).
 */
export type Geometry =
  | { kind: 'ellipse'; x: number; y: number; rx: number; ry: number; angle: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; radius: number; angle: number }
  | { kind: 'path'; points: [number, number][] }
  /** Clouds from noise: scale = features per frame height, level 0–1 = how much is filled. */
  | { kind: 'noise'; scale: number; level: number }
  /** Organic tiles: scale = cells per frame height, gap 0–1 between them. */
  | { kind: 'cells'; scale: number; gap: number }
  /** A ramp of the palette: fullest at (x1, y1), fading out at (x2, y2); radial grows out from (x1, y1). */
  | { kind: 'gradient'; x1: number; y1: number; x2: number; y2: number; radial: boolean }
  /**
   * Your own GLSL: the body of `float name(vec2 q, float t)`, returning a signed distance
   * (negative inside). q is the point (frame height 1, center origin, y up), t the time.
   */
  | { kind: 'code'; name: string; glsl: string }
  /** Words in Lazuli's stroke font (font.ts): size = cap height, weight 0–1 = stroke thickness. */
  | { kind: 'text'; text: string; x: number; y: number; size: number; weight: number; angle: number }

/** A shape you drew. Drawn layers next to each other join into one field (see compile.ts). */
export interface DrawnLayer extends LayerBase {
  kind: 'drawn'
  geom: Geometry
  /** 0–1: how softly it joins the drawn layer below (0 = a hard edge). */
  melt: number
  /** How it joins what's below: merge, add, cut, intersect. */
  combine: CombineMode
  /** 0–1: edge softness of the field it starts. */
  soft: number
  warps: WarpLayer[]
}

export type ShapeEntry = ShapeLayer | DrawnLayer

export interface TextureLayer extends LayerBase {
  kind: 'texture'
  settings: LazuliConfig['texture'] & { type: Exclude<TextureType, 'none'> }
}

/**
 * Light on drawn shapes. amount = bevel depth, shine 0 (matte, lit from the sun) to 1 (chrome,
 * mirrors the palette). The sun sits at (x, y) in field units, or follows the pointer; shadow
 * (0–1) darkens the ground on the far side of the shapes.
 */
export interface LightSettings {
  amount: number
  shine: number
  x?: number
  y?: number
  follow?: boolean
  shadow?: number
}

/** Where the light sits unless moved: up and to the left. */
export const DEFAULT_SUN: readonly [number, number] = [-0.34, 0.49]

export interface ColorLayer extends LayerBase {
  kind: 'color'
  settings: LazuliConfig['color']
  /**
   * Light on drawn shapes: each becomes a rounded surface that reflects the palette (dark below,
   * light above) with a highlight. amount 0 is flat color; 1 is deep, chrome-like. shine 0–1.
   */
  light?: LightSettings
  /**
   * Around drawn shapes: contour rings (0 = none, else rings per frame height), a glow (0–1), and
   * an outline (0 = none, up to 1 = thick) that wobbles like a sketch by `sketch` (0–1).
   */
  look?: { contours: number; glow: number; outline?: number; sketch?: number }
}

export interface BackgroundLayer extends LayerBase {
  kind: 'background'
  settings: LazuliConfig['background']
}

export type Layer = ShapeLayer | DrawnLayer | WarpLayer | TextureLayer | ColorLayer | BackgroundLayer

export interface Stack {
  /** Front first. At most MAX_TEXTURES, at most one screen texture (halftone, dither). */
  textures: TextureLayer[]
  color: ColorLayer
  /** The stack-wide pointer warp: moves every shape. */
  cursor: CursorWarp | null
  /** Front first: generated shapes (at most MAX_SHAPES) and drawn ones (at most MAX_DRAWN). May be empty. */
  shapes: ShapeEntry[]
  background: BackgroundLayer
  motion: LazuliConfig['motion']
  quality: LazuliConfig['quality']
  /** Keyframes for drawn layers, by layer id: what the layer is at each point of the loop. */
  keys?: Record<string, DrawnKey[]>
  /** How drawn shapes move on their own: drift about, or breathe in and out. Unset = still. */
  move?: MoveMode
}

export type MoveMode = 'drift' | 'breathe'

/** A drawn layer at one moment of the loop (t from 0 to 1). */
export interface DrawnKey {
  t: number
  geom: Geometry
  melt: number
  soft: number
  /** How the layer moves from this keyframe to the next. Default smooth (ease in and out). */
  ease?: KeyEase
}

export type KeyEase = 'smooth' | 'linear' | 'hold'

export const MAX_SHAPES = 4
export const MAX_DRAWN = 8
export const MAX_PATH_POINTS = 32
export const MAX_TEXTURES = 3
export const MAX_WARPS_PER_SHAPE = 2
export const SCREEN_TEXTURES: readonly TextureType[] = ['halftone', 'dither', 'hatch']

const clone = <T>(v: T): T => structuredClone(v)

// ---- config ⇄ stack ---------------------------------------------------------

const SHAPE_KEYS = ['blobs', 'waves', 'bands', 'rings', 'dots', 'nodal'] as const

const LABELS: Record<ShapeType, string> = { blobs: 'Blobs', waves: 'Waves', bands: 'Bands', rings: 'Rings', dots: 'Dots', nodal: 'Plate' }
const TEXTURE_LABELS: Record<TextureType, string> = { none: 'None', grain: 'Grain', noise: 'Noise', paper: 'Paper', halftone: 'Halftone', dither: 'Dither', hatch: 'Lines' }

/** A config is a one-shape stack. Ids are fixed, so the same config gives the same stack. */
export function configToStack(c: Readonly<LazuliConfig>): Stack {
  const settings = Object.fromEntries(SHAPE_KEYS.map((k) => [k, clone(c[k])])) as ShapeSettings
  const t = c.texture
  return {
    textures: t.type === 'none' ? [] : [{ id: 'texture-1', kind: 'texture', name: TEXTURE_LABELS[t.type], visible: true, settings: clone(t) as TextureLayer['settings'] }],
    color: { id: 'color', kind: 'color', name: 'Color map', visible: true, settings: clone(c.color) },
    cursor:
      c.cursor.mode === 'off'
        ? null
        : { id: 'cursor', kind: 'warp', type: 'cursor', name: 'Cursor', visible: true, mode: c.cursor.mode, strength: c.cursor.strength, radius: c.cursor.radius, smear: c.cursor.smear, follow: c.cursor.follow },
    shapes: [{ id: 'shape-1', kind: 'shape', type: c.shape.type, name: LABELS[c.shape.type], visible: true, seed: c.seed, combine: 'merge', settings, warps: [] }],
    background: { id: 'background', kind: 'background', name: 'Background', visible: true, settings: clone(c.background) },
    motion: clone(c.motion),
    quality: c.quality,
  }
}

/**
 * The config a stack would be if it had one shape: its front visible shape, front visible
 * texture and visible cursor. Used where the flat config is still the API (attributes, URL,
 * code export) until those learn stacks.
 */
export function stackToConfig(s: Readonly<Stack>): LazuliConfig {
  const c = cloneConfig(DEFAULT_CONFIG)
  // The front visible generated shape; a stack of drawn shapes only keeps the default settings.
  const generated = s.shapes.filter((x): x is ShapeLayer => x.kind === 'shape')
  const shape = generated.find((x) => x.visible) ?? generated[0]
  if (shape) {
    for (const k of SHAPE_KEYS) (c as unknown as Record<string, unknown>)[k] = clone(shape.settings[k])
    c.shape = { type: shape.type }
    c.seed = shape.seed
  }
  const tex = s.textures.find((x) => x.visible)
  c.texture = tex ? clone(tex.settings) : { ...c.texture, type: 'none' }
  c.color = clone(s.color.settings)
  const cur = s.cursor?.visible ? s.cursor : shapeCursor(s)
  c.cursor = cur ? { mode: cur.mode, strength: cur.strength, radius: cur.radius, smear: cur.smear, follow: cur.follow } : { ...c.cursor, mode: 'off' }
  c.background = clone(s.background.settings)
  c.motion = clone(s.motion)
  c.quality = s.quality
  return c
}

// ---- structure key ------------------------------------------------------------

/**
 * What decides the shader program: which shapes and textures are drawn, in order, and how the
 * shapes combine. Values
 * (sliders, colors, seeds) never change it, so editing them only re-uploads uniforms.
 */
/** A short hash (djb2) so a code layer's text can be part of a program key. */
function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export function stackKey(s: Readonly<Stack>): string {
  // The backmost shape's combine mode has nothing below it, so it doesn't count.
  const shapes = s.shapes
    .filter((x) => x.visible)
    .map((x, i, all) => {
      const warps = x.warps.filter((w) => w.visible).map((w) => w.type)
      const name = x.kind === 'drawn' ? `drawn-${x.geom.kind}${x.geom.kind === 'code' ? `:${hash(x.geom.glsl)}` : ''}` : x.type
      return `${name}${i < all.length - 1 ? `:${x.combine}` : ''}${warps.length ? `[${warps.join('+')}]` : ''}`
    })
  const tex = s.textures.find((x) => x.visible)?.settings.type ?? 'none'
  return `${shapes.join(',')}|${tex}${s.move ? `|${s.move}` : ''}`
}

// ---- operations ---------------------------------------------------------------

export type StackOp =
  | { op: 'add'; layer: 'shape'; type: ShapeType; index?: number }
  | { op: 'add'; layer: 'drawn'; geom: Geometry; index?: number }
  | { op: 'add'; layer: 'texture'; type: Exclude<TextureType, 'none'>; index?: number }
  | { op: 'add'; layer: 'warp'; type: Exclude<WarpType, 'cursor'>; parent: string; index?: number }
  | { op: 'add'; layer: 'cursor'; parent?: string }
  | { op: 'delete'; id: string }
  | { op: 'move'; id: string; index: number }
  | { op: 'hide'; id: string; visible: boolean }
  | { op: 'duplicate'; id: string }
  | { op: 'combine'; id: string; combine: CombineMode }
  | { op: 'rename'; id: string; name: string }
  | { op: 'tune'; id: string; strength?: number; size?: number }
  | { op: 'reshape'; id: string; geom?: Geometry; melt?: number; soft?: number }
  | { op: 'light'; amount?: number; shine?: number; x?: number; y?: number; follow?: boolean; shadow?: number }
  | { op: 'look'; contours?: number; glow?: number; outline?: number; sketch?: number }
  | { op: 'movement'; move: MoveMode | 'still' }

export type StackError =
  | 'not_found'
  | 'bad_move'
  | 'shape_limit'
  | 'texture_limit'
  | 'screen_limit'
  | 'warp_limit'
  | 'cursor_limit'
  | 'last_shape'
  | 'required_layer'
  | 'fixed_layer'
  | 'bad_index'
  | 'cannot_hide'
  | 'cannot_duplicate'
  | 'wrong_kind'
  | 'bad_name'
  | 'drawn_limit'
  | 'bad_geometry'

export type StackResult = { ok: true; stack: Stack } | { ok: false; error: StackError }

const fail = (error: StackError): StackResult => ({ ok: false, error })

/** Where a layer sits: which list holds it (and the shape that owns it, for a warp). */
type Place =
  | { list: 'textures'; index: number }
  | { list: 'shapes'; index: number }
  | { list: 'warps'; index: number; shape: number }
  | { list: 'color' }
  | { list: 'cursor' }
  | { list: 'background' }

export function findLayer(s: Readonly<Stack>, id: string): { layer: Layer; place: Place } | null {
  if (s.color.id === id) return { layer: s.color, place: { list: 'color' } }
  if (s.background.id === id) return { layer: s.background, place: { list: 'background' } }
  if (s.cursor?.id === id) return { layer: s.cursor, place: { list: 'cursor' } }
  const t = s.textures.findIndex((x) => x.id === id)
  if (t >= 0) return { layer: s.textures[t], place: { list: 'textures', index: t } }
  for (let i = 0; i < s.shapes.length; i++) {
    if (s.shapes[i].id === id) return { layer: s.shapes[i], place: { list: 'shapes', index: i } }
    const w = s.shapes[i].warps.findIndex((x) => x.id === id)
    if (w >= 0) return { layer: s.shapes[i].warps[w], place: { list: 'warps', index: w, shape: i } }
  }
  return null
}

function allIds(s: Readonly<Stack>): Set<string> {
  const ids = new Set([s.color.id, s.background.id, ...s.textures.map((x) => x.id)])
  if (s.cursor) ids.add(s.cursor.id)
  for (const sh of s.shapes) {
    ids.add(sh.id)
    for (const w of sh.warps) ids.add(w.id)
  }
  return ids
}

/** The next free id like `shape-3`. */
function nextId(s: Readonly<Stack>, prefix: string): string {
  const ids = allIds(s)
  let n = 1
  while (ids.has(`${prefix}-${n}`)) n++
  return `${prefix}-${n}`
}

/** A stack has at most one cursor: stack-wide, or on one shape. */
export function hasCursor(s: Readonly<Stack>): boolean {
  return !!s.cursor || s.shapes.some((x) => x.warps.some((w) => w.type === 'cursor'))
}

/** The visible cursor on a shape, if the stack-wide one isn't in use. */
export function shapeCursor(s: Readonly<Stack>): CursorWarp | null {
  for (const x of s.shapes) {
    if (!x.visible) continue
    const w = x.warps.find((w): w is CursorWarp => w.type === 'cursor' && w.visible)
    if (w) return w
  }
  return null
}

const screens = (s: Readonly<Stack>) => s.textures.filter((x) => SCREEN_TEXTURES.includes(x.settings.type)).length

function insertAt<T>(list: T[], item: T, index = 0): boolean {
  if (index < 0 || index > list.length || !Number.isInteger(index)) return false
  list.splice(index, 0, item)
  return true
}

/**
 * Apply one operation. Returns a new stack, or the rule it breaks; the input is never changed.
 * Rules: shapes 1–4; textures 0–3 with at most one screen texture; warps 0–2 per shape and one
 * cursor per stack; the Color map and Background can't be deleted, moved or hidden; layers
 * reorder only among their own kind (a warp within its shape).
 */
export function applyOp(input: Readonly<Stack>, op: StackOp): StackResult {
  const s = clone(input) as Stack
  switch (op.op) {
    case 'add': {
      if (op.layer === 'drawn') {
        if (s.shapes.filter((x) => x.kind === 'drawn').length >= MAX_DRAWN) return fail('drawn_limit')
        const geom = cleanGeometry(op.geom)
        if (!geom) return fail('bad_geometry')
        const names = { ellipse: 'Ellipse', rect: 'Rectangle', path: 'Path', noise: 'Noise', cells: 'Cells', text: 'Text', gradient: 'Gradient', code: 'Code' }
        const layer: DrawnLayer = { id: nextId(s, 'drawn'), kind: 'drawn', name: names[geom.kind], visible: true, geom, melt: 0.5, combine: 'merge', soft: geom.kind === 'text' ? 0.08 : 0.3, warps: [] }
        return insertAt(s.shapes, layer, op.index) ? { ok: true, stack: s } : fail('bad_index')
      }
      if (op.layer === 'shape') {
        if (s.shapes.filter((x) => x.kind === 'shape').length >= MAX_SHAPES) return fail('shape_limit')
        const base = s.shapes.find((x): x is ShapeLayer => x.kind === 'shape')
        const settings = Object.fromEntries(SHAPE_KEYS.map((k) => [k, clone(DEFAULT_CONFIG[k])])) as ShapeSettings
        const id = nextId(s, 'shape')
        const layer: ShapeLayer = { id, kind: 'shape', type: op.type, name: LABELS[op.type], visible: true, seed: base ? base.seed + s.shapes.length * 7919 : DEFAULT_CONFIG.seed, combine: 'merge', settings, warps: [] }
        return insertAt(s.shapes, layer, op.index) ? { ok: true, stack: s } : fail('bad_index')
      }
      if (op.layer === 'texture') {
        if (s.textures.length >= MAX_TEXTURES) return fail('texture_limit')
        if (SCREEN_TEXTURES.includes(op.type) && screens(s) >= 1) return fail('screen_limit')
        const layer: TextureLayer = { id: nextId(s, 'texture'), kind: 'texture', name: TEXTURE_LABELS[op.type], visible: true, settings: { ...clone(DEFAULT_CONFIG.texture), type: op.type, ...(op.type === 'hatch' ? { intensity: 100 } : {}) } }
        return insertAt(s.textures, layer, op.index) ? { ok: true, stack: s } : fail('bad_index')
      }
      if (op.layer === 'cursor') {
        if (hasCursor(s)) return fail('cursor_limit')
        const d = DEFAULT_CONFIG.cursor
        const cursor: CursorWarp = { id: nextId(s, 'cursor'), kind: 'warp', type: 'cursor', name: 'Cursor', visible: true, mode: d.mode === 'off' ? 'push' : d.mode, strength: d.strength, radius: d.radius, smear: d.smear, follow: d.follow }
        if (op.parent === undefined) {
          s.cursor = cursor
          return { ok: true, stack: s }
        }
        // On one shape: only that shape follows the pointer.
        const shape = s.shapes.find((x) => x.id === op.parent)
        if (!shape) return fail('not_found')
        if (shape.warps.length >= MAX_WARPS_PER_SHAPE) return fail('warp_limit')
        shape.warps.unshift(cursor)
        return { ok: true, stack: s }
      }
      const parent = s.shapes.find((x) => x.id === op.parent)
      if (!parent) return fail('not_found')
      if (parent.warps.length >= MAX_WARPS_PER_SHAPE) return fail('warp_limit')
      const warp: FieldWarp = { id: nextId(s, 'warp'), kind: 'warp', type: op.type, name: op.type[0].toUpperCase() + op.type.slice(1), visible: true, strength: 50, size: 50 }
      return insertAt(parent.warps, warp, op.index) ? { ok: true, stack: s } : fail('bad_index')
    }

    case 'delete': {
      const found = findLayer(s, op.id)
      if (!found) return fail('not_found')
      const p = found.place
      if (p.list === 'color' || p.list === 'background') return fail('required_layer')
      if (p.list === 'shapes') {
        // An empty canvas is fine: the background shows until you draw something.
        s.shapes.splice(p.index, 1)
      } else if (p.list === 'textures') s.textures.splice(p.index, 1)
      else if (p.list === 'warps') s.shapes[p.shape].warps.splice(p.index, 1)
      else s.cursor = null
      if (s.keys) delete s.keys[op.id]
      return { ok: true, stack: s }
    }

    case 'move': {
      const found = findLayer(s, op.id)
      if (!found) return fail('not_found')
      const p = found.place
      const list = p.list === 'shapes' ? s.shapes : p.list === 'textures' ? s.textures : p.list === 'warps' ? s.shapes[p.shape].warps : null
      if (!list || !('index' in p)) return fail('fixed_layer')
      if (!Number.isInteger(op.index) || op.index < 0 || op.index >= list.length) return fail('bad_index')
      const [item] = list.splice(p.index, 1)
      ;(list as Layer[]).splice(op.index, 0, item)
      return { ok: true, stack: s }
    }

    case 'hide': {
      const found = findLayer(s, op.id)
      if (!found) return fail('not_found')
      if (found.place.list === 'color' || found.place.list === 'background') return fail('cannot_hide')
      found.layer.visible = op.visible
      return { ok: true, stack: s }
    }

    case 'duplicate': {
      const found = findLayer(s, op.id)
      if (!found) return fail('not_found')
      const p = found.place
      if (p.list === 'shapes') {
        const src = s.shapes[p.index]
        const count = s.shapes.filter((x) => x.kind === src.kind).length
        if (src.kind === 'shape' ? count >= MAX_SHAPES : count >= MAX_DRAWN) return fail(src.kind === 'shape' ? 'shape_limit' : 'drawn_limit')
        const copy: ShapeEntry = { ...clone(src), id: nextId(s, src.kind === 'shape' ? 'shape' : 'drawn'), name: `${src.name} copy` }
        const taken = allIds(s)
        taken.add(copy.id)
        // One cursor per stack: the copy doesn't take it.
        copy.warps = copy.warps.filter((w) => w.type !== 'cursor').map((w) => {
          let n = 1
          while (taken.has(`warp-${n}`)) n++
          taken.add(`warp-${n}`)
          return { ...w, id: `warp-${n}` }
        })
        s.shapes.splice(p.index, 0, copy)
        return { ok: true, stack: s }
      }
      if (p.list === 'warps') {
        const shape = s.shapes[p.shape]
        if (shape.warps.length >= MAX_WARPS_PER_SHAPE) return fail('warp_limit')
        const src = shape.warps[p.index]
        if (src.type === 'cursor') return fail('cursor_limit')
        shape.warps.splice(p.index, 0, { ...clone(src), id: nextId(s, 'warp'), name: `${src.name} copy` })
        return { ok: true, stack: s }
      }
      if (p.list === 'cursor') return fail('cursor_limit')
      return fail('cannot_duplicate')
    }

    case 'combine': {
      const found = findLayer(s, op.id)
      if (!found) return fail('not_found')
      if (found.layer.kind !== 'shape' && found.layer.kind !== 'drawn') return fail('wrong_kind')
      found.layer.combine = op.combine
      return { ok: true, stack: s }
    }

    case 'tune': {
      const found = findLayer(s, op.id)
      if (!found) return fail('not_found')
      const l = found.layer
      if (l.kind !== 'warp' || l.type === 'cursor') return fail('wrong_kind')
      const clamp = (v: number) => Math.min(100, Math.max(0, v))
      if (op.strength !== undefined && Number.isFinite(op.strength)) l.strength = clamp(op.strength)
      if (op.size !== undefined && Number.isFinite(op.size)) l.size = clamp(op.size)
      return { ok: true, stack: s }
    }

    case 'reshape': {
      const found = findLayer(s, op.id)
      if (!found) return fail('not_found')
      const l = found.layer
      if (l.kind !== 'drawn') return fail('wrong_kind')
      if (op.geom) {
        const geom = cleanGeometry(op.geom)
        if (!geom) return fail('bad_geometry')
        l.geom = geom
      }
      const unit = (v: number) => Math.min(1, Math.max(0, v))
      if (op.melt !== undefined && Number.isFinite(op.melt)) l.melt = unit(op.melt)
      if (op.soft !== undefined && Number.isFinite(op.soft)) l.soft = unit(op.soft)
      return { ok: true, stack: s }
    }

    case 'light': {
      const unit = (v: number | undefined, d: number) => (v !== undefined && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d)
      const pos = (v: number | undefined, d: number) => (v !== undefined && Number.isFinite(v) ? Math.min(2, Math.max(-2, v)) : d)
      const was = s.color.light ?? { amount: 0, shine: 0.5 }
      const light: LightSettings = { amount: unit(op.amount, was.amount), shine: unit(op.shine, was.shine) }
      const x = pos(op.x, was.x ?? DEFAULT_SUN[0]), y = pos(op.y, was.y ?? DEFAULT_SUN[1])
      if (op.x !== undefined || op.y !== undefined || was.x !== undefined) Object.assign(light, { x, y })
      const follow = op.follow ?? was.follow
      if (follow) light.follow = true
      const shadow = unit(op.shadow, was.shadow ?? 0)
      if (shadow > 0) light.shadow = shadow
      s.color = { ...s.color, light }
      return { ok: true, stack: s }
    }

    case 'look': {
      const was = s.color.look ?? { contours: 0, glow: 0 }
      const unit = (v: number | undefined, d: number) => (v !== undefined && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d)
      const contours = op.contours !== undefined && Number.isFinite(op.contours) ? Math.min(60, Math.max(0, Math.round(op.contours))) : was.contours
      const look: NonNullable<ColorLayer['look']> = { contours, glow: unit(op.glow, was.glow) }
      const outline = unit(op.outline, was.outline ?? 0), sketch = unit(op.sketch, was.sketch ?? 0)
      if (outline > 0) look.outline = outline
      if (sketch > 0) look.sketch = sketch
      s.color = { ...s.color, look }
      return { ok: true, stack: s }
    }

    case 'movement': {
      if (op.move === 'still') delete s.move
      else if (op.move === 'drift' || op.move === 'breathe') s.move = op.move
      else return fail('bad_move')
      return { ok: true, stack: s }
    }

    case 'rename': {
      const found = findLayer(s, op.id)
      if (!found) return fail('not_found')
      const name = op.name.trim()
      if (!name || name.length > 60) return fail('bad_name')
      found.layer.name = name
      return { ok: true, stack: s }
    }
  }
}

export const MAX_CODE_LENGTH = 2000
const CODE_NAME = /^[A-Za-z][A-Za-z0-9_]{0,23}$/
// Names the shader already uses (or GLSL keeps): a code layer can't take them.
const RESERVED = new Set(['field', 'color', 'main', 'palette', 'background', 'light', 'contours', 'glow', 'melt', 'cut', 'intersect', 'ellipse', 'box', 'polygon', 'noise', 'cells', 'text', 'gradient', 'radial', 'shade', 'fbm', 'drift', 'mix', 'length', 'float', 'int', 'vec2', 'vec3', 'vec4', 'return', 'if', 'else', 'for', 'while'])

/**
 * GLSL that stays inside its function: no preprocessor lines, and (comments aside) braces that
 * never close more than they open. Whether it compiles is the GPU's call (see the renderer).
 */
export function safeGlsl(src: string): boolean {
  if (src.length > MAX_CODE_LENGTH || src.includes('#')) return false
  if (/\/\*(?![\s\S]*?\*\/)/.test(src)) return false
  const bare = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ')
  let depth = 0
  for (const ch of bare) {
    if (ch === '{') depth++
    if (ch === '}' && --depth < 0) return false
  }
  return depth === 0
}

/** A copy of the geometry with finite, in-range numbers, or null if it can't be drawn. */
export function cleanGeometry(g: Geometry): Geometry | null {
  const n = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null)
  if (g.kind === 'ellipse') {
    const v = [n(g.x, -4, 4), n(g.y, -4, 4), n(g.rx, 0.002, 4), n(g.ry, 0.002, 4), n(g.angle ?? 0, -10, 10)]
    if (v.some((x) => x === null)) return null
    return { kind: 'ellipse', x: v[0]!, y: v[1]!, rx: v[2]!, ry: v[3]!, angle: v[4]! }
  }
  if (g.kind === 'rect') {
    const v = [n(g.x, -4, 4), n(g.y, -4, 4), n(g.w, 0.002, 4), n(g.h, 0.002, 4), n(g.radius ?? 0, 0, 4), n(g.angle ?? 0, -10, 10)]
    if (v.some((x) => x === null)) return null
    return { kind: 'rect', x: v[0]!, y: v[1]!, w: v[2]!, h: v[3]!, radius: Math.min(v[4]!, v[2]!, v[3]!), angle: v[5]! }
  }
  if (g.kind === 'noise') {
    const v = [n(g.scale, 0.5, 20), n(g.level, 0, 1)]
    return v.some((x) => x === null) ? null : { kind: 'noise', scale: v[0]!, level: v[1]! }
  }
  if (g.kind === 'cells') {
    const v = [n(g.scale, 1, 30), n(g.gap, 0, 1)]
    return v.some((x) => x === null) ? null : { kind: 'cells', scale: v[0]!, gap: v[1]! }
  }
  if (g.kind === 'code') {
    if (typeof g.name !== 'string' || !CODE_NAME.test(g.name) || RESERVED.has(g.name)) return null
    if (typeof g.glsl !== 'string' || !safeGlsl(g.glsl)) return null
    return { kind: 'code', name: g.name, glsl: g.glsl.trim() }
  }
  if (g.kind === 'gradient') {
    const v = [n(g.x1, -4, 4), n(g.y1, -4, 4), n(g.x2, -4, 4), n(g.y2, -4, 4)]
    if (v.some((x) => x === null)) return null
    return { kind: 'gradient', x1: v[0]!, y1: v[1]!, x2: v[2]!, y2: v[3]!, radial: g.radial === true }
  }
  if (g.kind === 'text') {
    if (typeof g.text !== 'string') return null
    const text = textChars(g.text).slice(0, MAX_TEXT_LENGTH)
    const v = [n(g.x, -4, 4), n(g.y, -4, 4), n(g.size, 0.02, 2), n(g.weight, 0, 1), n(g.angle ?? 0, -10, 10)]
    if (v.some((x) => x === null)) return null
    return { kind: 'text', text, x: v[0]!, y: v[1]!, size: v[2]!, weight: v[3]!, angle: v[4]! }
  }
  if (g.kind === 'path') {
    if (!Array.isArray(g.points) || g.points.length < 3 || g.points.length > MAX_PATH_POINTS) return null
    const pts = g.points.map(([x, y]) => [n(x, -4, 4), n(y, -4, 4)])
    if (pts.some(([x, y]) => x === null || y === null)) return null
    return { kind: 'path', points: pts as [number, number][] }
  }
  return null
}

// ---- URL / attribute encoding --------------------------------------------------

/** A stack as a URL-safe string (base64url of its JSON). */
export function encodeStack(s: Readonly<Stack>): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, ...s }))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The stack from encodeStack, or null if the string isn't one. */
export function decodeStack(text: string): Stack | null {
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))))
    if (json?.v !== 1 || !Array.isArray(json.shapes) || !json.color || !json.background) return null
    const { v: _v, ...stack } = json
    return stack as Stack
  } catch {
    return null
  }
}
