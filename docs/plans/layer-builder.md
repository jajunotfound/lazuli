# Lazuli layer builder

Status: all seven milestones done, 2026-11-14. Supersedes `docs/SCOPE.md` (the trimmed background maker) and the image
and video export work. Nothing here is built yet.

## Problem

Lazuli lets people adjust a shader someone else wrote: one shape, one palette, one texture, in a
fixed order. It doesn't help anyone make a shader of their own. A designer who wants two shapes
merged, a swirl on one of them and grain only on the background can't get there without writing
GLSL. Lazuli should let people build a shader visually, as a stack of layers, and export code they
own.

## Users and stakes

- **Designers** who know Figma layers and don't write GLSL. If it fails, it's another preset
  tweaker and they go back to Unicorn Studio or a static gradient.
- **Front-end developers** who receive the export. If it fails, the code doesn't compile, doesn't
  match the preview, or drags in a heavy runtime, and it gets thrown away.

## Scope

### In

- A layer stack: Background, Shape, Warp, Color map, Texture layers (see Domain model).
- A compiler from a stack to one GLSL ES 1.00 fragment shader.
- A layers list + inspector panel (structure from the Figma-style reference: label column, compact
  fields, gradient bar with stops).
- Code export only: a standalone GLSL shader with the values written in, a Shadertoy version, an
  HTML file, and `<lazuli-bg>` taking a stack.
- Presets rebuilt as stacks (starting points, fully editable).

### Out (this pass)

- Image and video export, and the image-as-source layer (removed).
- The frames canvas: one shader, one preview.
- Groups (each with its own Color map; planned next), a node graph, custom GLSL layers, physics patterns, auth, npm publish, deploy.

## What exists already

| Path | Use in the builder |
| --- | --- |
| `packages/lazuli/src/shader.ts` | GLSL chunks per shape and texture. Each shape defines `shapeColor()` and calls `shade()` itself, and all share uniform names (`u_count`, `u_soft`…), so only one shape fits a program. The chunks are reused, refactored to return a **field** (coverage, tone) under per-layer names. |
| `shader.ts` `PALETTE` (`shade`, `stepTone`) | Becomes the Color map layer. |
| `shader.ts` `PATTERN` (pointer push/pull/swirl) | Becomes the Cursor warp. |
| `shader.ts` `MAIN` (background, blend) | Becomes the Background layer and the final composite. |
| `renderer.ts` | Program cache keyed by `variantKey(shape, texture)`; uniforms uploaded by name. The key becomes a hash of the stack's structure (layer kinds and order), so value changes don't recompile. |
| `uniforms.ts`, `layout.ts` | Config → uniform values; seeded blob layout. Run per layer with a per-layer prefix and seed. |
| `schema.ts` | Parameter table. Its per-shape groups become per-layer-kind parameter tables. |
| `tools/regress` | Pixel diff against references; used to prove the compiler matches today's engine. |
| `packages/lazuli/test` | `node --test` for config logic; stack reducer and compiler tests go here. |
| `src/capture.ts`, `src/mux/` | MP4 / WebM recorder and muxers deleted; the PNG `snapshot()` stays for thumbnails. |
| `apps/playground` | `Frames`, `FramePanel`, image source, the Image and Video tabs in `CodeDialog`: removed. Schema-driven `Control` rows: replaced by the inspector. |

## Domain model

**Stack**: an ordered list of layers, frontmost first (Figma convention: the top of the list is in
front).

| Layer | Count | Position | Settings |
| --- | --- | --- | --- |
| Texture | 0–3 | above Color map | Grain, Paper, Noise (overlay); Halftone, Dither (screen, max 1 per stack); Amount, Size; applies to All or Shapes |
| Color map | exactly 1 | above every Shape | Palette 2–5 stops, Steps, Opacity, Fade |
| Shape | 1–4 | between Color map and Background | Blobs, Waves, Bands, Rings, Plate, Dots + own params; **Combine** with the shapes below: Merge (smooth union), Add, Cut, Intersect; seed |
| Warp | 0–2 per Shape, plus 0–1 stack-wide Cursor | child of a Shape, or top-level Cursor | Swirl, Noise, Ripple, Cursor (Push/Pull/Swirl); Strength, Size |
| Background | exactly 1 | always last | Solid, Gradient, None |

