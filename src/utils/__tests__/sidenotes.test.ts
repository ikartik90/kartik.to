import { describe, it, expect } from "vitest";
import {
  collectSidenotes,
  sidenoteAnchorName,
  sidenoteBases,
  makeSidenoteId,
} from "@/utils/sidenotes";
import type { BlockNode } from "@/domain/nodes";

type Inline = { type: "text"; text: string; marks?: unknown[] };

function para(...children: Inline[]): BlockNode {
  return { type: "paragraph", children } as unknown as BlockNode;
}

function annotated(text: string, id: string, note = ""): Inline {
  return { type: "text", text, marks: [{ type: "sidenote", id, text: note }] };
}

describe("sidenoteAnchorName", () => {
  it("prefixes with --sn- and strips ident-unsafe chars", () => {
    expect(sidenoteAnchorName("abc")).toBe("--sn-abc");
    expect(sidenoteAnchorName("a b.c/d")).toBe("--sn-abcd");
  });
});

describe("makeSidenoteId", () => {
  it("returns a non-empty, unique-ish id", () => {
    const a = makeSidenoteId();
    const b = makeSidenoteId();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

describe("collectSidenotes", () => {
  it("numbers notes 1..n in document order", () => {
    const blocks: BlockNode[] = [
      para({ type: "text", text: "x " }, annotated("one", "a", "first")),
      para(annotated("two", "b", "second")),
    ];
    const entries = collectSidenotes(blocks);
    expect(entries.map((e) => [e.number, e.id, e.text, e.blockIndex])).toEqual([
      [1, "a", "first", 0],
      [2, "b", "second", 1],
    ]);
    expect(entries[0].anchorName).toBe("--sn-a");
  });

  it("renumbers when a note is inserted before an existing one", () => {
    const before: BlockNode[] = [para(annotated("old", "old"))];
    expect(collectSidenotes(before)[0].number).toBe(1);

    const after: BlockNode[] = [
      para(annotated("new", "new")),
      para(annotated("old", "old")),
    ];
    const entries = collectSidenotes(after);
    expect(entries.find((e) => e.id === "new")?.number).toBe(1);
    expect(entries.find((e) => e.id === "old")?.number).toBe(2);
  });

  it("counts a multi-run note once, keeping first-appearance text", () => {
    const blocks: BlockNode[] = [
      para(
        annotated("split ", "s", "note"),
        annotated("run", "s", "note"),
        annotated("z", "t", "other"),
      ),
    ];
    const entries = collectSidenotes(blocks);
    expect(entries.map((e) => e.id)).toEqual(["s", "t"]);
    expect(entries.map((e) => e.number)).toEqual([1, 2]);
  });

  it("ignores blocks without inline children", () => {
    const blocks: BlockNode[] = [
      { type: "horizontal_rule" },
      { type: "image", src: "/x.png" },
      para(annotated("n", "only")),
    ];
    expect(collectSidenotes(blocks).map((e) => e.id)).toEqual(["only"]);
  });

  it("returns an empty list when there are no sidenotes", () => {
    const blocks: BlockNode[] = [para({ type: "text", text: "plain" })];
    expect(collectSidenotes(blocks)).toEqual([]);
  });
});

describe("sidenoteBases", () => {
  it("reports the count of distinct notes before each block", () => {
    const blocks: BlockNode[] = [
      para(annotated("a", "1"), annotated("b", "2")), // 2 notes
      para({ type: "text", text: "plain" }), // 0 notes
      para(annotated("c", "3")), // 1 note
      para(annotated("d", "4")),
    ];
    expect(sidenoteBases(blocks)).toEqual([0, 2, 2, 3]);
  });

  it("base + within-block order equals the collectSidenotes ordinal", () => {
    const blocks: BlockNode[] = [
      para(annotated("a", "1")),
      para(annotated("b", "2"), annotated("c", "3")),
    ];
    const bases = sidenoteBases(blocks);
    // Block 1's first note is base(1)=1 → ordinal 2; its second → 3.
    expect(bases).toEqual([0, 1]);
    expect(collectSidenotes(blocks).map((e) => e.number)).toEqual([1, 2, 3]);
  });
});
