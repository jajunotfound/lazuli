import { layoutFromSeed, packLayout } from '../../packages/lazuli/src/layout.ts'
import { writeFileSync } from 'node:fs'
const seeds = process.argv.slice(2).map(Number)
const out = Object.fromEntries(seeds.map((s) => { const p = packLayout(layoutFromSeed(s)); return [s, { blob: [...p.blob], orbit: [...p.orbit] }] }))
writeFileSync(new URL('./layouts.json', import.meta.url), JSON.stringify(out))
console.log('packed', seeds.length)
