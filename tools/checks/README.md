# Checks without a browser

Run from the repo root (build `packages/lazuli` first; `code.ts` reads its `dist`):

```sh
node --import ./packages/lazuli/test/register.mjs tools/checks/code.ts    # the code language round trips
node --import ./packages/lazuli/test/register.mjs tools/checks/agent.ts   # Ask Lazuli's loop, with a stand-in model
node tools/checks/worker.mjs                                              # the free agent Worker, with stand-in upstreams
```
