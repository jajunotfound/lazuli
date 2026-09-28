// GLSL ES 1.00 so the same source compiles on WebGL1 and WebGL2 contexts.
//
// The fragment shader is assembled from chunks per (shape, texture) variant, so each
// program only contains the code it runs:
//
//   HEADER   uniforms shared by every variant, hash/noise helpers
//   PALETTE  shade(): coverage + tone → premultiplied pattern color from the palette stops
//   shape    vec4 shapeColor(vec2 p, float t): the pattern at p (premultiplied)
//   texture  vec3 texSignal(vec2 frag, float t): signed overlay (grain), when TEX_OVERLAY
//   MAIN     pointer warp → shape → opacity/fade → background → texture → output
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
uniform vec3 u_pal[5]; uniform float u_palN;
uniform float u_opacity; uniform float u_fade;
uniform float u_bgType; uniform vec3 u_bg[3]; uniform float u_bgN;
uniform float u_bgKind; uniform float u_bgAngle; uniform vec2 u_bgCenter;
uniform float u_texIntensity; uniform float u_texScale; uniform float u_texGamma;
uniform float u_texAnimated; uniform float u_texTarget; uniform float u_texMono;

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
`

const PALETTE = /* glsl */ `
// Stop 0 is drawn with the shape's outer coverage; each further stop k is a layer whose
// coverage rises over its slice of the tone ramp, composited over the ones below.
// With two stops that's v1's edge + core exactly.
vec4 shade(float coverage, float tone) {
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
    field += exp(-pow(dot(q, q) / (r * r) + 1e-6, FALLOFF));
  }

  // Softness widens the edge band; past the point where it would tint the ground,
  // only the outer side keeps growing, so high values read as haze.
  float lo = max(0.5 - u_soft * 0.45, 0.0);
  float hi = 0.5 + u_soft * 0.45;
  float e = smoothstep(lo, hi, field);
  return shade(e, (field - CORE_LO) / (CORE_HI - CORE_LO));
}
`

const GRAIN = /* glsl */ `
#define TEX_OVERLAY
float contrastCurve(float g) {
  if (u_texGamma == 1.0) return g;
  return sign(g) * 0.5 * pow(max(abs(2.0 * g), 1e-6), u_texGamma);
}

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

void main() {
  vec2 frag = gl_FragCoord.xy;
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

  vec4 P = shapeColor(p, u_time);
  P *= u_opacity * (1.0 - smoothstep(0.55, 1.0, length(uv - 0.5)) * u_fade);

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
  vec3 col = background(frag) * (1.0 - P.a) + P.rgb;
  gl_FragColor = vec4(col + s, 1.0);
}
`

const SHAPES: Record<ShapeType, string> = { blobs: BLOBS }
const TEXTURES: Record<TextureType, string> = { none: '', grain: GRAIN }

export function variantKey(shape: ShapeType, texture: TextureType): string {
  return `${shape}|${texture}`
}

export function fragmentShader(shape: ShapeType, texture: TextureType): string {
  return [HEADER, PALETTE, SHAPES[shape], TEXTURES[texture], MAIN].join('\n')
}
