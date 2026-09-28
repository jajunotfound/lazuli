# Parameters

Every parameter, as an attribute on `<lazuli-bg>` and as a path in the JS config
(`blobs.count` is `{ blobs: { count } }`). Generated from `packages/lazuli/src/schema.ts`:
run `pnpm --filter lazuli-bg params-doc` after changing it.

A shape's section (Blobs, Waves, …) applies when that shape is selected. A few texture settings
apply only to some types: Detail (noise, paper), Angle and Dot (halftone), Pattern and Levels
(dither), Fibers (paper), Applies to (grain, noise, paper), Animated (grain, noise, dither),
Monochrome (grain, noise). Out-of-range values are clamped; invalid ones are ignored.

**General**

| Attribute | JS path | Values | Default |
| --- | --- | --- | --- |
| `seed` | `seed` | number | `7226165.5` |
| `quality` | `quality` | `auto` \| `high` \| `low` | `auto` |

**Shape**

| Attribute | JS path | Values | Default |
| --- | --- | --- | --- |
| `shape` | `shape.type` | `blobs` \| `waves` \| `bands` \| `rings` \| `dots` \| `nodal` | `blobs` |

**Blobs**

| Attribute | JS path | Values | Default |
| --- | --- | --- | --- |
| `blobs-count` | `blobs.count` | 1–6 (whole) | `3` |
| `blobs-size` | `blobs.size` | 40–160 | `100` |
| `blobs-softness` | `blobs.softness` | 0–100 | `50` |
| `blobs-stretch` | `blobs.stretch` | 0–200 | `100` |
| `blobs-merge` | `blobs.merge` | 0–100 | `100` |
| `blobs-wobble` | `blobs.wobble` | 0–100 | `50` |
| `blobs-satellite` | `blobs.satellite` | `true` \| `false` | `true` |

**Waves**

| Attribute | JS path | Values | Default |
| --- | --- | --- | --- |
| `waves-count` | `waves.count` | 1–8 (whole) | `3` |
| `waves-amplitude` | `waves.amplitude` | 0–100 | `40` |
| `waves-wavelength` | `waves.wavelength` | 10–100 | `60` |
| `waves-thickness` | `waves.thickness` | 2–100 | `30` |
| `waves-softness` | `waves.softness` | 0–100 | `50` |
| `waves-spread` | `waves.spread` | 0–100 | `50` |
| `waves-twist` | `waves.twist` | 0–100 | `30` |
| `waves-angle` | `waves.angle` | -90–90 | `0` |

**Bands**

| Attribute | JS path | Values | Default |
| --- | --- | --- | --- |
| `bands-count` | `bands.count` | 1–30 (whole) | `6` |
| `bands-angle` | `bands.angle` | 0–180 | `30` |
| `bands-width` | `bands.width` | 5–95 | `50` |
| `bands-softness` | `bands.softness` | 0–100 | `40` |
| `bands-warp` | `bands.warp` | 0–100 | `30` |
| `bands-warp-scale` | `bands.warpScale` | 0–100 | `50` |

**Rings**

| Attribute | JS path | Values | Default |
| --- | --- | --- | --- |
| `rings-count` | `rings.count` | 1–24 (whole) | `6` |
| `rings-spacing` | `rings.spacing` | 5–100 | `40` |
| `rings-thickness` | `rings.thickness` | 2–100 | `30` |
| `rings-softness` | `rings.softness` | 0–100 | `40` |
| `rings-center-x` | `rings.centerX` | 0–100 | `50` |
| `rings-center-y` | `rings.centerY` | 0–100 | `50` |
| `rings-sources` | `rings.sources` | 1–3 (whole) | `1` |
| `rings-distortion` | `rings.distortion` | 0–100 | `20` |

**Dots**

| Attribute | JS path | Values | Default |
| --- | --- | --- | --- |
| `dots-spacing` | `dots.spacing` | 6–120 | `24` |
| `dots-size` | `dots.size` | 0–100 | `60` |
| `dots-softness` | `dots.softness` | 0–100 | `20` |
| `dots-grid` | `dots.grid` | `square` \| `hex` | `hex` |
| `dots-jitter` | `dots.jitter` | 0–100 | `0` |
| `dots-modulation` | `dots.modulation` | 0–100 | `60` |

