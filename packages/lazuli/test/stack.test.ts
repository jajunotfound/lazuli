import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compileStack, shapeGroups, stackFragment, stackUniforms } from '../src/compile'
import { fromFlat, presetConfig, resolveConfig, toFlat } from '../src/config'
import { PRESET_IDS } from '../src/presets'
import { applyOp, configToStack, decodeStack, encodeStack, stackKey, stackToConfig, type Stack, type StackOp } from '../src/stack'

const ok = (s: Stack, op: StackOp): Stack => {
  const r = applyOp(s, op)
  if (!r.ok) throw new Error(`${op.op} failed: ${r.error}`)
  return r.stack
}
const err = (s: Stack, op: StackOp) => {
  const r = applyOp(s, op)
  assert.equal(r.ok, false, `${JSON.stringify(op)} should fail`)
  return r.ok ? null : r.error
}
const base = () => configToStack(resolveConfig())

// A spread of configs: presets plus random edits across sections.
function configs() {
  const out = PRESET_IDS.map((id) => presetConfig(id))
  let x = 12345
  const rnd = () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]
  for (let i = 0; i < 40; i++) {
    out.push(
      resolveConfig({
        seed: Math.floor(rnd() * 1e6),
        shape: { type: pick(['blobs', 'waves', 'bands', 'rings', 'dots', 'nodal'] as const) },
        texture: { type: pick(['none', 'grain', 'noise', 'paper', 'halftone', 'dither'] as const), intensity: Math.round(rnd() * 100) },
        cursor: { mode: pick(['push', 'pull', 'swirl', 'off'] as const), strength: Math.round(rnd() * 100) },
        color: { palette: ['#112233', '#445566', '#778899'].slice(0, 2 + Math.floor(rnd() * 2)), steps: pick([0, 3, 5]) },
        background: { type: pick(['solid', 'gradient', 'transparent'] as const) },
        motion: { speed: rnd(), direction: Math.round(rnd() * 360) },
      }),
    )
  }
  return out
}

// ---- round trips ------------------------------------------------------------

test('config → stack → config keeps every active value', () => {
  for (const c of configs()) assert.deepEqual(toFlat(stackToConfig(configToStack(c)), 'url'), toFlat(c, 'url'))
})

test('a stack round-trips through its URL encoding', () => {
  for (const c of configs()) {
    const s = configToStack(c)
    assert.deepEqual(decodeStack(encodeStack(s)), s)
  }
  let s = ok(ok(ok(base(), { op: 'add', layer: 'shape', type: 'waves' }), { op: 'add', layer: 'texture', type: 'paper' }), { op: 'add', layer: 'warp', type: 'swirl', parent: 'shape-1' })
  s = ok(s, { op: 'hide', id: 'shape-2', visible: false })
  assert.deepEqual(decodeStack(encodeStack(s)), s)
  assert.equal(decodeStack('not a stack'), null)
  assert.equal(decodeStack(encodeStack(s))?.shapes.length, 2)
})

test('a one-shape stack round-trips through <lazuli-bg> attributes', () => {
  for (const c of configs()) {
    const back = resolveConfig(fromFlat(Object.fromEntries(toFlat(c, 'attr')), 'attr'))
    assert.deepEqual(toFlat(stackToConfig(configToStack(back)), 'url'), toFlat(c, 'url'))
  }
})

// ---- compile -----------------------------------------------------------------

test('editing values never changes the program', () => {
  let s = ok(base(), { op: 'add', layer: 'shape', type: 'rings' })
  const key = stackKey(s)
  const fragment = stackFragment(s)
  let x = 7
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 100; i++) {
    s = structuredClone(s)
    const sh = s.shapes[i % 2]
    sh.seed = Math.floor(rnd() * 1e6)
    sh.settings.blobs.count = 1 + Math.floor(rnd() * 6)
    sh.settings.rings.thickness = Math.round(rnd() * 100)
    s.color.settings.palette = ['#ff0000', `#00${Math.floor(rnd() * 255).toString(16).padStart(2, '0')}00`]
    s.background.settings.color = '#fafafa'
    s.motion.speed = rnd()
    if (s.textures[0]) s.textures[0].settings.intensity = Math.round(rnd() * 100)
    assert.equal(stackKey(s), key)
    assert.equal(stackFragment(s), fragment)
  }
})

