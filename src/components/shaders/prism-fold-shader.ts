import { PRISM_FOLD_MAX_COLORS, PRISM_FOLD_MAX_FOLDS } from "./prism-fold-uniforms";

export const prismFoldMeta = {
  maxColorCount: PRISM_FOLD_MAX_COLORS,
} as const;

// Output is premultiplied, like the other shaders, so a translucent ramp composites.
export const prismFoldFragmentShader = `#version 300 es
precision highp float;

uniform vec4 u_colors[${PRISM_FOLD_MAX_COLORS}];
uniform float u_colorsCount;
uniform vec4 u_colorSeam;

uniform float u_folds;
uniform float u_fan;
uniform float u_curve;
uniform float u_lift;
uniform float u_softness;
uniform float u_spread;
uniform float u_warp;
uniform float u_sheen;
uniform float u_sheenWidth;
uniform float u_seam;
uniform float u_seamWidth;
uniform float u_seamFalloff;
uniform float u_dispersion;
uniform float u_grain;

uniform float u_time;
// Device pixels per CSS pixel; keeps the seam's on-screen width fixed.
// mediump to match the library's vertex shader: a precision mismatch fails to link.
uniform mediump float u_pixelRatio;

in vec2 v_objectUV;
out vec4 fragColor;

#define MAX_FOLDS ${PRISM_FOLD_MAX_FOLDS}
// Where every fold starts (uv runs -1.5..1.5 along the frame's long side), and the first fold's heading in radians.
#define PIVOT vec2(-0.6, -1.0)
#define HEADING 0.62
#define DRIFT 0.05

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(
    mix(hash(i), hash(i + vec2(1., 0.)), u.x),
    mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x),
    u.y
  );
}

// u_colorsCount is the real count; the array's tail is padding.
vec4 stopAt(int i) {
  vec4 c = u_colors[clamp(i, 0, int(u_colorsCount) - 1)];
  return vec4(c.rgb * c.a, c.a);
}

// Catmull-Rom through the stops, so no stop shows as a plateau or a kink.
vec4 rampAt(float p) {
  float x = clamp(p, 0., 1.) * (u_colorsCount - 1.);
  int i = int(floor(x));
  float f = x - float(i);
  vec4 a = stopAt(i - 1);
  vec4 b = stopAt(i);
  vec4 c = stopAt(i + 1);
  vec4 d = stopAt(i + 2);
  vec4 col = 0.5 * (
    2. * b
    + (c - a) * f
    + (2. * a - 5. * b + 4. * c - d) * f * f
    + (3. * b - a - 3. * c + d) * f * f * f
  );
  col = clamp(col, 0., 1.);
  return vec4(min(col.rgb, vec3(col.a)), col.a);
}

void main() {
  vec2 uv = 3. * v_objectUV;
  float t = u_time * DRIFT;

  vec2 bend = vec2(
    noise(uv * 0.8 + vec2(t, -0.7 * t)),
    noise(uv * 0.8 + vec2(5.2 - 0.6 * t, 1.3 + t))
  ) - 0.5;
  vec2 q = uv + u_warp * 1.2 * bend;

  // Lightest at the top left, deepening toward the bottom right.
  float ground = clamp(dot(q, normalize(vec2(1., 0.2))) * 0.4 + 0.5, 0., 1.) * u_spread;

  float layers = 0.;
  float sheen = 0.;
  float core = 0.;
  float halo = 0.;
  float across = 0.;
  float nearest = 1e6;
  float seamHalf = u_seamWidth * 0.5;

  for (int i = 0; i < MAX_FOLDS; i++) {
    float fi = float(i);
    if (fi >= u_folds) break;

    float heading = HEADING + fi * u_fan + 0.04 * sin(u_time * 0.15 + fi * 1.7);
    vec2 dir = vec2(cos(heading), sin(heading));
    vec2 p = uv - PIVOT;
    float x = dot(p, dir);
    float y = dot(p, vec2(-dir.y, dir.x));
    // The outermost fold bends by u_curve, the first runs straight.
    float k = 0.5 * (u_folds > 1.5 ? u_curve * fi / (u_folds - 1.) : u_curve);

    // Signed distance to y = k·x², negative on the side the sheet covers.
    float d = (y - k * x * x) / sqrt(1. + 4. * k * k * x * x);
    float pixel = max(fwidth(d), 1e-6);
    float soft = u_softness * 0.2 + pixel;
    float over = 1. - smoothstep(-soft, soft, d);
    layers += over;
    sheen = max(sheen, over * exp(-max(-d, 0.) / (u_sheenWidth * 0.4)));

    float px = d / pixel / max(u_pixelRatio, 1.);
    float r = px / seamHalf;
    float strength = pow(1. - u_seamFalloff, fi);
    core = max(core, strength * exp(-r * r));
    halo = max(halo, strength * exp(-r * r / 9.));
    if (abs(px) < nearest) {
      nearest = abs(px);
      across = r / 3.;
    }
  }

  float pos = ground + layers * u_lift + sheen * u_sheen * 0.15;
  vec4 col = rampAt(pos);
  vec4 bright = vec4(u_colorSeam.rgb * u_colorSeam.a, u_colorSeam.a);
  col = mix(col, bright, sheen * u_sheen * 0.3);

  // Fringes: the ramp read a little either side of the seam, opposite hues on opposite sides.
  vec4 fringe = rampAt(pos + across * u_dispersion * 0.3);
  fringe.rgb = min(fringe.rgb * 1.25, vec3(fringe.a));
  col = mix(col, fringe, halo * u_seam * 0.8);
  col = mix(col, bright, core * u_seam);

  // Fixed per device pixel, so it never crawls while the ramp drifts.
  col.rgb += (hash(gl_FragCoord.xy) - 0.5) * u_grain * 0.05 * col.a;
  fragColor = vec4(clamp(col.rgb, 0., 1.), col.a);
}
`;
