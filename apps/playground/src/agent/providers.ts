// Where the agent's words come from. Zero cost to run Lazuli:
//   lazuli      our Cloudflare Worker (free plan): Gemini's free tier, Workers AI when that's busy.
//               Its URL comes from VITE_AGENT_URL; without it this option is hidden.
//   gemini      your own Gemini API key (free from Google AI Studio): your own free quota.
//   openrouter  your own OpenRouter key: any model, billed to your account.
//   anthropic   your own Anthropic key.
// Keys never leave this browser except to the provider they belong to.

export type ProviderId = 'lazuli' | 'gemini' | 'openrouter' | 'anthropic'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentSettings {
  provider: ProviderId
  keys: Partial<Record<ProviderId, string>>
  models: Partial<Record<ProviderId, string>>
}

export const AGENT_URL: string = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_AGENT_URL ?? ''

export const PROVIDERS: { id: ProviderId; name: string; needsKey: boolean; defaultModel: string; keyHelp?: { label: string; href: string } }[] = [
  ...(AGENT_URL ? [{ id: 'lazuli' as const, name: 'Lazuli (free)', needsKey: false, defaultModel: '' }] : []),
  { id: 'gemini', name: 'Gemini, your key', needsKey: true, defaultModel: 'gemini-flash-latest', keyHelp: { label: 'Get a free key', href: 'https://aistudio.google.com/apikey' } },
  { id: 'openrouter', name: 'OpenRouter, your key', needsKey: true, defaultModel: 'google/gemini-flash-latest', keyHelp: { label: 'Get a key', href: 'https://openrouter.ai/keys' } },
  { id: 'anthropic', name: 'Anthropic, your key', needsKey: true, defaultModel: 'claude-haiku-5-5', keyHelp: { label: 'Get a key', href: 'https://console.anthropic.com/settings/keys' } },
]

const STORE = 'lazuli.agent'

export function loadSettings(): AgentSettings {
  const fallback: AgentSettings = { provider: AGENT_URL ? 'lazuli' : 'gemini', keys: {}, models: {} }
  try {
    const raw = localStorage.getItem(STORE)
    if (!raw) return fallback
    const s = JSON.parse(raw) as Partial<AgentSettings>
    const provider = PROVIDERS.some((p) => p.id === s.provider) ? (s.provider as ProviderId) : fallback.provider
    return { provider, keys: s.keys ?? {}, models: s.models ?? {} }
  } catch {
    return fallback
  }
}

export function saveSettings(s: AgentSettings) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s))
  } catch {
    // Private mode or storage blocked: settings last for this visit only.
  }
}

export const providerInfo = (id: ProviderId) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]
export const modelFor = (s: AgentSettings) => s.models[s.provider] || providerInfo(s.provider).defaultModel
export const isReady = (s: AgentSettings) => !providerInfo(s.provider).needsKey || !!s.keys[s.provider]?.trim()

/** A failure worth showing as it is (no key, quota used up, refused key). */
export class AgentError extends Error {
  readonly kind: 'key' | 'busy' | 'network' | 'other'
  constructor(message: string, kind: AgentError['kind'] = 'other') {
    super(message)
    this.kind = kind
  }
}

interface Call {
  system: string
  messages: Message[]
  signal?: AbortSignal
  /** Each new piece of text as it streams in. */
  onText(chunk: string): void
}

/** Stream one reply from the chosen provider. Resolves with the whole text. */
export async function complete(settings: AgentSettings, call: Call): Promise<string> {
  const model = modelFor(settings)
  const key = settings.keys[settings.provider]?.trim() ?? ''
  let res: Response
  try {
    res = await request(settings.provider, model, key, call)
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new AgentError('Couldn’t reach the model. Check your connection and try again.', 'network')
  }
  if (!res.ok) throw await failure(res, settings.provider)
  if (!res.body) throw new AgentError('The model sent nothing back.', 'other')
  let text = ''
  const take = (t: string | undefined) => {
    if (!t) return
    text += t
    call.onText(t)
  }
  if (settings.provider === 'lazuli') {
    // The Worker streams plain text.
    await readText(res.body, take)
    return text
  }
  await readSse(res.body, (data) => {
    if (settings.provider === 'gemini') {
      const parts = (data as GeminiChunk).candidates?.[0]?.content?.parts ?? []
      for (const p of parts) if (!p.thought) take(p.text)
    } else if (settings.provider === 'openrouter') {
      take((data as OpenAiChunk).choices?.[0]?.delta?.content ?? undefined)
    } else {
      const d = data as AnthropicChunk
      if (d.type === 'content_block_delta' && d.delta?.type === 'text_delta') take(d.delta.text)
    }
  })
  return text
}

type GeminiChunk = { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
type OpenAiChunk = { choices?: { delta?: { content?: string | null } }[] }
type AnthropicChunk = { type?: string; delta?: { type?: string; text?: string } }

function request(provider: ProviderId, model: string, key: string, { system, messages, signal }: Call): Promise<Response> {
  const json = (url: string, headers: Record<string, string>, body: unknown) =>
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal })
  if (provider === 'lazuli') return json(AGENT_URL, {}, { system, messages })
  if (provider === 'gemini') {
    return json(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, { 'x-goog-api-key': key }, {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    })
  }
  if (provider === 'openrouter') {
    return json('https://openrouter.ai/api/v1/chat/completions', { authorization: `Bearer ${key}`, 'x-title': 'Lazuli' }, {
      model,
      stream: true,
      temperature: 0.7,
      max_tokens: 4096,
      messages: [{ role: 'system', content: system }, ...messages],
    })
  }
  return json('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, {
    model,
    max_tokens: 4096,
    stream: true,
    system,
    messages,
  })
}

async function failure(res: Response, provider: ProviderId): Promise<AgentError> {
  let detail = ''
  try {
    const body = await res.text()
    const parsed = JSON.parse(body)
    detail = parsed?.error?.message ?? parsed?.error ?? ''
  } catch {
    // Not JSON: the status says enough.
  }
  if (res.status === 401 || res.status === 403) return new AgentError(provider === 'lazuli' ? 'The free model turned us away. Try your own key.' : 'That key didn’t work. Check it in settings.', 'key')
  if (res.status === 429) return new AgentError(provider === 'lazuli' ? 'The free model is busy right now. Try again in a minute, or use your own key.' : 'Your key’s limit is used up for now. Try again in a minute.', 'busy')
  if (res.status === 404 && provider !== 'lazuli') return new AgentError(`That model isn’t available${detail ? `: ${String(detail).slice(0, 120)}` : ''}. Pick another in settings.`, 'key')
  return new AgentError(detail ? `The model said: ${String(detail).slice(0, 160)}` : `Something went wrong (${res.status}). Try again.`, 'other')
}

/** Read a server-sent-events stream, handing each `data:` JSON payload to `on`. */
/** Read a byte stream as text, piece by piece. */
async function readText(body: ReadableStream<Uint8Array>, on: (text: string) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    on(decoder.decode(value, { stream: true }))
  }
  const rest = decoder.decode()
  if (rest) on(rest)
}

async function readSse(body: ReadableStream<Uint8Array>, on: (data: unknown) => void) {
  let buf = ''
  const lines = (chunk: string) => {
    buf += chunk
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        on(JSON.parse(payload))
      } catch {
        // A partial or keep-alive line: skip it.
      }
    }
  }
  await readText(body, lines)
  lines('\n')
}