test('changing structure changes the program', () => {
  const s = base()
  const two = ok(s, { op: 'add', layer: 'shape', type: 'blobs' })
  const swapped = structuredClone(s)
  swapped.shapes[0].type = 'waves'
  const noTex = ok(s, { op: 'delete', id: 'texture-1' })
  const keys = [s, two, swapped, noTex].map(stackKey)
  assert.equal(new Set(keys).size, 4)
})

test('each shape layer gets its own names and uniforms', () => {
  const s = ok(base(), { op: 'add', layer: 'shape', type: 'blobs' })
  s.shapes[1].settings.blobs.count = 5
  const { fragment, uniforms } = compileStack(s)
  for (const name of ['u_count_0', 'u_count_1', 'shapeColor_0', 'shapeColor_1', 'FALLOFF_0', 'FALLOFF_1']) assert.ok(fragment.includes(name), name)
  assert.ok(!/\bu_count\b/.test(fragment), 'no unsuffixed shape uniform')
  assert.equal(uniforms.u_count_0, 3)
  assert.equal(uniforms.u_count_1, 5)
})

test('hidden shapes are left out of the program', () => {
  const s = ok(base(), { op: 'add', layer: 'shape', type: 'waves' })
  const hidden = ok(s, { op: 'hide', id: 'shape-2', visible: false })
  assert.equal(stackKey(hidden), 'blobs|grain')
  assert.ok(!stackFragment(hidden).includes('shapeColor_1'))
  assert.equal(stackUniforms(hidden).u_wCount_1, undefined)
})

// ---- legal operations (docs/plans/layer-builder.md, Domain model) --------------

test('add: shapes up to 4', () => {
  let s = base()
  for (const t of ['waves', 'rings', 'nodal'] as const) s = ok(s, { op: 'add', layer: 'shape', type: t })
  assert.equal(s.shapes.length, 4)
  assert.equal(err(s, { op: 'add', layer: 'shape', type: 'blobs' }), 'shape_limit')
})

test('add: textures up to 3, one screen texture', () => {
  let s = ok(base(), { op: 'add', layer: 'texture', type: 'halftone' })
  assert.equal(err(s, { op: 'add', layer: 'texture', type: 'dither' }), 'screen_limit')
  s = ok(s, { op: 'add', layer: 'texture', type: 'paper' })
  assert.equal(s.textures.length, 3)
  assert.equal(err(s, { op: 'add', layer: 'texture', type: 'noise' }), 'texture_limit')
})

test('add: warps up to 2 per shape, on an existing shape', () => {
  let s = ok(base(), { op: 'add', layer: 'warp', type: 'swirl', parent: 'shape-1' })
  s = ok(s, { op: 'add', layer: 'warp', type: 'noise', parent: 'shape-1' })
  assert.equal(err(s, { op: 'add', layer: 'warp', type: 'ripple', parent: 'shape-1' }), 'warp_limit')
  assert.equal(err(s, { op: 'add', layer: 'warp', type: 'ripple', parent: 'shape-9' }), 'not_found')
})

test('add: one cursor per stack', () => {
  const s = base()
  assert.ok(s.cursor)
  assert.equal(err(s, { op: 'add', layer: 'cursor' }), 'cursor_limit')
  const none = ok(s, { op: 'delete', id: 'cursor' })
  assert.equal(ok(none, { op: 'add', layer: 'cursor' }).cursor?.type, 'cursor')
})

test('add: index out of range is rejected', () => {
  assert.equal(err(base(), { op: 'add', layer: 'shape', type: 'waves', index: 5 }), 'bad_index')
})

