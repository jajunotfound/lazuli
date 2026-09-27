// Composition picker: renders the bare shader for a list of seeds at a few moments, tiled.
//   node seeds.mjs 4.2 12.5 33.1 …
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const seeds = process.argv.slice(2)
const times = [0, 2.5, 5]  // shader-time phases (time0), all at t = 0 with the camera at rest
const dir = resolve('out/seeds')
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=metal'] })
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } })
let i = 0
for (const s of seeds) {
  for (const t of times) {
    await page.goto(`file://${resolve('reel.html')}?bare=1&seedA=${s}&seedB=${s}&time0=${t}`)
    await page.evaluate(() => window.ready)
    await page.screenshot({ path: `${dir}/${String(i++).padStart(3, '0')}.png` })
  }
}
await browser.close()
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', `${dir}/%03d.png`, '-vf',
  `scale=216:270,tile=${times.length * 2}x${Math.ceil(seeds.length / 2)}:padding=4:color=white`,
  '-frames:v', '1', resolve('out/seeds.png')])
console.log(seeds.map((s, k) => `${k * times.length}-${k * times.length + times.length - 1}: ${s}`).join('  '))
