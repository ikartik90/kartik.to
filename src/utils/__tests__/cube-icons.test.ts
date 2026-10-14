import { describe, expect, it } from "vitest";
import { refreshFaces, startingFaces } from "@/utils/cube-icons";

const pool = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `icon-${i}` }));
const keys = (faces: { key: string }[][]) => faces.flat().map((icon) => icon.key);

describe("startingFaces", () => {
  it("puts the first icons in front and a different icon on every face", () => {
    const faces = startingFaces(pool(150), 25);
    expect(faces).toHaveLength(25);
    expect(faces.map((cube) => cube[0].key)).toEqual(pool(25).map((icon) => icon.key));
    expect(new Set(keys(faces)).size).toBe(125);
  });

  it("repeats icons round the backs when there aren't enough, never in front", () => {
    const faces = startingFaces(pool(30), 25);
    expect(new Set(faces.map((cube) => cube[0].key)).size).toBe(25);
    expect(faces.every((cube) => cube.length === 5)).toBe(true);
  });
});

describe("refreshFaces", () => {
  it("gives each face asked for an icon on no face of any cube", () => {
    const icons = pool(130);
    const faces = startingFaces(icons, 25);
    const next = refreshFaces(faces, [{ cube: 3, element: 2 }, { cube: 7, element: 4 }], icons, () => 0);
    expect(new Set(keys(next)).size).toBe(125);
    expect(next[3][2]).not.toBe(faces[3][2]);
    expect(next[7][4]).not.toBe(faces[7][4]);
  });

  it("leaves the other faces, and the faces it was given, as they were", () => {
    const icons = pool(130);
    const faces = startingFaces(icons, 25);
    const before = keys(faces);
    const next = refreshFaces(faces, [{ cube: 0, element: 1 }], icons, () => 0.5);
    expect(keys(faces)).toEqual(before);
    expect(keys(next).filter((key, i) => key !== before[i])).toHaveLength(1);
  });

  it("keeps a face's icon when every icon is already on a face", () => {
    const icons = pool(125);
    const faces = startingFaces(icons, 25);
    expect(refreshFaces(faces, [{ cube: 0, element: 1 }], icons, () => 0)[0][1]).toBe(faces[0][1]);
  });
});
