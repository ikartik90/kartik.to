"use client";

import { ShaderMount } from "@paper-design/shaders-react";
import { SHADER_MAX_PIXELS } from "@/components/shaders/use-shader-policy";
import { lch, OKLCH_GLSL, rampOf } from "../oklch-glsl";

// The backlight behind the landing card's monitor, in the monitor's 1536×1099 frame (monitor.tsx), fitted to
// the lightness of the wall in a photo of a monitor lit from below, sampled across it: light rising from under the frame
// onto the card, whose own colour shows through where the light fades. It's Blue Ribbon 600 as it fades in, then 500,
// 300 and 200 as it brightens towards the bottom. It fades in lower than the photo's, so the card keeps its colour at
// the top. Drawn once.

const BLUE = rampOf("Blue Ribbon");
const UNIFORMS = {
  u_stops: ["600", "500", "300", "200"].map((step) => lch(BLUE[step])),
  u_lamp: [3.25, 900, 1500],
  u_fade: [1, 2.6],
};

const BACKLIGHT = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
// Four Blue Ribbon steps in OKLCH, the hue in degrees.
uniform vec3 u_stops[4];
// The light's strength at the frame's bottom centre (0 none to 4 at the last stop), how far it rises and how wide it
// spreads, in frame pixels.
uniform vec3 u_lamp;
// How much light the card starts to take it at, and how much covers the card.
uniform vec2 u_fade;
out vec4 fragColor;

const vec2 FRAME = vec2(1536.0, 1099.0);

${OKLCH_GLSL}

// Along a curve through the stops, 0 at the first to 3 at the last.
vec3 stopsAt(float u) {
  vec3 s0 = oklab(u_stops[0]), s1 = oklab(u_stops[1]), s2 = oklab(u_stops[2]), s3 = oklab(u_stops[3]);
  if (u < 1.0) return catmullRom(s0, s0, s1, s2, u);
  if (u < 2.0) return catmullRom(s0, s1, s2, s3, u - 1.0);
  return catmullRom(s1, s2, s3, s3, u - 2.0);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_resolution * FRAME;
  float across = (p.x - FRAME.x * 0.5) * (p.x - FRAME.x * 0.5);
  float lamp = u_lamp.x * exp((p.y - FRAME.y) / u_lamp.y) * exp(-across / (2.0 * u_lamp.z * u_lamp.z));

  // Every step eased, as a crease where the light turns from covering the card to brightening reads as a stripe.
  float light = lamp < 3.0 ? lamp : 4.0 - exp(3.0 - lamp);
  vec3 lab = stopsAt(min(log(1.0 + exp(3.0 * (light - 1.0))) / 3.0, 3.0));
  // A dither against banding in the long fade. Premultiplied, as the canvas composites it.
  float dither = (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  float alpha = clamp(smoothstep(u_fade.x, u_fade.y, light) + dither, 0.0, 1.0);
  fragColor = vec4((toSrgb(lab) + dither) * alpha, alpha);
}
`;

export function Backlight({ className }: { className?: string }) {
  return (
    <ShaderMount
      className={className}
      fragmentShader={BACKLIGHT}
      uniforms={UNIFORMS}
      speed={0}
      maxPixelCount={SHADER_MAX_PIXELS}
    />
  );
}
