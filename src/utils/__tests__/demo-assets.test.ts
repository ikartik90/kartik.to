// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  COMMON_DEMO_ASSETS,
  LOGGER_DEMO_ASSETS,
  loadDemoAsset,
  resolveDemoAssets,
  __resetDemoAssetCache,
  type DemoAsset,
} from "../demo-assets";

beforeEach(() => {
  __resetDemoAssetCache();
});

describe("resolveDemoAssets", () => {
  it("always includes the common (shared) fonts", () => {
    const { fonts, images } = resolveDemoAssets({});
    expect(fonts.map((a) => a.id)).toEqual(
      COMMON_DEMO_ASSETS.map((a) => a.id),
    );
    expect(images).toEqual([]);
  });

  it("adds logger assets when a logger is configured", () => {
    const { fonts, images } = resolveDemoAssets({ logger: true });
    const loggerFonts = LOGGER_DEMO_ASSETS.filter((a) => a.kind === "font");
    const loggerImages = LOGGER_DEMO_ASSETS.filter((a) => a.kind === "image");

    for (const font of loggerFonts) {
      expect(fonts.map((a) => a.id)).toContain(font.id);
    }
    expect(images.map((a) => a.id)).toEqual(loggerImages.map((a) => a.id));
  });

  it("splits fonts (gating) from images (background)", () => {
    const { fonts, images } = resolveDemoAssets({ logger: {} });
    expect(fonts.every((a) => a.kind === "font")).toBe(true);
    expect(images.every((a) => a.kind === "image")).toBe(true);
  });

  it("appends demo-specific extras and de-duplicates by id", () => {
    const extras: DemoAsset[] = [
      { id: "font-switzer", kind: "font", cssVar: "--font-switzer" }, // dup
      { id: "font-custom", kind: "font", family: "Custom" },
    ];
    const { fonts } = resolveDemoAssets({ assets: extras });
    const switzerCount = fonts.filter((a) => a.id === "font-switzer").length;
    expect(switzerCount).toBe(1);
    expect(fonts.map((a) => a.id)).toContain("font-custom");
  });
});

describe("loadDemoAsset", () => {
  it("returns the same promise for a repeated id (shared across frames)", () => {
    const asset: DemoAsset = { id: "img-shared", kind: "image", src: "/x.png" };
    const first = loadDemoAsset(asset);
    const second = loadDemoAsset({ ...asset });
    expect(first).toBe(second);
  });

  it("resolves fonts even without a FontFaceSet (jsdom)", async () => {
    // jsdom has no document.fonts — the loader must still resolve, not hang.
    await expect(
      loadDemoAsset({ id: "font-x", kind: "font", family: "X" }),
    ).resolves.toBeUndefined();
  });

  it("never hangs on an image that never loads (timeout fallback)", async () => {
    // jsdom does not fetch images, so onload/onerror never fire — the internal
    // timeout must still settle the promise so the preloader can't wedge.
    vi.useFakeTimers();
    try {
      const promise = loadDemoAsset({
        id: "img-y",
        kind: "image",
        src: "/missing.png",
      });
      await vi.advanceTimersByTimeAsync(6000);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