Every layer: `id`, `kind`, `visible`, `name`. Stack-wide: Motion speed, direction.

**Legal operations** (the reducer enforces them; illegal ones return a typed error and the UI
disables the action):

| Operation | Rule |
| --- | --- |
| add | Shape ≤ 4, Texture ≤ 3, screen texture ≤ 1, Warp ≤ 2 per shape |
| delete | not the last Shape, not Color map, not Background |
| reorder | Shapes reorder among Shapes; Textures among Textures; a Warp moves only within its parent |
| hide | any layer except Background and Color map; hiding every Shape is allowed (shows Background) |
| duplicate | Shapes and Warps, within the limits above |

## Approach

**Compile the stack to one shader.** Each Shape layer emits `vec2 field_i(vec2 p, float t)`
(coverage, tone) with its uniforms prefixed `u_i_…`; its Warps wrap `p` first. Fields combine in
stack order (Merge is a smooth max on coverage, Cut is `a * (1 − b)`, …). The Color map runs
**once** on the combined field, then Textures, then the Background composite. The program is
cached by the stack's structure, so dragging a slider only changes uniforms. Export writes the
same GLSL with uniforms replaced by literals (except time, resolution and pointer).

Rejected:
- **Node graph:** most expressive, but intimidating for designers and much heavier to build.
- **Recipe slots** (fixed Shape → Distort → Color → Texture): simplest, but no multiple shapes,
  which is the first thing people will want.
- **One shader per layer composited in passes:** easy per-layer code, but N passes of cost, and the
  export stops being a single shader.

## Success criteria

1. `pnpm -r build` and `pnpm -r lint` pass, and the playground no longer imports
   `lazuli-bg/capture`, `Frames` or `FramePanel` (checked by grep).
2. Every current preset, converted to a one-shape stack, renders within 2/255 per channel of
   today's engine at t = 0 and t = 5 s (`tools/regress`).
3. Reducer tests cover every row of the Legal operations table: each legal op succeeds, each
   illegal op returns its typed error.
4. A stack round-trips through the URL and through `<lazuli-bg>` attributes unchanged (test).
5. Changing a value recompiles nothing (test: program cache size stays the same across 100 random
   value edits); changing structure compiles once.
6. A stack with 4 shapes, 2 warps and grain renders in under 8 ms at 1920×1080 on the M1
   (`bench.html`).
7. The exported standalone shader, with no Lazuli code, compiles in a fresh WebGL context and its
   HTML export matches the playground preview within 2/255 at t = 0 (headless test). The Shadertoy
   version uses `mainImage`, `iTime`, `iResolution`, `iMouse` and compiles under a Shadertoy-style
   header.
8. [human] The layers list + inspector read as clean as the reference; a designer can build
   "two blobs merged, swirl on one, grain on top" without help.

## Assumptions

- **A1** Video export is removed from the npm package too (`record`, `mux/`), and image export is gone
  from the UI. The still renderer `snapshot()` stays in `lazuli-bg/capture` to draw preset thumbnails
  (and layer previews later). Changed during Milestone 1.
- **A2** The frames canvas goes; the mascot and welcome stay as they are.
- **A3** Four shapes is enough for v1, and it keeps the fragment uniform count inside WebGL1's
  limits on low-end phones.
- **A4** Exported code with values written in is what developers want; `<lazuli-bg>` with a stack
  covers people who want to keep editing in the page.
- **A5** The panel keeps Lazuli's light palette and takes only the reference's structure.

## Decisions

- **Cursor is a Warp layer** (2026-11-14). It sits in the stack like any warp: as a child of one
  Shape it moves only that shape; at the top it moves everything.
- **One Color map per stack** (2026-11-14). All shapes melt into one form and take one palette.
  **Groups** come later: each group gets its own Color map, shapes melt inside a group and groups
  stack. Nothing in this pass blocks them.

## Findings

Milestone 2 showed that most shapes aren't one field: Milestone 3 has to pick how shapes combine.

