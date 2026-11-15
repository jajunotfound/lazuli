import assert from 'node:assert/strict'
import { ask, splitReply } from '../../apps/playground/src/agent/agent'
import { blankStack } from '../../apps/playground/src/state'

// A stand-in for Gemini's streaming endpoint: each reply goes out as two SSE chunks.
const replies: string[] = []
const seen: any[] = []
;(globalThis as any).fetch = async (url: string, init: any) => {
  seen.push({ url, body: JSON.parse(init.body), headers: init.headers })
  const text = replies.shift()!
  const half = Math.floor(text.length / 2)
  const sse = [text.slice(0, half), text.slice(half)].map((t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`).join('')
  return new Response(new Blob([sse]).stream(), { status: 200 })
}
const settings = { provider: 'gemini' as const, keys: { gemini: 'test-only' }, models: {} }

const good = 'Two melting moons\n```glsl\nfloat d = ellipse(p, vec2(-0.1, 0), vec2(0.15, 0.15)); // Moon\nd = melt(d, ellipse(p, vec2(0.15, 0.05), vec2(0.1, 0.1)), 0.6);\nreturn palette(field(p), 0.05);\nlight(0.6, 0.1, vec2(-0.4, 0.3));\npalette(#202538, #6d7bb0, #e8ecff);\nbackground(#0d1020);\nmove(breathe);\n```'
replies.push(good)
let streamed = ''
const r = await ask(settings, blankStack(), 'two moons', { onText: (s) => (streamed = s) })
assert.equal(r.title, 'Two melting moons')
assert.equal(r.stack.shapes.length, 2)
assert.equal(r.stack.move, 'breathe')
assert.equal(r.stack.shapes[1].name, 'Moon')
assert.equal(streamed, good)
assert.ok(seen[0].url.includes(':streamGenerateContent?alt=sse'))
assert.equal(seen[0].headers['x-goog-api-key'], 'test-only')
assert.match(seen[0].body.systemInstruction.parts[0].text, /HOW TO ANSWER/)
assert.match(seen[0].body.contents[0].parts[0].text, /The canvas is empty/)

// A bad first reply gets its error sent back once; the fixed one lands.
replies.push('Oops\n```glsl\nfloat d = blob(p);\n```', good)
const r2 = await ask(settings, r.stack, 'make it calmer')
assert.equal(r2.stack.shapes.length, 2)
const retry = seen[seen.length - 1].body.contents
assert.equal(retry.length, 3)
assert.equal(retry[1].role, 'model')
assert.match(retry[2].parts[0].text, /Line 1: .*Send the whole program again/)
assert.match(seen[seen.length - 2].body.contents[0].parts[0].text, /Current canvas:\n```glsl\nfloat field/)

// Two bad replies: a clear error, canvas untouched.
replies.push('no code here', 'still nothing')
await assert.rejects(ask(settings, r.stack, 'x'), /couldn’t use/)

assert.deepEqual(splitReply('Hi\n```\nfloat d = ellipse(p, vec2(0,0), vec2(0.1,0.1));\n```\ntrailing'), { title: 'Hi', code: 'float d = ellipse(p, vec2(0,0), vec2(0.1,0.1));' })
console.log('agent loop: ok')
