export { createLazuli, randomSeed, type LazuliInstance } from './engine'
export {
  resolveConfig,
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
  type ReducedMotion,
  type TextureTarget,
  type ColorMapping,
  type BlendMode,
} from './schema'
export { normalizeHex } from './color'
export { LazuliElement, defineLazuliElement, TAG_NAME } from './element'
export { layoutFromSeed, type Blob } from './layout'
