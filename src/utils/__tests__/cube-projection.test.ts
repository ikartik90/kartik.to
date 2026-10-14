import { describe, expect, it } from "vitest";
import { cubeTurn, flatMatrix, onScreen } from "@/utils/cube-projection";

const HALF = 50;
const at = (n: readonly number[]) => n.map((v) => Math.round(v * 1000) / 1000);

describe("onScreen", () => {
  it("puts the middle of an unturned cube's front at the middle of its cell", () => {
    expect(at(onScreen("F", 0, 0, HALF, cubeTurn(0, 0)))).toEqual([50, 50]);
  });

  it("draws the front at its own size, its nearest plane being the one the perspective is set at", () => {
    expect(at(onScreen("F", 10, -20, HALF, cubeTurn(0, 0)))).toEqual([60, 30]);
  });

  it("brings the right face round to the front with a quarter turn to the left", () => {
    const turned = cubeTurn(0, -Math.PI / 2);
    expect(at(onScreen("R", 0, 0, HALF, turned))).toEqual([50, 50]);
    expect(at(onScreen("R", 10, 0, HALF, turned))).toEqual([60, 50]);
  });

  it("brings the bottom face round to the front with a quarter turn up", () => {
    const turned = cubeTurn(Math.PI / 2, 0);
    expect(at(onScreen("B", 0, 0, HALF, turned))).toEqual([50, 50]);
    expect(at(onScreen("B", 0, 10, HALF, turned))).toEqual([50, 60]);
  });

  it("draws what's nearer the viewer further from the face's middle", () => {
    const turned = cubeTurn(0, Math.PI / 6);
    const [middle] = onScreen("F", 0, 0, HALF, turned);
    const [right] = onScreen("F", 40, 0, HALF, turned);
    const [left] = onScreen("F", -40, 0, HALF, turned);
    // Turned right, the front's right edge goes back and its left edge comes forward.
    expect(middle - left).toBeGreaterThan(right - middle);
  });
});

describe("flatMatrix", () => {
  it("is the identity at the middle of an unturned cube's front", () => {
    expect(at(flatMatrix("F", 20, HALF, cubeTurn(0, 0)))).toEqual([1, 0, 0, 1, 40, 40]);
  });

  it("squashes a face along the way it turns, and not across", () => {
    const [a, b, c, d] = flatMatrix("F", 20, HALF, cubeTurn(0, Math.PI / 3));
    expect(Math.abs(a)).toBeLessThan(0.6);
    expect(Math.abs(b)).toBeLessThan(0.01);
    expect(Math.abs(c)).toBeLessThan(0.01);
    expect(d).toBeGreaterThan(0.9);
  });

  it("fits a side face's icon to that face, centred on it", () => {
    const turned = cubeTurn(0, -Math.PI / 4);
    const [a, b, c, d, e, f] = flatMatrix("R", 20, HALF, turned);
    const [x, y] = onScreen("R", 0, 0, HALF, turned);
    expect(at([e + (a + c) * 10, f + (b + d) * 10])).toEqual(at([x, y]));
  });

  it("mirrors a face still turned away from the viewer, as the browser would leave it unseen", () => {
    const [a, b, c, d] = flatMatrix("R", 20, HALF, cubeTurn(0, -0.05));
    expect(a * d - b * c).toBeLessThan(0);
  });

  it("is close to flat at a face just come round to the viewer", () => {
    const [a, b, c, d] = flatMatrix("R", 20, HALF, cubeTurn(0, -0.2));
    expect(a * d - b * c).toBeGreaterThan(0);
    expect(a * d - b * c).toBeLessThan(0.15);
  });
});
