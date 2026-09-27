# Lazuli

Soft, animated gradient backgrounds for the web. Lazuli renders fluid, blurred shapes with a WebGL
fragment shader: they drift slowly, merge like liquid, and bend away from (or toward) the cursor.
Tune colors, shapes, texture, motion and cursor response in the playground, then export the code.

![Lazuli demo](./docs/demo.gif) <!-- TODO: record a demo GIF -->

- **Tiny:** about 5 kB gzipped, zero dependencies, raw WebGL (WebGL2 with a WebGL1 fallback).
- **Drop-in:** a `<lazuli-bg>` web component, a JS API, or a single script tag.
- **Considerate:** pauses offscreen and in hidden tabs, slows down for `prefers-reduced-motion`,
  caps pixel ratio at 2, and falls back to a flat ground color without WebGL.

## Use it

### Web component

```sh
npm install lazuli-bg
```

```js
import 'lazuli-bg/element'
```

```html
<section style="position: relative; isolation: isolate">
  <lazuli-bg core="#1f48a8" edge="#4c78d8" ground="#ffffff" count="3" cursor="push"></lazuli-bg>
  <h1>Content sits on top</h1>
</section>
```

`<lazuli-bg>` fills its nearest positioned ancestor and sits behind that ancestor's content
(`position: absolute; inset: 0; z-index: -1`). Give the container `position: relative` and
`isolation: isolate`, or restyle the element to taste, e.g. `lazuli-bg { position: fixed }` for a
full-page background. Attributes are live: change one and the background follows. Call
`element.shuffle()` for a new arrangement.

### Script tag (no build step)

```html
<script src="https://cdn.jsdelivr.net/npm/lazuli-bg/dist/lazuli.global.js"></script>
<lazuli-bg core="#1f48a8" edge="#4c78d8" ground="#ffffff"></lazuli-bg>
```

The script registers `<lazuli-bg>` and exposes the JS API as `window.Lazuli`. unpkg works too:
`https://unpkg.com/lazuli-bg`.

### JavaScript API

```js
import { createLazuli } from 'lazuli-bg'

const bg = createLazuli(document.querySelector('#hero'), {
  core: '#1f48a8',
  edge: '#4c78d8',
  ground: '#ffffff',
  speed: 0.35,
})

bg.set({ cursor: 'pull', strength: 80 }) // update any subset
bg.shuffle() // random seed, returns it
bg.destroy() // removes listeners, observers and the GL context
```

`createLazuli(element, options)` appends a canvas that fills `element` (or draws straight into it if
`element` is a `<canvas>`). Resizing is handled with a `ResizeObserver`, so it works in any
container, not just full-screen.

## Parameters

| Param      | Values              | Default   | What it does                                          |
| ---------- | ------------------- | --------- | ----------------------------------------------------- |
| `core`     | hex color           | `#1f48a8` | Color at the dense center of the shapes               |
| `edge`     | hex color           | `#4c78d8` | Color of the soft outer edge                          |
| `ground`   | hex color           | `#ffffff` | Background color                                      |
| `count`    | 1–6                 | `3`       | Number of shapes                                      |
| `size`     | 40–160 (%)          | `100`     | Shape size                                            |
| `softness` | 0–100               | `50`      | How blurry the edges are                              |
| `texture`  | 0–100               | `35`      | Film grain                                            |
| `speed`    | 0–1.5               | `0.35`    | Drift speed. `0` freezes the shapes; cursor still works |
| `cursor`   | `push` \| `pull`    | `push`    | Pointer pushes shapes away or pulls them in           |
| `strength` | 0–100               | `60`      | Pointer influence. `0` turns it off                   |
| `seed`     | number              | `7226165.5` | Arrangement. Each seed gives a different layout     |

Out-of-range values are clamped; invalid ones are ignored.

**Reduced motion.** When the visitor prefers reduced motion, speed drops to 0.05. Opt out with
`respectReducedMotion: false` in the JS API or `reduced-motion="ignore"` on the element.

## Develop

Requires Node 20+ and pnpm (via `corepack enable`).

```sh
pnpm install
pnpm dev          # playground at http://localhost:5173
pnpm dev:engine   # bare engine test page (packages/lazuli)
pnpm build        # engine (ESM + script tag + types), then the playground
pnpm lint         # type-check everything
```

| Path               | What                                                              |
| ------------------ | ----------------------------------------------------------------- |
| `packages/lazuli`  | The engine, published as `lazuli-bg`. TypeScript + raw WebGL.     |
| `apps/playground`  | The site. React + Vite, Radix primitives, react-colorful.         |

The playground consumes the engine through the workspace, so the preview is exactly what you export.
Settings live in the URL query string, so any design can be shared as a link.

Deploys to Vercel from the repo root (`vercel.json` is included).

## License

MIT © jaju
