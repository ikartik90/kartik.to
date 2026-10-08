// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shaderProps = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("@paper-design/shaders-react", () => ({
  Dithering: (props: Record<string, unknown>) => {
    shaderProps.push(props);
    return <div data-dithering="" />;
  },
}));

import { DitherGround } from "../dither-ground";

// jsdom has no canvas: each token reads back as the pixel queued here, in the order they're resolved.
let pixels: number[][] = [];
const realGetContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  shaderProps.length = 0;
  pixels = [
    [255, 255, 255, 255], // the canvas
    [0, 0, 0, 255], // the ink
  ];
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    fillStyle: "",
    fillRect: () => undefined,
    getImageData: () => ({ data: pixels.shift() ?? [0, 0, 0, 0] }),
  })) as unknown as HTMLCanvasElement["getContext"];
});

afterEach(() => {
  cleanup();
  HTMLCanvasElement.prototype.getContext = realGetContext;
  vi.restoreAllMocks();
});

const props = {
  shape: "warp",
  type: "4x4",
  size: 2,
  scale: 1.5,
  speed: 0.25,
  ink: "--colors-border-divider",
  strength: 0.5,
} as const;

describe("DitherGround", () => {
  it("draws on the canvas colour, in the ink at its strength against it", async () => {
    render(<DitherGround {...props} />);
    await waitFor(() => expect(shaderProps.length).toBeGreaterThan(0));
    const last = shaderProps[shaderProps.length - 1];
    expect(last.colorBack).toBe("rgb(255, 255, 255)");
    expect(last.colorFront).toBe("rgb(128, 128, 128)");
  });

  it("passes its pattern through", async () => {
    render(<DitherGround {...props} />);
    await waitFor(() => expect(shaderProps.length).toBeGreaterThan(0));
    expect(shaderProps[shaderProps.length - 1]).toMatchObject({
      shape: "warp",
      type: "4x4",
      size: 2,
      scale: 1.5,
      speed: 0.25,
      fit: "cover",
    });
  });

  it("holds still under reduced motion", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as MediaQueryList);
    render(<DitherGround {...props} />);
    await waitFor(() => expect(shaderProps.length).toBeGreaterThan(0));
    expect(shaderProps[shaderProps.length - 1].speed).toBe(0);
  });

  it("draws nothing until it knows the colours", () => {
    const { container } = render(<DitherGround {...props} />);
    expect(container.querySelector("[data-dithering]")).toBeNull();
  });
});
