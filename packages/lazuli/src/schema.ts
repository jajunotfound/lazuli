// The parameter table: the single source of truth for every parameter's type, range,
// default, when it applies, and its names as an attribute and in a URL. Clamping,
// <lazuli-bg> attributes, URL state, code export and the playground's controls are all
// generated from PARAMS, so a new parameter is one entry here plus its uniform mapping.

export type ShapeType = 'blobs' | 'waves' | 'bands' | 'rings' | 'dots' | 'nodal'
export type DotGrid = 'square' | 'hex'
export type NodalStyle = 'lines' | 'regions'
export type TextureType = 'none' | 'grain' | 'noise' | 'halftone' | 'dither' | 'paper'
export type DotShape = 'dot' | 'line' | 'square'
export type DitherMatrix = 'bayer4' | 'bayer8' | 'ign'
export type BackgroundType = 'solid' | 'gradient' | 'transparent'
export type GradientKind = 'linear' | 'radial'
export type CursorMode = 'push' | 'pull'
export type ReducedMotion = 'respect' | 'ignore'
export type TextureTarget = 'all' | 'pattern'
export type ColorMapping = 'layers' | 'cycle'
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'difference'

export interface LazuliConfig {
  /** Layout seed. Any number; each one gives a different arrangement. */
  seed: number
  shape: {
    type: ShapeType
  }
  blobs: {
    /** 1–6 */
    count: number
    /** Percent, 40–160 */
    size: number
    /** 0–100 */
    softness: number
    /** How far blobs stretch from round, 0–200 %. 100 is the seeded layout. */
    stretch: number
    /** 100: blobs fuse like liquid; 0: they overlap without merging. */
    merge: number
    /** Edge wobble, 0–100. */
    wobble: number
    /** The small drop next to the main blob. */
    satellite: boolean
  }
  waves: {
    /** Ribbons, 1–8 */
    count: number
    /** 0–100 */
    amplitude: number
    /** 10–100 */
    wavelength: number
    /** Ribbon width, 2–100 */
    thickness: number
    /** 0–100 */
    softness: number
    /** Spacing between ribbons, 0–100 */
    spread: number
    /** Phase offset between neighboring ribbons, 0–100 */
    twist: number
    /** Rotation in degrees, -90–90 */
    angle: number
  }
  bands: {
    /** Bands across the frame, 1–30 */
    count: number
    /** Degrees, 0–180 */
    angle: number
    /** Band width against the gap, 5–95 % */
    width: number
    /** 0–100 */
    softness: number
    /** How much noise bends the bands, 0–100 */
    warp: number
    /** Size of the bends, 0–100 */
    warpScale: number
  }
  rings: {
    /** 1–24 */
    count: number
    /** 5–100 */
    spacing: number
    /** Ring width as a share of the spacing, 2–100 */
    thickness: number
    /** 0–100 */
    softness: number
    /** Center in percent of the width and height (0 is the left and top edge). */
    centerX: number
    centerY: number
    /** 1–3; more than one gives interference patterns. */
    sources: number
    /** Noise warp, 0–100 */
    distortion: number
  }
  dots: {
    /** Grid spacing in CSS pixels, 6–120 */
    spacing: number
    /** Dot size as a share of the cell, 0–100 */
    size: number
    /** 0–100 */
    softness: number
    grid: DotGrid
    /** Seeded offset per dot, 0–100 */
    jitter: number
    /** How much a slow noise field swells and shrinks the dots, 0–100 */
    modulation: number
  }
  nodal: {
    /** Chladni mode numbers, 1–12 (equal values use the next mode, since n = m is blank). */
    n: number
    m: number
    /** Line width, 2–100 */
    thickness: number
    /** 0–100 */
    softness: number
    /** Zoom, 20–200 % */
    scale: number
    /** Draw the nodal lines, or fill the regions between them. */
    style: NodalStyle
  }
  color: {
    /** 2–5 hex colors, ordered from the soft outer edge to the dense core. */
    palette: string[]
    /** 'layers': stops stack by density (edge → core). 'cycle': each shape takes the next stop. */
    mapping: ColorMapping
    /** 0 = smooth; 2–8 posterizes into hard-edged bands. */
    steps: number
    /** How the pattern blends with the background (solid and gradient backgrounds). */
    blend: BlendMode
    /** Opacity of the whole pattern, 0–100. */
    opacity: number
    /** How much the pattern fades out toward the corners, 0–100. */
    fade: number
  }
  texture: {
    type: TextureType
    /** 0–100 */
    intensity: number
    /** Cell size multiplier, 1–16. Grain cells are device pixels. */
    scale: number
    /** 0–100; 50 is linear. */
    contrast: number
    /** Re-randomize every frame. */
    animated: boolean
    /** Texture over the whole image, or only where the shapes are. */
    target: TextureTarget
    /** Monochrome (true) or colored noise (grain, noise). */
    mono: boolean
    /** Noise detail, 1–5 (noise, paper). */
    octaves: number
    /** Screen angle in degrees, 0–90 (halftone). */
    angle: number
    dotShape: DotShape
    matrix: DitherMatrix
    /** Tone levels, 2–16 (dither); equal to the palette's stop count, it snaps to the stops. */
    levels: number
    /** 0–100 (paper) */
    fibers: number
  }
  background: {
    type: BackgroundType
    /** Used when type is 'solid'. */
    color: string
    /** 2–3 hex stops, used when type is 'gradient'. */
    gradient: string[]
    kind: GradientKind
    /** Degrees, CSS convention: 0 points up, 180 (default) runs top to bottom. */
    angle: number
    /** Radial center in percent of the width and height (0 is the left and top edge). */
    centerX: number
    centerY: number
  }
  motion: {
    /** Drift speed, 0–1.5. 0 freezes the shapes (the pointer still works). */
    speed: number
    /** 'respect' caps speed at 0.05 for users who prefer reduced motion. */
    reducedMotion: ReducedMotion
  }
  cursor: {
    mode: CursorMode
    /** 0–100. 0 turns the pointer off. */
    strength: number
  }
}