test('delete: any shape (an empty canvas is allowed), not the Color map or Background', () => {
  const s = base()
  const empty = ok(s, { op: 'delete', id: 'shape-1' })
  assert.equal(empty.shapes.length, 0)
  assert.equal(stackKey(empty), '|grain')
  assert.deepEqual(decodeStack(encodeStack(empty)), empty)
  assert.equal(err(s, { op: 'delete', id: 'color' }), 'required_layer')
  assert.equal(err(s, { op: 'delete', id: 'background' }), 'required_layer')
  assert.equal(err(s, { op: 'delete', id: 'nope' }), 'not_found')
  const two = ok(s, { op: 'add', layer: 'shape', type: 'waves' })
  assert.equal(ok(two, { op: 'delete', id: 'shape-1' }).shapes.length, 1)
  assert.equal(ok(s, { op: 'delete', id: 'texture-1' }).textures.length, 0)
  const w = ok(s, { op: 'add', layer: 'warp', type: 'swirl', parent: 'shape-1' })
  assert.equal(ok(w, { op: 'delete', id: 'warp-1' }).shapes[0].warps.length, 0)
})

test('move: within its own kind only', () => {
  let s = ok(ok(base(), { op: 'add', layer: 'shape', type: 'waves' }), { op: 'add', layer: 'texture', type: 'paper' })
  assert.deepEqual(s.shapes.map((x) => x.id), ['shape-2', 'shape-1'])
  s = ok(s, { op: 'move', id: 'shape-2', index: 1 })
  assert.deepEqual(s.shapes.map((x) => x.id), ['shape-1', 'shape-2'])
  assert.deepEqual(ok(s, { op: 'move', id: 'texture-1', index: 0 }).textures.map((x) => x.id), ['texture-1', 'texture-2'])
  assert.equal(err(s, { op: 'move', id: 'shape-1', index: 2 }), 'bad_index')
  assert.equal(err(s, { op: 'move', id: 'color', index: 0 }), 'fixed_layer')
  assert.equal(err(s, { op: 'move', id: 'background', index: 0 }), 'fixed_layer')
  assert.equal(err(s, { op: 'move', id: 'cursor', index: 0 }), 'fixed_layer')
  let w = ok(ok(s, { op: 'add', layer: 'warp', type: 'swirl', parent: 'shape-1' }), { op: 'add', layer: 'warp', type: 'noise', parent: 'shape-1' })
  w = ok(w, { op: 'move', id: 'warp-1', index: 0 })
  assert.deepEqual(w.shapes[0].warps.map((x) => x.id), ['warp-1', 'warp-2'])
  assert.equal(err(w, { op: 'move', id: 'warp-1', index: 2 }), 'bad_index')
})

test('hide: any layer but the Color map and Background', () => {
  const s = base()
  assert.equal(ok(s, { op: 'hide', id: 'shape-1', visible: false }).shapes[0].visible, false)
  assert.equal(ok(s, { op: 'hide', id: 'texture-1', visible: false }).textures[0].visible, false)
  assert.equal(ok(s, { op: 'hide', id: 'cursor', visible: false }).cursor?.visible, false)
  assert.equal(err(s, { op: 'hide', id: 'color', visible: false }), 'cannot_hide')
  assert.equal(err(s, { op: 'hide', id: 'background', visible: false }), 'cannot_hide')
})

test('duplicate: shapes and warps, within the limits', () => {
  let s = base()
  s = ok(s, { op: 'add', layer: 'warp', type: 'swirl', parent: 'shape-1' })
  const d = ok(s, { op: 'duplicate', id: 'shape-1' })
  assert.equal(d.shapes.length, 2)
  const ids = [...d.shapes.map((x) => x.id), ...d.shapes.flatMap((x) => x.warps.map((w) => w.id))]
  assert.equal(new Set(ids).size, ids.length, 'ids stay unique')
  assert.equal(ok(s, { op: 'duplicate', id: 'warp-1' }).shapes[0].warps.length, 2)
  const full = ok(ok(s, { op: 'duplicate', id: 'warp-1' }), { op: 'duplicate', id: 'shape-1' })
  assert.equal(err(full, { op: 'duplicate', id: 'warp-1' }), 'warp_limit')
  assert.equal(err(s, { op: 'duplicate', id: 'cursor' }), 'cursor_limit')
  assert.equal(err(s, { op: 'duplicate', id: 'color' }), 'cannot_duplicate')
  assert.equal(err(s, { op: 'duplicate', id: 'texture-1' }), 'cannot_duplicate')
  let four = s
  for (let i = 0; i < 3; i++) four = ok(four, { op: 'add', layer: 'shape', type: 'blobs' })
  assert.equal(err(four, { op: 'duplicate', id: 'shape-1' }), 'shape_limit')
})

