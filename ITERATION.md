# Lazuli v2: iteration plan

Status: draft for review. Nothing here is built yet.

v1 is one effect (blended blobs) with eleven knobs. v2 turns it into a small generator with
sections: **Presets, Shape, Color, Texture, Background, Motion, Cursor, Export**. Each shape and
texture type has its own settings. The pattern and the background become separate layers.
Design comes later in Paper; this plan covers capability only.

Hard requirement throughout: **the v2 default config renders the same as v1 today** (the look
fitted to Paper frame 01), to within 2/255 per channel. That's checked with a screenshot diff at
the end of every phase.

---

## 1. Parameter model

### 1.1 Shape of the config

Every section has its own object. The type for each section (`shape.type`, `texture.type`,
`background.type`) picks what gets rendered. Each shape keeps its settings in a group of its own,
so switching Blobs → Waves → Blobs brings back your blob settings.

```ts
interface LazuliConfig {
  seed: number
  shape: { type: ShapeType }
  blobs: BlobsParams; waves: WavesParams; rings: RingsParams; dots: DotsParams; bands: BandsParams
  color: ColorParams
  texture: TextureParams        // one texture at a time; type-specific fields sit alongside
  background: BackgroundParams
  motion: MotionParams
  cursor: CursorParams
}
```

One **schema table** (`packages/lazuli/src/schema.ts`) is the single source of truth. Each entry
holds:

- the path (`blobs.count`)
- the type and range
- the default
- the `when` condition (`shape.type === 'blobs'`)
- the attribute name (`blobs-count`)
- the short URL key (`bc`)
- the UI hint (slider, stepped, segmented, color, toggle)

Clamping, attributes, URL state, code export, section Reset and the playground's controls are all
generated from it. Today these are written out by hand in five places (`params.ts`, `element.ts`,
`state.ts`, `exportCode.ts`, `panels.tsx`); with about 80 parameters that won't hold.

The numbers below are the public, human-facing values. The mapping to uniforms lives next to each
shader chunk, the way `toUniforms` works today.

### 1.2 Top level

| Param | Type | Range | Default | Notes |
| --- | --- | --- | --- | --- |
| `seed` | number | any | `7226165.5` | Shared by every shape's layout generator. Shuffle (R) changes it. |
| `preset` | string | preset id | none | Input only (option or attribute). It's applied first, then explicit values go on top. It's never stored in the config. |

### 1.3 Shape

`shape.type`: `'blobs' | 'waves' | 'rings' | 'dots' | 'bands'`, default `'blobs'`.

Every shape outputs the same two things to the rest of the pipeline:

- a **field** value (≥ 0, where "denser" means higher)
- a per-instance **index**, used by the `cycle` color mapping

Color, texture and cursor never need to know which shape is active.

