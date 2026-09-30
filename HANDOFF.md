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
