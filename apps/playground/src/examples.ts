// Starting points made with the tool itself, written in the code language. Open one and switch
// to Code to see how it's built.

import type { Stack } from 'lazuli-bg'
import { applyCode, readCode } from './canvasCode'
import { blankStack } from './state'

export interface Example {
  id: string
  name: string
  code: string
}

export const EXAMPLES: Example[] = [
  {
    id: 'chrome',
    name: 'Liquid chrome',
    code: `float d = ellipse(p, vec2(-0.21, 0.03), vec2(0.13, 0.13));
d = melt(d, ellipse(p, vec2(0.09, 0.19), vec2(0.13, 0.13)), 0.8);
d = melt(d, ellipse(p, vec2(-0.04, -0.16), vec2(0.12, 0.12)), 0.8);
d = melt(d, ellipse(p, vec2(0.21, -0.2), vec2(0.13, 0.13)), 0.8);
return palette(field(p), 0.02);
light(0.9, 0.8);
palette(#1b1f2e, #6f7690, #eef0f7);
background(#f5f6fa, #dcdfeb);`,
  },
  {
    id: 'lava',
    name: 'Lava',
    code: `float d = ellipse(p, vec2(-0.25, -0.1), vec2(0.16, 0.2));
d = melt(d, ellipse(p, vec2(0.05, 0.15), vec2(0.11, 0.11)), 0.9);
d = melt(d, ellipse(p, vec2(0.3, -0.05), vec2(0.14, 0.17)), 0.6);
return palette(field(p), 0.4);
palette(#ffd35c, #ff8a3d, #e84a5f);
background(#2a1238, #120818);`,
  },
  {
    id: 'bite',
    name: 'Bite',
    code: `float d = box(p, vec2(0, 0), vec2(0.3, 0.2), 0.06);
d = cut(d, ellipse(p, vec2(0.28, 0.18), vec2(0.13, 0.13)), 0.15);
return palette(field(p), 0.03);
palette(#c9f0e4, #3fb6a8, #0d5c63);
background(#f3fbfa);`,
  },
  {
    id: 'star',
    name: 'Star',
    code: `float d = polygon(p, vec2(0, 0.3), vec2(0.07, 0.1), vec2(0.28, 0.09), vec2(0.11, -0.04), vec2(0.17, -0.25), vec2(0, -0.12), vec2(-0.17, -0.25), vec2(-0.11, -0.04), vec2(-0.28, 0.09), vec2(-0.07, 0.1));
d = melt(d, ellipse(p, vec2(0, 0), vec2(0.06, 0.06)), 0.5);
return palette(field(p), 0.08);
glow(0.6);
palette(#fff1b8, #ffc93c, #c77d00);
background(#2b1d0e, #120c05);`,
  },
  {
    id: 'bloom',
    name: 'Bloom',
    code: `float d = ellipse(kaleido(p), vec2(0.2, 0), vec2(0.12, 0.045));
d = melt(d, ellipse(p, vec2(0, 0), vec2(0.07, 0.07)), 0.4);
return palette(field(p), 0.03);
glow(0.4);
palette(#ffe0a3, #f2607e, #6b2fa8);
background(#1a0f24, #0b0712);`,
  },
  {
    id: 'tidepool',
    name: 'Tide pool',
    code: `float d = cells(p, 5, 0.25);
return palette(field(p), 0.06);
glow(0.3);
palette(#d6f3ee, #3fb6a8, #0d5c63);
background(#06282b);`,
  },
  {
    id: 'clouds',
    name: 'Clouds',
    code: `float d = noise(p, 2.5, 0.55);
return palette(field(p), 0.2);
light(0.35, 0.3);
palette(#7fa0e0, #cfdcff, #ffffff);
background(#4c78d8, #9db8f0);`,
  },
  {
    id: 'ripples',
    name: 'Ripples',
    code: `float d = ellipse(p, vec2(-0.12, 0.02), vec2(0.1, 0.1));
d = melt(d, ellipse(p, vec2(0.14, -0.04), vec2(0.07, 0.07)), 0.7);
return palette(field(p), 0.02);
contours(14);
palette(#c5d4ff, #6b8ff0, #1f48a8);
background(#f5f8ff);`,
  },
]

/** An example as a stack: a blank canvas with the example's code applied. */
export function exampleStack(e: Example): Stack {
  const r = readCode(e.code)
  if ('error' in r) throw new Error(`[lazuli] example ${e.id}, line ${r.error.line}: ${r.error.message}`)
  return applyCode(blankStack(), r.code)
}
