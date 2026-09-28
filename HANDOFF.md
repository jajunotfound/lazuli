# Handoff: 2026-09-28 (v2 build)

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
- **The reel branch** (`worktree-lazuli-reel`, commit `a704b1d`, not pushed) still sits on the old
  scaffold and still has a Co-Authored-By trailer. To do, in its worktree:
  `git rebase --onto origin/main 404601e`, `git commit --amend` (drop the trailer),
  `git push -u origin HEAD:lazuli-reel`.

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

1. Fix `main` and the reel branch (commands above).
2. Review the v2 playground; then the Paper design pass for the sectioned UI (phase 9).
3. Freeze the presets after that pass.
4. Measure on a phone; decide on the half-resolution pattern pass if needed.
5. Deploy to Vercel, record the demo GIF, publish `lazuli-bg`.
