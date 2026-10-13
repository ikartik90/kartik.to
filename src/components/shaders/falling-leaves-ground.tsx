"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { ShaderMount } from "@paper-design/shaders-react";
import {
  DitheringShapes,
  DitheringTypes,
  ShaderFitOptions,
  getShaderColorFromString,
  type DitheringShape,
  type DitheringType,
  type PaperShaderElement,
} from "@paper-design/shaders";
import { flattenColor, type Rgba } from "@/utils/flatten-color";
import {
  leafFrameUniforms,
  leafRows,
  leafSettingUniforms,
  leafTexture,
  narrowScale,
  populate,
  stepLeaves,
  wordLineRects,
  type Leaf,
  type LeafSettings,
} from "./falling-leaves";
import { fallingLeavesFragmentShader } from "./falling-leaves-shader";
import { SHADER_MAX_PIXELS, useReducedMotion } from "./use-shader-policy";

// Paper's Dithering in the site's colours, with maple leaves falling through it, fainter behind the heading and lede
// of the element it's drawn in. One rAF loop moves the leaves, keeps the pattern's time and draws, so the mount's own
// loop stays off. Under reduced motion the leaves hang where they start and the pattern holds still.

// The mount's uniform setter and visibility flag are private in its types.
type Mount = {
  getCurrentFrame(): number;
  setFrame(frame: number): void;
  setUniformValues(uniforms: Record<string, unknown>): void;
  isInViewport: boolean;
};

/** Each token as pixels, through a 1×1 canvas: the shader reads only rgb()/hex. */
function resolve(variable: string): Rgba | null {
  const probe = document.createElement("span");
  probe.style.color = `var(${variable})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return null;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

let texture: string | null = null;

const subscribeTheme = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  return () => observer.disconnect();
};
const readTheme = () => document.documentElement.dataset.theme ?? "";

export interface FallingLeavesGroundProps {
  shape: DitheringShape;
  type: DitheringType;
  /** The dither's pixel, in CSS px. */
  size: number;
  scale: number;
  speed: number;
  /** The CSS variable the pattern is drawn in, e.g. `--colors-border-divider`. */
  ink: string;
  /** The ink's share against the canvas colour, 0–1. */
  strength: number;
  leaves: LeafSettings;
  className?: string;
  style?: CSSProperties;
}

export function FallingLeavesGround({ shape, type, size, scale, speed, ink, strength, leaves, className, style }: FallingLeavesGroundProps) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "");
  const reducedMotion = useReducedMotion();
  const host = useRef<PaperShaderElement>(null);
  const [look, setLook] = useState<{ back: string; front: string; inks: [string, string]; texture: string } | null>(null);
  const live = useRef({ leaves, speed });
  useEffect(() => {
    live.current = { leaves, speed };
  });

  const [firstInk, secondInk] = leaves.inks;
  const { inkStrength } = leaves;
  useEffect(() => {
    // After the theme's styles apply, so the probe reads the new values.
    const frame = requestAnimationFrame(() => {
      const back = resolve("--colors-bg-canvas");
      const front = resolve(ink);
      const first = resolve(firstInk);
      const second = resolve(secondInk);
      texture ??= leafTexture();
      if (!back || !front || !first || !second || !texture) return;
      setLook({
        back: flattenColor(back, back, 1),
        front: flattenColor(front, back, strength),
        inks: [flattenColor(first, back, inkStrength), flattenColor(second, back, inkStrength)],
        texture,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [theme, ink, strength, firstInk, secondInk, inkStrength]);

  const uniforms = useMemo(
    () =>
      look && {
        u_colorBack: getShaderColorFromString(look.back),
        u_colorFront: getShaderColorFromString(look.front),
        u_shape: DitheringShapes[shape],
        u_type: DitheringTypes[type],
        u_pxSize: size,
        u_fit: ShaderFitOptions.cover,
        u_scale: scale,
        u_rotation: 0,
        u_offsetX: 0,
        u_offsetY: 0,
        u_originX: 0.5,
        u_originY: 0.5,
        u_worldWidth: 0,
        u_worldHeight: 0,
        ...leafSettingUniforms(leaves, look.inks, look.texture),
        ...leafFrameUniforms({ place: [], look: [] }, []),
      },
    [look, shape, type, size, scale, leaves],
  );

  const ready = !!uniforms;
  useEffect(() => {
    if (!ready) return;
    let leafList: Leaf[] = [];
    let width = 0;
    let height = 0;
    let frames = 0;
    let words: number[][] = [];
    const measure = () => {
      const rect = host.current?.getBoundingClientRect();
      width = rect?.width ?? 0;
      height = rect?.height ?? 0;
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (host.current) observer.observe(host.current);

    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      const ground = host.current;
      const mount = ground?.paperShaderMount as unknown as Mount | undefined;
      if (!ground || !mount || document.hidden || !mount.isInViewport || !width) return;
      // Held still, it only redraws now and then, for a resize or the words reflowing.
      const frame = frames++;
      if (reducedMotion && frame % 30) return;
      const { leaves, speed } = live.current;
      const scale = narrowScale(width);
      const count = Math.round(leaves.count * scale);
      if (count !== leafList.length) leafList = populate(leafList, count, width, height);
      if (!reducedMotion) stepLeaves(leafList, leaves, dt, width, height, scale);
      // The words rise in and reflow, so they're measured again every few frames.
      if (frame % 10 === 0 && ground.parentElement) words = wordLineRects(ground.parentElement, ground.getBoundingClientRect());
      mount.setUniformValues(leafFrameUniforms(leafRows(leafList, leaves, scale), words));
      mount.setFrame(mount.getCurrentFrame() + (reducedMotion ? 0 : dt * 1000 * speed));
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [ready, reducedMotion]);

  if (!uniforms) return null;
  return (
    <ShaderMount
      ref={host}
      className={className}
      style={style}
      fragmentShader={fallingLeavesFragmentShader}
      uniforms={uniforms}
      speed={0}
      // Dither cells are whole CSS px with no edges to smooth, so drawing past the screen's own density only costs.
      minPixelRatio={1}
      maxPixelCount={SHADER_MAX_PIXELS}
    />
  );
}