test('operations never change their input', () => {
  const s = base()
  const before = JSON.stringify(s)
  ok(s, { op: 'add', layer: 'shape', type: 'waves' })
  ok(s, { op: 'hide', id: 'shape-1', visible: false })
  assert.equal(JSON.stringify(s), before)
})

// ---- combine modes (milestone 3) ------------------------------------------------

test('Blobs that merge melt into the Blobs below them', () => {
  const sh = (type: string, combine = 'merge') => ({ type, combine }) as Pick<import('../src/stack').ShapeLayer, 'type' | 'combine'>
  assert.deepEqual(shapeGroups([sh('blobs'), sh('blobs'), sh('blobs'), sh('waves')]), [[0, 1, 2], [3]])
  assert.deepEqual(shapeGroups([sh('blobs', 'add'), sh('blobs')]), [[0], [1]])
  assert.deepEqual(shapeGroups([sh('waves'), sh('blobs'), sh('blobs', 'cut'), sh('blobs')]), [[0], [1, 2], [3]])
  assert.deepEqual(shapeGroups([sh('blobs')]), [[0]])
})

test('merging Blobs share one shading pass', () => {
  const s = ok(base(), { op: 'add', layer: 'shape', type: 'blobs' })
  const f = stackFragment(s)
  assert.ok(f.includes('group_0'))
  assert.ok(f.includes('blobsField_0(p, t, k, c)') && f.includes('blobsField_1(p, t, k, c)'))
  const apart = structuredClone(s)
  apart.shapes[0].combine = 'add'
  assert.ok(!stackFragment(apart).includes('group_0'))
})

test('combine modes change the program; the backmost shape’s does not', () => {
  const s = ok(base(), { op: 'add', layer: 'shape', type: 'waves' })
  const keys = (['merge', 'add', 'cut', 'intersect'] as const).map((m) => {
    const x = structuredClone(s)
    x.shapes[0].combine = m
    return stackKey(x)
  })
  assert.equal(new Set(keys).size, 4)
  const back = structuredClone(s)
  back.shapes[1].combine = 'cut'
  assert.equal(stackKey(back), stackKey(s))
})

test('combine and rename', () => {
  const s = base()
  assert.equal(ok(s, { op: 'combine', id: 'shape-1', combine: 'cut' }).shapes[0].combine, 'cut')
  assert.equal(err(s, { op: 'combine', id: 'color', combine: 'cut' }), 'wrong_kind')
  assert.equal(ok(s, { op: 'rename', id: 'shape-1', name: '  Hero blob ' }).shapes[0].name, 'Hero blob')
  assert.equal(err(s, { op: 'rename', id: 'shape-1', name: '   ' }), 'bad_name')
  assert.equal(err(s, { op: 'rename', id: 'nope', name: 'x' }), 'not_found')
})

// ---- warps (milestone 5) ------------------------------------------------------

test('warps compile per shape with their own settings', () => {
  let s = ok(base(), { op: 'add', layer: 'warp', type: 'swirl', parent: 'shape-1' })
  s = ok(s, { op: 'add', layer: 'warp', type: 'ripple', parent: 'shape-1' })
  s = ok(s, { op: 'tune', id: 'warp-1', strength: 80, size: 20 })
  const { fragment, uniforms } = compileStack(s)
  assert.ok(fragment.includes('vec2 warp_0(vec2 p, float t)'))
  assert.ok(fragment.includes('shapeColor_0(warp_0(p, t), t)'))
  // Backmost warp first: the ripple (added second, front) bends last.
  assert.ok(fragment.indexOf('swirlWarp(p, u_warp_0_1') < fragment.indexOf('rippleWarp(p, u_warp_0_0'))
  assert.equal((uniforms.u_warp_0_1 as number[])[0], 0.8 * 6)
  assert.equal(stackKey(s), 'blobs[ripple+swirl]|grain')
  const hidden = ok(s, { op: 'hide', id: 'warp-1', visible: false })
  assert.equal(stackKey(hidden), 'blobs[ripple]|grain')
})