- **Only Blobs are one field colored once.** Waves, Bands, Rings, Dots and Plate color each ribbon
  or ring and stack them. Combining at the color level (Add, Cut, Intersect by alpha) works for
  every shape as it is; a liquid Merge needs a field, which only Blobs give without reworking each
  shape.
- **What Milestone 2 leaves for later:** shapes stack with plain over-compositing; only the front
  texture draws; warps on a shape aren't compiled yet; a multi-shape stack reaches `<lazuli-bg>`
  as one encoded `stack` attribute in Milestone 6.
- **Size:** the script-tag build grew from 16 to 23 kB gzipped (stack, compiler, export).

## Milestones

1. **Strip.** Remove image/video export, the image source and the frames canvas; one preview.
   Demo: the playground with code-only export. Criteria 1. **Done 2026-11-14.**
2. **Compiler, one shape.** Stack model, reducer, compiler; today's config converts to a stack and
   renders the same. Demo: presets look unchanged on the new engine. Criteria 2, 3, 4, 5. **Done 2026-11-14:** 56 of
   56 renders pixel-identical (`tools/regress/compare.mjs`), 36 tests pass.
3. **Many shapes.** Combine modes, per-layer seeds and uniforms. Demo: two blobs merged with rings
   cut out. Criterion 6. **Done 2026-11-14:** Merge melts Blobs into the Blobs below (fields add
   up); Add, Cut, Intersect composite by alpha for every shape. 4 shapes + grain: 5.9 ms at
   1920×1080 on the M1.
4. **Layers panel.** List (add, delete, reorder, hide, duplicate) + inspector. Demo: build a stack
   by hand. Criterion 8. **Done 2026-11-14:** layers list (add menu
   greys out what the rules forbid, drag or Alt+↑/↓ to reorder, hide, duplicate, delete, rename),
   Figma-style inspector, undo/redo, stack in the URL (`?s=`).
5. **Warps.** Swirl, Noise, Ripple; Cursor moves into the stack. Demo: swirl on one shape only. **Done 2026-11-14:** Swirl, Noise, Ripple
   per shape (loop seamlessly); the cursor can sit on one shape. 4 shapes + 2 warps + grain: 6.1 ms
   at 1920×1080 on the M1 (criterion 6).
6. **Export.** Standalone GLSL, Shadertoy, HTML, `<lazuli-bg>` stack. Demo: paste into Shadertoy.
   Criterion 7. **Done 2026-11-14:** GLSL (WebGL1),
   Shadertoy and standalone HTML match `snapshot()` within 2/255 (`node tools/regress/stacks.mjs
   export`); `<lazuli-bg stack>`. Exception: halftone/dither may flip up to 0.1% of values at cell
   edges, because written-in constants round a hair differently from uniforms.
7. **Presets as stacks.** Rebuild the nine presets; freeze them. **Done 2026-11-14:** presets are a config
   plus layer operations (`presetStack`); Silk, Ripple, Stripe, Paper, Night got warps; new Orbit
   (rings cut through blobs). Frozen by `test/presets.test.ts`.

## After the milestones

- **The dock stays.** Milestone 4 first replaced the dock with a plain layers sidebar; the user
  called the dock "the beauty of lazuli", so it came back: Presets and Layers open beside it, the
  section tools jump to their layer in the right inspector.
- **Open:** Groups (a Color map per group); liquid Merge for shapes other than Blobs; a `set` op so
  presets can tune an added shape; design pass in Paper for the inspector and layer list.

## Risks

| Risk | Earliest signal |
| --- | --- |
| Refactoring shapes to fields changes how they look | Milestone 2's regress diff exceeds 2/255 |
| Many layers are slow on phones | Milestone 3 bench over 8 ms on the M1 means much worse on phones |
| Too many uniforms for WebGL1 | Link failure with 4 shapes in a WebGL1 context, Milestone 3 |
| Combine modes give ugly seams (e.g. Merge between blobs and waves) | Milestone 3 demo screenshots |
| Shader compile hitch when adding a layer | Visible stall in Milestone 4; the renderer already compiles in parallel when supported |
