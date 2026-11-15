// One request to the agent: the current canvas and what the person asked for go in; a stack the
// canvas can take comes out. The reply must read as Lazuli code and compile; if it doesn't, the
// error goes back to the model once.

import type { Stack } from 'lazuli-bg'
import { applyCode, readCode, writeCode } from '../canvasCode'
import { shaderError } from '../glCheck'
import { AgentError, complete, type AgentSettings, type Message } from './providers'
import { systemPrompt } from './spec'

export interface AgentResult {
  stack: Stack
  /** What it made, in a few words (the reply's first line). */
  title: string
  /** The program it wrote. */
  code: string
}

/** The reply's code block (or the whole reply if there isn't one) and the line before it. */
export function splitReply(text: string): { title: string; code: string } {
  const fence = /```[a-z]*\s*\n([\s\S]*?)(```|$)/i.exec(text)
  const code = (fence ? fence[1] : text).trim()
  const before = fence ? text.slice(0, fence.index) : ''
  const title = before.split('\n').map((l) => l.replace(/^[#*\s>-]+|[*\s]+$/g, '')).find((l) => l) ?? ''
  return { title: title.slice(0, 80), code }
}

const hasDrawing = (s: Stack) => s.shapes.length > 0

/** Check a program against the canvas: the new stack, or the problem in words the model can fix. */
function check(base: Stack, code: string): { stack: Stack } | { problem: string } {
  const r = readCode(code)
  if ('error' in r) return { problem: `Line ${r.error.line}: ${r.error.message}` }
  if (!r.code.shapes.length) return { problem: 'There are no shapes. Start with float d = <shape>;' }
  const next = applyCode(base, r.code)
  const bad = shaderError(next)
  if (bad) return { problem: `${bad.name ? `In ${bad.name}(), line ${bad.line}` : 'The GLSL'}: ${bad.message}` }
  return { stack: next }
}

export async function ask(settings: AgentSettings, base: Stack, prompt: string, opts: { signal?: AbortSignal; onText?(soFar: string): void } = {}): Promise<AgentResult> {
  const canvas = hasDrawing(base) ? `Current canvas:\n\`\`\`glsl\n${writeCode(base)}\n\`\`\`\n\n` : 'The canvas is empty.\n\n'
  const messages: Message[] = [{ role: 'user', content: `${canvas}${prompt}` }]
  const system = systemPrompt()
  for (let attempt = 0; attempt < 2; attempt++) {
    let soFar = ''
    const text = await complete(settings, {
      system,
      messages,
      signal: opts.signal,
      onText: (t) => {
        soFar += t
        opts.onText?.(soFar)
      },
    })
    const { title, code } = splitReply(text)
    const out = check(base, code)
    if ('stack' in out) return { stack: out.stack, title: title || 'Here it is', code }
    if (attempt === 0) {
      messages.push({ role: 'assistant', content: text }, { role: 'user', content: `That didn't work. ${out.problem}. Send the whole program again, fixed, in the same format.` })
      continue
    }
    throw new AgentError(`It wrote something Lazuli couldn’t use (${out.problem}). Try asking another way.`)
  }
  throw new AgentError('Try asking another way.')
}
