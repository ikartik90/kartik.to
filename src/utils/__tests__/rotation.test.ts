import { describe, expect, it } from "vitest";
import {
  ROTATION_MAX,
  ROTATION_MIN,
  ROTATION_STEP,
  wrapRotation,
} from "../rotation";

describe("the rotation range", () => {
  it("is signed about a zero in the middle", () => {
    expect(ROTATION_MIN).toBe(-180);
    expect(ROTATION_MAX).toBe(180);
    expect((ROTATION_MIN + ROTATION_MAX) / 2).toBe(0);
  });

  it("puts zero and the quarter turns on the step grid", () => {
    for (const stop of [0, 15, -15, 45, -45, 90, -90, 180, -180]) {
      expect((stop - ROTATION_MIN) % ROTATION_STEP).toBe(0);
    }
  });
});

describe("wrapRotation", () => {
  it("leaves a value already in range exactly as it is", () => {
    for (const value of [-180, -90, 0, 0.5, 90, 180]) {
      expect(wrapRotation(value)).toBe(value);
    }
  });

  it("brings the old range's far half across as the same angle", () => {
    expect(wrapRotation(270)).toBe(-90);
    expect(wrapRotation(360)).toBe(0);
    expect(wrapRotation(181)).toBe(-179);
    expect(wrapRotation(200)).toBe(-160);
  });

  it("wraps a value from any number of turns away", () => {
    expect(wrapRotation(400)).toBe(40);
    expect(wrapRotation(-400)).toBe(-40);
    expect(wrapRotation(720)).toBe(0);
  });

  it("does not send 180 to the other end of the track", () => {
    expect(wrapRotation(180)).toBe(180);
  });

  it("hands back anything that is not a finite number", () => {
    expect(wrapRotation(Number.NaN)).toBeNaN();
    expect(wrapRotation(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });
});
