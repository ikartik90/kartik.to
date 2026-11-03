"use client";

import { ShaderMount } from "@paper-design/shaders-react";
import { SHADER_MAX_PIXELS } from "@/components/shaders/use-shader-policy";
import { lch, OKLCH_GLSL, rampOf } from "./oklch-glsl";

// The overlay's ground, the backlight's shader (landing/backlight.tsx) fitted to a photo of a dusk sky
// sampled on a grid across it. Its light, from Blue Ribbon 600 up to 200, rises round a point low and right of the
// middle, as its hue turns from Blue Ribbon at the top to Cinnabar at the bottom right, through lavender and pink. Half
// its chroma is Woodsmoke's, more of it kept towards Cinnabar, as the photo's colours are softer than the ramps'. The
// photo's top left is a little greener than Blue Ribbon. Covers the whole ground, in both themes. Drawn once.

const STEPS = ["600", "500", "400", "300", "200"];
const stepsOf = (name: string) => STEPS.map((step) => lch(rampOf(name)[step]));

const UNIFORMS = {
  u_blue: stepsOf("Blue Ribbon"),
  u_cinnabar: stepsOf("Cinnabar"),
  u_woodsmoke: stepsOf("Woodsmoke"),
  u_glow: [0.682, 0.74, 0.774, 1],
  u_light: [8.815, -5.265],
  u_turn: [-0.423, 0.304, 1.037],
  u_chroma: [0.504, 0.109],
};

const SKY = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
// Each ramp's steps 600 to 200 in OKLCH, the hue in degrees.
uniform vec3 u_blue[5];
uniform vec3 u_cinnabar[5];
uniform vec3 u_woodsmoke[5];
// Where the light is strongest and how far it spreads across and down, in fractions of the sky.
uniform vec4 u_glow;
// How many steps up from 600 the light lifts the sky at its strongest, and at none.
uniform vec2 u_light;
// The hue's turn from Blue Ribbon to Cinnabar: where it stands at the top left, and how fast it turns across and down.
uniform vec3 u_turn;
// How much of the ramps' chroma is kept at Blue Ribbon, and how much more by Cinnabar; the rest is Woodsmoke's.
uniform vec2 u_chroma;
out vec4 fragColor;

${OKLCH_GLSL}

// Along a curve through a ramp's steps, 0 at 600 to 4 at 200.
vec3 rampAt(vec3 stops[5], float u) {
  int i = int(min(floor(u), 3.0));
  return catmullRom(stops[max(i - 1, 0)], stops[i], stops[i + 1], stops[min(i + 2, 4)], u - float(i));
}

// Zero below none, eased in, so the light never creases where it reaches 600.
float soft(float v) {
  return log(1.0 + exp(4.0 * v)) / 4.0;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_resolution;
  vec2 off = (p - u_glow.xy) / u_glow.zw;
  float glow = exp(-0.5 * dot(off, off));
  float u = clamp(soft(u_light.x * glow + u_light.y), 0.0, 4.0);
  float t = smoothstep(0.0, 1.0, u_turn.x + dot(u_turn.yz, p));

  vec3 blue = rampAt(u_blue, u), cinnabar = rampAt(u_cinnabar, u);
  // The shorter way round.
  float turn = cinnabar.z - blue.z;
  turn -= 360.0 * floor((turn + 180.0) / 360.0);
  vec3 hue = vec3(mix(blue.xy, cinnabar.xy, t), blue.z + turn * t);
  vec3 lab = mix(oklab(rampAt(u_woodsmoke, u)), oklab(hue), u_chroma.x + u_chroma.y * t);

  // A dither against banding in the long fades.
  fragColor = vec4(toSrgb(lab) + (hash(gl_FragCoord.xy) - 0.5) / 255.0, 1.0);
}
`;

export function Sky({ className }: { className?: string }) {
  return (
    <ShaderMount
      className={className}
      fragmentShader={SKY}
      uniforms={UNIFORMS}
      speed={0}
      maxPixelCount={SHADER_MAX_PIXELS}
      data-overlay-motion="ground"
    />
  );
}