test('tune clamps and only applies to field warps', () => {
  const s = ok(base(), { op: 'add', layer: 'warp', type: 'noise', parent: 'shape-1' })
  const t = ok(s, { op: 'tune', id: 'warp-1', strength: 140, size: -5 })
  const w = t.shapes[0].warps[0] as import('../src/stack').FieldWarp
  assert.deepEqual([w.strength, w.size], [100, 0])
  assert.equal(err(s, { op: 'tune', id: 'shape-1', strength: 10 }), 'wrong_kind')
  assert.equal(err(s, { op: 'tune', id: 'cursor', strength: 10 }), 'wrong_kind')
})

test('a cursor on one shape: one cursor per stack, and only that shape follows the pointer', () => {
  const noCursor = ok(ok(base(), { op: 'delete', id: 'cursor' }), { op: 'add', layer: 'shape', type: 'waves' })
  const s = ok(noCursor, { op: 'add', layer: 'cursor', parent: 'shape-1' })
  assert.equal(s.shapes[1].warps[0].type, 'cursor')
  assert.equal(err(s, { op: 'add', layer: 'cursor' }), 'cursor_limit')
  assert.equal(err(s, { op: 'duplicate', id: 'cursor-1' }), 'cursor_limit')
  const dup = ok(s, { op: 'duplicate', id: 'shape-1' })
  assert.equal(dup.shapes.flatMap((x) => x.warps).filter((w) => w.type === 'cursor').length, 1, 'a copied shape leaves the cursor behind')
  const u = stackUniforms(s)
  assert.equal(u.u_pull, 0, 'no stack-wide push')
  assert.ok((u.u_warp_1_0 as number[])[0] > 0, 'the shape’s own push')
  assert.equal(stackToConfig(s).cursor.follow, 50, 'the engine still follows the pointer')
})

// ---- drawn layers (draw builder, milestone 1) -----------------------------------

const ellipse = (x: number, y: number, r = 0.15) => ({ kind: 'ellipse' as const, x, y, rx: r, ry: r, angle: 0 })

test('drawn layers: add, reshape, limits, geometry checks', () => {
  let s = ok(base(), { op: 'add', layer: 'drawn', geom: ellipse(0, 0) })
  assert.equal(s.shapes[0].kind, 'drawn')
  assert.equal(s.shapes[0].name, 'Ellipse')
  s = ok(s, { op: 'reshape', id: 'drawn-1', melt: 2, soft: -1, geom: { kind: 'rect', x: 0.1, y: 0, w: 0.2, h: 0.1, radius: 0.5, angle: 0 } })
  const d = s.shapes[0] as import('../src/stack').DrawnLayer
  assert.deepEqual([d.melt, d.soft], [1, 0])
  assert.equal(d.geom.kind === 'rect' && d.geom.radius, 0.1, 'corner radius clamps to the half size')
  assert.equal(err(s, { op: 'reshape', id: 'shape-1', melt: 0.2 }), 'wrong_kind')
  assert.equal(err(s, { op: 'add', layer: 'drawn', geom: { kind: 'path', points: [[0, 0], [1, 1]] } }), 'bad_geometry')
  assert.equal(err(s, { op: 'add', layer: 'drawn', geom: { kind: 'ellipse', x: NaN, y: 0, rx: 0.1, ry: 0.1, angle: 0 } }), 'bad_geometry')
  for (let i = 0; i < 7; i++) s = ok(s, { op: 'add', layer: 'drawn', geom: ellipse(i / 10, 0) })
  assert.equal(err(s, { op: 'add', layer: 'drawn', geom: ellipse(0, 0) }), 'drawn_limit')
  assert.equal(err(s, { op: 'duplicate', id: 'drawn-1' }), 'drawn_limit')
  // Generated shapes keep their own limit, separate from drawn ones.
  assert.equal(ok(s, { op: 'add', layer: 'shape', type: 'waves' }).shapes.filter((x) => x.kind === 'shape').length, 2)
})

test('drawn layers next to each other form one field; add starts a new group', () => {
  const d = (combine: string) => ({ kind: 'drawn', combine }) as never
  assert.deepEqual(shapeGroups([d('merge'), d('cut'), d('intersect'), d('merge')]), [[0, 1, 2, 3]])
  assert.deepEqual(shapeGroups([d('add'), d('merge')]), [[0], [1]])
  assert.deepEqual(shapeGroups([d('merge'), { type: 'blobs', combine: 'merge' }, { type: 'blobs', combine: 'merge' }]), [[0], [1, 2]])
})