**Nodal**

| Attribute | JS path | Values | Default |
| --- | --- | --- | --- |
| `nodal-n` | `nodal.n` | 1–12 (whole) | `3` |
| `nodal-m` | `nodal.m` | 1–12 (whole) | `5` |
| `nodal-thickness` | `nodal.thickness` | 2–100 | `20` |
| `nodal-softness` | `nodal.softness` | 0–100 | `40` |
| `nodal-scale` | `nodal.scale` | 20–200 | `100` |
| `nodal-style` | `nodal.style` | `lines` \| `regions` | `lines` |

**Color**

| Attribute | JS path | Values | Default |
| --- | --- | --- | --- |
| `color-palette` | `color.palette` | 2–5 hex colors | `#4c78d8, #1f48a8` |
| `color-mapping` | `color.mapping` | `layers` \| `cycle` | `layers` |
| `color-steps` | `color.steps` | 0–8 (whole) | `0` |
| `color-blend` | `color.blend` | `normal` \| `multiply` \| `screen` \| `overlay` \| `soft-light` \| `difference` | `normal` |
| `color-opacity` | `color.opacity` | 0–100 | `100` |
| `color-fade` | `color.fade` | 0–100 | `35` |

**Texture**

| Attribute | JS path | Values | Default |
| --- | --- | --- | --- |
| `texture-type` | `texture.type` | `none` \| `grain` \| `noise` \| `halftone` \| `dither` \| `paper` | `grain` |
| `texture-intensity` | `texture.intensity` | 0–100 | `35` |
| `texture-scale` | `texture.scale` | 1–16 | `1` |
| `texture-contrast` | `texture.contrast` | 0–100 | `50` |
| `texture-animated` | `texture.animated` | `true` \| `false` | `true` |
| `texture-target` | `texture.target` | `all` \| `pattern` | `all` |
| `texture-mono` | `texture.mono` | `true` \| `false` | `true` |
| `texture-octaves` | `texture.octaves` | 1–5 (whole) | `3` |
| `texture-angle` | `texture.angle` | 0–90 | `45` |
| `texture-dot-shape` | `texture.dotShape` | `dot` \| `line` \| `square` | `dot` |
| `texture-matrix` | `texture.matrix` | `bayer4` \| `bayer8` \| `ign` | `bayer8` |
| `texture-levels` | `texture.levels` | 2–16 (whole) | `4` |
| `texture-fibers` | `texture.fibers` | 0–100 | `40` |

**Background**

| Attribute | JS path | Values | Default |
| --- | --- | --- | --- |
| `background-type` | `background.type` | `solid` \| `gradient` \| `transparent` | `solid` |
| `background-color` | `background.color` | hex color | `#ffffff` |
| `background-gradient` | `background.gradient` | 2–3 hex colors | `#ffffff, #e8eefb` |
| `background-kind` | `background.kind` | `linear` \| `radial` | `linear` |
| `background-angle` | `background.angle` | 0–360 | `180` |
| `background-center-x` | `background.centerX` | 0–100 | `50` |
| `background-center-y` | `background.centerY` | 0–100 | `50` |

**Motion**

| Attribute | JS path | Values | Default |
| --- | --- | --- | --- |
| `motion-speed` | `motion.speed` | 0–1.5 | `0.35` |
| `motion-direction` | `motion.direction` | 0–360 | `0` |
| `motion-loop` | `motion.loop` | 0–60 | `0` |
| `reduced-motion` | `motion.reducedMotion` | `respect` \| `ignore` | `respect` |

**Cursor**

| Attribute | JS path | Values | Default |
| --- | --- | --- | --- |
| `cursor-mode` | `cursor.mode` | `push` \| `pull` \| `swirl` \| `off` | `push` |
| `cursor-strength` | `cursor.strength` | 0–100 | `60` |
| `cursor-radius` | `cursor.radius` | 0–100 | `50` |
| `cursor-smear` | `cursor.smear` | 0–100 | `50` |
| `cursor-follow` | `cursor.follow` | 0–100 | `50` |
