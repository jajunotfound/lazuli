# Lazuli scope: the background maker's knobs

Status: proposal, 2026-11-14. Nothing is implemented yet.

Lazuli is a background maker: pick a preset, tune a few knobs, export. The engine has 80
parameters; the default Blobs look shows 33 controls at once. This trims the panel to the knobs a
designer needs to make a background: **17 at once for Blobs**, never more than 20.

## Rules

- **Trim the panel, not the engine.** Cut knobs disappear from the playground. The engine keeps them
  as `<lazuli-bg>` attributes with their current defaults, so presets that use them still render the
  same and nothing published breaks. Deleting them from the engine is a later, separate decision.
- **Five knobs per shape at most.** Each shape keeps Count, size, Softness and its one signature knob.
- **Settings that belong to an output live in Export**, not the panel: loop length (video), quality
  and reduced motion (code).
- **Positions are dragged on the canvas**, not set with X/Y sliders.
- **Seed becomes the Shuffle button.** No number field.

## The panel

| Section | Keep | Cut from the panel (engine default stays) |
| --- | --- | --- |
| **Shape** | Type: Blobs, Waves, Bands, Rings, Plate | Dots (halftone texture covers the dotted look) |
| Blobs | Count, Size, Softness, Wobble | Stretch, Merge (always liquid), Satellite |
| Waves | Count, Height, Thickness, Softness, Angle | Wavelength, Spread, Twist |
| Bands | Count, Width, Softness, Warp, Angle | Warp size |
| Rings | Count, Thickness, Softness, Distortion; center dragged on canvas | Spacing (follows Count), Sources, Center X/Y sliders |
| Plate (was Nodal) | Pattern (one stepper over curated mode pairs), Thickness, Softness, Lines / Regions | Mode n, Mode m, Scale |
| **Color** | Palette (2–5 stops on a gradient bar), Steps, Opacity, Fade | Mapping, Blend |
| **Texture** | Type: None, Grain, Halftone, Dither, Paper; Amount; Size | Noise (overlaps Grain), Contrast, Animated, Applies to, Monochrome, Detail, Angle, Dot shape, Pattern, Levels (snaps to the palette), Fibers |
| **Background** | Type: Solid, Gradient, None; Color or 2–3 stops; Angle (gradient) | Radial kind, Center X/Y |
| **Motion** | Speed, Direction (directional shapes only) | Loop → video export, Reduced motion → code export |
| **Cursor** (folds into Motion) | Mode: Push, Pull, Swirl, Off; Strength | Radius, Smear, Follow |
| **Global** | Shuffle button | Seed field, Quality → code export |

Sections drop from 9 tools to 6: **Presets, Shape, Color, Texture, Background, Motion**, plus
Export as a button.

## Counts

| | v2 now | Trimmed |
| --- | --- | --- |
| Parameters in the panel overall | 80 | 41 |
| Controls visible at once (Blobs, grain, solid) | 33 | 17 |
| Shapes / textures | 6 / 6 | 5 / 5 |

## Presets

All nine presets keep working because the engine keeps every parameter. Silk (Wavelength, Spread,
Twist) and Night (Blend: Screen) use knobs the panel no longer shows. Changing a preset's visible
knobs keeps its hidden values. Presets get frozen after the panel redesign.
