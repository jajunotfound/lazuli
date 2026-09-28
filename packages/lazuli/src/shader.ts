// GLSL ES 1.00 so the same source compiles on WebGL1 and WebGL2 contexts.
//
// The fragment shader is assembled from chunks per (shape, texture) variant, so each
// program only contains the code it runs:
//
//   HEADER   uniforms shared by every variant, hash/noise helpers
//   PALETTE  shade(): coverage + tone → premultiplied pattern color from the palette stops
//   shape    vec4 shapeColor(vec2 p, float t): the pattern at p (premultiplied)
//   PATTERN  patternAt(frag): pointer warp + shape; fadeAt(frag): opacity × corner fade
//   texture  TEX_OVERLAY: vec3 texSignal(frag, t), a signed overlay (grain, noise, paper)
//            TEX_SCREEN: vec4 screenPattern(frag), re-renders the pattern (halftone, dither)
//   MAIN     pattern → texture → background → blend → output
//
// The pattern is its own layer. Over a solid background it reproduces v1 exactly: v1 drew
// the edge color with coverage e, then the core with coverage c, so the pattern alone is
// alpha 1 − (1 − e)(1 − c) with premultiplied color e(1 − c)·edge + c·core.

import type { ShapeType, TextureType } from './schema'

export const VERTEX_SHADER = /* glsl */ `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const HEADER = /* glsl */ `
precision highp float;
uniform vec2 u_res; uniform float u_time; uniform float u_dpr;
uniform vec2 u_mouse; uniform vec2 u_vel; uniform float u_active;
uniform float u_pull; uniform float u_cursorR; uniform float u_smear;
uniform vec3 u_pal[5]; uniform float u_palN; uniform float u_mapping; uniform float u_steps; uniform float u_blend;
uniform float u_opacity; uniform float u_fade;
uniform float u_bgType; uniform vec3 u_bg[3]; uniform float u_bgN;
uniform float u_bgKind; uniform float u_bgAngle; uniform vec2 u_bgCenter;
uniform float u_texIntensity; uniform float u_texScale; uniform float u_texGamma;
uniform float u_texAnimated; uniform float u_texTarget; uniform float u_texMono;
uniform float u_texOctaves; uniform float u_texAngle; uniform float u_texDotShape;
uniform float u_texMatrix; uniform float u_texLevels; uniform float u_texFibers;

// What the last shade() call saw, so a screening texture (halftone, dither) can re-shade
// the same point with quantized inputs.
float g_cov; float g_tone; vec3 g_flat; float g_isFlat;

