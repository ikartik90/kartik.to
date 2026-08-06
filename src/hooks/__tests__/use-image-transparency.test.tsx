// @vitest-environment jsdom
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useImageTransparency } from "@/hooks/use-image-transparency";

// ---------------------------------------------------------------------------
// jsdom decodes nothing and paints nothing, so both halves of the inspection
// are stood in for: an <img> whose load outcome is scripted per src (separately
// for the CORS attempt and the plain one), and a 2D context that hands back the
// pixels that src was registered with.
// ---------------------------------------------------------------------------

interface Outcome {
  /** Whether a load with `crossOrigin="anonymous"` succeeds. */
  cors?: boolean;
  /** Whether a plain load — the one the cell itself does — succeeds. */
  plain?: boolean;
  width?: number;
  height?: number;
  /** Alpha values, one per pixel; the colour bytes are filled in opaque. */
  alpha?: number[];
  /** Readback refused, as a cross-origin canvas would. */
  tainted?: boolean;
}

const registry = new Map<string, Outcome>();
const loads: { src: string; crossOrigin: string | null }[] = [];

const register = (src: string, outcome: Outcome) => {
  registry.set(src, { cors: true, plain: true, width: 8, height: 8, ...outcome });
  return src;
};

const rgba = (alpha: number[]) => {
  const pixels = new Uint8ClampedArray(alpha.length * 4).fill(255);
  alpha.forEach((value, index) => {
    pixels[index * 4 + 3] = value;
  });
  return pixels;
};

class FakeImage {
  crossOrigin: string | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  loaded = "";

  set src(value: string) {
    loads.push({ src: value, crossOrigin: this.crossOrigin });
    const outcome = registry.get(value);
    const ok = this.crossOrigin ? outcome?.cors : outcome?.plain;
    if (ok) {
      this.loaded = value;
      this.naturalWidth = outcome?.width ?? 0;
      this.naturalHeight = outcome?.height ?? 0;
    }
    queueMicrotask(() => (ok ? this.onload?.() : this.onerror?.()));
  }
}

beforeEach(() => {
  loads.length = 0;
  vi.stubGlobal("Image", FakeImage);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      let drawn: FakeImage | null = null;
      return {
        drawImage: (image: FakeImage) => {
          drawn = image;
        },
        getImageData: () => {
          const outcome = registry.get(drawn?.loaded ?? "");
          if (outcome?.tainted) throw new Error("SecurityError");
          return { data: rgba(outcome?.alpha ?? []) };
        },
      } as unknown as CanvasRenderingContext2D;
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const transparency = (srcs: string[]) =>
  renderHook(({ list }) => useImageTransparency(list), {
    initialProps: { list: srcs },
  });

/**
 * A picture that is definitely see-through, inspected alongside the one under
 * test. "It is not in the set" is true before an inspection finishes as well as
 * after, so an absence only means anything once something has landed — and the
 * store is shared, so the barrier has to be a src this test put there itself.
 */
const marker = (name: string) => register(`marker-${name}.png`, { alpha: [0] });

const settled = (
  result: { current: ReadonlySet<string> },
  name: string,
) => waitFor(() => expect(result.current.has(marker(name))).toBe(true));

describe("useImageTransparency", () => {
  it("reports a picture with a transparent pixel", async () => {
    const src = register("shot.png", { alpha: [255, 255, 0, 255] });
    const { result } = transparency([src]);
    await waitFor(() => expect(result.current.has(src)).toBe(true));
  });

  it("leaves an opaque picture out", async () => {
    const src = register("opaque.png", { alpha: [255, 255, 255, 255] });
    const { result } = transparency([src, marker("opaque")]);
    await settled(result, "opaque");
    expect(result.current.has(src)).toBe(false);
  });

  // The cheapest answer, and it keeps the common case off the network: a JPEG
  // has no alpha channel to inspect.
  it("never decodes a JPEG", async () => {
    const src = register("photo.jpg", { alpha: [0, 0, 0, 0] });
    const { result } = transparency([src, marker("jpeg")]);
    await settled(result, "jpeg");
    expect(result.current.has(src)).toBe(false);
    // The marker is a PNG, so exactly one picture was decoded — not this one.
    expect(loads.map((load) => load.src)).toEqual([marker("jpeg")]);
  });

  // A bucket that declines CORS fails the readback load outright. The picture
  // is fine — it is only unreadable — so the checkerboard is assumed rather
  // than dropped, which is safe: an opaque picture covers it.
  it("assumes transparency when the host refuses the CORS read", async () => {
    const src = register("no-cors.png", { cors: false, plain: true });
    const { result } = transparency([src]);
    await waitFor(() => expect(result.current.has(src)).toBe(true));
    expect(loads.map((load) => load.crossOrigin)).toEqual([
      "anonymous",
      null,
    ]);
  });

  it("assumes transparency when the canvas refuses the readback", async () => {
    const src = register("tainted.png", { tainted: true });
    const { result } = transparency([src]);
    await waitFor(() => expect(result.current.has(src)).toBe(true));
  });

  // Neither load works, so the src is broken rather than unreadable — nothing
  // to stand a ground behind.
  it("leaves a picture that cannot be loaded at all out", async () => {
    const src = register("missing.png", { cors: false, plain: false });
    const { result } = transparency([src, marker("missing")]);
    await settled(result, "missing");
    expect(result.current.has(src)).toBe(false);
    // Both attempts were made — the CORS read and the plain one that tells a
    // refused read from a broken src.
    expect(loads.filter((load) => load.src === src)).toHaveLength(2);
  });

  // An SVG with no intrinsic size decodes to 0×0 and cannot be sampled.
  it("assumes transparency for a picture with no intrinsic size", async () => {
    const src = register("icon.svg", { width: 0, height: 0 });
    const { result } = transparency([src]);
    await waitFor(() => expect(result.current.has(src)).toBe(true));
  });

  it("inspects each src once, however many times it is asked about", async () => {
    const src = register("cached.png", { alpha: [0] });
    const first = transparency([src]);
    await waitFor(() => expect(first.result.current.has(src)).toBe(true));
    cleanup();

    // Synchronously on the FIRST render of the second mount — a picture whose
    // answer is already known must not flash over a bare cell while it is
    // re-derived.
    const { result } = transparency([src]);
    expect(result.current.has(src)).toBe(true);
    expect(loads).toHaveLength(1);
  });

  it("picks up a src added to the list", async () => {
    const first = register("one.png", { alpha: [0] });
    const second = register("two.png", { alpha: [0] });
    const { result, rerender } = transparency([first]);
    await waitFor(() => expect(result.current.has(first)).toBe(true));

    rerender({ list: [first, second] });
    await waitFor(() => expect(result.current.has(second)).toBe(true));
    expect(result.current.has(first)).toBe(true);
  });

  it("survives a grid that unmounts mid-inspection", async () => {
    const src = register("abandoned.png", { alpha: [0] });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = transparency([src]);
    unmount();
    await waitFor(() => expect(loads).toHaveLength(1));
    expect(errors).not.toHaveBeenCalled();

    // And the work it started is not wasted: the answer landed in the shared
    // store, so the next grid to show that picture has it on its first render.
    const { result } = transparency([src]);
    await waitFor(() => expect(result.current.has(src)).toBe(true));
    expect(loads).toHaveLength(1);
  });
});
