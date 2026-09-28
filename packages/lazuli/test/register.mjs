// Lets `node --test` run the TypeScript sources directly: Node strips the types, and this
// hook resolves the extensionless relative imports the sources use ('./schema' → schema.ts).
import { register } from 'node:module'

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (/^\\.\\.?\\//.test(specifier) && !/\\.[cm]?[jt]s$/.test(specifier)) {
    try { return await next(specifier + '.ts', context) } catch {}
  }
  return next(specifier, context)
}`),
)
