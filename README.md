# Lazuli

Soft, animated shader backgrounds for the web. Lazuli renders fluid blobs, ribbons, bands, rings,
dot grids and Chladni plate patterns with a WebGL fragment shader. They drift, merge like liquid
and bend around the cursor. Tune shape, color, texture, background, motion and cursor in the
playground, then export code, a PNG or a video.

![Lazuli demo](./docs/demo.gif) <!-- TODO: record a demo GIF -->

- **Small:** about 16 kB gzipped for the script-tag build, zero dependencies, raw WebGL (WebGL2
  with a WebGL1 fallback). Each shape and texture compiles to its own small shader, only when used.
- **Drop-in:** a `<lazuli-bg>` web component, a JS API, or a single script tag.
- **Layered:** the pattern has its own palette, opacity and blend mode over a solid, gradient or
  transparent background, so it can sit on top of any site.
- **Considerate:** pauses offscreen and in hidden tabs, slows down for `prefers-reduced-motion`,
  lowers its resolution while frames run slow, and falls back to the background color without WebGL.

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
  <lazuli-bg shape="waves" color-palette="#f6c1d9,#b388ff,#5b3fd1" background-type="transparent"></lazuli-bg>
  <h1>Content sits on top</h1>
</section>
```

`<lazuli-bg>` fills its nearest positioned ancestor and sits behind that ancestor's content
(`position: absolute; inset: 0; z-index: -1`). Give the container `position: relative` and
`isolation: isolate`, or restyle the element, e.g. `lazuli-bg { position: fixed }` for a full-page
background. Attributes are live: change one and the background follows. Call `element.shuffle()`
for a new arrangement.

Start from a preset and change what you like: `<lazuli-bg preset="silk" waves-count="2">`.
Presets: `lazuli`, `silk`, `ripple`, `screen`, `stripe`, `paper`, `night`, `plate`, `glass`. A
whole config also fits in one attribute: `config='{"shape":{"type":"rings"}}'`. Individual
attributes win over `config`, which wins over `preset`.

### Script tag (no build step)

```html
<script src="https://cdn.jsdelivr.net/npm/lazuli-bg/dist/lazuli.global.js"></script>
<lazuli-bg preset="night"></lazuli-bg>
```

The script registers `<lazuli-bg>` and exposes the JS API as `window.Lazuli`. unpkg works too:
`https://unpkg.com/lazuli-bg`.

### JavaScript API

```js
import { createLazuli } from 'lazuli-bg'

const bg = createLazuli(document.querySelector('#hero'), {
  preset: 'silk',
  waves: { count: 4, twist: 60 },
  color: { palette: ['#6b4ee6', '#f0508c', '#ffc93c'] },
  background: { type: 'transparent' },
})

bg.set({ texture: { type: 'dither', levels: 3 } }) // any subset, merged
bg.shuffle() // random seed, returns it
bg.config // the resolved config
bg.destroy() // removes listeners, observers and the GL context
```

`createLazuli(element, options)` appends a canvas that fills `element` (or draws straight into it if
`element` is a `<canvas>`). Resizing is handled with a `ResizeObserver`, so it works in any
container, not just full-screen.

### Images and video

```js
import { snapshot, record } from 'lazuli-bg/capture'

const png = await snapshot(bg, { scale: 2 }) // Blob, the current frame
const mp4 = await record(bg, { width: 1920, height: 1080, fps: 30, format: 'mp4' }) // or 'webm'
```

Both render offline on their own context at a fixed time step, so the live background isn't
disturbed and video never drops frames. Set `motion.loop` (seconds) and `record` produces whole,
seamless loops. Video needs WebCodecs (Chrome 94+, Safari 16.4+, Firefox 130+). A transparent
background stays transparent in PNGs and renders over black in video.

## Parameters

The config has one section per panel. Every parameter is also an attribute:

| Section | What's in it |
| --- | --- |
| `shape` | `type`: `blobs`, `waves`, `bands`, `rings`, `dots` or `nodal` (Chladni plate modes) |
| `blobs`, `waves`, `bands`, `rings`, `dots`, `nodal` | Each shape's own settings: count, size, softness, amplitude, spacing, mode numbers, … |
| `color` | `palette` (2–5 stops, edge to core), `mapping` (by depth or per shape), `steps` (posterize), `blend`, `opacity`, `fade` |
| `texture` | `type` (`none`, `grain`, `noise`, `halftone`, `dither`, `paper`), `intensity`, `scale`, `contrast`, and per-type options |
| `background` | `type` (`solid`, `gradient`, `transparent`), `color`, `gradient` stops, `kind`, `angle`, center |
| `motion` | `speed`, `direction`, `loop`, `reducedMotion` |
| `cursor` | `mode` (`push`, `pull`, `swirl`, `off`), `strength`, `radius`, `smear`, `follow` |
| top level | `seed` (arrangement), `quality` (`auto`, `high`, `low`), `preset` |

The full list with attribute names, ranges and defaults is in
[docs/PARAMETERS.md](./docs/PARAMETERS.md). Out-of-range values are clamped; invalid ones are
ignored.

**v1 names still work.** `core`, `edge`, `ground`, `count`, `size`, `softness`, `texture` (a grain
amount), `speed`, `cursor`, `strength` and `respectReducedMotion` map onto the new sections, as
attributes, in `createLazuli`/`set`, and in old playground links. If both are given, the new
name wins.

**Reduced motion.** When the visitor prefers reduced motion, speed drops to 0.05. Opt out with
`motion: { reducedMotion: 'ignore' }` or `reduced-motion="ignore"` on the element.

## Develop

Requires Node 20+ (22.18+ for `pnpm test`, which runs the TypeScript directly) and pnpm (via `corepack enable`).

```sh
pnpm install
pnpm dev          # playground at http://localhost:5173
pnpm dev:engine   # bare engine test page (packages/lazuli); /bench.html times variants
pnpm build        # engine (ESM + script tag + types), then the playground
pnpm lint         # type-check everything
pnpm test         # engine config tests
```

| Path               | What                                                              |
| ------------------ | ----------------------------------------------------------------- |
| `packages/lazuli`  | The engine, published as `lazuli-bg`. TypeScript + raw WebGL.     |
| `apps/playground`  | The site. React + Vite, Radix primitives, react-colorful.         |
| `tools/regress`    | Checks the default look still renders like v1, pixel for pixel.   |

The playground consumes the engine through the workspace, so the preview is exactly what you export.
Settings live in the URL query string (the preset you started from plus what you changed), so any
design can be shared as a link.

Deploys to Vercel from the repo root (`vercel.json` is included).

## License

MIT © jaju
