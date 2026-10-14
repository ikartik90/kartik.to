import { describe, expect, it } from "vitest";
import { CubeTurns } from "@/utils/cube-turns";

const level = () => [0, 0] as [number, number];
const run = (turns: CubeTurns, seconds: number, tilt = level) => {
  const fresh: { cube: number; element: number }[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) fresh.push(...turns.step(1 / 60, tilt));
  return fresh;
};

describe("CubeTurns", () => {
  it("starts every cube square on, its first face in front", () => {
    const turns = new CubeTurns(2);
    expect(turns.turn(0)).toEqual({ ax: 0, ay: 0 });
    expect(turns.faces[1].F).toBe(0);
  });

  it("flips a cube right: the face on its left comes round to the front", () => {
    const turns = new CubeTurns(1);
    const { L } = turns.faces[0];
    turns.flip(0, "right");
    run(turns, 1);
    expect(turns.faces[0].F).toBe(L);
  });

  it("gives the face that went round the back a fresh icon, as soon as it's out of sight", () => {
    const turns = new CubeTurns(1);
    const { R } = turns.faces[0];
    turns.flip(0, "right");
    expect(run(turns, 1)).toEqual([{ cube: 0, element: R }]);
  });

  it("flips up and down about the other axis, bringing round the bottom and the top", () => {
    const turns = new CubeTurns(2);
    const [{ B }, { T }] = turns.faces;
    turns.flip(0, "up");
    turns.flip(1, "down");
    run(turns, 1);
    expect([turns.faces[0].F, turns.faces[1].F]).toEqual([B, T]);
  });

  it("comes to rest square on again after a flip", () => {
    const turns = new CubeTurns(1);
    turns.flip(0, "left");
    run(turns, 2);
    const { ax, ay } = turns.turn(0);
    expect(Math.abs(ax) + Math.abs(ay)).toBeLessThan(0.001);
  });

  it("turns past halfway with no jump, the front handed over to the face coming round", () => {
    const turns = new CubeTurns(1);
    turns.flip(0, "right");
    let last = 0;
    let largest = 0;
    for (let i = 0; i < 60; i++) {
      turns.step(1 / 60, level);
      // The face coming round is a quarter turn short of the front: before the hand-over it's at angle − 90°.
      const { ay } = turns.turn(0);
      const coming = turns.faces[0].F === 0 ? ay - Math.PI / 2 : ay;
      if (i > 0) largest = Math.max(largest, Math.abs(coming - last));
      last = coming;
    }
    expect(largest).toBeLessThan(0.2);
  });

  it("refuses a flip while one is under way, until the new face is in front", () => {
    const turns = new CubeTurns(1);
    expect(turns.flip(0, "right")).toBe(true);
    expect(turns.flip(0, "up")).toBe(false);
    run(turns, 1);
    expect(turns.flip(0, "up")).toBe(true);
  });

  it("leans a cube toward its tilt", () => {
    const turns = new CubeTurns(1);
    run(turns, 2, () => [0.3, -0.2]);
    const { ax, ay } = turns.turn(0);
    expect(ax).toBeCloseTo(0.3, 2);
    expect(ay).toBeCloseTo(-0.2, 2);
  });

  it("rocks a cube it's kicked, and settles it again", () => {
    const turns = new CubeTurns(1);
    turns.kick(0, 4, 0);
    turns.step(1 / 60, level);
    expect(turns.turn(0).ax).toBeGreaterThan(0);
    run(turns, 3);
    expect(Math.abs(turns.turn(0).ax)).toBeLessThan(0.001);
  });

  it("shows a side face only while the cube is turned to show it", () => {
    const turns = new CubeTurns(1);
    run(turns, 2, () => [0.3, -0.2]);
    expect(turns.showing(0, "F")).toBe(true);
    expect(turns.showing(0, "B")).toBe(true);
    expect(turns.showing(0, "R")).toBe(true);
    expect(turns.showing(0, "T")).toBe(false);
    expect(turns.showing(0, "L")).toBe(false);
  });
});
