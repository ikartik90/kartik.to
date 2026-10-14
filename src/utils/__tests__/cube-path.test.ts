import { describe, expect, it } from "vitest";
import { CubePath, flipChance, type CubeFlip } from "@/utils/cube-path";

// A 5 × 5 grid; cells count from its middle cube, so row 2 runs along y = 0.
const make = (random = () => 0.5) => new CubePath({ columns: 5, rows: 5, random });
const sweep = (path: CubePath, points: [number, number][], clock = 0) =>
  points.flatMap(([x, y], i) => path.move({ x, y }, clock + i * 0.016));
const line = (from: [number, number], to: [number, number], steps = 24): [number, number][] =>
  Array.from({ length: steps + 1 }, (_, i) => [
    from[0] + ((to[0] - from[0]) * i) / steps,
    from[1] + ((to[1] - from[1]) * i) / steps,
  ]);
const cubes = (flips: CubeFlip[]) => flips.map((flip) => flip.cube).sort((a, b) => a - b);

describe("CubePath", () => {
  it("flips every cube the cursor passes over, once, the way it goes", () => {
    const path = make();
    const flips = sweep(path, line([-3, 0], [3, 0]));
    expect(cubes(flips)).toEqual([10, 11, 12, 13, 14]);
    expect(new Set(flips.map((flip) => flip.dir))).toEqual(new Set(["right"]));
  });

  it("flips them on its way down a column too, and only once while the cursor rests", () => {
    const path = make();
    const flips = sweep(path, [...line([0, -3], [0, 0.1]), [0, 0.1], [0, 0.1]]);
    expect(cubes(flips)).toEqual([2, 7, 12]);
    expect(new Set(flips.map((flip) => flip.dir))).toEqual(new Set(["down"]));
  });

  it("flips a cube the cursor comes straight onto from outside the card, as if from the nearest edge", () => {
    const flips = make().move({ x: -2, y: 0.2 }, 0);
    expect(flips).toEqual([{ cube: 10, dir: "right", at: 0 }]);
  });

  it("doesn't flip a cube again while the cursor wobbles on its edge", () => {
    const path = make();
    const wobble: [number, number][] = Array.from({ length: 20 }, (_, i) => [0.5 + (i % 2 ? 0.03 : -0.03), 0]);
    const flips = sweep(path, [[0.4, 0], ...wobble]);
    expect(cubes(flips)).toEqual([12]);
  });

  it("gives each cube beside the path one chance to flip, away from the path, once the cursor is past", () => {
    const path = make(() => 0);
    sweep(path, line([-3, 0], [3, 0]));
    const due = path.due(10);
    expect(cubes(due)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
    expect(due.filter((flip) => flip.cube < 10).every((flip) => flip.dir === "up")).toBe(true);
    expect(due.filter((flip) => flip.cube > 14).every((flip) => flip.dir === "down")).toBe(true);
  });

  it("leaves a cube beside the path as it is when its chance doesn't come up", () => {
    const path = make(() => 0.99);
    sweep(path, line([-3, 0], [3, 0]));
    expect(path.due(10)).toEqual([]);
  });

  it("flips the cubes further from the path later, like a ripple", () => {
    const path = make(() => 0);
    sweep(path, line([-3, 0], [3, 0]));
    const due = path.due(10);
    const at = (cube: number) => due.find((flip) => flip.cube === cube)?.at ?? NaN;
    const [near, far] = [at(7), at(2)];
    expect(far).toBeGreaterThan(near);
  });

  it("flips nothing before its time", () => {
    const path = make(() => 0);
    sweep(path, line([-3, 0], [3, 0]));
    expect(path.due(0)).toEqual([]);
  });

  it("lets the cubes the cursor was still nearing have their chance once it leaves", () => {
    const path = make(() => 0);
    sweep(path, line([-3, 0], [0, 0]));
    expect(cubes(path.due(10))).not.toContain(13);
    path.leave();
    expect(cubes(path.due(10))).toContain(13);
  });

  it("flips a cube the cursor comes over now, in place of a chance it had of flipping later", () => {
    const path = make(() => 0);
    sweep(path, line([-3, 0], [3, 0]));
    path.leave();
    const flips = sweep(path, line([0, 3], [0, 1.2], 8), 1);
    expect(cubes(flips)).toEqual([17, 22]);
    expect(cubes(path.due(10))).not.toContain(17);
    expect(cubes(path.due(10))).not.toContain(22);
  });
});

describe("flipChance", () => {
  it("is certain just off the path, falls off with distance, and is none past reach", () => {
    expect(flipChance(0.5)).toBe(1);
    expect(flipChance(1)).toBeGreaterThan(flipChance(2));
    expect(flipChance(2)).toBeGreaterThan(0);
    expect(flipChance(2.5)).toBe(0);
    expect(flipChance(3)).toBe(0);
  });
});
