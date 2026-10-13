// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DitheringShapes, DitheringTypes, getShaderColorFromString } from "@paper-design/shaders";

const mountProps = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("@paper-design/shaders-react", () => ({
  ShaderMount: (props: Record<string, unknown>) => {
    mountProps.push(props);
    return <div data-shader-mount="" />;
  },
}));

import { FallingLeavesGround } from "../falling-leaves-ground";
import { fallingLeavesFragmentShader } from "../falling-leaves-shader";
import type { LeafSettings } from "../falling-leaves";

// jsdom has no canvas: each token reads back as the pixel queued here, in the order they're resolved.
let pixels: number[][] = [];
const realGetContext = HTMLCanvasElement.prototype.getContext;
const realToDataURL = HTMLCanvasElement.prototype.toDataURL;

beforeEach(() => {
  mountProps.length = 0;
  pixels = [
    [255, 255, 255, 255], // the canvas
    [0, 0, 0, 255], // the pattern's ink
    [255, 171, 111, 255], // the first leaf ink
    [255, 77, 151, 255], // the second
  ];
  const noop = () => undefined;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    globalCompositeOperation: "source-over",
    fillRect: noop,
    translate: noop,
    scale: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    getImageData: () => ({ data: pixels.shift() ?? [0, 0, 0, 0] }),
  })) as unknown as HTMLCanvasElement["getContext"];
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,leaf";
});

afterEach(() => {
  cleanup();
  HTMLCanvasElement.prototype.getContext = realGetContext;
  HTMLCanvasElement.prototype.toDataURL = realToDataURL;
  vi.restoreAllMocks();
});

const leaves: LeafSettings = {
  count: 14,
  size: 100,
  depth: 0.5,
  fall: 56,
  sway: 36,
  tumble: 1,
  tumblePace: 0.56,
  wind: 100,
  density: 0.8,
  veins: 0.45,
  inks: ["--colors-brand-orange", "--colors-brand-pink"],
  inkStrength: 1,
  behindWords: { density: 0.32, ink: 0.6, margin: 40 },
};

const props = {
  shape: "warp",
  type: "4x4",
  size: 2,
  scale: 1.5,
  speed: 0.25,
  ink: "--colors-border-divider",
  strength: 0.5,
  leaves,
} as const;

const lastUniforms = () => mountProps[mountProps.length - 1].uniforms as Record<string, unknown>;

describe("FallingLeavesGround", () => {
  it("draws nothing until it knows the colours", () => {
    const { container } = render(<FallingLeavesGround {...props} />);
    expect(container.querySelector("[data-shader-mount]")).toBeNull();
  });

  it("draws the pattern on the canvas colour, in its ink at its strength against it", async () => {
    render(<FallingLeavesGround {...props} />);
    await waitFor(() => expect(mountProps.length).toBeGreaterThan(0));
    expect(lastUniforms().u_colorBack).toEqual(getShaderColorFromString("rgb(255, 255, 255)"));
    expect(lastUniforms().u_colorFront).toEqual(getShaderColorFromString("rgb(128, 128, 128)"));
  });

  it("inks the leaves in their two inks, at their strength", async () => {
    render(<FallingLeavesGround {...props} />);
    await waitFor(() => expect(mountProps.length).toBeGreaterThan(0));
    expect(lastUniforms().u_leafInk0).toEqual(getShaderColorFromString("rgb(255, 171, 111)"));
    expect(lastUniforms().u_leafInk1).toEqual(getShaderColorFromString("rgb(255, 77, 151)"));
  });

  it("passes its pattern through, filling the ground", async () => {
    render(<FallingLeavesGround {...props} />);
    await waitFor(() => expect(mountProps.length).toBeGreaterThan(0));
    expect(lastUniforms()).toMatchObject({
      u_shape: DitheringShapes.warp,
      u_type: DitheringTypes["4x4"],
      u_pxSize: 2,
      u_scale: 1.5,
    });
  });

  it("draws with the leaves' program, its own loop keeping time instead of the mount's", async () => {
    render(<FallingLeavesGround {...props} />);
    await waitFor(() => expect(mountProps.length).toBeGreaterThan(0));
    expect(mountProps[mountProps.length - 1].fragmentShader).toBe(fallingLeavesFragmentShader);
    expect(mountProps[mountProps.length - 1].speed).toBe(0);
  });

  it("draws at the screen's own density, not past it", async () => {
    render(<FallingLeavesGround {...props} />);
    await waitFor(() => expect(mountProps.length).toBeGreaterThan(0));
    expect(mountProps[mountProps.length - 1].minPixelRatio).toBe(1);
  });
});