type Sections = { [S in keyof LazuliConfig]: LazuliConfig[S] extends object ? S : never }[keyof LazuliConfig]

/** Every parameter's dotted path, e.g. `'blobs.count'`, plus top-level `'seed'`. */
export type ParamPath =
  | Exclude<keyof LazuliConfig, Sections>
  | { [S in Sections]: `${S}.${keyof LazuliConfig[S] & string}` }[Sections]

export type ValueAt<P extends ParamPath> = P extends `${infer S extends Sections}.${infer K}`
  ? K extends keyof LazuliConfig[S]
    ? LazuliConfig[S][K]
    : never
  : P extends keyof LazuliConfig
    ? LazuliConfig[P]
    : never

interface Common {
  /** Attribute name on <lazuli-bg>. */
  attr: string
  /** Short query-string key in the playground URL. */
  url: string
  label: string
  /** When the parameter has an effect. Inactive parameters are left out of URLs and exports. */
  when?: (c: LazuliConfig) => boolean
}

export type NumberDef = Common & {
  kind: 'number'
  min: number
  max: number
  int?: boolean
  default: number
  /** Final fix-up after clamping, for ranges with a gap (e.g. steps 0 or 2–8). */
  normalize?: (v: number) => number
}
export type EnumDef = Common & { kind: 'enum'; options: readonly string[]; default: string }
export type BoolDef = Common & { kind: 'bool'; default: boolean }
export type ColorDef = Common & { kind: 'color'; default: string }
export type ColorsDef = Common & { kind: 'colors'; minItems: number; maxItems: number; default: readonly string[] }
export type ParamSpec = NumberDef | EnumDef | BoolDef | ColorDef | ColorsDef
export type ParamDef = ParamSpec & { path: ParamPath }

// Tuples stop the conditional from distributing over enum unions.
type SpecFor<V> = [V] extends [number]
  ? NumberDef
  : [V] extends [boolean]
    ? BoolDef
    : [V] extends [string[]]
      ? ColorsDef
      : [V] extends [string]
        ? string extends V
          ? ColorDef
          : EnumDef & { options: readonly V[]; default: V }
        : never

