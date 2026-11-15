import assert from 'node:assert/strict'
import { applyOp, configToStack, resolveConfig } from '../../packages/lazuli/dist/lazuli.js'
import { applyCode, readCode, writeCode } from '../../apps/playground/src/canvasCode.ts'
let s = configToStack(resolveConfig({ texture: { type: 'none' } }))
for (const op of [
  { op: 'add', layer: 'drawn', geom: { kind: 'ellipse', x: 0.1234, y: -0.0567, rx: 0.2, ry: 0.15, angle: 0.3 } },
  { op: 'add', layer: 'drawn', geom: { kind: 'path', points: [[0, 0.2], [0.2, -0.2], [-0.2, -0.2]] } },
  { op: 'combine', id: 'drawn-2', combine: 'cut' },
  { op: 'delete', id: 'shape-1' },
]) { const r = applyOp(s, op); if (!r.ok) throw new Error(r.error); s = r.stack }
const text = writeCode(s)
console.log(text)
const r1 = readCode(text); if ('error' in r1) throw new Error(JSON.stringify(r1.error))
assert.deepEqual(applyCode(s, r1.code), s, 'round trip changes nothing (exact values kept)')
const moved = readCode(text.replace('vec2(0.123, -0.057)', 'vec2(0.3, 0.1)'))
if ('error' in moved) throw new Error('edit failed')
const m = applyCode(s, moved.code)
assert.equal(m.shapes[1].geom.x, 0.3); assert.equal(m.shapes[0].geom.points[0][1], 0.2)
const added = readCode(text.replace('  return d;', '  d = melt(d, box(p, vec2(0.4, 0), vec2(0.1, 0.1), 0.02), 0.6); // New box\n  return d;'))
if ('error' in added) throw new Error(JSON.stringify(added.error))
const a = applyCode(s, added.code); assert.equal(a.shapes.length, 3); assert.equal(a.shapes[0].name, 'New box'); assert.equal(a.shapes[0].kind, 'drawn')
const bad = readCode(text.replace('return d;', 'retrun d;'))
assert.ok('error' in bad && bad.error.line === 4, JSON.stringify(bad))
const removed = readCode(text.split('\n').filter((l) => !l.includes('cut(')).join('\n'))
if ('error' in removed) throw new Error('remove failed'); assert.equal(applyCode(s, removed.code).shapes.length, 1)
console.log('canvas code: round trip, edit, add, remove and errors all ok')
{
  const t = 'float d = noise(twist(p), 3, 0.6);\nd = melt(d, cells(kaleido(p), 5, 0.2), 0.4);\ncontours(10);\nglow(0.5);\npalette(#112233, #445566);\nbackground(#ffffff);'
  const r = readCode(t); if ('error' in r) throw new Error(JSON.stringify(r.error))
  const a = applyCode(s, r.code)
  assert.equal(a.shapes.length, 2)
  assert.equal(a.shapes[1].geom.kind, 'noise'); assert.equal(a.shapes[1].warps[0].type, 'twist')
  assert.equal(a.shapes[0].geom.kind, 'cells'); assert.equal(a.shapes[0].warps[0].type, 'kaleido')
  assert.deepEqual(a.color.look, { contours: 10, glow: 0.5 })
  const back = readCode(writeCode(a)); if ('error' in back) throw new Error('rewrite failed')
  assert.deepEqual(applyCode(a, back.code).shapes, a.shapes, 'noise/cells/warps round trip')
  const bad = readCode('float d = ellipse(blur(p), vec2(0, 0), vec2(0.1, 0.1));')
  assert.ok('error' in bad && /Wrap p in/.test(bad.error.message))
  console.log('fields, warps, contours, glow: ok')
}
{
  const t = 'float d = text(swirl(p), "HI, A//B", vec2(0.1, -0.05), 0.25, 0.6, 0.2); // Title\nd = melt(d, ellipse(p, vec2(0, 0), vec2(0.1, 0.1)), 0.5);\npalette(#112233, #445566);\nbackground(#ffffff);'
  const r = readCode(t); if ('error' in r) throw new Error(JSON.stringify(r.error))
  const a = applyCode(s, r.code)
  const g = a.shapes[1].geom as any
  assert.equal(g.kind, 'text'); assert.equal(g.text, 'HI, A//B'); assert.equal(g.size, 0.25); assert.equal(g.angle, 0.2)
  assert.equal(a.shapes[1].name, 'Title'); assert.equal(a.shapes[1].warps[0].type, 'swirl')
  const back = readCode(writeCode(a)); if ('error' in back) throw new Error('rewrite failed: ' + JSON.stringify(back.error))
  assert.deepEqual(applyCode(a, back.code).shapes, a.shapes, 'text round trip')
  const bad = readCode('float d = text(p, "~~", vec2(0, 0), 0.2, 0.4);')
  assert.ok('error' in bad && /only/.test(bad.error.message))
  console.log('text: ok')
}
{
  const t = 'float d = gradient(p, vec2(-0.5, 0.1), vec2(0.5, -0.1));\nd = melt(d, radial(twist(p), vec2(0.2, 0), vec2(0.4, 0.1)), 0.3);\npalette(#112233, #445566);\nbackground(#ffffff);'
  const r = readCode(t); if ('error' in r) throw new Error(JSON.stringify(r.error))
  const a = applyCode(s, r.code)
  assert.deepEqual(a.shapes[1].geom, { kind: 'gradient', x1: -0.5, y1: 0.1, x2: 0.5, y2: -0.1, radial: false })
  assert.equal((a.shapes[0].geom as any).radial, true)
  const back = readCode(writeCode(a)); if ('error' in back) throw new Error('rewrite failed')
  assert.deepEqual(applyCode(a, back.code).shapes, a.shapes, 'gradient round trip')
  console.log('gradient: ok')
}
{
  const t = 'float blob(vec2 q, float t) {\n  float r = 0.2 + 0.03 * sin(t);\n  return length(q) - r;\n}\n\nfloat field(vec2 p) {\n  float d = blob(twist(p));\n  d = melt(d, ellipse(p, vec2(0.3, 0), vec2(0.1, 0.1)), 0.5);\n  return d;\n}\npalette(#112233, #445566);\nbackground(#ffffff);'
  const r = readCode(t); if ('error' in r) throw new Error(JSON.stringify(r.error))
  const a = applyCode(s, r.code)
  assert.deepEqual(a.shapes[1].geom, { kind: 'code', name: 'blob', glsl: 'float r = 0.2 + 0.03 * sin(t);\nreturn length(q) - r;' })
  assert.equal(a.shapes[1].warps[0].type, 'twist')
  const w = writeCode(a)
  assert.ok(w.startsWith('float blob(vec2 q, float t) {\n  float r = 0.2'), w)
  const back = readCode(w); if ('error' in back) throw new Error('rewrite failed ' + JSON.stringify(back.error))
  assert.deepEqual(applyCode(a, back.code).shapes, a.shapes, 'code layer round trip')
  // Editing only the body is an edit (not "untouched").
  const edited = readCode(w.replace('0.03', '0.05')); if ('error' in edited) throw new Error('edit failed')
  assert.match((applyCode(a, edited.code).shapes[1].geom as any).glsl, /0\.05/)
  const open = readCode('float blob(vec2 q, float t) {\n  return 1.0;\n'); assert.ok('error' in open && /never closes/.test(open.error.message))
  const esc = readCode('float blob(vec2 q, float t) {\n  return 1.0; } void main() {\n}\n'); assert.ok('error' in esc)
  console.log('code layers: ok')
}
{
  const t = 'float d = ellipse(p, vec2(-0.2, 0.06), vec2(0.15, 0.15));\nd = melt(d, ellipse(p, vec2(0.1, 0.14), vec2(0.12, 0.12)), 0.7);\nreturn palette(field(p), 0.04);\nlight(0.8, 0.05, vec2(-0.5, 0.35));\nshadow(0.7);\noutline(0.4, 0.6);\npalette(#3a3d45, #9a9da5, #f4f2ec);\nbackground(#f6f3ec);\nlines(1, 45, cross);\npaper(0.4);\nmove(breathe);'
  const r = readCode(t); if ('error' in r) throw new Error(JSON.stringify(r.error))
  const a = applyCode(s, r.code)
  assert.deepEqual(a.color.light, { amount: 0.8, shine: 0.05, x: -0.5, y: 0.35, shadow: 0.7 })
  assert.equal(a.color.look?.outline, 0.4); assert.equal(a.color.look?.sketch, 0.6)
  assert.equal(a.move, 'breathe')
  const hatch = a.textures.find((x) => x.settings.type === 'hatch')!
  assert.equal(hatch.settings.angle, 45); assert.equal(hatch.settings.cross, true); assert.equal(hatch.settings.intensity, 100)
  assert.equal(a.textures.find((x) => x.settings.type === 'paper')!.settings.intensity, 40)
  const w = writeCode(a)
  const back = readCode(w); if ('error' in back) throw new Error('rewrite failed ' + JSON.stringify(back.error) + '\n' + w)
  const b = applyCode(a, back.code)
  assert.deepEqual(b.color, a.color); assert.deepEqual(b.textures, a.textures); assert.equal(b.move, a.move)
  // Taking lines out removes the lines; pointer light follows.
  const c = readCode(w.replace(/^lines\(.*$/m, '').replace('vec2(-0.5, 0.35)', 'pointer')); if ('error' in c) throw new Error('edit failed')
  const cc = applyCode(a, c.code)
  assert.ok(!cc.textures.some((x) => x.settings.type === 'hatch')); assert.equal(cc.color.light?.follow, true)
  const still = readCode(w.replace(/^move\(.*$/m, '')); if ('error' in still) throw new Error('edit failed')
  assert.equal(applyCode(a, still.code).move, undefined)
  const bad = readCode('lines(1, 200);'); assert.ok('error' in bad)
  console.log('pencil statements: ok')
}