float hash(float n) { return fract(sin(n) * 43758.5453123); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(dot(i, vec2(1.0, 57.0)));
  float b = hash(dot(i + vec2(1.0, 0.0), vec2(1.0, 57.0)));
  float c = hash(dot(i + vec2(0.0, 1.0), vec2(1.0, 57.0)));
  float d = hash(dot(i + vec2(1.0, 1.0), vec2(1.0, 57.0)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Up to five octaves of value noise, normalized to 0..1.
float fbm(vec2 p, float octaves) {
  float v = 0.0, a = 0.5, sum = 0.0;
  for (int i = 0; i < 5; i++) {
    if (float(i) >= octaves) break;
    v += a * noise(p);
    sum += a;
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v / sum;
}

float contrastCurve(float g) {
  if (u_texGamma == 1.0) return g;
  return sign(g) * 0.5 * pow(max(abs(2.0 * g), 1e-6), u_texGamma);
}
`

const PALETTE = /* glsl */ `
// Palette stop i (wrapping), for the 'cycle' mapping. GLSL ES 1.00 only allows constant
// or loop indices into uniform arrays, hence the loop.
vec3 palAt(float i) {
  float k = floor(mod(i + 0.5, u_palN));
  vec3 c = u_pal[0];
  for (int j = 1; j < 5; j++) if (float(j) == k) c = u_pal[j];
  return c;
}

// Steps: a hard outer edge and a staircase of tone bands, with a thin soft riser
// so the contours don't alias.
float stepEdge(float a) { return u_steps > 0.5 ? smoothstep(0.46, 0.54, a) : a; }
float stepTone(float u) {
  if (u_steps < 0.5) return u;
  float x = clamp(u, 0.0, 1.0) * u_steps;
  return min((floor(x) + smoothstep(0.9, 1.0, fract(x))) / u_steps, 1.0);
}

// One flat color at a coverage ('cycle' mapping).
vec4 shadeFlat(float coverage, vec3 col) {
  g_cov = coverage; g_flat = col; g_isFlat = 1.0;
  float a = stepEdge(coverage);
  return vec4(col * a, a);
}

// Stop 0 is drawn with the shape's outer coverage; each further stop k is a layer whose
// coverage rises over its slice of the tone ramp, composited over the ones below.
// With two stops that's v1's edge + core exactly.
vec4 shade(float coverage, float tone) {
  g_cov = coverage; g_tone = tone; g_isFlat = 0.0;
  coverage = stepEdge(coverage);
  tone = stepTone(tone);
  vec4 P = vec4(u_pal[0] * coverage, coverage);
  for (int k = 1; k < 5; k++) {
    if (float(k) >= u_palN) break;
    float span = u_palN - 1.0;
    float c = smoothstep(float(k - 1) / span, float(k) / span, tone);
    P = vec4(u_pal[k] * c, c) + P * (1.0 - c);
  }
  return P;
}
`

const BLOBS = /* glsl */ `
uniform float u_count; uniform float u_size; uniform float u_soft;
// Per blob: (center.x in uv, center.y, radius, x-squash) and (orbit f1, f2, amplitude, phase).
uniform vec4 u_blob[6];
uniform vec4 u_orbit[6];

// Fitted to Paper frame 01.
const float FALLOFF = 1.8;   // >1 flattens each blob's top and steepens its edge
const float CORE_LO = 0.525; // field where the core color starts
const float CORE_HI = 1.54;  // field where it's fully core

vec4 shapeColor(vec2 p, float t) {
  float aspect = u_res.x / u_res.y;
  // slow organic wobble on the edges
  p += 0.035 * vec2(noise(p * 3.0 + t * 0.4), noise(p * 3.0 - t * 0.4 + 7.0)) - 0.0175;

  float field = 0.0;
  vec3 cyc = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    if (float(i) >= u_count) break;
    vec4 b = u_blob[i];
    vec4 o = u_orbit[i];
    float p1 = o.w;
    float p2 = o.w * 1.3 + 1.7;
    float p3 = o.w * 0.7 + 2.9;
    // Orbits are offset so every blob starts exactly at its layout position (t = 0).
    vec2 c = vec2(b.x * aspect, b.y) + vec2(sin(t * o.x + p1) - sin(p1), cos(t * o.y + p2) - cos(p2)) * o.z;
    float r = b.z * u_size;
    vec2 q = p - c;
    q.x *= b.w * (1.0 + 0.12 * (sin(t * 0.3 + p3) - sin(p3)));
    float f = exp(-pow(dot(q, q) / (r * r) + 1e-6, FALLOFF));
    field += f;
    cyc += f * palAt(float(i));
  }

  // Softness widens the edge band; past the point where it would tint the ground,
  // only the outer side keeps growing, so high values read as haze.
  float lo = max(0.5 - u_soft * 0.45, 0.0);
  float hi = 0.5 + u_soft * 0.45;
  float e = smoothstep(lo, hi, field);
  float tone = (field - CORE_LO) / (CORE_HI - CORE_LO);
  if (u_mapping > 0.5) {
    // Each blob its own stop, mixed where they merge; same overall density as 'layers'.
    float c = smoothstep(0.0, 1.0, tone);
    return shadeFlat(1.0 - (1.0 - e) * (1.0 - c), cyc / max(field, 1e-4));
  }
  return shade(e, tone);
}
`

const PATTERN = /* glsl */ `
// The pattern at a pixel: pointer warp, then the shape (premultiplied, before opacity/fade).
vec4 patternAt(vec2 frag) {
  float aspect = u_res.x / u_res.y;
  vec2 uv = frag / u_res;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);

  // pointer: push away (u_pull > 0) or pull in (u_pull < 0), smear along motion.
  // Displacement scales with d itself, not normalize(d), so it fades to zero at the
  // pointer instead of flipping direction at full strength (a sharp notch). The
  // radial map is r * (1 + k * exp(-r^2/s)); k must stay below 1 or a full pull folds
  // the center inside out. 0.9 peaks at r ~ 0.15, matching the old push there.
  vec2 d = p - m;
  float fall = exp(-dot(d, d) / u_cursorR) * u_active;
  p += d * fall * 0.9 * u_pull;
  p -= vec2(u_vel.x * aspect, u_vel.y) * fall * u_smear;
  return shapeColor(p, u_time);
}

// Opacity times the corner fade at a pixel.
float fadeAt(vec2 frag) {
  return u_opacity * (1.0 - smoothstep(0.55, 1.0, length(frag / u_res - 0.5)) * u_fade);
}
`

const GRAIN = /* glsl */ `
#define TEX_OVERLAY
vec3 texSignal(vec2 frag, float t) {
  vec2 c = (floor(frag / u_texScale) + 0.5) * u_texScale;
  float seed = u_texAnimated > 0.5 ? fract(t) : 0.0;
  float n = dot(c, vec2(12.9898, 78.233));
  float g = contrastCurve(hash(n + seed) - 0.5);
  if (u_texMono > 0.5) return vec3(g * u_texIntensity);
  float gg = contrastCurve(hash(n + seed + 17.13) - 0.5);
  float gb = contrastCurve(hash(n + seed + 41.71) - 0.5);
  return vec3(g, gg, gb) * u_texIntensity;
}
`

const NOISE = /* glsl */ `
#define TEX_OVERLAY
// Soft, cloudy mottling. Base cell is 24 CSS px at scale 1; drifts slowly when animated.
vec3 texSignal(vec2 frag, float t) {
  vec2 p = frag / (u_texScale * 24.0 * u_dpr);
  vec2 drift = u_texAnimated > 0.5 ? vec2(t * 0.6, -t * 0.45) : vec2(0.0);
  float g = contrastCurve(fbm(p + drift, u_texOctaves) - 0.5);
  if (u_texMono > 0.5) return vec3(g * u_texIntensity);
  float gg = contrastCurve(fbm(p + drift + 31.7, u_texOctaves) - 0.5);
  float gb = contrastCurve(fbm(p + drift + 57.3, u_texOctaves) - 0.5);
  return vec3(g, gg, gb) * u_texIntensity;
}
`

const PAPER = /* glsl */ `
#define TEX_OVERLAY
// Paper: fine tooth with a little embossed relief, plus long fibers in a few directions.
// Always static. Base cell is 6 CSS px at scale 1.
vec3 texSignal(vec2 frag, float t) {
  vec2 p = frag / (u_texScale * 6.0 * u_dpr);
  float tooth = fbm(p, u_texOctaves);
  float relief = tooth - fbm(p + vec2(0.4, 0.4), u_texOctaves);
  float fib = 0.0;
  for (int i = 0; i < 3; i++) {
    float a = float(i) * 2.1 + 0.4;
    vec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * p * 0.35;
    fib += smoothstep(0.62, 0.9, noise(vec2(q.x * 0.25, q.y * 7.0) + float(i) * 13.0));
  }
  float g = relief * 1.4 + (tooth - 0.5) * 0.35 - fib * u_texFibers * 0.35;
  return vec3(contrastCurve(g) * u_texIntensity);
}
`

const DITHER = /* glsl */ `
#define TEX_SCREEN
// Ordered Bayer matrices from a recursive formula (no texture needed), or interleaved
// gradient noise. Values in [0, 1).
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

// Offset by half a matrix step so zero coverage never turns a dot on.
float threshold(vec2 frag) {
  vec2 c = floor(frag / u_texScale);
  if (u_texMatrix < 0.5) return bayer4(c) + 0.5 / 16.0;
  if (u_texMatrix < 1.5) return bayer8(c) + 0.5 / 64.0;
  float o = u_texAnimated > 0.5 ? floor(fract(u_time) * 64.0) * 5.588238 : 0.0;
  return fract(52.9829189 * fract(dot(c + o, vec2(0.06711056, 0.00583715))));
}

// Coverage becomes on/off dots; tone snaps to u_texLevels levels (the palette stops when
// levels equals the stop count). Opacity and corner fade are dithered too.
vec4 screenPattern(vec2 frag) {
  vec4 P = patternAt(frag);
  float k = fadeAt(frag);
  float thr = threshold(frag);
  float cov = g_cov * k;
  // Stepped coverage has a hard edge already; dither what's left of it.
  float on = step(thr, contrastCurve(cov - 0.5) + 0.5);
  vec4 D;
  if (g_isFlat > 0.5) {
    D = shadeFlat(1.0, g_flat);
  } else {
    float L = u_texLevels - 1.0;
    float tone = floor(clamp(g_tone, 0.0, 1.0) * L + thr) / L;
    D = shade(1.0, tone);
  }
  return mix(P * k, D * on, u_texIntensity);
}
`

const HALFTONE = /* glsl */ `
#define TEX_SCREEN
// A rotated screen of cells; each cell samples the pattern at its center and draws a dot
// (or line, or square) whose area follows the coverage there. Base cell is 6 CSS px.
vec4 screenPattern(vec2 frag) {
  float cell = u_texScale * 6.0 * u_dpr;
  float ca = cos(u_texAngle), sa = sin(u_texAngle);
  mat2 rot = mat2(ca, sa, -sa, ca);
  vec2 q = rot * frag / cell;           // screen space → cell space
  vec2 id = floor(q) + 0.5;
  vec2 center = (id * cell) * rot;      // back (rot is orthonormal: transpose = inverse)
  vec2 local = (q - id) * cell;         // device px from the cell center

  vec4 C = patternAt(center);
  vec3 centerCol = C.a > 1e-4 ? C.rgb / C.a : u_pal[0];
  float a = clamp(g_cov * fadeAt(center), 0.0, 1.0);
  a = clamp(contrastCurve(a - 0.5) + 0.5, 0.0, 1.0);
  float dist, r;
  if (u_texDotShape < 0.5) { dist = length(local); r = sqrt(a) * 0.7072 * cell; }
  else if (u_texDotShape < 1.5) { dist = abs(local.y); r = a * 0.5 * cell; }
  else { dist = max(abs(local.x), abs(local.y)); r = sqrt(a) * 0.5 * cell; }
  float mask = (1.0 - smoothstep(r - 0.75, r + 0.75, dist)) * step(1e-3, a);
  // Dots take the pattern's color at each pixel, so palettes stay smooth across cells;
  // where the pixel itself is outside the shape (a dot's rim), use the cell's color.
  vec4 P = patternAt(frag);
  vec3 col = mix(centerCol, P.rgb / max(P.a, 1e-4), smoothstep(0.02, 0.2, P.a));
  vec4 H = vec4(col * mask, mask);
  return mix(P * fadeAt(frag), H, u_texIntensity);
}
`

const MAIN = /* glsl */ `
vec3 background(vec2 frag) {
  if (u_bgType < 0.5) return u_bg[0];
  float t;
  if (u_bgKind < 0.5) {
    // CSS linear-gradient geometry: the line through the center at the angle, long
    // enough that the corners land on 0 and 1. GL's y axis points up.
    vec2 d = vec2(sin(u_bgAngle), cos(u_bgAngle));
    float len = abs(u_res.x * d.x) + abs(u_res.y * d.y);
    t = 0.5 + dot(frag - 0.5 * u_res, d) / len;
  } else {
    // circle farthest-corner
    vec2 c = u_bgCenter * u_res;
    t = length(frag - c) / length(max(c, u_res - c));
  }
  t = clamp(t, 0.0, 1.0);
  vec3 col = u_bgN < 2.5 ? mix(u_bg[0], u_bg[1], t)
    : (t < 0.5 ? mix(u_bg[0], u_bg[1], t * 2.0) : mix(u_bg[1], u_bg[2], t * 2.0 - 1.0));
  // A little noise so smooth gradients don't band on 8-bit output.
  return col + (hash(dot(frag, vec2(7.13, 157.1))) - 0.5) / 255.0;
}

// Separable blend modes (W3C compositing), backdrop b, source s.
vec3 blendMode(vec3 b, vec3 s) {
  if (u_blend < 1.5) return b * s;
  if (u_blend < 2.5) return 1.0 - (1.0 - b) * (1.0 - s);
  if (u_blend < 3.5) return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b));
  if (u_blend < 4.5) {
    vec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(0.25, b));
    return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(0.5, s));
  }
  return abs(b - s);
}

