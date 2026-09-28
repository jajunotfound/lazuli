// Rewrites the tables in docs/PARAMETERS.md from the schema, so the reference can't drift.
// Run: pnpm --filter lazuli-bg params-doc
import { readFileSync, writeFileSync } from 'node:fs'
import { PARAMS, type ParamDef } from '../src/schema'

const fmt = (v: unknown) => (Array.isArray(v) ? v.join(', ') : String(v))
const values = (d: ParamDef): string => {
  switch (d.kind) {
    case 'number':
      if (!Number.isFinite(d.min)) return 'number'
      return `${d.min}–${d.max}${d.int ? ' (whole)' : ''}`
    case 'enum':
      return d.options.map((o) => `\`${o}\``).join(' \\| ')
    case 'bool':
      return '`true` \\| `false`'
    case 'color':
      return 'hex color'
    case 'colors':
      return `${d.minItems}–${d.maxItems} hex colors`
  }
}

let section = ''
const out: string[] = []
for (const d of PARAMS) {
  const s = d.path.includes('.') ? d.path.split('.')[0] : 'general'
  if (s !== section) {
    section = s
    out.push('', `**${s[0].toUpperCase() + s.slice(1)}**`, '', '| Attribute | JS path | Values | Default |', '| --- | --- | --- | --- |')
  }
  out.push(`| \`${d.attr}\` | \`${d.path}\` | ${values(d)} | \`${fmt(d.default)}\` |`)
}
const file = new URL('../../../docs/PARAMETERS.md', import.meta.url)
const doc = readFileSync(file, 'utf8')
const start = doc.indexOf('**General**')
writeFileSync(file, doc.slice(0, start) + out.join('\n').trim() + '\n')
