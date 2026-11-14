export { createLazuli, randomSeed, type LazuliInstance } from './engine'
export {
  resolveConfig,
  presetConfig,
  fromFlat,
  toFlat,
  diffConfig,
  formatValue,
  LEGACY_KEYS,
  type LazuliInput,
  type ConfigPatch,
  type LegacyParams,
  type FlatKey,
} from './config'
export {
  DEFAULT_CONFIG,
  PARAMS,
  getPath,
  setPath,
  isActive,
  cloneConfig,
  type LazuliConfig,
  type ParamDef,
  type ParamPath,
  type ValueAt,
  type ShapeType,
  type TextureType,
  type BackgroundType,
  type GradientKind,
  type CursorMode,
  type Quality,
  type ReducedMotion,
  type TextureTarget,
  type ColorMapping,
  type DotShape,
  type DotGrid,
  type NodalStyle,
  type DitherMatrix,
  type BlendMode,
} from './schema'
export { normalizeHex } from './color'
export { PRESETS, PRESET_IDS, isPreset, type PresetId } from './presets'
export { LazuliElement, defineLazuliElement, TAG_NAME } from './element'
export { layoutFromSeed, type Blob } from './layout'
export {
  applyOp,
  configToStack,
  decodeStack,
  encodeStack,
  findLayer,
  stackKey,
  stackToConfig,
  MAX_SHAPES,
  MAX_TEXTURES,
  MAX_WARPS_PER_SHAPE,
  type BackgroundLayer,
  type ColorLayer,
  type CombineMode,
  type CursorWarp,
  type FieldWarp,
  type Layer,
  type ShapeLayer,
  type ShapeEntry,
  type DrawnLayer,
  type Geometry,
  cleanGeometry,
  MAX_DRAWN,
  MAX_PATH_POINTS,
  type Stack,
  type StackError,
  type StackOp,
  type StackResult,
  type TextureLayer,
  type WarpLayer,
  type WarpType,
} from './stack'
export { compileStack, type CompiledStack } from './compile'
export { exportShader, exportShadertoy, exportHtml } from './export'
export { presetStack, presetHasLayers } from './presetStack'
export { animateStack, easeKey, keyAt, hasKeys, keyLoop, keyPhase } from './animate'
export type { DrawnKey, KeyEase } from './stack'
export { MAX_TEXT_LENGTH, MAX_TEXT_SEGMENTS, textChars, textLayout } from './font'
