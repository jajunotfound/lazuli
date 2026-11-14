import { compileStack, configToStack, diffConfig, encodeStack, exportHtml, exportShader, exportShadertoy, stackToConfig, toFlat, type Stack } from 'lazuli-bg'

const PACKAGE = 'lazuli-bg'

/** True when the stack is just one shape the flat settings can say (shorter snippets). */
function isFlat(s: Stack): boolean {
  const flat = configToStack(stackToConfig(s))
  return JSON.stringify(compileStack(flat)) === JSON.stringify(compileStack(s))
}

/** The element tag: flat attributes for a simple stack, else the whole stack in one attribute. */
function elementTag(s: Stack, indent: string): string {
  if (!isFlat(s)) return `${indent}<lazuli-bg stack="${encodeStack(s)}"></lazuli-bg>`
  const attrs = toFlat(stackToConfig(s), 'attr').map(([k, v]) => `${k}="${v}"`)
  if (attrs.length === 0) return `${indent}<lazuli-bg></lazuli-bg>`
  return `${indent}<lazuli-bg\n${attrs.map((a) => `${indent}  ${a}`).join('\n')}\n${indent}></lazuli-bg>`
}

/** A standalone page: the shader with its settings written in and a small WebGL loop. */
export function htmlFile(s: Stack): string {
  return exportHtml(s)
}

export function elementSnippet(s: Stack): string {
  return `npm install ${PACKAGE}

// In your app's entry file
import '${PACKAGE}/element'

<!-- In your markup, inside a positioned container -->
${elementTag(s, '')}
`
}

export function jsSnippet(s: Stack): string {
  if (!isFlat(s)) {
    return `npm install ${PACKAGE}

import { createLazuli, decodeStack } from '${PACKAGE}'

// Fills the element (give it position: relative) and sits behind its content.
const background = createLazuli(document.querySelector('#hero'))
background.setStack(decodeStack('${encodeStack(s)}'))

// Later: background.shuffle(), background.destroy()
`
  }
  const options = toSource(diffConfig(stackToConfig(s)), '')
  return `npm install ${PACKAGE}

import { createLazuli } from '${PACKAGE}'

// Fills the element (give it position: relative) and sits behind its content.
const background = createLazuli(document.querySelector('#hero'), ${options})

// Later: background.set({ … }), background.shuffle(), background.destroy()
`
}

export const glslFile = (s: Stack) => exportShader(s)
export const shadertoyFile = (s: Stack) => exportShadertoy(s)

/** Object literal in JS style: unquoted keys, single quotes, short arrays on one line. */
function toSource(v: unknown, indent: string): string {
  if (Array.isArray(v)) return `[${v.map((x) => toSource(x, indent)).join(', ')}]`
  if (v && typeof v === 'object') {
    const entries = Object.entries(v)
    if (entries.length === 0) return '{}'
    const inner = indent + '  '
    return `{\n${entries.map(([k, x]) => `${inner}${k}: ${toSource(x, inner)},`).join('\n')}\n${indent}}`
  }
  return typeof v === 'string' ? `'${v}'` : String(v)
}
