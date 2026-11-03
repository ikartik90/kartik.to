import { PALETTE } from "./ds-tokens";

// What the shaders that draw in SW Curie's colours share. A ramp's steps by name, each as OKLCH with L 0–1
// and the hue in degrees, and GLSL to turn OKLCH into sRGB, dither and curve through stops.

export const lch = (color: string) => {
  const [l, c, h] = color.match(/[\d.]+/g)!.map(Number);
  return [l / 100, c, h];
};

export const rampOf = (name: string): Record<string, string> =>
  Object.fromEntries(PALETTE.find((ramp) => ramp.name === name)!.steps);

export const OKLCH_GLSL = `
vec3 oklab(vec3 lch) {
  float h = radians(lch.z);
  return vec3(lch.x, lch.y * cos(h), lch.y * sin(h));
}

vec3 toSrgb(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  vec3 rgb = clamp(vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  ), 0.0, 1.0);
  return mix(rgb * 12.92, 1.055 * pow(rgb, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, rgb));
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 catmullRom(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
  return 0.5 * (2.0 * p1 + (p2 - p0) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t * t
    + (3.0 * (p1 - p2) + p3 - p0) * t * t * t);
}
`;
