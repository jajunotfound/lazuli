// Renders reel.html with Playwright.
//   node render.mjs stills 1.8 3.2 …   one PNG per time, in out/stills
//   node render.mjs contact            one frame per second, tiled into out/contact.png
//   node render.mjs loop               proves the frame at t = T matches t = 0 (PSNR)
//   node render.mjs full               4 subframes per frame → tmix → out/lazuli-reel.mp4
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const SUB = 4
const WORKERS = 3
const [mode = 'contact', ...args] = process.argv.slice(2)
const OUT = resolve('out')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ args: ['--use-angle=metal'] })

async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => {
    console.error('page error:', e.message)
    process.exit(1)
  })
  await page.goto('file://' + resolve('reel.html'))
  await page.evaluate(() => window.ready)
  const { T, FPS } = await page.evaluate(() => ({ T: window.REEL.T, FPS: window.REEL.FPS }))
  const shot = async (t, frame, path, opts = {}) => {
    await page.evaluate(([t, f, o]) => window.seek(t, f, o), [t, frame, opts])
    await page.screenshot({ path, type: 'png' })
  }
  return { page, shot, T, FPS }
}

const ff = (...a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' })
const pad = (n, w = 6) => String(n).padStart(w, '0')

if (mode === 'stills') {
  const { shot, FPS } = await openPage()
  mkdirSync(`${OUT}/stills`, { recursive: true })
  for (const a of args) {
    const t = Number(a)
    await shot(t, Math.round(t * FPS), `${OUT}/stills/t${a.padStart(5, '0')}.png`)
  }
} else if (mode === 'contact') {
  const { shot, T, FPS } = await openPage()
  const dir = `${OUT}/contact`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (let s = 0; s < T; s++) await shot(s, s * FPS, `${dir}/${pad(s, 2)}.png`)
  ff('-i', `${dir}/%02d.png`, '-vf', 'scale=360:450:flags=lanczos,tile=4x3:padding=6:color=white', '-frames:v', '1', `${OUT}/contact.png`)
  console.log(`${OUT}/contact.png`)
} else if (mode === 'loop') {
  const { shot, T, FPS } = await openPage()
  await shot(0, 0, `${OUT}/loop_first.png`)
  await shot(T, T * FPS, `${OUT}/loop_last.png`, { nowrap: true })
  execFileSync('ffmpeg', ['-hide_banner', '-i', `${OUT}/loop_first.png`, '-i', `${OUT}/loop_last.png`, '-lavfi', 'psnr', '-f', 'null', '-'], { stdio: 'inherit' })
} else if (mode === 'full') {
  const dir = `${OUT}/sub`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const pages = await Promise.all(Array.from({ length: WORKERS }, openPage))
  const { T, FPS } = pages[0]
  const total = T * FPS * SUB
  let next = 0, done = 0
  const started = Date.now()
  await Promise.all(
    pages.map(async ({ shot }) => {
      while (next < total) {
        const i = next++
        const f = Math.floor(i / SUB), k = i % SUB
        // Four samples spread across the frame interval, centred on the frame time.
        // The grain is seeded by frame number, so all four share it and don't average to mush.
        const t = (f + (k + 0.5) / SUB - 0.5) / FPS
        await shot(t, f, `${dir}/${pad(i)}.png`)
        if (++done % 240 === 0) console.log(`${done}/${total} subframes, ${((Date.now() - started) / 1000).toFixed(0)}s`)
      }
    }),
  )
  // tmix averages each run of 4 subframes; keep the last of every 4 so each output frame is one full group.
  ff(
    '-framerate', String(FPS * SUB), '-i', `${dir}/%06d.png`,
    '-vf', `tmix=frames=${SUB}:weights='1 1 1 1',select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB),scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-maxrate', '40M', '-bufsize', '80M',
    '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', `${OUT}/lazuli-reel.mp4`,
  )
  console.log(`${OUT}/lazuli-reel.mp4`)
}
await browser.close()
