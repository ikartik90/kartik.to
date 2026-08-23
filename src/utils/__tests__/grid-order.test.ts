import { describe, it, expect } from "vitest";
import { orderGridItems } from "@/utils/grid-order";

/** A placeable reduced to the two fields the ordering actually reads. */
const item = (
  id: string,
  gridIndex: number | null,
  publishedAt: string | null,
) => ({ id, gridIndex, publishedAt: publishedAt ? new Date(publishedAt) : null });

const ids = (list: { id: string }[]) => list.map((i) => i.id);

describe("orderGridItems", () => {
  it("returns nothing for nothing", () => {
    expect(orderGridItems([])).toEqual([]);
  });

  it("runs unpinned items newest first", () => {
    const out = orderGridItems([
      item("old", null, "2026-01-01"),
      item("new", null, "2026-06-01"),
      item("mid", null, "2026-03-01"),
    ]);
    expect(ids(out)).toEqual(["new", "mid", "old"]);
  });

  it("sinks an undated item below every dated one", () => {
    const out = orderGridItems([
      item("undated", null, null),
      item("dated", null, "2020-01-01"),
    ]);
    expect(ids(out)).toEqual(["dated", "undated"]);
  });

  it("seats a pinned item at its index and flows the rest around it", () => {
    const out = orderGridItems([
      item("a", null, "2026-06-01"),
      item("b", null, "2026-05-01"),
      item("pin", 1, "2020-01-01"),
      item("c", null, "2026-04-01"),
    ]);
    expect(ids(out)).toEqual(["a", "pin", "b", "c"]);
  });

  it("pins to index 0 ahead of a newer unpinned item", () => {
    const out = orderGridItems([
      item("newest", null, "2026-12-01"),
      item("pin", 0, "2019-01-01"),
    ]);
    expect(ids(out)).toEqual(["pin", "newest"]);
  });

  // The user's stated requirement, and the reason a pin is worth having:
  // position 3 is position 3 no matter how the unpinned set grows around it.
  it("holds an index steady as unpinned items are added around it", () => {
    const pinned = item("pin", 3, "2020-01-01");
    const filler = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        item(`f${i}`, null, `2026-01-0${(i % 9) + 1}`),
      );

    for (const n of [4, 8, 20]) {
      const out = orderGridItems([...filler(n), pinned]);
      expect(ids(out).indexOf("pin"), `with ${n} fillers`).toBe(3);
    }
  });

  it("clamps a pin past the end onto the last slot rather than leaving a hole", () => {
    const out = orderGridItems([
      item("a", null, "2026-06-01"),
      item("b", null, "2026-05-01"),
      item("far", 99, "2020-01-01"),
    ]);
    expect(ids(out)).toEqual(["a", "b", "far"]);
    expect(out).toHaveLength(3);
  });

  // The schema deliberately allows this — see `GridIndexSchema`, which prices a
  // collision as cosmetic and self-healing. Cosmetic still has to be DECIDED:
  // the loser takes the next free slot, and nothing is dropped.
  it("gives a colliding pin the next free slot instead of overwriting", () => {
    const out = orderGridItems([
      item("first", 1, "2026-06-01"),
      item("second", 1, "2026-05-01"),
      item("free", null, "2026-04-01"),
    ]);
    expect(ids(out)).toEqual(["free", "first", "second"]);
  });

  it("keeps every input exactly once, whatever the pins say", () => {
    const input = [
      item("a", 0, "2026-06-01"),
      item("b", 0, "2026-05-01"),
      item("c", 99, "2026-04-01"),
      item("d", null, "2026-03-01"),
      item("e", 2, null),
    ];
    const out = orderGridItems(input);
    expect(out).toHaveLength(input.length);
    expect([...ids(out)].sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("orders an all-pinned set by index", () => {
    const out = orderGridItems([
      item("third", 2, "2026-01-01"),
      item("first", 0, "2026-01-01"),
      item("second", 1, "2026-01-01"),
    ]);
    expect(ids(out)).toEqual(["first", "second", "third"]);
  });

  it("does not mutate the array it was given", () => {
    const input = [item("a", null, "2026-01-01"), item("pin", 0, "2020-01-01")];
    const snapshot = ids(input);
    orderGridItems(input);
    expect(ids(input)).toEqual(snapshot);
  });
});
