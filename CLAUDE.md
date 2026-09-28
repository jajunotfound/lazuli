# Lazuli

Open-source playground for soft, animated gradient backgrounds. A WebGL fragment shader renders
blurred metaball shapes that drift, merge like liquid, and push away from (or pull toward) the
pointer. Users tune colors, shapes, texture, motion and cursor response, then export code.

- Repo: https://github.com/jajunotfound/lazuli (default branch `build-lazuli`)
- License: MIT. Deploy target: Vercel (`vercel.json` at root).

## Source of truth

- **Visuals: the Paper file is the only source of truth.**
  https://app.paper.design/file/01M3HS8GJTKKBKPPYXYW1ZV876/p-1-0 (file "Lazuli", 12 state frames
  `01 Default` … `12 Get code copied`, plus `Phone 01 Shapes`, `Phone 02 Cursor`). Read exact values
  with the Paper MCP (`get_jsx` / `get_computed_styles`), never from screenshots. Colors, layout,
  spacing, radii, type and the canvas look all come from Paper.
- **Behavior:** the original product brief wins where Paper doesn't specify behavior (toolbar
  order incl. Hide controls, keyboard R/H/Esc, Cursor popover stays open on canvas, presets vs
  slider, URL state, welcome persistence, export formats).

## Stack and layout

pnpm workspaces monorepo (pnpm via corepack; Node 20+; TypeScript 7, Vite 8).

| Path | What |
| --- | --- |
| `packages/lazuli` | Engine, published as **`lazuli-bg`** (`lazuli` is taken on npm). TS + raw WebGL, zero runtime deps. |
| `packages/lazuli/src/schema.ts` | **The parameter table** (`PARAMS`): every parameter's path, type, range, default, `when`, attribute and URL key. `DEFAULT_CONFIG` is built from it. Attributes, URLs, export and the playground's controls are generated from it. |
| `packages/lazuli/src/config.ts` | `resolveConfig` (validate/clamp/merge), v1 legacy keys (`core`, `count`, `texture: 35`, …), `fromFlat`/`toFlat` (attributes, URL), `diffConfig`. |
| `packages/lazuli/src/shader.ts` | GLSL ES 1.00 chunks assembled per (shape, texture) variant. Fitted constants `FALLOFF`, `CORE_LO`, `CORE_HI`. Pattern is a premultiplied layer over the background. |
| `packages/lazuli/src/uniforms.ts` | Config → uniform values (`SIZE_SCALE`, `SOFT_*`, `GRAIN_SCALE`), CSS fallback background. |
| `packages/lazuli/src/renderer.ts` | GL context, shader-variant cache (parallel compile when available), uniform upload by name. Shared by the engine and capture. |
| `packages/lazuli/src/layout.ts` | Seeded blob layout on the CPU (mulberry32): anchor + companion + satellite drop + extras. Passed as `u_blob[6]`/`u_orbit[6]` uniforms. |
| `packages/lazuli/src/engine.ts` | `createLazuli(el, input)` → `{ set, shuffle, config, time, canvas, destroy }`: loop, pointer, resize, visibility, reduced motion, context loss. |
| `packages/lazuli/src/capture.ts` | `snapshot()` (entry `lazuli-bg/capture`): deterministic offline PNG on its own context. |
| `packages/lazuli/src/element.ts` | `<lazuli-bg>` web component (shadow DOM, fills nearest positioned ancestor, `z-index: -1`). |
| `packages/lazuli/src/element-define.ts` | Side-effect entry: `lazuli-bg/element` and the IIFE build register the element. |
| `packages/lazuli/index.html`, `element.html` | Bare engine test page; script-tag element test page. |
| `apps/playground` | The site: React 19 + Vite, Radix (Popover, Toggle, ToggleGroup, Slider, Dialog, Tooltip), react-colorful, plain CSS tokens in `src/styles.css`. |
| `apps/playground/src/components/` | `Toolbar`, `panels` (`SchemaPanel` per section + preset rows), `Control` (one schema parameter → slider/segmented/switch/color rows), `InlineSlider`, `Segmented`, `ColorPicker`, `Welcome` (+ About button), `CodeDialog` (HTML / web component / JS / Image). |
| `apps/playground/src/exportCode.ts` | "HTML file" export (engine IIFE inlined via `lazuli-bg/global?raw`), web component and JS snippets (active, non-default values only). |
| `apps/playground/src/controls.ts` | Playground-only presentation hints per parameter (labels, formats, sqrt scale, switch). |
| `apps/playground/src/state.ts` | `SECTIONS` (which params each panel shows/resets), presets, swatches, URL query (schema short keys, non-defaults only, v1 links still read), welcome flag. |
| `tools/visual-fit/` | Seed search + WebGL pixel fitter + CDP screenshot driver used to match Paper frame 01. See its README. |
| `tools/regress/` | v1 reference build + pixel diff: `node tools/regress/run.mjs` checks the defaults still render like v1 (≤ 2/255). |
| `ITERATION.md` | The v2 plan (approved): parameter model, engine, API, phases. |