const def = <P extends ParamPath>(path: P, spec: SpecFor<ValueAt<P>>): ParamDef => ({ ...spec, path })

const shapeIs = (t: ShapeType) => (c: LazuliConfig) => c.shape.type === t
const isBlobs = shapeIs('blobs')
const hasTexture = (c: LazuliConfig) => c.texture.type !== 'none'
const texIn = (...types: TextureType[]) => (c: LazuliConfig) => types.includes(c.texture.type)
const bgIs = (t: BackgroundType) => (c: LazuliConfig) => c.background.type === t
const bgRadial = (c: LazuliConfig) => c.background.type === 'gradient' && c.background.kind === 'radial'
const bgLinear = (c: LazuliConfig) => c.background.type === 'gradient' && c.background.kind === 'linear'

// Defaults reproduce the v1 look fitted to Paper frame 01: colors from the Color panel
// (frame 05), panel values from frames 07–10, and the seed whose layout matches frame 01.
export const PARAMS: readonly ParamDef[] = [
  def('seed', { kind: 'number', min: -Infinity, max: Infinity, default: 7226165.5, attr: 'seed', url: 'seed', label: 'Seed' }),

  def('shape.type', { kind: 'enum', options: ['blobs', 'waves', 'bands', 'rings', 'dots', 'nodal'], default: 'blobs', attr: 'shape', url: 'sh', label: 'Shape' }),

  def('blobs.count', { kind: 'number', min: 1, max: 6, int: true, default: 3, attr: 'blobs-count', url: 'bc', label: 'Count', when: isBlobs }),
  def('blobs.size', { kind: 'number', min: 40, max: 160, default: 100, attr: 'blobs-size', url: 'bs', label: 'Size', when: isBlobs }),
  def('blobs.softness', { kind: 'number', min: 0, max: 100, default: 50, attr: 'blobs-softness', url: 'bf', label: 'Softness', when: isBlobs }),
  def('blobs.stretch', { kind: 'number', min: 0, max: 200, default: 100, attr: 'blobs-stretch', url: 'bt', label: 'Stretch', when: isBlobs }),
  def('blobs.merge', { kind: 'number', min: 0, max: 100, default: 100, attr: 'blobs-merge', url: 'bm', label: 'Merge', when: isBlobs }),
  def('blobs.wobble', { kind: 'number', min: 0, max: 100, default: 50, attr: 'blobs-wobble', url: 'bw', label: 'Wobble', when: isBlobs }),
  def('blobs.satellite', { kind: 'bool', default: true, attr: 'blobs-satellite', url: 'bx', label: 'Satellite', when: isBlobs }),

  def('waves.count', { kind: 'number', min: 1, max: 8, int: true, default: 3, attr: 'waves-count', url: 'wc', label: 'Count', when: shapeIs('waves') }),
  def('waves.amplitude', { kind: 'number', min: 0, max: 100, default: 40, attr: 'waves-amplitude', url: 'wa', label: 'Amplitude', when: shapeIs('waves') }),
  def('waves.wavelength', { kind: 'number', min: 10, max: 100, default: 60, attr: 'waves-wavelength', url: 'wl', label: 'Wavelength', when: shapeIs('waves') }),
  def('waves.thickness', { kind: 'number', min: 2, max: 100, default: 30, attr: 'waves-thickness', url: 'wt', label: 'Thickness', when: shapeIs('waves') }),
  def('waves.softness', { kind: 'number', min: 0, max: 100, default: 50, attr: 'waves-softness', url: 'wf', label: 'Softness', when: shapeIs('waves') }),
  def('waves.spread', { kind: 'number', min: 0, max: 100, default: 50, attr: 'waves-spread', url: 'ws', label: 'Spread', when: shapeIs('waves') }),
  def('waves.twist', { kind: 'number', min: 0, max: 100, default: 30, attr: 'waves-twist', url: 'ww', label: 'Twist', when: shapeIs('waves') }),
  def('waves.angle', { kind: 'number', min: -90, max: 90, default: 0, attr: 'waves-angle', url: 'wn', label: 'Angle', when: shapeIs('waves') }),

  def('bands.count', { kind: 'number', min: 1, max: 30, int: true, default: 6, attr: 'bands-count', url: 'kc', label: 'Count', when: shapeIs('bands') }),
  def('bands.angle', { kind: 'number', min: 0, max: 180, default: 30, attr: 'bands-angle', url: 'ka', label: 'Angle', when: shapeIs('bands') }),
  def('bands.width', { kind: 'number', min: 5, max: 95, default: 50, attr: 'bands-width', url: 'kw', label: 'Width', when: shapeIs('bands') }),
  def('bands.softness', { kind: 'number', min: 0, max: 100, default: 40, attr: 'bands-softness', url: 'kf', label: 'Softness', when: shapeIs('bands') }),
  def('bands.warp', { kind: 'number', min: 0, max: 100, default: 30, attr: 'bands-warp', url: 'kx', label: 'Warp', when: shapeIs('bands') }),
  def('bands.warpScale', { kind: 'number', min: 0, max: 100, default: 50, attr: 'bands-warp-scale', url: 'kz', label: 'Warp size', when: shapeIs('bands') }),

  def('rings.count', { kind: 'number', min: 1, max: 24, int: true, default: 6, attr: 'rings-count', url: 'rc', label: 'Count', when: shapeIs('rings') }),
  def('rings.spacing', { kind: 'number', min: 5, max: 100, default: 40, attr: 'rings-spacing', url: 'rs', label: 'Spacing', when: shapeIs('rings') }),
  def('rings.thickness', { kind: 'number', min: 2, max: 100, default: 30, attr: 'rings-thickness', url: 'rt', label: 'Thickness', when: shapeIs('rings') }),
  def('rings.softness', { kind: 'number', min: 0, max: 100, default: 40, attr: 'rings-softness', url: 'rf', label: 'Softness', when: shapeIs('rings') }),
  def('rings.centerX', { kind: 'number', min: 0, max: 100, default: 50, attr: 'rings-center-x', url: 'rx', label: 'Center X', when: shapeIs('rings') }),
  def('rings.centerY', { kind: 'number', min: 0, max: 100, default: 50, attr: 'rings-center-y', url: 'ry', label: 'Center Y', when: shapeIs('rings') }),
  def('rings.sources', { kind: 'number', min: 1, max: 3, int: true, default: 1, attr: 'rings-sources', url: 'rn', label: 'Sources', when: shapeIs('rings') }),
  def('rings.distortion', { kind: 'number', min: 0, max: 100, default: 20, attr: 'rings-distortion', url: 'rd', label: 'Distortion', when: shapeIs('rings') }),

  def('dots.spacing', { kind: 'number', min: 6, max: 120, default: 24, attr: 'dots-spacing', url: 'os', label: 'Spacing', when: shapeIs('dots') }),
  def('dots.size', { kind: 'number', min: 0, max: 100, default: 60, attr: 'dots-size', url: 'oz', label: 'Size', when: shapeIs('dots') }),
  def('dots.softness', { kind: 'number', min: 0, max: 100, default: 20, attr: 'dots-softness', url: 'of', label: 'Softness', when: shapeIs('dots') }),
  def('dots.grid', { kind: 'enum', options: ['square', 'hex'], default: 'hex', attr: 'dots-grid', url: 'og', label: 'Grid', when: shapeIs('dots') }),
  def('dots.jitter', { kind: 'number', min: 0, max: 100, default: 0, attr: 'dots-jitter', url: 'oj', label: 'Jitter', when: shapeIs('dots') }),
  def('dots.modulation', { kind: 'number', min: 0, max: 100, default: 60, attr: 'dots-modulation', url: 'om', label: 'Modulation', when: shapeIs('dots') }),

  def('nodal.n', { kind: 'number', min: 1, max: 12, int: true, default: 3, attr: 'nodal-n', url: 'nn', label: 'Mode n', when: shapeIs('nodal') }),
  def('nodal.m', { kind: 'number', min: 1, max: 12, int: true, default: 5, attr: 'nodal-m', url: 'nm', label: 'Mode m', when: shapeIs('nodal') }),
  def('nodal.thickness', { kind: 'number', min: 2, max: 100, default: 20, attr: 'nodal-thickness', url: 'nt', label: 'Thickness', when: shapeIs('nodal') }),
  def('nodal.softness', { kind: 'number', min: 0, max: 100, default: 40, attr: 'nodal-softness', url: 'nf', label: 'Softness', when: shapeIs('nodal') }),
  def('nodal.scale', { kind: 'number', min: 20, max: 200, default: 100, attr: 'nodal-scale', url: 'nz', label: 'Scale', when: shapeIs('nodal') }),
  def('nodal.style', { kind: 'enum', options: ['lines', 'regions'], default: 'lines', attr: 'nodal-style', url: 'ny', label: 'Style', when: shapeIs('nodal') }),

  def('color.palette', { kind: 'colors', minItems: 2, maxItems: 5, default: ['#4c78d8', '#1f48a8'], attr: 'color-palette', url: 'pal', label: 'Palette' }),
  def('color.mapping', { kind: 'enum', options: ['layers', 'cycle'], default: 'layers', attr: 'color-mapping', url: 'map', label: 'Mapping' }),
  def('color.steps', { kind: 'number', min: 0, max: 8, int: true, default: 0, normalize: (v) => (v === 1 ? 2 : v), attr: 'color-steps', url: 'st', label: 'Steps' }),
  def('color.blend', {
    kind: 'enum',
    options: ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'difference'],
    default: 'normal',
    attr: 'color-blend',
    url: 'bl',
    label: 'Blend',
    when: (c) => c.background.type !== 'transparent',
  }),
  def('color.opacity', { kind: 'number', min: 0, max: 100, default: 100, attr: 'color-opacity', url: 'op', label: 'Opacity' }),
  def('color.fade', { kind: 'number', min: 0, max: 100, default: 35, attr: 'color-fade', url: 'fd', label: 'Corner fade' }),

  def('texture.type', { kind: 'enum', options: ['none', 'grain', 'noise', 'halftone', 'dither', 'paper'], default: 'grain', attr: 'texture-type', url: 'tt', label: 'Type' }),
  def('texture.intensity', { kind: 'number', min: 0, max: 100, default: 35, attr: 'texture-intensity', url: 'ti', label: 'Amount', when: hasTexture }),
  def('texture.scale', { kind: 'number', min: 1, max: 16, default: 1, attr: 'texture-scale', url: 'tz', label: 'Scale', when: hasTexture }),
  def('texture.contrast', { kind: 'number', min: 0, max: 100, default: 50, attr: 'texture-contrast', url: 'tc', label: 'Contrast', when: hasTexture }),
  def('texture.animated', { kind: 'bool', default: true, attr: 'texture-animated', url: 'ta', label: 'Animated', when: texIn('grain', 'noise', 'dither') }),
  // Halftone and dither re-render the pattern itself, so they always apply to the shapes.
  def('texture.target', { kind: 'enum', options: ['all', 'pattern'], default: 'all', attr: 'texture-target', url: 'tg', label: 'Applies to', when: texIn('grain', 'noise', 'paper') }),
  def('texture.mono', { kind: 'bool', default: true, attr: 'texture-mono', url: 'tm', label: 'Monochrome', when: texIn('grain', 'noise') }),
  def('texture.octaves', { kind: 'number', min: 1, max: 5, int: true, default: 3, attr: 'texture-octaves', url: 'to', label: 'Detail', when: texIn('noise', 'paper') }),
  def('texture.angle', { kind: 'number', min: 0, max: 90, default: 45, attr: 'texture-angle', url: 'tn', label: 'Angle', when: texIn('halftone') }),
  def('texture.dotShape', { kind: 'enum', options: ['dot', 'line', 'square'], default: 'dot', attr: 'texture-dot-shape', url: 'td', label: 'Dot', when: texIn('halftone') }),
  def('texture.matrix', { kind: 'enum', options: ['bayer4', 'bayer8', 'ign'], default: 'bayer8', attr: 'texture-matrix', url: 'tx', label: 'Pattern', when: texIn('dither') }),
  def('texture.levels', { kind: 'number', min: 2, max: 16, int: true, default: 4, attr: 'texture-levels', url: 'tl', label: 'Levels', when: texIn('dither') }),
  def('texture.fibers', { kind: 'number', min: 0, max: 100, default: 40, attr: 'texture-fibers', url: 'tf', label: 'Fibers', when: texIn('paper') }),

  def('background.type', { kind: 'enum', options: ['solid', 'gradient', 'transparent'], default: 'solid', attr: 'background-type', url: 'bg', label: 'Type' }),
  def('background.color', { kind: 'color', default: '#ffffff', attr: 'background-color', url: 'bgc', label: 'Color', when: bgIs('solid') }),
  def('background.gradient', { kind: 'colors', minItems: 2, maxItems: 3, default: ['#ffffff', '#e8eefb'], attr: 'background-gradient', url: 'bgg', label: 'Gradient', when: bgIs('gradient') }),
  def('background.kind', { kind: 'enum', options: ['linear', 'radial'], default: 'linear', attr: 'background-kind', url: 'bgk', label: 'Kind', when: bgIs('gradient') }),
  def('background.angle', { kind: 'number', min: 0, max: 360, default: 180, attr: 'background-angle', url: 'bga', label: 'Angle', when: bgLinear }),
  def('background.centerX', { kind: 'number', min: 0, max: 100, default: 50, attr: 'background-center-x', url: 'bgx', label: 'Center X', when: bgRadial }),
  def('background.centerY', { kind: 'number', min: 0, max: 100, default: 50, attr: 'background-center-y', url: 'bgy', label: 'Center Y', when: bgRadial }),

  def('motion.speed', { kind: 'number', min: 0, max: 1.5, default: 0.35, attr: 'motion-speed', url: 'sp', label: 'Speed' }),
  def('motion.reducedMotion', { kind: 'enum', options: ['respect', 'ignore'], default: 'respect', attr: 'reduced-motion', url: 'rm', label: 'Reduced motion' }),

  def('cursor.mode', { kind: 'enum', options: ['push', 'pull'], default: 'push', attr: 'cursor-mode', url: 'cm', label: 'Mode' }),
  def('cursor.strength', { kind: 'number', min: 0, max: 100, default: 60, attr: 'cursor-strength', url: 'cs', label: 'Strength' }),
]

