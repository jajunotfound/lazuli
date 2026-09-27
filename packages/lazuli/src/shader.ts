// GLSL ES 1.00 so the same source compiles on WebGL1 and WebGL2 contexts.
// Behavior is identical to the prototype shader; only formatting changed.

export const VERTEX_SHADER = /* glsl */ `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

export const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform vec2 u_vel;
uniform float u_active; uniform float u_seed; uniform float u_count; uniform float u_size;
uniform float u_soft; uniform float u_pull; uniform float u_grain;
uniform vec3 u_deep; uniform vec3 u_mid; uniform vec3 u_bg;

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

  // pointer: push away (u_pull > 0) or pull in (u_pull < 0), smear along motion
  vec2 d = p - m;
  float fall = exp(-dot(d, d) / 0.045) * u_active;
  p += normalize(d + 1e-5) * fall * 0.14 * u_pull;
  p -= vec2(u_vel.x * aspect, u_vel.y) * fall * 1.6;

  // slow organic wobble on the edges
  float t = u_time;
  p += 0.035 * vec2(noise(p * 3.0 + t * 0.4), noise(p * 3.0 - t * 0.4 + 7.0)) - 0.0175;

  float field = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (fi >= u_count) break;
    float s = u_seed + fi * 13.7;
    vec2 base = vec2(0.2 + 0.6 * hash(s + 1.0), 0.2 + 0.6 * hash(s + 2.0));
    base.x *= aspect;
    float f1 = 0.3 + 0.5 * hash(s + 3.0);
    float f2 = 0.3 + 0.5 * hash(s + 4.0);
    vec2 orbit = vec2(sin(t * f1 + s), cos(t * f2 + s * 1.3)) * (0.08 + 0.1 * hash(s + 5.0));
    vec2 c = base + orbit;
    float r = mix(0.34, 0.07, pow(hash(s + 6.0), 1.5)) * u_size;
    if (i == 0) r = 0.36 * u_size;
    vec2 q = p - c;
    q.x *= 1.0 + 0.35 * sin(t * 0.3 + s);
    field += exp(-dot(q, q) / (r * r));
  }

  float lo = 0.5 - u_soft * 0.45;
  float hi = 0.5 + u_soft * 0.45;
  float e = smoothstep(lo, hi, field);
  float core = smoothstep(0.7, 1.6, field);
  vec3 col = mix(u_bg, u_mid, e);
  col = mix(col, u_deep, core);
  col = mix(col, u_bg * 1.02, smoothstep(0.55, 1.0, length(uv - 0.5)) * 0.35);
  float g = hash(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + fract(t)) - 0.5;
  col += g * u_grain;
  gl_FragColor = vec4(col, 1.0);
}
`
