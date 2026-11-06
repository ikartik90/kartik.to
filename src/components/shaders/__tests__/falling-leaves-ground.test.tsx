// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DitheringShapes, DitheringTypes, getShaderColorFromString } from "@paper-design/shaders";

const mountProps = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("@paper-design/shaders-react", () => ({
  ShaderMount: ({ ref, ...props }: { ref?: React.Ref<HTMLDivElement> } & Record<string, unknown>) => {
    mountProps.push(props);
    return <div data-shader-mount="" ref={ref} />;
  },
}));

import { FallingLeavesGround } from "../falling-leaves-ground";
import { fallingLeavesFragmentShader } from "../falling-leaves-shader";
import type { LeafSettings } from "../falling-leaves";
import { holdFirstFold } from "@/utils/first-fold";

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

describe("FallingLeavesGround's leaves", () => {
  // The browser's frames, idle time and resizes, run by hand.
  let frames: FrameRequestCallback[] = [];
  let idle: IdleRequestCallback[] = [];
  let resized: ResizeObserverCallback[] = [];
  let clock = 0;
  let realRangeRects: Range["getClientRects"];
  const setUniformValues = vi.fn();
  let currentFrame = 0;
  const mount = {
    getCurrentFrame: () => currentFrame,
    setFrame: (frame: number) => void (currentFrame = frame),
    setUniformValues,
    isInViewport: true,
  };

  const step = (ms: number, count = 1) =>
    act(() => {
      for (let i = 0; i < count; i++) {
        clock += ms;
        for (const frame of frames.splice(0)) frame(clock);
      }
    });
  const goIdle = () =>
    act(() => {
      for (const callback of idle.splice(0)) callback({ didTimeout: false, timeRemaining: () => 50 });
    });

  /** Rendered with its colours resolved and the mount's handle in place. */
  async function drawn() {
    const view = render(
      <div>
        <h1>The heading</h1>
        <FallingLeavesGround {...props} />
      </div>,
    );
    await step(16);
    const ground = view.container.querySelector("[data-shader-mount]");
    if (!ground) throw new Error("not drawn");
    Object.assign(ground, { paperShaderMount: mount });
    return view;
  }

  const leafRowsDrawn = (call = 0) => {
    const uniforms = setUniformValues.mock.calls[call][0] as { u_leafCount: number; u_leaf: number[][] };
    return uniforms.u_leaf.slice(0, uniforms.u_leafCount);
  };

  beforeEach(() => {
    frames = [];
    idle = [];
    resized = [];
    clock = 0;
    currentFrame = 0;
    setUniformValues.mockClear();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((frame) => frames.push(frame));
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => idle.push(callback));
    vi.stubGlobal("cancelIdleCallback", () => undefined);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resized.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1440, 800));
    // jsdom lays out no text.
    realRangeRects = Range.prototype.getClientRects;
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Range.prototype.getClientRects = realRangeRects;
  });

  it("holds the leaves back until the page has loaded and the browser is idle", async () => {
    const readyState = vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    await drawn();
    await goIdle();
    await step(16, 30);
    expect(setUniformValues).not.toHaveBeenCalled();

    readyState.mockReturnValue("complete");
    await act(() => void window.dispatchEvent(new Event("load")));
    await step(16, 30);
    expect(setUniformValues).not.toHaveBeenCalled();

    await goIdle();
    await step(16, 2);
    expect(setUniformValues).toHaveBeenCalled();
  });

  it("holds the leaves back while the first fold's own work is under way", async () => {
    const release = holdFirstFold(10_000);
    await drawn();
    await goIdle();
    await step(16, 30);
    expect(setUniformValues).not.toHaveBeenCalled();

    await act(release);
    await step(16, 2);
    expect(setUniformValues).toHaveBeenCalled();
  });

  it("brings the leaves in from out of sight above the ground, rather than on it", async () => {
    await drawn();
    await goIdle();
    await step(16, 2);
    const rows = leafRowsDrawn();
    expect(rows.length).toBeGreaterThan(0);
    // Each row is the leaf's centre, then its square: none of the square shows yet.
    for (const [, y, square] of rows) expect(y + 0.75 * square).toBeLessThanOrEqual(0);
  });

  it.each([60, 120])("draws 30 frames a second on a %iHz screen", async (hz) => {
    await drawn();
    await goIdle();
    await step(1000 / hz, hz);
    setUniformValues.mockClear();
    await step(1000 / hz, hz);
    expect(setUniformValues.mock.calls.length).toBeGreaterThanOrEqual(29);
    expect(setUniformValues.mock.calls.length).toBeLessThanOrEqual(31);
  });

  it("measures the words when they move or reflow, not as it draws", async () => {
    const view = await drawn();
    const walk = vi.spyOn(document, "createTreeWalker");
    await goIdle();
    await step(16, 60);
    expect(walk).toHaveBeenCalledTimes(1);

    await act(() => resized.forEach((callback) => callback([], {} as ResizeObserver)));
    await step(16, 4);
    expect(walk).toHaveBeenCalledTimes(2);

    // The opening's last line coming to rest.
    await act(() => void view.getByRole("heading").dispatchEvent(new Event("animationend", { bubbles: true })));
    await step(16, 4);
    expect(walk).toHaveBeenCalledTimes(3);
  });
});
