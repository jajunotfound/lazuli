import assert from 'node:assert/strict'
import { test } from 'node:test'
import { diffConfig, fromFlat, resolveConfig, toFlat } from '../src/config'
import { DEFAULT_CONFIG, PARAMS } from '../src/schema'

test('defaults reproduce the v1 defaults', () => {
  const c = resolveConfig()
  assert.deepEqual(c.color.palette, ['#4c78d8', '#1f48a8'])
  assert.equal(c.background.type, 'solid')
  assert.equal(c.background.color, '#ffffff')
  assert.equal(c.blobs.count, 3)
  assert.equal(c.texture.type, 'grain')
  assert.equal(c.texture.intensity, 35)
  assert.equal(c.motion.speed, 0.35)
  assert.equal(c.seed, 7226165.5)
})

test('v1 flat keys map onto v2 paths', () => {
  const c = resolveConfig({ core: '#7A1F5C', edge: 'd45a9a', ground: '#f4dde8', count: '5', size: 70, cursor: 'pull', strength: 90, speed: 0.9 })
  assert.deepEqual(c.color.palette, ['#d45a9a', '#7a1f5c'])
  assert.equal(c.background.color, '#f4dde8')
  assert.equal(c.blobs.count, 5)
  assert.equal(c.blobs.size, 70)
  assert.equal(c.cursor.mode, 'pull')
  assert.equal(c.cursor.strength, 90)
  assert.equal(c.motion.speed, 0.9)
})

test('v1 texture amount becomes grain intensity; 0 turns it off', () => {
  assert.equal(resolveConfig({ texture: 60 }).texture.intensity, 60)
  assert.equal(resolveConfig({ texture: '0' }).texture.type, 'none')
  assert.equal(resolveConfig({ respectReducedMotion: false }).motion.reducedMotion, 'ignore')
})

test('v2 wins over v1 when both are given', () => {
  const c = resolveConfig({ count: 5, blobs: { count: 2 }, ground: '#000000', background: { type: 'transparent' } })
  assert.equal(c.blobs.count, 2)
  assert.equal(c.background.type, 'transparent')
})

test('values are clamped and invalid ones ignored', () => {
  const c = resolveConfig({ blobs: { count: 99, size: -5, softness: Number.NaN }, background: { type: 'plaid' as never, color: 'nope' } })
  assert.equal(c.blobs.count, 6)
  assert.equal(c.blobs.size, 40)
  assert.equal(c.blobs.softness, 50)
  assert.equal(c.background.type, 'solid')
  assert.equal(c.background.color, '#ffffff')
})

test('color lists keep their length limits', () => {
  assert.deepEqual(resolveConfig({ background: { gradient: ['#000'] } }).background.gradient, DEFAULT_CONFIG.background.gradient)
  assert.deepEqual(resolveConfig({ background: { gradient: '#000,#fff,#f00,#0f0' as never } }).background.gradient, ['#000000', '#ffffff', '#ff0000'])
})

test('attributes and URL round-trip through the flat form', () => {
  const c = resolveConfig({
    seed: 12.5,
    blobs: { count: 5 },
    color: { palette: ['#111111', '#ff0000'], opacity: 70 },
    background: { type: 'gradient', gradient: ['#ffffff', '#000000', '#ff8800'], kind: 'radial', centerX: 20 },
    texture: { animated: false },
  })
  for (const key of ['attr', 'url'] as const) {
    const flat = Object.fromEntries(toFlat(c, key))
    assert.deepEqual(resolveConfig(fromFlat(flat, key)), c, key)
  }
})

test('the flat form only carries active, changed values', () => {
  const c = resolveConfig({ background: { type: 'solid', angle: 90 }, blobs: { count: 4 } })
  assert.deepEqual(toFlat(c, 'attr'), [['blobs-count', '4']])
  assert.deepEqual(toFlat(DEFAULT_CONFIG, 'url'), [])
})

test('v1 URLs still read', () => {
  const c = resolveConfig(fromFlat({ core: '7a1f5c', ground: '000000', count: '4', texture: '80' }, 'url'))
  assert.equal(c.color.palette[1], '#7a1f5c')
  assert.equal(c.background.color, '#000000')
  assert.equal(c.blobs.count, 4)
  assert.equal(c.texture.intensity, 80)
})

test('diffConfig holds only what changed', () => {
  assert.deepEqual(diffConfig(resolveConfig({ blobs: { size: 120.004 }, cursor: { mode: 'pull' } })), { blobs: { size: 120 }, cursor: { mode: 'pull' } })
})

test('every parameter has a unique attribute and URL key', () => {
  for (const key of ['attr', 'url'] as const) {
    const names = PARAMS.map((d) => d[key])
    assert.equal(new Set(names).size, names.length, key)
  }
})

test('steps skip 1 (0 is smooth, bands start at 2)', () => {
  assert.equal(resolveConfig({ color: { steps: 1 } }).color.steps, 2)
  assert.equal(resolveConfig({ color: { steps: 0.4 } }).color.steps, 0)
})

test('blend has no effect over a transparent background', () => {
  const c = resolveConfig({ color: { blend: 'screen' }, background: { type: 'transparent' } })
  assert.deepEqual(toFlat(c, 'attr'), [['background-type', 'transparent']])
})

test('palettes take up to five stops', () => {
  const pal = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666']
  assert.deepEqual(resolveConfig({ color: { palette: pal } }).color.palette, pal.slice(0, 5))
})

test('texture settings only count for the types that use them', () => {
  const c = resolveConfig({ texture: { type: 'halftone', target: 'pattern', levels: 8, angle: 30 } })
  assert.deepEqual(toFlat(c, 'attr'), [['texture-type', 'halftone'], ['texture-angle', '30']])
})

test('each shape exports only its own settings', () => {
  const c = resolveConfig({ shape: 'waves', waves: { count: 5 }, blobs: { count: 2 }, rings: { count: 9 } })
  assert.deepEqual(toFlat(c, 'attr'), [['shape', 'waves'], ['waves-count', '5']])
})