**Blobs** (today's effect; defaults unchanged)

| Param | Type | Range | Default | Notes |
| --- | --- | --- | --- | --- |
| `blobs.count` | int | 1–6 | 3 | v1 `count`. |
| `blobs.size` | number | 40–160 % | 100 | v1 `size`. |
| `blobs.softness` | number | 0–100 | 50 | v1 `softness`. |
| `blobs.stretch` | number | 0–200 % | 100 | Scales each blob's x-squash away from round. 100 = the seeded layout. |
| `blobs.merge` | number | 0–100 | 100 | 100 = additive metaball field (today, merges like liquid). 0 = max(), so blobs overlap without fusing. |
| `blobs.wobble` | number | 0–100 | 50 | Noise distortion of the edges. 50 = today's 0.035. |
| `blobs.satellite` | bool | | true | The small drop next to the main blob. Turning it off also fixes the welcome-preview issue. |

**Waves** (ribbons)

| Param | Type | Range | Default | Notes |
| --- | --- | --- | --- | --- |
| `waves.count` | int | 1–8 | 3 | Number of ribbons. |
| `waves.amplitude` | number | 0–100 | 40 | Up to 0.3 × height. |
| `waves.wavelength` | number | 10–100 | 60 | Relative to width. |
| `waves.thickness` | number | 2–100 | 30 | Ribbon width. |
| `waves.softness` | number | 0–100 | 50 | Edge falloff. |
| `waves.spread` | number | 0–100 | 50 | Spacing between ribbons. |
| `waves.twist` | number | 0–100 | 30 | Phase offset between neighboring ribbons. |
| `waves.angle` | number | −90–90° | 0 | Rotation of the whole set. |

**Rings**

| Param | Type | Range | Default | Notes |
| --- | --- | --- | --- | --- |
| `rings.count` | int | 1–24 | 6 | |
| `rings.spacing` | number | 5–100 | 40 | |
| `rings.thickness` | number | 2–100 | 30 | |
| `rings.softness` | number | 0–100 | 40 | |
| `rings.centerX`, `rings.centerY` | number | 0–100 % | 50, 50 | |
| `rings.sources` | int | 1–3 | 1 | More than one source gives interference patterns. |
| `rings.distortion` | number | 0–100 | 20 | Noise warp. |

**Dots** (grid)

| Param | Type | Range | Default | Notes |
| --- | --- | --- | --- | --- |
| `dots.spacing` | number | 6–120 CSS px | 24 | In CSS px, so dots stay crisp and look the same size at any DPR. |
| `dots.size` | number | 0–100 % of cell | 60 | |
| `dots.softness` | number | 0–100 | 20 | |
| `dots.grid` | enum | `square` / `hex` | `hex` | |
| `dots.jitter` | number | 0–100 | 0 | Seeded per-cell offset. |
| `dots.modulation` | number | 0–100 | 60 | How much a slow noise field swells and shrinks the dots. 0 = uniform wallpaper. |

**Bands** (linear)

| Param | Type | Range | Default | Notes |
| --- | --- | --- | --- | --- |
| `bands.count` | int | 1–30 | 6 | Bands across the frame. |
| `bands.angle` | number | 0–180° | 30 | |
| `bands.width` | number | 5–95 % | 50 | Duty cycle: band width versus gap. |
| `bands.softness` | number | 0–100 | 40 | |
| `bands.warp` | number | 0–100 | 30 | Noise bend. |
| `bands.warpScale` | number | 0–100 | 50 | Size of the bends. |

### 1.4 Color (the pattern layer)

| Param | Type | Range | Default | Notes |
| --- | --- | --- | --- | --- |
| `color.palette` | hex[] | 2–5 stops | `['#4c78d8', '#1f48a8']` | Ordered from outer to dense. v1 `edge`, `core`. |
| `color.mapping` | enum | `layers` / `cycle` | `layers` | `layers`: stops stack by field value (below). `cycle`: each shape instance (ribbon, ring, band) takes the next stop. |
| `color.steps` | int | 0, 2–8 | 0 | 0 = smooth. 2–8 posterizes the field into hard contours. |
| `color.opacity` | number | 0–100 | 100 | Opacity of the whole pattern. |
| `color.blend` | enum | `normal` `multiply` `screen` `overlay` `soft-light` `difference` | `normal` | How the pattern blends with the Lazuli background (see 2.4 for transparent). |
| `color.fade` | number | 0–100 | 35 | Corner fade of the pattern. This is the v1 vignette, made explicit. |

Why `layers`: v1's color is not a simple ramp. It draws the edge color with coverage
`e = smoothstep(lo, hi, field)` and then the core color over it with
`c = smoothstep(CORE_LO, CORE_HI, field)`. Written as one pattern layer that means:

- alpha is `1 − (1 − e)(1 − c)`
- premultiplied color is `e(1 − c)·edge + c·core`

Over the background that gives exactly v1's result, with no ground color inside the pattern. For
N stops, stop *k* is a layer at a field threshold spread between the edge band and `CORE_HI`. With
two stops you get today's thresholds, which were fitted to Paper.

### 1.5 Texture

`texture.type`: `'none' | 'grain' | 'noise' | 'halftone' | 'dither' | 'paper'`, default `'grain'`.

Common controls:

| Param | Type | Range | Default | Notes |
| --- | --- | --- | --- | --- |
| `texture.intensity` | number | 0–100 | 35 | v1 `texture`. |
| `texture.scale` | number | 1–16 | 1 | Cell-size multiplier. For grain and dither the base cell is one device pixel (1 = v1). For noise, paper and halftone it's a CSS-px base (see types). |
| `texture.contrast` | number | 0–100 | 50 | 50 = linear. |
| `texture.animated` | bool | | true | v1 grain re-randomizes every frame. Paper defaults to static. |
| `texture.target` | enum | `all` / `pattern` | `all` | `all` = after compositing with the background (v1). `pattern` = only where shapes are, weighted by their alpha. |

Type-specific (used only when that type is active):

| Param | Type | Range | Default | For |
| --- | --- | --- | --- | --- |
| `texture.mono` | bool | | true | grain, noise: monochrome or chroma noise |
| `texture.octaves` | int | 1–5 | 3 | noise, paper |
| `texture.angle` | number | 0–90° | 45 | halftone screen angle |
| `texture.dotShape` | enum | `dot` / `line` / `square` | `dot` | halftone |
| `texture.matrix` | enum | `bayer4` / `bayer8` / `ign` | `bayer8` | dither (all computed in the shader, no texture assets) |
| `texture.levels` | int | 2–16 | 4 | dither: tone levels, snapped to palette stops |
| `texture.fibers` | number | 0–100 | 40 | paper |

Grain, noise and paper are overlays. Halftone and dither are different: they *re-render* the tone
instead of adding to it (see pushback 6.1). Halftone reads the pattern at each cell's center; that
works in a single pass because the shape field is an analytic function we can evaluate anywhere.

### 1.6 Background

| Param | Type | Range | Default | Notes |
| --- | --- | --- | --- | --- |
| `background.type` | enum | `solid` / `gradient` / `transparent` | `solid` | |
| `background.color` | hex | | `#ffffff` | v1 `ground`. Used when type is `solid`. |
| `background.gradient` | hex[] | 2–3 stops | `['#ffffff', '#e8eefb']` | Always gets a tiny hash dither so gradients don't band. |
| `background.kind` | enum | `linear` / `radial` | `linear` | |
| `background.angle` | number | 0–360° | 180 | linear |
| `background.centerX`, `background.centerY` | number | 0–100 % | 50, 50 | radial |

### 1.7 Motion

| Param | Type | Range | Default | Notes |
| --- | --- | --- | --- | --- |
| `motion.speed` | number | 0–1.5 | 0.35 | v1 `speed`. Square-root slider as now. |
| `motion.direction` | number | 0–360° | 0 | Travel direction for waves, bands and noise. Blobs orbit and ignore it. |
| `motion.loop` | number | 0, 2–60 s | 0 | When set, every frequency is snapped to a multiple of 2π/loop so the animation repeats exactly. Needed for seamless video export. |
| `motion.reducedMotion` | enum | `respect` / `ignore` | `respect` | The current `respectReducedMotion` / `reduced-motion="ignore"`. |

### 1.8 Cursor

| Param | Type | Range | Default | Notes |
| --- | --- | --- | --- | --- |
| `cursor.mode` | enum | `push` / `pull` / `swirl` / `off` | `push` | `off` replaces "strength 0 reads Off". |
| `cursor.strength` | number | 0–100 | 60 | |
| `cursor.radius` | number | 0–100 | 50 | 50 = today's σ² 0.045. |
| `cursor.smear` | number | 0–100 | 50 | 50 = today's 1.6 velocity smear. |
| `cursor.follow` | number | 0–100 | 50 | Pointer easing. 50 = today's 0.12 per frame. |

The cursor warps the sampling position before the shape is evaluated, so it works the same on
every shape. On dots, the grid itself swims around the pointer. The notch fix just landed
(displacement ∝ d, k = 0.9) and carries over. Swirl rotates d by strength × falloff, which has the
same no-fold constraint.

### 1.9 Presets

A preset is a full config stored as a diff against the defaults. It is not a parameter. Suggested
first set:

| Preset | Look |
| --- | --- |
| Lazuli | The default. |
| Silk | Waves, 3 stops. |
| Ripple | Rings, 2 sources. |
| Screen | Blobs with a halftone texture. |
| Stripe | Bands, posterized. |
| Paper | Blobs with a paper texture, warm background. |
| Night | Dark gradient background. |
| Glass | Transparent background, 70 % opacity. |

**Once a preset ships, it's frozen.** Changing it later would silently change every embed that
uses `preset="silk"`. Code export always writes out the full values instead of the preset name.

---

## 2. Engine and shader

### 2.1 Options

| Approach | Pros | Cons |
| --- | --- | --- |
| **A. One uber-shader** with a branch on `u_shapeType` / `u_textureType` | One compile. Switching is instant. | Registers are sized for the largest path, so every config pays the worst case (lower occupancy, hurts mobile and integrated GPUs most). Big source. Some WebGL1 drivers flatten branches. |
| **B. Assembled variants**: GLSL chunks (`common` + shape + texture + `composite`) combined per (shape, texture), compiled on demand and cached | Each program only contains what it needs, so it's the fastest per frame. Chunks are small, testable files. | The first switch to a new combination compiles (~10–50 ms). 5 × 6 = 30 possible programs, only ever compiled when used. |
| **C. Multi-pass** (pattern → FBO → texture/composite) | Pattern can render at half resolution (soft shapes are low-frequency) while grain stays sharp. Enables accumulation for motion-blurred video. | FBO management and context-loss rebuilds, plus more bandwidth. Nothing in the v2 feature list strictly needs it. |

**Recommendation: B, single pass, with C held in reserve.**

- Use `KHR_parallel_shader_compile` where it's available. Keep drawing the old program until the
  new one links, so a switch never shows a blank frame. Warm the cache during idle time for the
  preset combinations.
- Counts stay uniforms, looped up to a compile-time max with `break` (GLSL ES 1.00 needs constant
  loop bounds). Baking counts into the source would recompile while a Count slider is dragged.
- Add the half-resolution pattern pass (C) only if real-hardware numbers call for it (see 2.3).
  Offline video export gets its own accumulation FBO for sub-frame motion blur, like the reel does.

### 2.2 Code layout

```
packages/lazuli/src/
  schema.ts           parameter table (1.1)
  config.ts           resolve / clamp / deep-merge, legacy mapping, diff vs defaults
  presets.ts
  shaders/
    common.glsl.ts    hash, noise, pointer warp, uniforms shared by all
    blobs.glsl.ts  waves.glsl.ts  rings.glsl.ts  dots.glsl.ts  bands.glsl.ts
    texture/*.glsl.ts
    composite.glsl.ts palette layers, background, blend, fade, output
  program.ts          assemble + compile + cache variants
  layouts/            seeded CPU layouts per shape (blobs = today's layout.ts, unchanged)
  engine.ts           loop, pointer, resize, context loss (mostly as now)
  capture.ts          deterministic renderFrame() for PNG and video (separate entry)
```

The seeded layouts stay on the CPU, so a seed means the same image on every GPU. The blob layout
function stays byte-for-byte the same, so the default seed still reproduces frame 01.

### 2.3 Performance

- **Rough per-pixel cost:**
  - Blobs: 6 × `exp(pow())`, as now.
  - Waves: N × `sin`.
  - Rings: very cheap.
  - Dots: 1 cell, or 4 when jitter or softness is high.
  - Bands: cheap.
  - Paper and noise at 5 octaves: the most expensive texture.
  - Halftone: replaces the per-pixel shape evaluation with a per-cell-center one, so about the same.
- **The real risk is fill rate.** A 4K display at DPR 2 is about 8 Mpx per frame. Nothing has
  been measured on real hardware yet; every check so far ran on SwiftShader.
- **Proposed budget:** the default config at ≤ 4 ms/frame on an M1 at 1440p × 2, and 60 fps on a
  mid-range Android phone.
- **Add `quality: 'auto' | 'high' | 'low'`.** `auto` lowers the render scale (1 → 0.75 → 0.5) when
  rAF frame times stay over budget, and raises it again when there's headroom. Grain at a reduced
  scale looks blocky, so if `auto` has to drop often, that's the trigger for the half-resolution
  pattern pass.
- **Keep the current skip-draw path** (speed 0, no pointer, not dirty). Static textures make it
  more useful: with `texture.animated` off, speed 0 really does render zero frames.
- **Uniforms stay under 64 vec4** (already past WebGL1's minimum of 16, which is fine in practice).
- **Bundle size:** about 13 kB min / 6 kB gz today; estimated 30–40 kB min for the runtime. GLSL
  gets a whitespace/comment strip at build time. Capture/video code goes in a separate entry
  (`lazuli-bg/capture`) so embeds don't ship it.

**Measured in phase 5** (Apple M1, Chrome on Metal, 2880×1800 = a 1440×900 screen at 2×, one
1-pixel readback per frame, so these slightly overstate; `packages/lazuli/bench.html?timing`):

| Variant | ms/frame | Variant | ms/frame |
| --- | --- | --- | --- |
| Blobs (default, same maths as v1) | 5.7 | Noise | 7.2 |
| Waves | 5.2 | Paper | 10.0 |
| Bands | 4.1 | Halftone | 10.0 |
| Rings, 3 sources | 5.1 | Dither | 6.2 |
| Dots (hex) | 5.3 | Waves + halftone | 9.4 |
| Dots with jitter | 18.8 | Dots + halftone | 10.4 |
| Nodal | 2.5 | | |

The 4 ms budget above was a guess, and v1's own maths doesn't meet it at this size, so `quality: 'auto'`
(render scale 1 → 0.75 → 0.5 when frames run over 24 ms, back up under 17.5 ms) is the answer for
now. Everything but jittered dots fits a 60 fps frame on an M1 at full resolution, so the
half-resolution pattern pass stays deferred. Dots were 20.6 ms before they looked up only the
nearest center when a dot can't reach past its cell. Phones still need measuring.

### 2.4 Transparency and blending

- The context switches to `alpha: true, premultipliedAlpha: true`. The shader outputs a
  premultiplied pattern, composited over the background inside the shader for solid and gradient
  backgrounds, or output as-is for transparent.
- Context attributes can't change on a live canvas, so the alternative is to swap the canvas when
  the background type changes. I'd start with alpha always on and measure; the compositor cost of
  an alpha canvas is usually negligible.
- Blend modes are computed in the shader against the Lazuli background.
- With a transparent background there's nothing to blend against in the shader. Options:
  - `normal` only (recommended), or
  - CSS `mix-blend-mode` on the canvas, which only reaches page content inside the same stacking
    context. It works only sometimes, so I'd leave it out of v2.
- `texture.target: 'all'` over a transparent background draws the texture as a light/dark speckle
  with its own alpha, since there are no page pixels to modulate.

---

## 3. Public API and `<lazuli-bg>`

### 3.1 JavaScript

```ts
const bg = createLazuli(el, {
  preset: 'silk',
  shape: { type: 'waves' },
  waves: { count: 4, twist: 60 },
  color: { palette: ['#6b4ee6', '#f0508c', '#ffc93c'] },
  background: { type: 'transparent' },
})
bg.set({ texture: { type: 'dither', levels: 3 } })   // deep-partial merge
bg.config                                              // resolved LazuliConfig
bg.shuffle(); bg.pause(); bg.play(); bg.destroy()
```

From `lazuli-bg/capture`:

- `snapshot(bg, { width, height, time? }) → Promise<Blob>` (PNG)
- `record(bg, { width, height, fps, duration | loops, format }) → Promise<Blob>`

Both render frames deterministically with a fixed dt and no pointer. They don't screen-record.

### 3.2 Attributes

- Every path gets an attribute:
  - `shape="waves"`, `waves-count="4"`, `color-palette="#6b4ee6,#f0508c,#ffc93c"`
  - `texture-type="dither"`, `background-type="transparent"`, `cursor-mode="pull"`
- Top level: `seed` and `preset`.
- A `config='{"…json…"}'` attribute for configs too big to write as attributes.
- Precedence: individual attribute > `config` > `preset` > defaults.

### 3.3 Keeping existing embeds working

The compatibility burden is small right now, and the plan leans on that:

- `lazuli-bg` isn't published on npm yet, and the playground isn't deployed, so there are no npm
  users and no shared links.
- Every exported HTML file inlines its own copy of the engine, so those keep working as they are
  forever. A new engine never touches them.

A thin legacy layer is still cheap and worth having, in case someone swaps a v1 export's inlined
engine for v2. It maps v1 flat keys and attributes, and v2 keys win if both are present:

| v1 | v2 |
| --- | --- |
| `core`, `edge` | `color.palette = [edge, core]` |
| `ground` | `background.type = 'solid'`, `background.color` (exactly equivalent now that the pattern is premultiplied) |
| `count`, `size`, `softness` | `blobs.*` |
| `texture` (number) | `texture.type = 'grain'` (or `'none'` at 0), `texture.intensity` |
| `speed` | `motion.speed` |
| `cursor` | `cursor.mode` |
| `strength` | `cursor.strength` (0 → mode `off`) |
| `respectReducedMotion` | `motion.reducedMotion` |

`instance.params` becomes `instance.config`. Because nothing is published, I'd rename it outright
rather than keep a deprecated getter. Publish v2 as the first npm release.

---

## 4. URL state and code export

### 4.1 URL

- Still readable and hand-editable, but using short keys from the schema:
  `?v=2&p=silk&wc=4&pal=6b4ee6-f0508c-ffc93c&bgt=t`.
- **Contents:**
  - The preset id plus only the values that differ from that preset, which keeps the URL short
    when you start from a preset.
  - Only parameters that are active (the current shape group, the current texture type's fields).
    Tweaks to inactive groups are dropped from the link. That's acceptable, and it keeps links
    honest about what they show.
- **Reading:** v1 keys (`core=…&count=4`) still parse through the legacy layer.
- **Fallback:** if a URL ever passes about 1,500 characters, switch to a compressed `#c=`
  base64url JSON. I don't expect to need it.

### 4.2 Code export

Tabs in the Get code dialog:

- **HTML file:** as now (engine inlined, works offline), with a version comment.
- **Web component:** the npm snippet. Emits **only non-default, active attributes**. Today it
  emits every parameter, which would mean about 80 lines.
- **JavaScript:** `createLazuli(el, {...})` with the nested diff.
- **Image:** PNG at the current size ×1/×2, or a custom W×H. Transparent when the background is.
- **Video:** WebM / MP4 at a chosen resolution, fps and duration (or "N loops" when `motion.loop`
  is set). Rendered offline frame by frame through WebCodecs `VideoEncoder`, then muxed into a
  file. Real-time `MediaRecorder` capture drops frames on heavy configs, so it's only a fallback.
  **The muxer is a new dependency** (for example `mediabunny`, MIT), so I'm asking before adding
  it. Without one we can do WebM through `MediaRecorder` only, not MP4.

Every export expands presets to full values (1.9).

---

## 5. Build order

Each phase ends with type-check, the v1-default screenshot diff (≤ 2/255), and screenshots of the
new features at extreme settings (full strength, extreme counts and scales, both cursor modes).

1. **Groundwork plus layers (smallest useful step).** Delivers transparent backgrounds, which lets
   the pattern sit over any site, plus opacity and PNG.
   - `schema.ts`, `config.ts` with legacy mapping.
   - Shader split into chunks (blobs only) with the program cache.
   - Premultiplied pattern and a separate background: solid, gradient, transparent.
   - `color.opacity`, `color.fade`.
   - PNG snapshot.
   - Playground: Background section plus a PNG export tab. Existing panels read from the new config.
2. **Palette.** 2–5 stops, `layers` / `cycle`, `steps`, blend modes.
3. **Texture types.** Grain with the full common controls, then noise, paper, dither, halftone,
   and `target`.
4. **Shapes.** Waves and bands first (cheap, similar math, prove the shape interface), then rings,
   then dots. Blob extras (`stretch`, `merge`, `wobble`, `satellite`).
5. **Motion and cursor depth.** `direction`, `loop`, `radius`, `smear`, `follow`, swirl, `quality`
   with adaptive resolution. Measure on real hardware here (M1 plus a phone) and decide whether
   the half-resolution pattern pass is needed.
6. **Presets.** Tuned by eye against the Paper design once it exists, then frozen.
7. **Export: code.** Non-default-only attributes, JS tab, compact URL with preset diff.
8. **Export: video.** After the dependency decision.
9. **Paper design pass** over the sectioned UI. Until then, the playground's controls are generated
   from the schema in the current popover style, so capability doesn't wait on design.

Tests: the repo has no test runner. Node 22+ runs `.ts` directly, so `node --test` covers
`config.ts` (clamping, legacy mapping, URL round-trip, preset diff) with no new dependency.

---

## 6. Pushback and suggestions

1. **Halftone and dither aren't textures in the same sense as grain.** They replace the smooth
   tone rather than sitting on top of it. I'd still put them in the Texture menu (that's where
   people look), but with one texture at a time, not a stack. Stacking two texture slots doubles
   the UI and URL surface for a small gain; revisit after v2.
2. **Dot grid and halftone overlap.** "Blobs + halftone" already gives shapes drawn as dots. I've
   kept Dots as a shape with its own noise modulation so it stands alone, but I'd cut it first if
   scope needs trimming.
3. **Consider a "Nodal" (Chladni) shape.** You cited Chladni generators; the actual pattern is a
   few cosine terms (`cos(nπx)cos(mπy) − cos(mπx)cos(nπy)`) with n and m sliders, and it fits the
   field interface for free. It's cheap enough to try in phase 4, or it could replace Rings.
4. **Drop transparent video and page-level blend modes.** Alpha video only works as VP9 WebM in
   Chromium, and CSS `mix-blend-mode` over the host page works only sometimes (2.4).
5. **Video wants a dependency.** MP4 needs a muxer. If you'd rather not add one, ship WebM through
   `MediaRecorder` first and label it "may drop frames on slow machines".
6. **Hold back on control count.** Five to seven controls per shape is plenty. More than that
   belongs behind an "Advanced" disclosure, which is a question for the Paper design.
7. **Popovers may not survive.** Eight sections with deep controls probably want a docked side
   panel rather than toolbar popovers. That's a design decision to make in Paper before phase 9.
8. **The v1 vignette becomes `color.fade`.** In v1 it mixed toward `ground × 1.02`. As a pattern
   fade it stays within 2/255 of v1 (the `× 1.02` adds at most 0.02 × 0.35 ≈ 1.8/255 in the
   corners).
9. **Performance must be measured before phase 5 ships.** No real-hardware numbers exist yet.
