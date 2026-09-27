# Lazuli reel

A 12 s, 1080×1350, 60 fps looping Instagram video of the playground. One continuous take: the cursor
glides in over the shapes, shuffles, recolours the core, grows the shapes, copies the code, and shuffles
back to the opening frame.

```sh
npm install && npx playwright install chromium
npm run contact   # out/contact.png, one frame per second
npm run loop      # PSNR between t = 12 and t = 0 (should be "inf")
npm run render    # out/lazuli-reel.mp4 (≈5 min on an M1)
node render.mjs stills 2.2 4.6   # any moments, into out/stills
node seeds.mjs 12.5 61.3 …       # compare compositions
```

Needs ffmpeg with libx264.

## How it works

- `reel.html` exposes `seek(t, frame)`. Every value is computed from `t`: no CSS transitions, timers or
  per-frame state. Springs are closed-form step responses, and a value that changes target several times
  is the sum of one spring per change.
- The shader is the Lazuli fragment shader from `packages/lazuli/src/shader.ts`. Lines marked `PROMO`
  add two seeds blended by `u_seedMix` (so Shuffle glides), two time phases blended across the loop (so
  the drift returns to its start), a camera mapping, and grain seeded by frame number.
- The engine smooths the pointer with per-frame easing. Here each easing is replaced by its continuous
  exponential kernel, convolved with the scripted cursor path and its analytic derivative.
- The UI is a 540×675 CSS app drawn at 2×. The camera scales it with a plain 2D transform (no
  `will-change`) and passes the same transform to the shader, which always renders at 1080×1350.
- `render.mjs full` takes 4 subframes per frame, centred on the frame time, and ffmpeg's `tmix` blends
  them into H.264 High, yuv420p, BT.709.
- Values follow the Paper file "Lazuli": white ground, core `#1F48A8`, edge `#4C78D8`, softness 50,
  texture 35, seven tools.

To retime anything, edit `S` (the script) and `CAM_EVENTS` near the top of `reel.html`.