void main() {
  vec2 frag = gl_FragCoord.xy;

#ifdef TEX_SCREEN
  vec4 P = screenPattern(frag);
#else
  vec4 P = patternAt(frag) * fadeAt(frag);
#endif

#ifdef TEX_OVERLAY
  vec3 s = texSignal(frag, u_time);
  // Only where the shapes are: add to the pattern's own color, weighted by its alpha.
  if (u_texTarget > 0.5) { P.rgb = clamp(P.rgb + s * P.a, 0.0, P.a); s = vec3(0.0); }
#else
  vec3 s = vec3(0.0);
#endif

  if (u_bgType > 1.5) {
    // Transparent: premultiplied pattern; an overall texture becomes light/dark speckle.
    float a = abs(s.r);
    vec4 speck = vec4(vec3(step(0.0, s.r)) * a, a);
    gl_FragColor = speck + P * (1.0 - a);
    return;
  }
  vec3 b = background(frag);
  vec3 col = b * (1.0 - P.a) + P.rgb;
  if (u_blend > 0.5) {
    vec3 src = clamp(P.rgb / max(P.a, 1e-4), 0.0, 1.0);
    col = b * (1.0 - P.a) + P.a * blendMode(b, src);
  }
  gl_FragColor = vec4(col + s, 1.0);
}
`

const SHAPES: Record<ShapeType, string> = { blobs: BLOBS }
const TEXTURES: Record<TextureType, string> = { none: '', grain: GRAIN, noise: NOISE, paper: PAPER, dither: DITHER, halftone: HALFTONE }

export function variantKey(shape: ShapeType, texture: TextureType): string {
  return `${shape}|${texture}`
}

export function fragmentShader(shape: ShapeType, texture: TextureType): string {
  return [HEADER, PALETTE, SHAPES[shape], PATTERN, TEXTURES[texture], MAIN].join('\n')
}