export const PARAM_BY_PATH = new Map(PARAMS.map((d) => [d.path, d])) as ReadonlyMap<ParamPath, ParamDef>

export function getPath<P extends ParamPath>(c: LazuliConfig, path: P): ValueAt<P> {
  const [s, k] = path.split('.')
  const section = (c as unknown as Record<string, unknown>)[s]
  return (k === undefined ? section : (section as Record<string, unknown>)[k]) as ValueAt<P>
}

export function setPath(c: LazuliConfig, path: ParamPath, value: unknown) {
  const [s, k] = path.split('.')
  const root = c as unknown as Record<string, unknown>
  if (k === undefined) root[s] = value
  else (root[s] as Record<string, unknown>)[k] = value
}

export function isActive(d: ParamDef, c: LazuliConfig): boolean {
  return !d.when || d.when(c)
}

function buildDefaults(): LazuliConfig {
  const out: Record<string, unknown> = {}
  for (const d of PARAMS) {
    const [s, k] = d.path.split('.')
    const v = Array.isArray(d.default) ? [...d.default] : d.default
    if (k === undefined) out[s] = v
    else ((out[s] ??= {}) as Record<string, unknown>)[k] = v
  }
  return out as unknown as LazuliConfig
}

/** The default configuration. Frozen; clone before changing. */
export const DEFAULT_CONFIG: Readonly<LazuliConfig> = deepFreeze(buildDefaults())

export function cloneConfig(c: Readonly<LazuliConfig>): LazuliConfig {
  const out = {} as Record<string, unknown>
  for (const [s, v] of Object.entries(c)) {
    out[s] =
      v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Array.isArray(x) ? [...x] : x]))
        : v
  }
  return out as unknown as LazuliConfig
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o)) deepFreeze(v)
    Object.freeze(o)
  }
  return o
}
