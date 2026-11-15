# Lazuli: drawings you build, and an agent that builds them with you

Status: built, 2026-11-15. Follows `draw-builder.md`. Direction from the options page
(https://claude.ai/artifact/RbtHBZsYipJXT1hi3g1emW, tabs "Build a pencil drawing" and "Ask Lazuli").

## Problem

People should make their own shaders without writing code. Two gaps were left: effects like a pencil
drawing could only be picked, not built, and starting from an empty canvas was hard. Visual first,
code second; most people will start by asking.

## What we decided

- A look like pencil is made of blocks you stack and handle on the canvas, not a style you pick:
  a lit surface, lines where it's dark, a sketchy outline, paper and a cast shadow.
- Motion is a choice. Canvases are still; Drift and Breathe are options; the light can follow the pointer.
- Ask Lazuli lives on the dock (a static line icon of the mascot) and opens by itself on an empty
  canvas. It answers with ordinary layers; the code is one click away.
- Zero budget: a free Cloudflare Worker (Gemini free tier, Workers AI when that's busy or for
  EEA/UK/CH visitors), plus bring-your-own key (Gemini, OpenRouter, Anthropic). Research:
  `docs/research/agent-model.md`.

## What exists

| Block | Engine | Playground | Code |
|---|---|---|---|
| Light from a sun (matte to chrome) | `ColorLayer.light` x, y, follow; `drawnLit` | Colour map: Light, Shine, Light from; sun handle on the canvas | `light(depth, shine, vec2(x, y) or pointer)` |
| Cast shadow | `light.shadow`; `field_i` | Colour map: Shadow | `shadow(0.7)` |
| Outline | `look.outline`, `look.sketch`; `drawnFx` | Colour map: Outline, Sketchy | `outline(0.4, 0.6)` |
| Lines (hatch) | screen texture `hatch` (`shader.ts`), `texture.cross` | Textures: Lines (Angle, Cross lines) | `lines(1, 45, cross)` |
| Paper | texture `paper` (existing) | Textures: Paper | `paper(0.4)` |
| Motion | `Stack.move` drift / breathe (`composeShapes`) | Motion: Move | `move(drift)` |
| Ask Lazuli | – | `components/AskLazuli.tsx`, `agent/` (spec, providers, ask loop) | the agent writes the code language |
| Free endpoint | – | `VITE_AGENT_URL` | `workers/agent` (deploy: its README) |

The Pencil example in Presets uses all of the drawing blocks.

## Success criteria (all checked 2026-11-15)

1. Existing looks don't change: `tools/regress/compare.mjs` 0/255.
2. Exports of the new blocks match the engine: `stacks.mjs export` (pencil stack included), 38/38.
3. Every new statement round-trips through the code language: `tools/checks/code.ts`.
4. The agent's reply is parsed, compile-checked and retried once with the error:
   `tools/checks/agent.ts` (stand-in model).
5. The Worker checks origin and size, streams Gemini, falls back to Workers AI on 429/5xx and for
   EEA/UK/CH: `tools/checks/worker.mjs`.
6. [human] Asking feels like the start of making something, not a replacement for it.

## Not done (next)

- Deploy the Worker (needs a Cloudflare account and a Gemini key: `workers/agent/README.md`), then set
  `VITE_AGENT_URL`. Until then the app offers bring-your-own key only.
- No real model has been tried yet; run the 25 to 40 prompt test in the research doc once a key exists,
  and tune the spec (`agent/spec.ts`) on what goes wrong.
- In-browser model (WebLLM) as an opt-in offline mode: needs a cut-down spec (4K context).
- OpenRouter's one-click connect (OAuth PKCE) instead of a pasted key.
- On-canvas angle dial for Lines (the inspector slider works today).
