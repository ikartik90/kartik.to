import { describe, expect, it } from "vitest";
import { COLLECTION_MAX_ITEMS, type CollectionItem } from "@/domain/nodes";
import {
  appendItems,
  collectionItemAlt,
  collectionLayout,
  collectionSurplusCount,
  featureItem,
  removeItem,
  replaceItem,
  setItemCaption,
  swapItems,
} from "../collection-items";

const items = (...srcs: string[]): CollectionItem[] =>
  srcs.map((src) => ({ src }));

const srcs = (list: CollectionItem[]) => list.map((item) => item.src);

// ---------------------------------------------------------------------------
// featureItem
// ---------------------------------------------------------------------------

describe("swapItems", () => {
  it("exchanges two slots and leaves the rest alone", () => {
    expect(srcs(swapItems(items("a", "b", "c", "d"), 1, 3))).toEqual([
      "a",
      "d",
      "c",
      "b",
    ]);
  });

  it("is symmetric", () => {
    const list = items("a", "b", "c");
    expect(srcs(swapItems(list, 0, 2))).toEqual(srcs(swapItems(list, 2, 0)));
  });

  it("is a no-op onto itself", () => {
    expect(srcs(swapItems(items("a", "b"), 1, 1))).toEqual(["a", "b"]);
  });

  it("ignores an out-of-range index on either side", () => {
    expect(srcs(swapItems(items("a", "b"), 0, 9))).toEqual(["a", "b"]);
    expect(srcs(swapItems(items("a", "b"), -1, 1))).toEqual(["a", "b"]);
  });

  it("does not mutate its input", () => {
    const original = items("a", "b", "c");
    swapItems(original, 0, 2);
    expect(srcs(original)).toEqual(["a", "b", "c"]);
  });
});

describe("featureItem", () => {
  // Featuring SWAPS with slot 0 rather than moving to the front: it disturbs
  // exactly two cells instead of re-laying-out everything in between.
  it("exchanges the item with whatever is currently featured", () => {
    expect(srcs(featureItem(items("a", "b", "c", "d"), 3))).toEqual([
      "d",
      "b",
      "c",
      "a",
    ]);
  });

  it("leaves every slot it did not touch exactly where it was", () => {
    expect(srcs(featureItem(items("a", "b", "c", "d", "e"), 2))).toEqual([
      "c",
      "b",
      "a",
      "d",
      "e",
    ]);
  });

  it("returns an equivalent list when the item is already featured", () => {
    expect(srcs(featureItem(items("a", "b"), 0))).toEqual(["a", "b"]);
  });

  it("ignores an out-of-range index", () => {
    expect(srcs(featureItem(items("a", "b"), 5))).toEqual(["a", "b"]);
    expect(srcs(featureItem(items("a", "b"), -1))).toEqual(["a", "b"]);
  });

  it("does not mutate its input", () => {
    const original = items("a", "b", "c");
    featureItem(original, 2);
    expect(srcs(original)).toEqual(["a", "b", "c"]);
  });
});

// ---------------------------------------------------------------------------
// removeItem
// ---------------------------------------------------------------------------

