# Handoff: 2026-09-28

Read `CLAUDE.md` first for stable context. This file is the state of play.

## Where the code is

- GitHub: https://github.com/jajunotfound/lazuli, branch **`build-lazuli`** (the repo's default).
  All work is committed and pushed there.
- The original local checkout `~/lazuli` is still on an old one-commit scaffold `main`. The work was
  done in a git worktree at `~/lazuli/.claude/worktrees/build-lazuli` (branch
  `worktree-build-lazuli`, tracking `origin/build-lazuli`). To continue somewhere else:
  `git clone https://github.com/jajunotfound/lazuli.git && cd lazuli && pnpm install`.
- pnpm on this Mac comes from corepack in `~/.local/bin` (`corepack enable pnpm --install-directory ~/.local/bin`).

## Done

1. Monorepo scaffold (pnpm workspaces, root `dev` / `build` / `lint`).
2. Engine `lazuli-bg`: shader, runtime (pointer smoothing and velocity, active fade, touch, dt cap,
   DPR ≤ 2, ResizeObserver, IntersectionObserver + visibility pause, reduced motion, WebGL1
   fallback, flat-ground fallback without WebGL, context-loss recovery, full cleanup), typed API.
3. `<lazuli-bg>` web component, ESM + script-tag IIFE builds, types. Verified from a plain
   `<script>` tag.
4. Playground UI for every Paper frame: toolbar with dock magnification and tooltips, Colors +
   picker (eyedropper where supported), Shapes (stepped Count with dots), Texture/Motion presets
   with inline sliders, Cursor (stays open on canvas), per-section Reset, Get code dialog with two
   tabs and Copied state, welcome card with a live zoomed preview, About button, Hide controls
   (H), Shuffle (R), Esc, phone layout (≤ 640px) matching the phone frames.
5. Export ("HTML file" works offline, verified from `file://`), URL state (non-defaults only),
   first-visit flag in localStorage (try/catch).
6. README, MIT LICENSE, `vercel.json`.
7. Visual pass to match Paper: defaults and colors from Paper, CPU seeded layout, default seed
   and shader constants fitted to frame 01 (first frame is 2–6/255 mean off Paper's blobs), zoomed
   welcome preview, subtle grain, light-only UI. User accepted it: "works for now".

## In progress / half-finished

Nothing is uncommitted. The visual match was accepted as good enough for now, not finished.
Files touched in that pass: `packages/lazuli/src/{layout.ts,shader.ts,params.ts,engine.ts,index.ts}`,
`apps/playground/src/{styles.css,components/Welcome.tsx}`, `apps/playground/index.html`,
`README.md`, `tools/visual-fit/*`.

## Known issues and open questions

- **Silhouette:** Paper's tall blob has a straighter left side and flatter top than ours; ours is a
  little rounder. Closing it fully likely needs a shape change in the shader (e.g. a squarer
  per-blob metric), then a re-fit with `tools/visual-fit`.
- **Core color (ask the user):** Paper's Color panel says `#1F48A8` (used); Paper's mock blob is
  `#0F4AAD` (a bit more vivid).
- **Hide controls button (ask the user):** kept in the toolbar per the brief; Paper's toolbar has no
  such button. Alternative: keyboard-only H plus the faint show button.
- **Welcome preview** shows the satellite drop in its corner; Paper's preview doesn't.
- Pointer push leaves a small sharp notch at the pointer center (`normalize(d + 1e-5)` in the
  prototype shader). Kept on purpose; the user may want it smoothed.
- `pnpm lint` is type-check only. ESLint would be a new dependency: ask first.
- 60 fps target not measured on real hardware (all checks ran on SwiftShader in headless Chrome).
- README demo GIF is a placeholder (`docs/demo.gif` doesn't exist).
- Not yet: npm publish of `lazuli-bg`, Vercel deploy, renaming `build-lazuli` to `main`.
- Visual-review screenshots (Paper vs Lazuli) are at `~/lazuli-review/` on this Mac, outside git.

## Next steps

1. Get answers on the two open questions above (core color, Hide controls placement).
2. If the user wants a closer match: adjust the blob metric in `shader.ts` and mirror it in
   `tools/visual-fit/fit.html`, run `runGeo` to see the ceiling, re-run `search.ts` → `pack.ts` →
   `runFit()`, update `DEFAULTS.seed` and the constants, then screenshot against frame 01.
3. Optionally rename the branch to `main`:
   `gh api -X POST repos/jajunotfound/lazuli/branches/build-lazuli/rename -f new_name=main`.
4. Deploy: import the repo in Vercel (config in `vercel.json`), then record the demo GIF.
5. Publish `lazuli-bg` to npm (`pnpm --filter lazuli-bg build && cd packages/lazuli && npm publish`).
