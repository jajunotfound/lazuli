// The parameter table: the single source of truth for every parameter's type, range,
// default, when it applies, and its names as an attribute and in a URL. Clamping,
// <lazuli-bg> attributes, URL state, code export and the playground's controls are all
// generated from PARAMS, so a new parameter is one entry here plus its uniform mapping.

export type ShapeType = 'blobs'
export type TextureType = 'none' | 'grain'
export type BackgroundType = 'solid' | 'gradient' | 'transparent'
export type GradientKind = 'linear' | 'radial'
export type CursorMode = 'push' | 'pull'
export type ReducedMotion = 'respect' | 'ignore'
export type TextureTarget = 'all' | 'pattern'

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
  }
  color: {
    /** 2 hex colors, ordered from the soft outer edge to the dense core. */
    palette: string[]
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
    /** Monochrome (true) or colored noise. */
    mono: boolean
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

export type NumberDef = Common & { kind: 'number'; min: number; max: number; int?: boolean; default: number }
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

const isBlobs = (c: LazuliConfig) => c.shape.type === 'blobs'
const hasTexture = (c: LazuliConfig) => c.texture.type !== 'none'
const bgIs = (t: BackgroundType) => (c: LazuliConfig) => c.background.type === t
const bgRadial = (c: LazuliConfig) => c.background.type === 'gradient' && c.background.kind === 'radial'
const bgLinear = (c: LazuliConfig) => c.background.type === 'gradient' && c.background.kind === 'linear'

// Defaults reproduce the v1 look fitted to Paper frame 01: colors from the Color panel
// (frame 05), panel values from frames 07–10, and the seed whose layout matches frame 01.
export const PARAMS: readonly ParamDef[] = [
  def('seed', { kind: 'number', min: -Infinity, max: Infinity, default: 7226165.5, attr: 'seed', url: 'seed', label: 'Seed' }),

  def('shape.type', { kind: 'enum', options: ['blobs'], default: 'blobs', attr: 'shape', url: 'sh', label: 'Shape' }),

  def('blobs.count', { kind: 'number', min: 1, max: 6, int: true, default: 3, attr: 'blobs-count', url: 'bc', label: 'Count', when: isBlobs }),
  def('blobs.size', { kind: 'number', min: 40, max: 160, default: 100, attr: 'blobs-size', url: 'bs', label: 'Size', when: isBlobs }),
  def('blobs.softness', { kind: 'number', min: 0, max: 100, default: 50, attr: 'blobs-softness', url: 'bf', label: 'Softness', when: isBlobs }),

  def('color.palette', { kind: 'colors', minItems: 2, maxItems: 2, default: ['#4c78d8', '#1f48a8'], attr: 'color-palette', url: 'pal', label: 'Palette' }),
  def('color.opacity', { kind: 'number', min: 0, max: 100, default: 100, attr: 'color-opacity', url: 'op', label: 'Opacity' }),
  def('color.fade', { kind: 'number', min: 0, max: 100, default: 35, attr: 'color-fade', url: 'fd', label: 'Corner fade' }),

  def('texture.type', { kind: 'enum', options: ['none', 'grain'], default: 'grain', attr: 'texture-type', url: 'tt', label: 'Type' }),
  def('texture.intensity', { kind: 'number', min: 0, max: 100, default: 35, attr: 'texture-intensity', url: 'ti', label: 'Amount', when: hasTexture }),
  def('texture.scale', { kind: 'number', min: 1, max: 16, default: 1, attr: 'texture-scale', url: 'tz', label: 'Scale', when: hasTexture }),
  def('texture.contrast', { kind: 'number', min: 0, max: 100, default: 50, attr: 'texture-contrast', url: 'tc', label: 'Contrast', when: hasTexture }),
  def('texture.animated', { kind: 'bool', default: true, attr: 'texture-animated', url: 'ta', label: 'Animated', when: hasTexture }),
  def('texture.target', { kind: 'enum', options: ['all', 'pattern'], default: 'all', attr: 'texture-target', url: 'tg', label: 'Applies to', when: hasTexture }),
  def('texture.mono', { kind: 'bool', default: true, attr: 'texture-mono', url: 'tm', label: 'Monochrome', when: hasTexture }),

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
