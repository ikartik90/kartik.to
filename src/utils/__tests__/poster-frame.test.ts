import { describe, expect, it } from "vitest";
import {
  POSTER_SAMPLE_COUNT,
  frameEnergy,
  frameChange,
  pickPosterFrame,
  posterSampleTimes,
  type FrameSample,
} from "../poster-frame";

/** A frame of one flat colour — the blank a clip opens and closes on. */
function flat(
  time: number,
  [r, g, b]: [number, number, number] = [0, 0, 0],
  size = 4,
): FrameSample {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    pixels.set([r, g, b, 255], i * 4);
  }
  return { time, pixels };
}

/** A frame split down the middle — the simplest frame with something in it. */
function halved(time: number, size = 4): FrameSample {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = x < size / 2 ? 0 : 255;
      pixels.set([value, value, value, 255], (y * size + x) * 4);
    }
  }
  return { time, pixels };
}

/** A frame of noise — busy, and deliberately not still. */
function speckled(time: number, seed: number, size = 4): FrameSample {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const value = ((i * 97 + seed * 53) % 256) as number;
    pixels.set([value, value, value, 255], i * 4);
  }
  return { time, pixels };
}

describe("posterSampleTimes", () => {
  it("skips the clip's own head and tail", () => {
    const times = posterSampleTimes(10);
    expect(times).toHaveLength(POSTER_SAMPLE_COUNT);
    expect(times[0]).toBeGreaterThan(0);
    expect(times[times.length - 1]).toBeLessThan(10);
  });

  it("walks forward in time", () => {
    const times = posterSampleTimes(30);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  it("has one sample to offer for a clip too short to walk", () => {
    expect(posterSampleTimes(0).length).toBeGreaterThan(0);
    expect(posterSampleTimes(Number.NaN).every(Number.isFinite)).toBe(true);
  });
});

describe("frameEnergy", () => {
  it("is nothing at all for a frame of one flat colour", () => {
    expect(frameEnergy(flat(0).pixels)).toBe(0);
    expect(frameEnergy(flat(0, [255, 255, 255]).pixels)).toBe(0);
  });

  it("rises as a frame gets more in it", () => {
    expect(frameEnergy(halved(0).pixels)).toBeGreaterThan(0);
    expect(frameEnergy(speckled(0, 1).pixels)).toBeGreaterThan(0);
  });

  it("reads a dark frame and its inverse the same", () => {
    // Energy is DEVIATION, not brightness: a white-on-black screen and a
    // black-on-white one hold the same amount of picture.
    const light = frameEnergy(halved(0).pixels);
    const inverted = halved(0);
    for (let i = 0; i < inverted.pixels.length; i += 4) {
      inverted.pixels[i] = 255 - inverted.pixels[i];
      inverted.pixels[i + 1] = 255 - inverted.pixels[i + 1];
      inverted.pixels[i + 2] = 255 - inverted.pixels[i + 2];
    }
    expect(frameEnergy(inverted.pixels)).toBeCloseTo(light, 5);
  });
});

describe("frameChange", () => {
  it("is nothing between a frame and itself", () => {
    expect(frameChange(halved(0).pixels, halved(1).pixels)).toBe(0);
  });

  it("is total between black and white", () => {
    expect(
      frameChange(flat(0).pixels, flat(1, [255, 255, 255]).pixels),
    ).toBeCloseTo(1, 5);
  });
});

describe("pickPosterFrame", () => {
  it("passes over the blank a clip opens and closes on", () => {
    const index = pickPosterFrame([
      flat(0.5),
      halved(1.5),
      halved(2.5),
      flat(3.5),
    ]);
    expect([1, 2]).toContain(index);
  });

  it("prefers a settled frame to one mid-transition", () => {
    // Two candidates with content: one held across its neighbours, one that is
    // a different picture from every frame around it.
    const held = halved(2);
    const index = pickPosterFrame([
      speckled(0.5, 1),
      speckled(1, 2),
      { ...held, time: 1.5 },
      halved(2),
      halved(2.5),
    ]);
    expect(index).toBeGreaterThanOrEqual(2);
  });

  it("still answers when every frame is blank", () => {
    const index = pickPosterFrame([flat(0.5), flat(1.5), flat(2.5)]);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(3);
  });

  it("has nothing to pick from an empty clip", () => {
    expect(pickPosterFrame([])).toBe(-1);
  });
});
