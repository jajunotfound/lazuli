// Prints the animated state at t = 0 and t = T (unwrapped) so loop residuals are visible as numbers.
import { chromium } from 'playwright'
import { resolve } from 'node:path'

const b = await chromium.launch({ args: ['--use-angle=metal'] })
const p = await b.newPage()
await p.goto('file://' + resolve('reel.html'))
await p.evaluate(() => window.ready)
console.log(
  await p.evaluate(() => {
    const R = window.REEL, T = R.T
    return {
      seedMix: R.seedMix(T), hue: R.hueAt(T) - R.hueAt(0), size: R.sizeAt(T) - R.sizeAt(0),
      cam: R.camera(T), core: [R.coreAt(0), R.coreAt(T)], ptr0: R.pointer(0), ptrT: R.pointer(T),
    }
  }),
)
await b.close()