Builds: ESM (`dist/lazuli.js`, `dist/element.js`, `dist/capture.js`, shared chunks) + IIFE
`dist/lazuli.global.js` (`window.Lazuli`, registers `<lazuli-bg>`), types via `tsc`.

## Run

```sh
pnpm install
pnpm dev          # builds the engine, then the playground (Vite picks 5173 or the next free port)
pnpm dev:engine   # bare engine test page
pnpm build        # engine (ESM + IIFE + d.ts) then playground
pnpm lint         # TypeScript type-check only (no ESLint yet)
```

- The playground imports the engine's **built `dist`**. After changing `packages/lazuli/src`, run
  `pnpm --filter lazuli-bg build`, then **fully reload** the page: the WebGL instance is created once
  and survives HMR, so shader/default changes don't show until a reload.
- Port 5173 on this machine may be taken by an unrelated project (`~/critters`, "Animal Farm").
- The welcome card shows only on first visit (`localStorage['lazuli:welcome-seen']`); use a private window to see it.

## Key decisions

- **Look is fitted to Paper frame 01.** Defaults: core `#1f48a8`, edge `#4c78d8`, ground `#ffffff`
  (Paper Color panel), count 3, size 100, softness 50, texture 35 (Fine), speed 0.35, push,
  strength 60 (Paper panels), seed `7226165.5` (layout closest to frame 01). The prototype's hex
  values and `u_size = size/100`, `u_soft 0.05–1`, `grain ×0.15` mappings were replaced.
- **Layout on the CPU, not a GPU sin-hash:** same seed looks identical on every GPU, and layouts
  compose like the design. Orbits/stretch are offset so t = 0 is exactly the layout.
- **Per-blob falloff `exp(-(d²/r²)^1.8)`** gives Paper's plateau + edge; softness above 50 only
  widens the outer side (haze) so the ground never gets tinted.
- **UI is light-only** (Paper has no dark design). `color-scheme: light`.
- **Toolbar has Hide controls** (brief) though Paper's toolbar doesn't; Get code has tabs (brief).
- Speed slider uses a square-root scale (stored value stays 0–1.5). Strength 0 reads "Off".
- Popover plumbing: controlled single `open` in `App`; Cursor ignores outside clicks on the canvas;
  `onCloseAutoFocus` is prevented when another panel is opening (else Radix refocuses the old
  trigger and closes the new panel); magnification uses pointermove and resets when panels change.
- Engine listens for the pointer on `window` (works under overlaid content); dt floored at 1 ms
  (a zero dt produced NaN velocity and a solid-color canvas).
- Reduced motion: speed capped at 0.05 unless `motion.reducedMotion: 'ignore'` /
  `reduced-motion="ignore"`; the playground lifts the cap once the user touches Speed (engine only,
  never in exports).
- **v2 (see `ITERATION.md`):** pattern and background are separate layers (solid / gradient /
  transparent). Defaults must keep rendering like v1: run `tools/regress` after engine changes.
  A new parameter = a `PARAMS` entry + its uniform in `uniforms.ts` (+ a hint in the playground's
  `controls.ts` if the default control doesn't fit).

## Conventions

- Ask before adding any dependency not already in the package.json files.
- **No Claude attribution:** no `Co-Authored-By` trailers or "Generated with Claude" lines.
- Match surrounding style: plain CSS with tokens on `:root`, Paper SVG icons in `src/icons.tsx`,
  comments only where the why isn't obvious.
- Verify UI changes by screenshot against the Paper frames (`tools/visual-fit/shoot.mjs`).
