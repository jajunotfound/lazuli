import { diffConfig, toFlat } from 'lazuli-bg'
import engineSource from 'lazuli-bg/global?raw'
import { version } from 'lazuli-bg/package.json'
import type { Config } from './state'

const PACKAGE = 'lazuli-bg'

/** Only what differs from the defaults and has an effect, so the snippet stays short. */
function elementTag(c: Config, indent: string): string {
  const attrs = toFlat(c, 'attr').map(([k, v]) => `${k}="${v}"`)
  if (attrs.length === 0) return `${indent}<lazuli-bg></lazuli-bg>`
  return `${indent}<lazuli-bg\n${attrs.map((a) => `${indent}  ${a}`).join('\n')}\n${indent}></lazuli-bg>`
}

const ENGINE_PLACEHOLDER = `/* Lazuli engine (${Math.round(engineSource.length / 1024)} kB), included in full when you copy */`

/**
 * A complete HTML document: the element with the current settings baked in and
 * the engine inlined, so it works offline and needs nothing else.
 * `preview` swaps the minified engine for a one-line note so it stays readable.
 */
export function htmlFile(c: Config, preview = false): string {
  // Escape any "</script" so the inlined source can't end the tag early.
  const inlined = engineSource.trim().replace(/<\/script/gi, '<\\/script')
  const engine = preview ? ENGINE_PLACEHOLDER : `/*! lazuli-bg ${version} · MIT */\n${inlined}`
  // <html>, <head> and <body> are optional in HTML, which keeps the settings near the top.
  return `<!doctype html>
<!-- Lazuli background (lazuli-bg ${version}): works offline, no dependencies. -->
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Lazuli background</title>

${elementTag(c, '')}

<style>
  html, body { margin: 0; height: 100%; }
  /* <lazuli-bg> fills its nearest positioned ancestor, behind content. */
  body { position: relative; isolation: isolate; }
</style>

<script>
${engine}
</script>
`
}

export function elementSnippet(c: Config): string {
  return `npm install ${PACKAGE}

// In your app's entry file
import '${PACKAGE}/element'

<!-- In your markup, inside a positioned container -->
${elementTag(c, '')}
`
}

export function jsSnippet(c: Config): string {
  const options = toSource(diffConfig(c), '')
  return `npm install ${PACKAGE}

import { createLazuli } from '${PACKAGE}'

// Fills the element (give it position: relative) and sits behind its content.
const background = createLazuli(document.querySelector('#hero'), ${options})

// Later: background.set({ … }), background.shuffle(), background.destroy()
`
}

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
