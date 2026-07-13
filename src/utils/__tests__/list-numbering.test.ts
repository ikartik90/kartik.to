import { describe, it, expect } from "vitest";
import { computeListNumbering, toAlpha } from "@/utils/list-numbering";
import type { BlockNode } from "@/domain/nodes";

const p = (): BlockNode => ({ type: "paragraph", children: [{ type: "text", text: "" }] });
const li = (extra: Partial<Extract<BlockNode, { type: "list_item" }>> = {}): BlockNode => ({
  type: "list_item",
  children: [{ type: "text", text: "" }],
  ...extra,
});

const labels = (blocks: BlockNode[]) =>
  computeListNumbering(blocks).map((n) => n?.label ?? null);
const ordinals = (blocks: BlockNode[]) =>
  computeListNumbering(blocks).map((n) => n?.ordinal ?? null);

describe("toAlpha", () => {
  it("maps 1-based ordinals to bijective base-26 letters", () => {
    expect(toAlpha(1)).toBe("a");
    expect(toAlpha(26)).toBe("z");
    expect(toAlpha(27)).toBe("aa");
    expect(toAlpha(28)).toBe("ab");
    expect(toAlpha(52)).toBe("az");
    expect(toAlpha(53)).toBe("ba");
  });
});

describe("computeListNumbering", () => {
  it("numbers a simple run from 1 and maps non-list blocks to null", () => {
    expect(ordinals([p(), li(), li(), li(), p()])).toEqual([null, 1, 2, 3, null]);
  });

  it("zero-pads to the digit width of the run's largest ordinal", () => {
    const blocks = Array.from({ length: 10 }, () => li());
    expect(labels(blocks)).toEqual([
      "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
    ]);
  });

  it("does not zero-pad single-digit runs", () => {
    expect(labels([li(), li(), li()])).toEqual(["1", "2", "3"]);
  });

  it("continues numbering from the previous list when the head is marked", () => {
    const blocks = [li(), li(), li(), p(), li({ continued: true }), li()];
    // First list 1,2,3 → second continues 4,5.
    expect(ordinals(blocks)).toEqual([1, 2, 3, null, 4, 5]);
  });

  it("keeps the continued count live as the preceding list grows", () => {
    const grown = [li(), li(), li(), li(), p(), li({ continued: true }), li()];
    expect(ordinals(grown)).toEqual([1, 2, 3, 4, null, 5, 6]);
  });

  it("ignores continue when no numbered list precedes the run", () => {
    expect(ordinals([p(), li({ continued: true }), li()])).toEqual([null, 1, 2]);
  });

  it("restarts the counter at an item carrying an explicit start", () => {
    const blocks = [li(), li(), li({ start: 1 }), li()];
    expect(ordinals(blocks)).toEqual([1, 2, 1, 2]);
  });

  it("renders alpha markers when the run head is styled alpha", () => {
    expect(labels([li({ marker: "alpha" }), li(), li()])).toEqual(["a", "b", "c"]);
  });

  it("applies the head's style across the whole run, ignoring later heads", () => {
    // marker on a non-head item is ignored; the run style comes from the head.
    const blocks = [li(), li({ marker: "alpha" }), li()];
    expect(labels(blocks)).toEqual(["1", "2", "3"]);
  });

  it("combines continue + alpha", () => {
    const blocks = [li(), li(), li(), p(), li({ continued: true, marker: "alpha" }), li()];
    // second list continues at 4,5 but renders d,e.
    expect(labels(blocks)).toEqual(["1", "2", "3", null, "d", "e"]);
  });

  it("treats each run independently for zero-pad width", () => {
    const blocks = [
      ...Array.from({ length: 12 }, () => li()),
      p(),
      li({ continued: true }),
      li(),
    ];
    const out = labels(blocks);
    expect(out[0]).toBe("01");
    expect(out[11]).toBe("12");
    // continued run is 13,14 → two digits, no leading zero needed.
    expect(out[13]).toBe("13");
    expect(out[14]).toBe("14");
  });
});
