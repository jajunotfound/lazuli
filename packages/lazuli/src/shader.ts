// GLSL ES 1.00 so the same source compiles on WebGL1 and WebGL2 contexts.
// Interaction (pointer push/pull + smear, edge wobble, grain) is the prototype's.
// The look is tuned to the Paper design: blob layout comes from the CPU (layout.ts)
// as uniforms, each blob uses a flattened falloff so shapes read as soft ellipses
// rather than fuzzy dots, and the edge/core thresholds were fitted to frame 01.

export const VERTEX_SHADER = /* glsl */ `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

export const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform vec2 u_vel;
uniform float u_active; uniform float u_count; uniform float u_size;
uniform float u_soft; uniform float u_pull; uniform float u_grain;
uniform vec3 u_deep; uniform vec3 u_mid; uniform vec3 u_bg;
// Per blob: (center.x in uv, center.y, radius, x-squash) and (orbit f1, f2, amplitude, phase).
uniform vec4 u_blob[6];
uniform vec4 u_orbit[6];

// Fitted to Paper frame 01.
const float FALLOFF = 1.8;   // >1 flattens each blob's top and steepens its edge
const float CORE_LO = 0.525; // field where the core color starts
const float CORE_HI = 1.54;  // field where it's fully core

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

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);

  // pointer: push away (u_pull > 0) or pull in (u_pull < 0), smear along motion.
  // Displacement scales with d itself, not normalize(d), so it fades to zero at the
  // pointer instead of flipping direction at full strength (a sharp notch). The
  // radial map is r * (1 + k * exp(-r^2/s)); k must stay below 1 or a full pull folds
  // the center inside out. 0.9 peaks at r ~ 0.15, matching the old push there.
  vec2 d = p - m;
  float fall = exp(-dot(d, d) / 0.045) * u_active;
  p += d * fall * 0.9 * u_pull;
  p -= vec2(u_vel.x * aspect, u_vel.y) * fall * 1.6;

  // slow organic wobble on the edges
  float t = u_time;
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
  float core = smoothstep(CORE_LO, CORE_HI, field);
  vec3 col = mix(u_bg, u_mid, e);
  col = mix(col, u_deep, core);
  col = mix(col, u_bg * 1.02, smoothstep(0.55, 1.0, length(uv - 0.5)) * 0.35);
  float g = hash(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + fract(t)) - 0.5;
  col += g * u_grain;
  gl_FragColor = vec4(col, 1.0);
}
`
