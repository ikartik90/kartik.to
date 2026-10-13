import { ditheringFragmentShader } from "@paper-design/shaders";
import { MAX_LEAVES, MAX_WORD_LINES } from "./falling-leaves";

// Paper's Dithering with maple leaves spliced in, so with none it draws exactly Paper's pattern. A leaf is read at
// each dither cell as the pattern is and goes through the same dither, in its own tone and ink; a cell it leaves
// empty shows the pattern there. Behind the words it thins and pales. Each splice throws if Paper's source changes.

const field = `
precision highp float;

uniform sampler2D u_leafShape;
uniform float u_leafVeins;
uniform vec4 u_leafInk0;
uniform vec4 u_leafInk1;
uniform float u_leafCount;
// Centre in CSS px from the ground's top left; the square's side in CSS px; rotation in rad.
uniform vec4 u_leaf[${MAX_LEAVES}];
// The turn about its long axis (signed cosine) and across it; tone 0–1; ink 0 or 1.
uniform vec4 u_leafLook[${MAX_LEAVES}];
uniform float u_wordCount;
// Each line of the heading and lede: x, y, width, height in CSS px from the ground's top left.
uniform vec4 u_words[${MAX_WORD_LINES}];
uniform float u_wordMargin;
uniform float u_wordDensity;
uniform float u_wordInk;

float g_leafHit;
float g_leafTone;
vec4 g_leafInk;

void leafField(vec2 c) {
  g_leafHit = 0.;
  g_leafTone = 0.;
  g_leafInk = vec4(0.);
  int count = int(u_leafCount);
  // Nearest last, so it wins.
  for (int i = 0; i < ${MAX_LEAVES}; i++) {
    if (i >= count) break;
    vec4 l = u_leaf[i];
    vec2 p = c - l.xy;
    if (dot(p, p) > .5 * l.z * l.z) continue;
    vec4 look = u_leafLook[i];
    float s = sin(l.w);
    float k = cos(l.w);
    vec2 q = mat2(k, -s, s, k) * p;
    q.x /= (look.x < 0. ? -1. : 1.) * max(abs(look.x), .06);
    q.y /= max(look.y, .06);
    vec2 uv = q / l.z + .5;
    if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) continue;
    vec4 tex = textureLod(u_leafShape, uv, 0.);
    if (tex.r < .5) continue;
    g_leafHit = 1.;
    g_leafTone = look.z * (1. - .6 * u_leafVeins * tex.g);
    g_leafInk = look.w < .5 ? u_leafInk0 : u_leafInk1;
  }

  if (g_leafHit < .5 || u_wordCount < .5) return;
  float d = 1e5;
  int words = int(u_wordCount);
  for (int i = 0; i < ${MAX_WORD_LINES}; i++) {
    if (i >= words) break;
    vec4 r = u_words[i];
    vec2 outside = abs(c - r.xy - .5 * r.zw) - .5 * r.zw;
    d = min(d, length(max(outside, 0.)));
  }
  float near = 1. - smoothstep(0., max(u_wordMargin, 1.), d);
  g_leafTone *= mix(1., u_wordDensity, near);
  g_leafInk = mix(g_leafInk, u_colorBack, (1. - u_wordInk) * near);
}
`;

function splice(source: string, find: string, replace: string) {
  if (!source.includes(find)) throw new Error(`Paper's dithering shader changed: "${find}" is gone`);
  return source.replace(find, replace);
}

export const fallingLeavesFragmentShader = [
  ["out vec4 fragColor;", `${field}\nout vec4 fragColor;`],
  [
    "int type = int(floor(u_type));",
    `vec2 leafAt = (canvasPixelizedUV + .5 * u_resolution) / u_pixelRatio;
  leafAt.y = u_resolution.y / u_pixelRatio - leafAt.y;
  leafField(leafAt);
  float patternShape = shape;
  if (g_leafHit > .5) shape = g_leafTone;
  int type = int(floor(u_type));`,
  ],
  [
    "vec3 fgColor = u_colorFront.rgb * u_colorFront.a;",
    `vec4 front = u_colorFront;
  if (g_leafHit > .5) {
    if (res > .5) {
      front = g_leafInk;
    } else {
      float patternDither = type == 1 ? step(hash21(ditheringNoiseUV), patternShape) - .5 : dithering;
      res = step(.5, patternShape + patternDither);
    }
  }
  vec3 fgColor = front.rgb * front.a;`,
  ],
  ["float fgOpacity = u_colorFront.a;", "float fgOpacity = front.a;"],
].reduce((source, [find, replace]) => splice(source, find, replace), ditheringFragmentShader);
