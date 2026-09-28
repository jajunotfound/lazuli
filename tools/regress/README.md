# regress

Checks that the engine's defaults still render like v1 (the look fitted to Paper frame 01).
`v1/lazuli.global.js` is the last v1 build, kept as the reference.

```sh
python3 -m http.server 5398 &      # from the repo root
node tools/regress/run.mjs          # renders v1 and the current build, prints the pixel diff
```

`page.html?engine=…&opts=…` renders one build full-window; `diff.html?a=…&b=…` compares two PNGs.
Target: max difference ≤ 2/255 per channel.
