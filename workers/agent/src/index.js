// Lazuli's free agent endpoint, for a Cloudflare Worker on the free plan.
// POST { system, messages: [{ role: 'user' | 'assistant', content }] }  →  the reply, streamed as plain text.
//
// Gemini's free tier first (the key stays here, never in the browser). Workers AI takes over when
// Gemini is busy (429 / 5xx) or for visitors in the EEA, UK and Switzerland, where Gemini's free
// tier may not be used. Only the origins in ALLOWED_ORIGINS may call it.

const NO_FREE_GEMINI = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH'.split(' '))
const MAX_CHARS = 40000
const MAX_MESSAGES = 6

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') ?? ''
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    const cors = allowed.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: allowed.includes(origin) ? 204 : 403, headers: { ...cors, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } })
    }
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, cors)
    if (!allowed.includes(origin)) return json({ error: 'Not from Lazuli' }, 403, cors)

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Send JSON' }, 400, cors)
    }
    const system = typeof body.system === 'string' ? body.system : ''
    const messages = Array.isArray(body.messages) ? body.messages.filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') : []
    const size = system.length + messages.reduce((n, m) => n + m.content.length, 0)
    if (!messages.length || messages.length > MAX_MESSAGES || size > MAX_CHARS) return json({ error: 'That request is too big' }, 413, cors)

    const country = request.cf?.country ?? ''
    if (env.GEMINI_KEY && !NO_FREE_GEMINI.has(country)) {
      const res = await gemini(env, system, messages)
      if (res.ok && res.body) return stream(geminiText(res.body), cors)
      if (res.status !== 429 && res.status < 500) return json({ error: `Gemini said ${res.status}` }, 502, cors)
    }
    if (!env.AI) return json({ error: 'The free model is busy' }, 429, cors)
    try {
      const out = await env.AI.run(env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8-fast', {
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: 2048,
        stream: true,
      })
      return stream(workersAiText(out), cors)
    } catch {
      // Out of free neurons for today, or the model is down.
      return json({ error: 'The free model is busy' }, 429, cors)
    }
  },
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors } })
}

function stream(text, cors) {
  return new Response(text.pipeThrough(new TextEncoderStream()), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...cors } })
}

function gemini(env, system, messages) {
  const model = env.GEMINI_MODEL || 'gemini-flash-latest'
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }),
  })
}

/** Server-sent events in, the text of each `data:` payload out (picked by `pick`). */
function sseText(body, pick) {
  let buf = ''
  return body.pipeThrough(new TextDecoderStream()).pipeThrough(
    new TransformStream({
      transform(chunk, ctl) {
        buf += chunk
        let nl
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (!payload || payload === '[DONE]') continue
          try {
            const t = pick(JSON.parse(payload))
            if (t) ctl.enqueue(t)
          } catch {
            // Partial or keep-alive line.
          }
        }
      },
    }),
  )
}

const geminiText = (body) => sseText(body, (d) => (d.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join(''))
const workersAiText = (body) => sseText(body, (d) => d.response ?? '')
