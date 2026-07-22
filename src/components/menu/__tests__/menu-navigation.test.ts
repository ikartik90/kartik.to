import { describe, expect, it } from "vitest";
import { matchesQuery, nextActiveId, type NavItem } from "../menu-navigation";

describe("matchesQuery", () => {
  it("matches everything on an empty or whitespace query", () => {
    expect(matchesQuery("Paragraph", undefined, "")).toBe(true);
    expect(matchesQuery("Paragraph", undefined, "   ")).toBe(true);
  });

  it("matches a case-insensitive substring of the value", () => {
    expect(matchesQuery("Sub-heading", undefined, "head")).toBe(true);
    expect(matchesQuery("Sub-heading", undefined, "HEAD")).toBe(true);
    expect(matchesQuery("Paragraph", undefined, "xyz")).toBe(false);
  });

  it("falls back to keywords when the value does not match", () => {
    expect(matchesQuery("Media", ["image", "video"], "vid")).toBe(true);
    expect(matchesQuery("Media", ["image"], "vid")).toBe(false);
  });
});

describe("nextActiveId", () => {
  const items: NavItem[] = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("enters from the first item going forward and the last going back", () => {
    expect(nextActiveId(items, null, 1, false)).toBe("a");
    expect(nextActiveId(items, null, -1, false)).toBe("c");
  });

  it("steps forward and backward", () => {
    expect(nextActiveId(items, "a", 1, false)).toBe("b");
    expect(nextActiveId(items, "b", -1, false)).toBe("a");
  });

  it("clamps at the edges without loop", () => {
    expect(nextActiveId(items, "c", 1, false)).toBe("c");
    expect(nextActiveId(items, "a", -1, false)).toBe("a");
  });

  it("wraps at the edges with loop", () => {
    expect(nextActiveId(items, "c", 1, true)).toBe("a");
    expect(nextActiveId(items, "a", -1, true)).toBe("c");
  });

  it("skips disabled items", () => {
    const withDisabled: NavItem[] = [
      { id: "a" },
      { id: "b", disabled: true },
      { id: "c" },
    ];
    expect(nextActiveId(withDisabled, "a", 1, false)).toBe("c");
    expect(nextActiveId(withDisabled, "c", -1, false)).toBe("a");
  });

  it("returns null when every item is disabled or the list is empty", () => {
    expect(nextActiveId([{ id: "a", disabled: true }], null, 1, false)).toBeNull();
    expect(nextActiveId([], null, 1, false)).toBeNull();
  });

  it("treats an unknown current id as a fresh entry", () => {
    expect(nextActiveId(items, "gone", 1, false)).toBe("a");
    expect(nextActiveId(items, "gone", -1, false)).toBe("c");
  });
});
