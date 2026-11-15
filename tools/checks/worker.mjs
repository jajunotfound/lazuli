import assert from 'node:assert/strict'
const worker = (await import(new URL('../../workers/agent/src/index.js', import.meta.url).href)).default
const sse = (objs) => new Response(new Blob([objs.map((o) => `data: ${JSON.stringify(o)}\n\n`).join('')]).stream(), { status: 200 })
let geminiStatus = 200, geminiCalls = 0
globalThis.fetch = async (url, init) => {
  geminiCalls++
  assert.match(url, /:streamGenerateContent\?alt=sse/)
  assert.equal(init.headers['x-goog-api-key'], 'stub')
  if (geminiStatus !== 200) return new Response('{}', { status: geminiStatus })
  return sse([{ candidates: [{ content: { parts: [{ text: 'Hello ' }] } }] }, { candidates: [{ content: { parts: [{ text: 'from Gemini' }] } }] }])
}
const AI = { run: async () => sse([{ response: 'Hello ' }, { response: 'from Workers AI' }]).body }
const env = { ALLOWED_ORIGINS: 'http://localhost:5210', GEMINI_KEY: 'stub', AI }
const req = (origin, country = 'US', body = { system: 'spec', messages: [{ role: 'user', content: 'hi' }] }) => {
  const r = new Request('https://w.example/', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  Object.defineProperty(r, 'cf', { value: { country } })
  return r
}
let res = await worker.fetch(req('http://localhost:5210'), env)
assert.equal(res.status, 200); assert.equal(await res.text(), 'Hello from Gemini')
assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5210')
res = await worker.fetch(req('https://evil.example'), env); assert.equal(res.status, 403)
geminiStatus = 429
res = await worker.fetch(req('http://localhost:5210'), env); assert.equal(await res.text(), 'Hello from Workers AI')
geminiStatus = 200; geminiCalls = 0
res = await worker.fetch(req('http://localhost:5210', 'DE'), env); assert.equal(await res.text(), 'Hello from Workers AI'); assert.equal(geminiCalls, 0)
res = await worker.fetch(req('http://localhost:5210', 'US', { system: 'x'.repeat(50000), messages: [{ role: 'user', content: 'hi' }] }), env); assert.equal(res.status, 413)
res = await worker.fetch(req('http://localhost:5210', 'US'), { ...env, AI: { run: async () => { throw new Error('no neurons') } }, GEMINI_KEY: '' }); assert.equal(res.status, 429)
console.log('worker: ok')
