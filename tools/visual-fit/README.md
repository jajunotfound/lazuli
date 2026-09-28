# visual-fit

Tools used to fit the engine's default look to Paper frame 01. Not part of any build.

| File | What it does |
| --- | --- |
| `ref.html` | Frame 01's three blobs, CSS copied verbatim from Paper's JSX export, on white 1280×832. The target. |
| `paper-ref.png` | `ref.html` rendered in Chrome. Matches Paper's own export to ~0.5–4.6/255 per channel. |
| `search.ts` | Scans millions of seeds through `layoutFromSeed` for the layout closest to target blob geometry (edit `T` for a new target). ~1M seeds/s. |
| `pack.ts` | Writes `layouts.json` (packed uniforms) for chosen seeds, for `fit.html`. |
| `fit.html` | Runs the fragment shader in WebGL and pixel-fits knobs (`rscale`, `soft`, `clo`, `chi`, `k`) per seed. `runFit()` fits the seeds in `layouts.json`; `runGeo(seed, init)` frees the blob geometry too (the best the shader can do); `show(p)` renders at 1280×832. |
| `shoot.mjs` | Headless-Chrome (CDP) driver used for fitting and UI screenshots. `node shoot.mjs <url> <out-prefix> <w> <h> <steps.json>`. Steps: `eval`, `wait`, `shot`, `mouse`, `click`, `tap`, `key`, `save`. Env: `SCHEME`, `MOTION`, `GPU=1` (real GPU instead of SwiftShader, for timing). |

## Workflow

```sh
cd tools/visual-fit
node search.ts 30000000                  # top-10 seeds for the target geometry in search.ts
node pack.ts <seed> <seed> ...           # -> layouts.json
python3 -m http.server 5399 &            # fit.html needs http (image + fetch)
echo '[{"eval":"runFit()"}]' > fit.json
node shoot.mjs http://localhost:5399/fit.html out 1280 832 fit.json
```

Put the winning seed in `DEFAULTS.seed` (`packages/lazuli/src/params.ts`) and the fitted knobs in
`shader.ts` (`FALLOFF`, `CORE_LO`, `CORE_HI`) and `params.ts` (`SIZE_SCALE`, `SOFT_*`).
The shader in `fit.html` must mirror `packages/lazuli/src/shader.ts`; keep them in sync.