describe("removeItem", () => {
  it("drops the item and shifts later items left", () => {
    expect(srcs(removeItem(items("a", "b", "c"), 1))).toEqual(["a", "c"]);
  });

  it("can empty the list", () => {
    expect(removeItem(items("a"), 0)).toEqual([]);
  });

  it("ignores an out-of-range index", () => {
    expect(srcs(removeItem(items("a", "b"), 9))).toEqual(["a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// setItemCaption
// ---------------------------------------------------------------------------

describe("setItemCaption", () => {
  it("sets the caption on the addressed item only", () => {
    const next = setItemCaption(items("a", "b"), 1, "Second");
    expect(next[0].caption).toBeUndefined();
    expect(next[1].caption).toBe("Second");
  });

  it("drops an empty or whitespace-only caption rather than storing it", () => {
    const seeded: CollectionItem[] = [{ src: "a", caption: "Old" }];
    expect(setItemCaption(seeded, 0, "")[0].caption).toBeUndefined();
    expect(setItemCaption(seeded, 0, "   ")[0].caption).toBeUndefined();
    expect(setItemCaption(seeded, 0, undefined)[0].caption).toBeUndefined();
  });

  it("trims the stored caption", () => {
    expect(setItemCaption(items("a"), 0, "  Hi  ")[0].caption).toBe("Hi");
  });

  it("ignores an out-of-range index", () => {
    expect(setItemCaption(items("a"), 4, "x")).toEqual(items("a"));
  });
});

// ---------------------------------------------------------------------------
// appendItems
// ---------------------------------------------------------------------------

describe("appendItems", () => {
  it("appends in order", () => {
    expect(srcs(appendItems(items("a"), items("b", "c")))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("caps at COLLECTION_MAX_ITEMS and drops the overflow", () => {
    const added = items("d", "e", "f", "g", "h");
    const next = appendItems(items("a", "b", "c"), added);
    expect(next).toHaveLength(COLLECTION_MAX_ITEMS);
    expect(srcs(next)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("is a no-op when already full", () => {
    const full = items("a", "b", "c", "d", "e", "f");
    expect(srcs(appendItems(full, items("g")))).toEqual(srcs(full));
  });
});

// ---------------------------------------------------------------------------
// replaceItem
// ---------------------------------------------------------------------------

describe("replaceItem", () => {
  it("swaps the image but keeps the caption already written for that slot", () => {
    const seeded: CollectionItem[] = [{ src: "old", caption: "Kept" }];
    const next = replaceItem(seeded, 0, { src: "new", alt: "New" });
    expect(next[0]).toEqual({ src: "new", alt: "New", caption: "Kept" });
  });

  it("takes the incoming caption when the slot had none", () => {
    const next = replaceItem(items("old"), 0, { src: "new", caption: "Fresh" });
    expect(next[0].caption).toBe("Fresh");
  });

  it("ignores an out-of-range index", () => {
    expect(replaceItem(items("a"), 3, { src: "b" })).toEqual(items("a"));
  });
});

// ---------------------------------------------------------------------------
// collectionItemAlt
// ---------------------------------------------------------------------------

describe("collectionItemAlt", () => {
  it("prefers explicit alt text", () => {
    expect(collectionItemAlt({ src: "a", alt: "Alt", caption: "Cap" })).toBe(
      "Alt",
    );
  });

  it("falls back to the caption", () => {
    expect(collectionItemAlt({ src: "a", caption: "Cap" })).toBe("Cap");
  });

  it("falls back to an empty string, marking the image decorative", () => {
    expect(collectionItemAlt({ src: "a" })).toBe("");
  });
});

// ---------------------------------------------------------------------------
// collectionSurplusCount
// ---------------------------------------------------------------------------

describe("collectionSurplusCount", () => {
  it("counts the items the reader grid cannot show", () => {
    expect(collectionSurplusCount(5)).toBe(2);
    expect(collectionSurplusCount(COLLECTION_MAX_ITEMS)).toBe(3);
  });

  it("is zero at or below the three visible tiles", () => {
    for (const count of [0, 1, 2, 3]) {
      expect(collectionSurplusCount(count)).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// collectionLayout
// ---------------------------------------------------------------------------

describe("collectionLayout", () => {
  it("always gives the editor the full 3×2 slot grid", () => {
    for (let count = 0; count <= COLLECTION_MAX_ITEMS; count += 1) {
      expect(collectionLayout(count, "editor")).toBe("uniform");
    }
  });

  it("splits the reader grid evenly below three images", () => {
    expect(collectionLayout(1, "reader")).toBe("single");
    expect(collectionLayout(2, "reader")).toBe("pair");
  });

  it("uses the featured skeleton from three images up", () => {
    expect(collectionLayout(3, "reader")).toBe("featured");
    expect(collectionLayout(COLLECTION_MAX_ITEMS, "reader")).toBe("featured");
  });

  it("treats an empty reader collection as a single tile", () => {
    expect(collectionLayout(0, "reader")).toBe("single");
  });
});
