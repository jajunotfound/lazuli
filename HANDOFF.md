# Handoff: 2026-11-15, latest (drawings you build + Ask Lazuli)

Plan of record for this round: `docs/plans/agent-and-drawing.md` (what was built, checks, what's next).
Earlier plan: `docs/plans/draw-builder.md` (all milestones built).
- Pencil building blocks: sun light (matte to chrome), cast shadow, sketchy outline, Lines texture,
  Paper; Motion is Still / Drift / Breathe. Pencil example in Presets.
- Ask Lazuli on the dock (`components/AskLazuli.tsx`, `apps/playground/src/agent/`): agent-first on an
  empty canvas, answers as layers, Keep / Undo / Show code.
- Free endpoint: `workers/agent` (not deployed yet; needs a Cloudflare account + Gemini key, see its
  README), then `VITE_AGENT_URL` in `apps/playground/.env.local`. Bring-your-own key works today.
- Checks: `pnpm -C packages/lazuli test`; `tools/checks/*` (code language, agent loop, Worker);
  `tools/regress/*` GPU checks (serve the repo root on 5398).
- Workspace (2026-11-15, after the user's reference): the canvas fills the window behind everything
  (`.backdrop`, a second low-quality engine), the canvas card takes the canvas's own background, the
  stack panel (Shapes | Effects, settings inline under the selected row) replaces the Layers popover
  and floating inspector, full-width timeline with ticks. The dock is unchanged; its Layers button
  shows/hides the panel. Phone layout: panel overlays the top (not checked on a device yet).
- Textures apply to the shapes: new grain/noise/paper default to "only the shapes"; lit drawn shapes
  report their real coverage to dither/halftone; dither never lights a dot without coverage.
- The light handle is a quiet ring, shown only while the Colour map is selected.
- Type: Manrope, even px sizes only (14 body).

---

# Handoff: 2026-11-15, latest (option 3: draw, then shape the field)

Plan of record now: `docs/plans/draw-builder.md`. Options page (direction chosen):
https://claude.ai/artifact/RbtHBZsYipJXT1hi3g1emW (`design/lazuli-options.html`).
- Done: M1 draw engine, M2 canvas, M3 noise/cells fields + twist/kaleido/repeat warps,
  M4 light/contours/glow, M7 examples (`apps/playground/src/examples.ts`, written in the code
  language; `ExampleGrid.tsx`). Code view (`canvasCode.ts`, `CodeEditor.tsx`) covers all of it.
- Also done 2026-11-15: animation in exports, per-key easing (smooth/linear/hold), Text (own
  stroke font, `font.ts`), Gradient (linear/radial, on-canvas stops), Code layers (own GLSL,
  compile-checked in `glCheck.ts`). All milestones of draw-builder.md are built.
- Dev note: after rebuilding `packages/lazuli`, reload the playground tab (Vite doesn't hot-swap
  the engine's dist), or new geometry renders blank.
- Type: Manrope, even px sizes only (14 body).
- Checks: `pnpm -C packages/lazuli test`; `node --import ./packages/lazuli/test/register.mjs <script>`
  for playground TS from node (extensionless imports need the hook).

---

# Handoff: 2026-11-14, later (pivot: Lazuli is a visual shader builder)

Read `docs/plans/layer-builder.md` first; it is the plan of record. The user decided:
- Lazuli lets people **build a shader visually as a layer stack** and export code. It supersedes
  the "background maker" reset below and `docs/SCOPE.md`.
- Build model: **layer stack** (chosen over a node graph and fixed recipe slots).
- **Image and video export go.** Export is code only.
- The trimmed-panel work is parked, unfinished, on local branch `wip-trim-panel` (62984d9).
- Decided: Cursor is a Warp layer; one Color map per stack, Groups later. Plan doc also lives as a
  Claude Doc: https://claude.ai/artifact/R4xjCRqqkEja5aeBGtw9WC (keep both in sync).
- Milestone 1 (Strip) done: one full-screen preview, Get code has HTML / Web component / JS only,
  image source + frames canvas + video recorder removed; `snapshot()` kept for preset thumbnails.
- Milestone 2 done: `src/stack.ts` (model, rules, URL encoding, structure key), `src/compile.ts`
  (per-layer renamed shape chunks, shapes stacked back to front), renderer `setStack`, snapshot
  `stack` option. Checks: `python3 -m http.server 5398` at the repo root, then
  `node tools/regress/compare.mjs` (pixel parity vs `tools/regress/ref`, the pre-stack engine) and
  `node tools/regress/stacks.mjs` (multi-shape stacks compile and draw). `pnpm test` in
  packages/lazuli.
- Milestone 3 done: combine modes (compile.ts `shapeGroups`, `COMBINE`), Blobs split into
  `blobsField` + `blobsShade`, engine `setStack()` / `stack`. Bench: `pnpm dev:engine` (or vite on
  5399) then `GPU=1 node tools/visual-fit/shoot.mjs 'http://localhost:5399/bench.html?timing&w=1920&h=1080' …`.
- Milestone 4 done: playground state is a Stack (`App.tsx` with undo history), `Layers.tsx`,
  `Inspector.tsx` (compact fields), `layerEdit.ts` (layer ⇄ schema controls). Old toolbar and
  popover panels deleted.
- Milestone 5 done: `WARPS` GLSL in compile.ts (`warp_i` per shape, `u_warp_i_j` vec4), `tune` op,
  cursor on a shape (`add cursor` with `parent`; global push off then).
- Dock restored (user: "the side dock was the beauty of lazuli"): Presets + Layers open beside it,
  Shape/Color/Texture/Background/Motion jump to their layer in the right inspector.
- Milestone 6 done: `src/export.ts` (exportShader / exportShadertoy / exportHtml), element `stack`
  attribute, Get code tabs HTML · Web component · JavaScript · GLSL · Shadertoy.
- Milestone 7 done: presets = config + `layers` ops (`src/presetStack.ts`), frozen by
  `test/presets.test.ts` + `presets.frozen.json`; new preset Orbit. `<lazuli-bg preset="orbit">`
  alone draws the full stack.
- All seven milestones of docs/plans/layer-builder.md are done. Next: user review; open items in
  the plan's "After the milestones".

---

# Handoff: 2026-11-14 (product reset: Lazuli is a background maker)

Read this section first. Everything below it is the earlier state and is kept for history; where it
conflicts with this section, this section wins.

## Decision: Lazuli is a background maker

Pick a preset, tune a few knobs, export a PNG, a video or `<lazuli-bg>` code. One background at a
time, with an output-size picker. The npm package is the export format, not a separate product.

Why: v2 grew in three directions at once (drop-in library, background maker, shader design tool)
and the UI showed it. The user picked the background maker.

### Cut

- **Image as a frame's source** and applying the effect to items: it never ran on the engine (SVG
  filter stand-in) and doesn't fit a background maker.
- **Free-drawn frames / the frames canvas.** Replaced by an output-size picker (16:9, 1:1, 4:5,
  9:16, custom). If frames survive at all, picking the Frame tool shows the size presets right away
  and one click makes a frame; drawing first and choosing a size after is the wrong order.
- Re-check every v2 knob against "does a designer making a background need this?" before the
  redesign. Fewer, better controls.

### Design direction for the panel (user's reference: Figma-style inspector)

Port the reference's structure, not its dark palette:
- One panel surface, not a card per row. Label column left, input fields right.
- Compact fields (~32px) with icon prefixes; numbers are editable and scrubbable.
- No whole-row slider fills (they read as selection, cover labels, and look broken at low values).
- Colors: swatch + hex + opacity in one field; palette stops shown on a gradient bar above the
  list; "+" beside the Stops header instead of an "Add color" row.
- No step dots under values.

### State

- GitHub: `main` force-updated to `ab3af8a` and set as the default branch (2026-11-14).
  `build-lazuli` points at the same commit. Local `~/lazuli` main checkout is still the old scaffold.
- Paper MCP was not connected this session; nothing new is in Paper yet.

### Next

1. Trim the parameter list to the background-maker scope: proposal in `docs/SCOPE.md`, waiting for approval.
2. Redesign the panel in Paper in the new structure; user reviews.
3. Implement; remove the frames canvas and image source from the playground.

---

# Handoff: 2026-09-30 (v2 built and designed in Paper; next: review the design, then implement)

Read `CLAUDE.md` first for stable context and `ITERATION.md` for the v2 plan. This file is the
state of play.

## Where the code is

- GitHub: https://github.com/jajunotfound/lazuli, branch **`build-lazuli`** (the repo's default).
  All work is committed and pushed there.
- Work happens in the worktree `~/lazuli/.claude/worktrees/build-lazuli` (branch
  `worktree-build-lazuli`, pushed to `origin/build-lazuli`).
- **`main` on GitHub is stale.** It holds only the old one-commit scaffold `404601e`, pushed by
  mistake when a fast-forward failed (the two scaffold commits have identical files but different
  hashes). Pointing it at `build-lazuli` needs a force push, which the permission check blocked.
  To fix it, from `~/lazuli`: `git reset --keep origin/build-lazuli && git push --force-with-lease=main:404601e origin main`.
  Then set `main` as the default branch on GitHub; `build-lazuli` stays until main is confirmed.
  Still pending (the session can't force-push); the user runs:
  `cd ~/lazuli/.claude/worktrees/build-lazuli && git push --force-with-lease=main:404601e origin a9097b6:refs/heads/main && gh repo edit jajunotfound/lazuli --default-branch main`
- **The reel** is on GitHub as branch `lazuli-reel` (`8ca486b`): rebuilt on top of `build-lazuli`
  with the same 11 `promo/reel/*` files and no Co-Authored-By trailer. The local
  `worktree-lazuli-reel` branch (`a704b1d`) is the old copy and can be deleted.

## Done this session: the v2 design pass in Paper

New frames in the Paper file, in a row below the v1 frames (x 258→, y 4700–9800). All reuse v1's
exact type, colors, 242px panel, 48px rows, segmented, switch and slider styles.

| Frame | What |
| --- | --- |
| 13 Presets | 10-tool toolbar (new Presets + Background icons, Hide), Presets popover: 3-column grid of real engine thumbnails, current ring, "Edited · Revert" state, hint. |
| 14 Shapes · Blobs | New **select row** (label, value, chevron), stepped Count with dots, Stretch/Merge/Wobble, Satellite switch. |
| 15 Shape select open | Menu under the row: 36px options with a glyph per shape, check on current. |
| 16 Shapes · per-type controls | Sheet: Waves, Nodal, Bands, Rings, Dots cards. Rings gets a **Center** position pad instead of X/Y sliders. |
| 17 Color · 3 stops | Ramp bar, Core/Middle/Edge (Middle hovered with remove), dashed "Add color", divider, Mapping, Steps (Smooth), Blend select, Opacity, Corner fade. |
| 18 Blend select open | Menu flipping **up** when there's no room below. |
| 19 Texture · per-type controls | Grain, Halftone, Dither, Paper cards. |
| 20 Background · types | Solid, Gradient linear (stops, add stop, angle), Gradient radial (center pad), None (checker + note). |
| 21 Motion & Cursor | Motion (presets, speed, direction with arrow, loop, quality); Cursor Push/Pull/Swirl + Strength/Radius/Smear/Follow; Cursor off (rows dimmed). |
| 22 Get code · new tabs | JavaScript, Image (preview, size, Download PNG), Video idle (Format/Size/Rate/Length rows), Video rendering (progress + Cancel). |
| 23 Docked side panel | The alternative to toolbar + popovers: floating right panel, Preset select, accordion sections with one-line summaries, Get code footer. |
| Phone 03–05 | Phone: collapsed bar (Shuffle, Presets, Edit, Get code, Hide); Edit sheet with section chips; Presets sheet (3×3). |

Design rules introduced (apply them in code):
- The slider **handle hides while the fill edge is under the label** (long labels, low values).
- **Step dots only for ranges of ≤ 8 steps** (Levels 2–16 gets none).
- Menus open below their row and **flip up** when they'd collide.
- Tabs in Get code: "HTML · Web component · JavaScript | Image · Video" (hairline between code and media).
- Dither Pattern labels: **4×4 / 8×8 / Noise**.
- Progress bar: light accent fill + accent label (readable at any %).
- Phone: 10 tools don't fit, so the phone gets a bar + bottom sheet (chips per section).

Assets used by the frames (real engine renders, thumbnails, checkerboards) are in
`~/lazuli-review/paper-assets/` on this Mac.

## User's edits to the v2 frames (reviewed in depth, 2026-09-30)

Everything else matches what was built; these are the user's changes and they win:
- **13 Presets panel:** padding 6 → **12px**, fixed 240px width removed (hugs content, 254px);
  **"Edited · Revert" removed** from the title row; **footer hint removed**. Lazuli card is `flex: 1`.
- **16 Waves Count row:** the 5 absolutely placed step dots became an **auto-layout group of 4 dots**
  (left 98, gap 25) that ends at x 189, so **dots never sit under the value**.
- **Hints removed everywhere:** 20 None ("Transparent: …"), 21 Motion ("Loop repeats …"),
  21 Cursor ("Move over the canvas …") and Cursor off. The UI carries no helper lines now.
- v1 frames, toolbar, menus, 14/15/17/18/19/22/23 and the phone frames are unchanged.
- Open question for the user: apply the dot rule and "no hints" to the other stepped rows / v1
  hints too (frame 14 Count, Rings Sources, Color Steps, Paper Detail still have dots under the value).

## v2.1: the Lazuli mascot

- Paper artboard **"lazuli"**: 669px circle, `linear-gradient(180deg, oklab(44.2% -0.027 -0.167),
  oklab(55.2% -0.027 -0.167))`, inset shadow `23px -23px 47px #00000033`, blur 10px; two white
  45×82 pill eyes, gap 23, blur 2px, top at 30.8% of the body.
- Motion prototype: `design/lazuli-motion.html`, published at
  https://claude.ai/artifact/JUy1s3wqrthyqAKbGHmDws (private). 8 states (Idle, Look, Happy,
  Curious, Thinking, Sleepy, Surprised, Melt) each tied to a product moment, with a timing table;
  4 entrances (Drop-in-then-melt for first visit, Peek, From-a-dot for returning/reduced motion,
  Wake-it-up into the welcome card). All sizes are relative to the body, so it scales to any size.
- **Round 2 (user feedback applied):**
  - **Peek + "meet lazuli"** is the first-visit entrance ("meet" black, "lazuli" #1F48A8). Lazuli
    peeks, looks left/right/up at its name, grins, climbs up over the words.
  - **Dissolve runs backwards**: eyes close, Lazuli moves to the deep blob's spot, shrinks 18% and
    blurs out; the default blob grows out of that point (deep blob first, then the wide one and the
    drop). No more scale-up toward the viewer.
  - **Eyes rebuilt**: per-eye position/scale/tilt, gaze reaches the rim (±21% × ±16% of S) with
    sideways foreshortening; straight lids are a clip-path, slanted lids and crescent arcs a mask.
  - States: Look reaches the edges; Thinking = glances between upper corners with a concentration
    squint; Happy = crescents; new **Oops** (worried, for failed exports / no WebGL). 9 states.
- **Frames prototype**: `design/lazuli-frames.html`, published at
  https://claude.ai/artifact/4MfQiFxF5PHEj42zzmm2jG (private). Canvas of frames (name + export
  size above each), presets open as frames beside the selected one, aspect 16:9 / 1:1 / 4:5 /
  9:16, docked panel edits the selection, only the selected frame is "Live". **One kind of frame**
  (user feedback): Source is a Shape / Image setting on any frame, not a separate frame type; new
  frames come from the Presets popover on the toolbar "+" (frame 13 style), no horizontal preset
  strip; drop an image onto a frame to use it there, or on the canvas for a new frame. Image: an
  uploaded or dropped image, gradient-mapped through a preset's palette (SVG filter stand-in for
  the engine's image-as-field pass) with Steps, Softness, Grain, Mix; Get code shows a proposed
  `source=` attribute. Paper was disconnected, so this isn't in Paper yet.
- Auth: deferred by the user.

## Next: review the design, then implement it

1. User reviews frames 13–23 and Phone 03–05; decides **docked panel (23) vs toolbar + popovers**.
2. Implement the chosen layout from the frames (`get_jsx` / `get_computed_styles` for values).
3. Swap the placeholder icons in `apps/playground/src/icons.tsx` for the Paper ones (Presets,
   Background, Chevron, shape glyphs, Edit sliders icon).

## (Previous) task description: design the v2 UI in Paper

The user asked for **every page and state that isn't in Paper yet** to be designed there.
- File: https://app.paper.design/file/01M3HS8GJTKKBKPPYXYW1ZV876/p-1-0/1F0-0 (Paper desktop app
  must be open; the session needs the `paper` MCP connected).
- Paper has only the v1 frames: `01 Default` … `12 Get code copied`, `Phone 01 Shapes`,
  `Phone 02 Cursor`. First read them (`get_jsx` / `get_computed_styles`) and reuse their exact
  type, spacing, radii, colors and components. Don't invent a new visual language.
- Reference for what exists: run the playground (`pnpm dev` in this worktree) and click through.
  The current UI is schema-generated in the v1 popover style, so the design wins over it.
- Frames to add:
  1. Presets panel (9 cards with thumbnails, current + "edited" states).
  2. Shape panel: shape select + per-shape controls (Blobs, Waves, Nodal at least; list states
     for Bands, Rings, Dots).
  3. Color panel: 2–5 stops (Core / Middle / Edge), Mapping (By depth / Per shape), Steps, Blend.
  4. Texture panel: Type select + per-type controls (Grain, Halftone, Dither, Paper).
  5. Background panel: Solid, Gradient (stops, kind, angle / center), None (transparent).
  6. Motion (Speed, Direction, Loop, Quality) and Cursor (Push/Pull/Swirl, Strength, Radius,
     Smear, Follow).
  7. Select menu open state (e.g. Blend, Shape).
  8. Get code: JavaScript, Image, Video (idle + rendering progress) tabs.
  9. A docked side-panel alternative to the 10-tool toolbar + popovers (agreed direction to explore).
  10. Phone versions of the new sections.
- New icons (Presets, Background, chevron) are placeholders in `apps/playground/src/icons.tsx`;
  design proper ones.

## Proposed next: physics-inspired patterns (waiting for the user's go-ahead)

Presets that reproduce real experiments, each with a one-line "what you're seeing". Cheap batch
(single pass, same cost as current shapes): Faraday waves (N plane waves: squares / hexagons /
quasicrystals), circular Chladni plate / drumhead (Bessel modes, as a Nodal option), magnetic
field lines (iron filings around 2–4 poles), Young's slits (2-source Rings exists; add a plane
source), soap film / Newton's rings (an "iridescent" color mode for any shape), diffraction (Airy
disk, slit gratings), moiré. Medium: Bénard convection cells, harmonograph / Lissajous. Heavy (needs
a ping-pong simulation pass the engine doesn't have): reaction–diffusion (Turing, BZ spirals),
Kármán vortex street.

## Done (v2, phases 1–8 of ITERATION.md)

1. Parameter schema (`schema.ts`) drives attributes, URL, export, docs and the playground's controls.
   v1 names still work everywhere.
2. Pattern and background are separate layers: solid, gradient, transparent; opacity, corner fade.
   Defaults render within 1/255 of v1 (`tools/regress`).
3. Palette of 2–5 stops, by depth or per shape, posterized steps, six blend modes.
4. Textures: grain, noise, paper, halftone, dither (with per-type controls).
5. Shapes: blobs (+ stretch, merge, wobble, satellite), waves, bands, rings, dots, nodal (Chladni).
6. Motion direction, seamless loops, cursor swirl/off + radius/smear/follow, adaptive quality.
7. Nine presets with thumbnails; URLs store the preset plus changes.
8. Export: HTML, web component, JS, PNG, MP4/WebM (own muxers, no dependency).
9. Also: the pointer notch fix, config tests, GLSL minified in builds, docs regenerated from the schema.

## Decisions made along the way (flag if you disagree)

- **Video muxing is in-house** (MP4 + WebM writers, ~250 lines) rather than `mediabunny`, to keep
  zero dependencies. Verified with ffprobe/ffmpeg.
- **Nodal (Chladni) shape added**, from the plan's suggestions.
- **Texture panel:** the None/Fine/Heavy preset row is replaced by a Type select (six types).
- **Dither levels** are tone levels (snap to the palette when equal to its stop count); coverage
  is always on/off dots.
- **Direction for waves** only picks which way ribbons travel along themselves.
- Presets are **provisional**: tuned by eye, to be frozen after the Paper design.

## Known issues and open questions

- **Design (phase 9):** the toolbar now has 10 tools, and panels like Shapes (up to 9 rows) and
  Texture scroll inside their popover. You agreed a docked side panel is likely; that's the Paper
  pass. New icons (Presets, Background, chevron) are placeholders, not from Paper.
- Performance on phones is unmeasured. M1 numbers are in `ITERATION.md` §2.3.
- Jittered dots are the slowest variant (19 ms at 2880×1800 on an M1).
- Halftone at full size is too slow for SwiftShader (headless screenshots of it time out); fine on
  a GPU (10 ms).
- Video has no alpha: transparent backgrounds render over black.
- Earlier open items still stand: the blob silhouette vs Paper, the welcome preview's satellite
  drop (now `blobs.satellite: false` can hide it), no ESLint, no demo GIF, not deployed, not on npm.

## Next steps

1. Fix `main` (command above; the reel branch is done).
2. Review the Paper design (frames 13–23, Phone 03–05); pick docked panel vs popovers; implement.
3. Freeze the presets after that pass.
4. Measure on a phone; decide on the half-resolution pattern pass if needed.
5. Deploy to Vercel, record the demo GIF, publish `lazuli-bg`.
