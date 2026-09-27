// Side-effect entry: `import 'lazuli-bg/element'` (and the script-tag build)
// registers <lazuli-bg> and re-exports the full API.
import { defineLazuliElement } from './element'

defineLazuliElement()

export * from './index'
