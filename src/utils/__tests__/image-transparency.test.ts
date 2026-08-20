import { describe, expect, it } from "vitest";
import {
  ALPHA_OPAQUE_THRESHOLD,
  formatCanCarryAlpha,
  hasTransparentPixels,
  sampleSize,
} from "@/utils/image-transparency";

/** An RGBA buffer of `count` pixels, every one of them fully opaque. */
const opaque = (count: number) =>
  new Uint8ClampedArray(count * 4).fill(255);

describe("formatCanCarryAlpha", () => {
  it("rules out JPEG, whatever the spelling or case", () => {
    expect(formatCanCarryAlpha("photo.jpg")).toBe(false);
    expect(formatCanCarryAlpha("photo.jpeg")).toBe(false);
    expect(formatCanCarryAlpha("PHOTO.JPG")).toBe(false);
    expect(formatCanCarryAlpha("photo.jfif")).toBe(false);
  });

  // This used to rule an mp4 out, and that was picture-vs-clip being decided
  // from a filename on a render path — the one thing the `kind` field exists to
  // stop. It could not even do the job: a clip under a bare R2 key carries no
  // extension, so the case it was there for was the case it missed.
  //
  // A clip is now excluded by its node's own `kind` before this is ever
  // reached, so an mp4 here is simply a format nobody asks about, and it must
  // answer like any other unrecognised one. Pinned so that the video knowledge
  // cannot creep back in: if it does, this goes red rather than quietly
  // reinstating the guess.
  it("has no opinion about a clip — that is not this question", () => {
    expect(formatCanCarryAlpha("demo.mp4")).toBe(true);
    expect(
      formatCanCarryAlpha("https://cdn.example.com/media/uuid-demo.MP4?v=2"),
    ).toBe(true);
  });

  it("allows the formats that carry an alpha channel", () => {
    for (const src of ["a.png", "a.webp", "a.gif", "a.svg", "a.avif"]) {
      expect(formatCanCarryAlpha(src)).toBe(true);
    }
  });

  it("reads the extension off a CDN url, past its query and hash", () => {
    expect(
      formatCanCarryAlpha("https://cdn.example.com/media/uuid-shot.png?v=2"),
    ).toBe(true);
    expect(
      formatCanCarryAlpha("https://cdn.example.com/media/uuid-shot.jpg?v=2"),
    ).toBe(false);
    expect(formatCanCarryAlpha("https://cdn.example.com/a.jpeg#frag")).toBe(
      false,
    );
  });

  it("is not fooled by a dot in a directory above an extensionless key", () => {
    expect(formatCanCarryAlpha("https://cdn.example.com/v1.2/shot")).toBe(true);
  });

  // Unknown means "might be" — the checkerboard is painted BEHIND the picture,
  // so guessing it can be transparent costs nothing when it turns out not to be
  // (the image covers it), whereas guessing the other way loses the feature.
  it("assumes alpha is possible when the format is unknown", () => {
    expect(formatCanCarryAlpha("https://cdn.example.com/media/uuid-shot")).toBe(
      true,
    );
    expect(formatCanCarryAlpha("data:image/png;base64,AAAA")).toBe(true);
  });
});

describe("sampleSize", () => {
  it("fits the long edge to the cap, keeping the aspect ratio", () => {
    expect(sampleSize(1000, 500, 256)).toEqual({ width: 256, height: 128 });
    expect(sampleSize(500, 1000, 256)).toEqual({ width: 128, height: 256 });
  });

  it("never upscales a picture smaller than the cap", () => {
    expect(sampleSize(100, 50, 256)).toEqual({ width: 100, height: 50 });
  });

  it("keeps a sliver at least one pixel tall", () => {
    expect(sampleSize(10000, 1, 256)).toEqual({ width: 256, height: 1 });
  });
});

describe("hasTransparentPixels", () => {
  it("is false for a fully opaque buffer", () => {
    expect(hasTransparentPixels(opaque(64))).toBe(false);
  });

  it("is false for an empty buffer", () => {
    expect(hasTransparentPixels(new Uint8ClampedArray(0))).toBe(false);
  });

  it("finds a single transparent pixel anywhere in the buffer", () => {
    const pixels = opaque(64);
    pixels[4 * 37 + 3] = 0;
    expect(hasTransparentPixels(pixels)).toBe(true);
  });

  // Downscaling into the sample canvas AVERAGES alpha, so a sparse transparent
  // region arrives as a near-opaque value rather than a zero. The threshold is
  // what keeps those legible; an exactly-opaque picture stays at 255.
  it("counts a near-opaque pixel below the threshold", () => {
    const pixels = opaque(4);
    pixels[3] = ALPHA_OPAQUE_THRESHOLD - 1;
    expect(hasTransparentPixels(pixels)).toBe(true);
  });

  it("leaves a pixel at the threshold alone", () => {
    const pixels = opaque(4);
    pixels[3] = ALPHA_OPAQUE_THRESHOLD;
    expect(hasTransparentPixels(pixels)).toBe(false);
  });

  it("reads the ALPHA byte, not the colour ones", () => {
    const pixels = opaque(4);
    pixels[0] = 0;
    pixels[1] = 0;
    pixels[2] = 0;
    expect(hasTransparentPixels(pixels)).toBe(false);
  });
});
