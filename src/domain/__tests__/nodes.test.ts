import { describe, it, expect } from "vitest";
import {
  BACKGROUND_EFFECT_MAX_COLORS,
  BackgroundEffectSchema,
  CollectionItemSchema,
  DEFAULT_BACKGROUND_EFFECT,
  ImageNodeSchema,
} from "../nodes";

describe("BackgroundEffectSchema", () => {
  it("fills every parameter from the defaults, so `{}` is a valid effect", () => {
    expect(BackgroundEffectSchema.parse({})).toEqual(DEFAULT_BACKGROUND_EFFECT);
  });

  it("keeps the two brand colours as the starting gradient", () => {
    expect(DEFAULT_BACKGROUND_EFFECT.colors).toEqual(["#FFAB6FFF", "#FF4D97FF"]);
  });

  it("accepts a full parameter set unchanged", () => {
    const effect = {
      ...DEFAULT_BACKGROUND_EFFECT,
      colors: ["#000000FF", "#FFFFFF80"],
      positions: 42,
      waveX: 0.25,
      rotation: 180,
      offsetX: -0.5,
    };
    expect(BackgroundEffectSchema.parse(effect)).toEqual(effect);
  });

  it("rejects a wave outside 0-1", () => {
    expect(() => BackgroundEffectSchema.parse({ waveX: 1.5 })).toThrow();
    expect(() => BackgroundEffectSchema.parse({ waveY: -0.1 })).toThrow();
  });

  it("rejects a rotation outside 0-360", () => {
    expect(() => BackgroundEffectSchema.parse({ rotation: 400 })).toThrow();
  });

  it("rejects an offset outside -1..1", () => {
    expect(() => BackgroundEffectSchema.parse({ offsetY: 2 })).toThrow();
  });

  it("rejects a scale outside the shader's own 0.01-4", () => {
    expect(() => BackgroundEffectSchema.parse({ scale: 0 })).toThrow();
    expect(() => BackgroundEffectSchema.parse({ scale: 5 })).toThrow();
  });

  it("rejects a colour list past the shader's ten-colour ceiling", () => {
    const colors = Array.from({ length: BACKGROUND_EFFECT_MAX_COLORS + 1 }, () => "#000000FF");
    expect(() => BackgroundEffectSchema.parse({ colors })).toThrow();
  });

  it("rejects an empty colour list — a gradient needs something to blend", () => {
    expect(() => BackgroundEffectSchema.parse({ colors: [] })).toThrow();
  });

  it("rejects a colour that is not 8-digit hex", () => {
    expect(() => BackgroundEffectSchema.parse({ colors: ["red"] })).toThrow();
    expect(() => BackgroundEffectSchema.parse({ colors: ["#FFAB6F"] })).toThrow();
  });
});

describe("background effect on image nodes", () => {
  it("is optional — an image without one still parses", () => {
    expect(ImageNodeSchema.parse({ type: "image", src: "/a.png" }).backgroundEffect)
      .toBeUndefined();
  });

  it("rides along on collection items, which are image nodes minus the type", () => {
    const item = CollectionItemSchema.parse({
      src: "/a.png",
      backgroundEffect: {},
    });
    expect(item.backgroundEffect).toEqual(DEFAULT_BACKGROUND_EFFECT);
  });
});
