# Lazuli: draw, then shape the field

Status: building, 2026-11-14. Follows `layer-builder.md` (the layer stack, its compiler and export
are the base). Direction chosen on the options page (https://claude.ai/artifact/RbtHBZsYipJXT1hi3g1emW):
option 3 by default, with a code view beside the canvas.

## Problem

The layer stack only remixes shapes someone else wrote (blobs, waves, rings). People can't make
their own forms. Lazuli should let you draw any shape and shape its field (soften, melt, ring,
warp, light it), and give you the code.

## Scope

In: drawn layers (ellipse, rectangle, pen path, later text); continuous melt and soft cut /
intersect between drawn layers; a framed canvas with drawing tools in the dock; field sources that
aren't shapes (noise, cells, gradient); more ways to bend space; color and light; a loop timeline;
the side code editor with scrubbable numbers and Code layers; examples rebuilt with the tool.

Out (for now): simulations (fluid, reaction-diffusion), 3D, collaboration.

## Model

A **drawn layer** sits in the stack's shape list beside today's generated shapes:

| Field | Meaning |
| --- | --- |
| `geom` | `ellipse` (center, radii), `rect` (center, half size, corner radius), `path` (closed polygon, up to 32 points; pen curves are sampled into points) |
| `melt` | 0–1: how softly it joins the drawn layer below (0 = hard edge) |
| `combine` | merge, add, cut, intersect (cut and intersect are smooth when melt > 0) |
| `soft` | 0–1: edge softness of the group it starts |
| `warps` | the same warps as other shapes |

Consecutive drawn layers that merge, cut or intersect form one **field group**: their distances
combine with smooth min / max, then the group is shaded once through the palette (depth → tone),
so melted shapes color as one liquid form. A group lands on the layers below like any other group.

## Success criteria

1. Existing looks don't change: `tools/regress/compare.mjs` stays at 0/255.
2. Drawn layers compile and draw on WebGL1 and WebGL2 (`tools/regress/stacks.mjs` checks).
3. Melt is continuous: melt 0 equals a hard union; raising it fills the gap between two shapes
   (pixel check).
4. Cut with melt removes a soft bite; intersect keeps only the overlap (pixel checks).
5. A path layer renders any closed polygon (a star and a concave L), inside/outside correct.
6. Export (GLSL, Shadertoy, HTML) of a drawn stack matches the engine within 2/255.
7. [human] Drawing on the canvas feels like making something (milestone 2 onward).

## Milestones

1. **Draw engine:** drawn layers, field groups, melt / soft cut / intersect, export. Tests + GPU checks.
   **Done 2026-11-14:** criteria 1–6 pass (parity 0/255; 4 drawn GPU checks; drawn export matches).
2. **Canvas:** one centered 16:9 frame (sizes dropped at the user's request; was 16:9 · Square · Phone · Fill), dock tools Move / Pen / Ellipse /
   Rectangle, selection handles, melt handle between shapes.
   **Done 2026-11-14:** blank start (now an empty canvas with a hint; Presets › New canvas clears); V/P/O/R tools, Shift+R shuffle, arrows
   nudge; drag to draw, click points to pen (close on the first point, Enter or double-click);
   move, corner resize, path point drag, melt handle; inspector Melt / Softness / Rotation / Corner.
3. **Fields and bending:** text, noise, cells, gradient sources; repeat, kaleidoscope, twist.
   **Done 2026-11-15 (partly):** Noise (scale, fill) and Cells (scale, gap) are drawn layers that fill
   the frame and melt/cut like any shape; Twist, Kaleido and Repeat join the warps. All are in the
   Draw menu, the inspector and the code (`noise(p, …)`, `cells(p, …)`, `kaleido(p)`). Deferred:
   text as a field (needs a glyph SDF atlas) and gradient sources.
4. **Color and light:** on-canvas gradient, contours, glow, light as height.
   **Done 2026-11-15 (partly):** Light (depth + shine: bevel from the field, palette reflection,
   specular) for chrome looks; Contours and Glow on the colour map; all in the inspector and code
   (`light()`, `contours()`, `glow()`, written only when on). Deferred: on-canvas gradient handles.
5. **Motion:** loop timeline with keyframes.
   **Started 2026-11-14 (brought forward):** timeline under the canvas, ◆ Key, scrub, play/pause,
   auto-key while paused; keys live in the stack (`keys`, `animateStack`). Not yet: export of
   animation, per-key easing.
6. **Code view:** side editor (Code | Properties) with scrubbable numbers; Code layers.
   **Started 2026-11-14 (brought forward):** Code mode is a workspace (dock hides). The left pane
   is a CodeMirror editor over Lazuli's shape language (`canvasCode.ts`: ellipse / box / polygon,
   melt / cut / intersect, palette, background): valid edits apply as you type, errors underline
   and keep the last good canvas, Alt-drag slides numbers. Not yet: Code layers (free GLSL).
7. **Examples:** today's looks rebuilt as files made with the tool; presets become examples.
   **Done 2026-11-15:** `examples.ts` holds eight looks written in the code language (Liquid chrome,
   Lava, Bite, Star, Bloom, Tide pool, Clouds, Ripples); Presets shows them as Examples above the
   Built-in presets. Picking one opens it as editable drawn layers.

## Type

Manrope, even pixel sizes only (14 body, 12 small, 10 tiny).
