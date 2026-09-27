import { DEFAULTS, PARAM_KEYS } from 'lazuli-bg'
import engineSource from 'lazuli-bg/global?raw'
import { round, type Params } from './state'

const PACKAGE = 'lazuli-bg'

/** `core="#1f48a8" count="4" …`: every param, so the snippet is self-describing. */
function attributes(p: Params, onlyChanged = false): string[] {
  return PARAM_KEYS.filter((k) => !onlyChanged || p[k] !== DEFAULTS[k]).map((k) => {
    const v = p[k]
    return `${k}="${typeof v === 'number' ? round(v) : v}"`
  })
}

function elementTag(p: Params, indent: string): string {
  const attrs = attributes(p)
  return `${indent}<lazuli-bg\n${attrs.map((a) => `${indent}  ${a}`).join('\n')}\n${indent}></lazuli-bg>`
}

const ENGINE_PLACEHOLDER = `/* Lazuli engine (${Math.round(engineSource.length / 1024)} kB), included in full when you copy */`

/**
 * A complete HTML document: the element with the current settings baked in and
 * the engine inlined, so it works offline and needs nothing else.
 * `preview` swaps the minified engine for a one-line note so it stays readable.
 */
export function htmlFile(p: Params, preview = false): string {
  // Escape any "</script" so the inlined source can't end the tag early.
  const inlined = engineSource.trim().replace(/<\/script/gi, '<\\/script')
  const engine = preview ? ENGINE_PLACEHOLDER : `/*! lazuli-bg · MIT */\n${inlined}`
  // <html>, <head> and <body> are optional in HTML, which keeps the settings near the top.
  return `<!doctype html>
<!-- Lazuli background: works offline, no dependencies. -->
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Lazuli background</title>

${elementTag(p, '')}

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

export function npmSnippet(p: Params): string {
  return `npm install ${PACKAGE}

// In your app's entry file
import '${PACKAGE}/element'

<!-- In your markup, inside a positioned container -->
${elementTag(p, '')}
`
}