test('a drawn field compiles to one shading pass with each layer’s join', () => {
  let s = ok(base(), { op: 'add', layer: 'drawn', geom: ellipse(-0.2, 0) })
  s = ok(s, { op: 'add', layer: 'drawn', geom: { kind: 'path', points: [[0, 0.2], [0.2, -0.2], [-0.2, -0.2]] } })
  s = ok(s, { op: 'combine', id: 'drawn-2', combine: 'cut' })
  s = ok(s, { op: 'delete', id: 'shape-1' })
  const { fragment, uniforms, key } = compileStack(s)
  assert.equal(key, 'drawn-path:cut,drawn-ellipse|grain')
  assert.ok(fragment.includes('float d = drawn_1(p, t);'))
  assert.ok(fragment.includes('d = dCut(d, drawn_0(p, t), u_melt_0);'))
  assert.equal((fragment.match(/drawnShade\(/g) ?? []).length, 2, 'one call site plus its definition')
  assert.equal(uniforms.u_npts_0, 3)
  assert.deepEqual([...(uniforms.u_pts_0 as Float32Array).slice(0, 8)].map((v) => +v.toFixed(3)), [0, 0.2, 0.2, -0.2, -0.2, -0.2, 0, 0.2])
  assert.equal(stackToConfig(s).shape.type, 'blobs', 'a drawn-only stack keeps the default settings for the rest')
})

test('keyframe easing: smooth by default, linear, hold', async () => {
  const { keyAt } = await import('../src/animate')
  const g = (x: number) => ({ kind: 'ellipse' as const, x, y: 0, rx: 0.1, ry: 0.1, angle: 0 })
  const keys = (ease?: 'linear' | 'hold') => [{ t: 0, geom: g(0), melt: 0, soft: 0, ease }, { t: 0.5, geom: g(1), melt: 0, soft: 0 }]
  const x = (k: ReturnType<typeof keys>, t: number) => (keyAt(k, t).geom as { x: number }).x
  assert.ok(Math.abs(x(keys(), 0.125) - 0.15625) < 1e-9)
  assert.ok(Math.abs(x(keys('linear'), 0.125) - 0.25) < 1e-9)
  assert.equal(x(keys('hold'), 0.45), 0)
  assert.equal(x(keys('hold'), 0.5), 1)
})

test('text: layout, cleaning and compiling', async () => {
  const { textLayout, MAX_TEXT_SEGMENTS } = await import('../src/font')
  const { cleanGeometry } = await import('../src/stack')
  const hi = textLayout('Hi!')
  assert.equal(hi.segments.length, 3 + 1 + 2)
  // Centered: the line spans -width/2 to width/2 and cap height -0.5 to 0.5.
  const xs = hi.segments.flatMap(([a, , c]) => [a, c]), ys = hi.segments.flatMap(([, b, , d]) => [b, d])
  assert.ok(Math.abs(Math.min(...xs) + hi.width / 2) < 1e-9 && Math.abs(Math.max(...xs) - hi.width / 2) < 1e-9)
  assert.equal(Math.min(...ys), -0.5)
  assert.equal(Math.max(...ys), 0.5)
  assert.ok(textLayout('OOOOOOOOOOOO').segments.length <= MAX_TEXT_SEGMENTS)
  assert.deepEqual(cleanGeometry({ kind: 'text', text: 'hey ~you', x: 0, y: 0, size: 9, weight: 2, angle: 0 }), { kind: 'text', text: 'HEY YOU', x: 0, y: 0, size: 2, weight: 1, angle: 0 })
  const r = applyOp(configToStack(resolveConfig({})), { op: 'add', layer: 'drawn', geom: { kind: 'text', text: 'HI', x: 0, y: 0, size: 0.2, weight: 0.5, angle: 0 } })
  assert.ok(r.ok)
  const fs = stackFragment(r.stack)
  assert.match(fs, /uniform vec4 u_seg_0\[64\]/)
  assert.equal(stackUniforms(r.stack).u_nseg_0, 4)
})
