import { describe, expect, it } from "vitest";
import {
  COLLECTION_MAX_ITEMS,
  DEFAULT_BACKGROUND_EFFECT,
  type MediaNode,
} from "@/domain/nodes";
import {
  appendItems,
  collectionItemAlt,
  collectionLayout,
  collectionSurplusCount,
  featureItem,
  removeItem,
  replaceItem,
  setItemBackgroundEffect,
  setItemCaption,
  setItemLayout,
  swapItems,
} from "../collection-items";

/**
 * Everything a media node holds bar the two words that classify it. Spelling
 * `type: "media"` into every fixture would say nothing — it is constant across
 * both arms — and spelling `kind` into every one would bury the handful of
 * cases where the kind is the point.
 */
type MediaFields = Omit<MediaNode, "type" | "kind">;

const picture = (fields: MediaFields): MediaNode => ({
  type: "media",
  kind: "image",
  ...fields,
});

const clip = (fields: MediaFields): MediaNode => ({
  type: "media",
  kind: "video",
  ...fields,
});

const items = (...srcs: string[]): MediaNode[] =>
  srcs.map((src) => picture({ src }));

const srcs = (list: MediaNode[]) => list.map((item) => item.src);

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
    const seeded = [picture({ src: "a", caption: "Old" })];
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
    const seeded = [picture({ src: "old", caption: "Kept" })];
    const next = replaceItem(seeded, 0, picture({ src: "new", alt: "New" }));
    expect(next[0]).toEqual(
      picture({ src: "new", alt: "New", caption: "Kept" }),
    );
  });

  it("takes the incoming caption when the slot had none", () => {
    const next = replaceItem(
      items("old"),
      0,
      picture({ src: "new", caption: "Fresh" }),
    );
    expect(next[0].caption).toBe("Fresh");
  });

  it("keeps the styling the slot was given — fit, inset, corner, effect", () => {
    const seeded = [
      picture({
        src: "old",
        objectFit: "contain",
        padding: 24,
        borderRadius: 0,
        backgroundEffect: DEFAULT_BACKGROUND_EFFECT,
      }),
    ];
    expect(replaceItem(seeded, 0, picture({ src: "new" }))[0]).toEqual({
      ...seeded[0],
      src: "new",
    });
  });

  it("lets the incoming item's own styling win over the slot's", () => {
    const seeded = [picture({ src: "old", objectFit: "contain" })];
    const next = replaceItem(
      seeded,
      0,
      picture({ src: "new", objectFit: "cover" }),
    );
    expect(next[0].objectFit).toBe("cover");
  });

  // A zero the panel writes is dropped rather than stored, but a document
  // written before that was true can still hold one — and the merge tests for
  // ABSENCE, not truthiness, so it carries across either way.
  it("keeps a stored zero corner, which is falsy but not absent", () => {
    const seeded = [picture({ src: "old", borderRadius: 0 })];
    expect(
      replaceItem(seeded, 0, picture({ src: "new" }))[0].borderRadius,
    ).toBe(0);
  });

  it("does not carry the old picture's alt onto the new one", () => {
    const seeded = [picture({ src: "old", alt: "A red bicycle" })];
    expect(
      replaceItem(seeded, 0, picture({ src: "new" }))[0].alt,
    ).toBeUndefined();
  });

  // The one property that is emphatically NOT the slot's. Everything in
  // SLOT_OWNED_PROPERTIES is work the author did against a POSITION in the
  // grid and rightly outlives the file standing in it; `kind` is a statement
  // about the file itself, in exactly the way `src` and `alt` are. Preserve it
  // from the outgoing item and dropping a clip into a slot that used to hold a
  // photograph leaves an `<img>` pointed at an mp4 — a broken image where the
  // demo should be, and one that no amount of re-picking the file can fix,
  // because every replacement would inherit the same stale word.
  it("takes the incoming item's kind, never the outgoing one's", () => {
    const seeded = [picture({ src: "old.png", caption: "Kept", padding: 24 })];
    expect(replaceItem(seeded, 0, clip({ src: "new.mp4" }))[0]).toEqual(
      clip({ src: "new.mp4", caption: "Kept", padding: 24 }),
    );
  });

  it("swaps a clip back out for a picture just as readily", () => {
    const seeded = [clip({ src: "old.mp4" })];
    expect(replaceItem(seeded, 0, picture({ src: "new.png" }))[0].kind).toBe(
      "image",
    );
  });

  it("ignores an out-of-range index", () => {
    expect(replaceItem(items("a"), 3, picture({ src: "b" }))).toEqual(
      items("a"),
    );
  });
});

// ---------------------------------------------------------------------------
// collectionItemAlt
// ---------------------------------------------------------------------------

describe("collectionItemAlt", () => {
  it("prefers explicit alt text", () => {
    expect(
      collectionItemAlt(picture({ src: "a", alt: "Alt", caption: "Cap" })),
    ).toBe("Alt");
  });

  it("falls back to the caption", () => {
    expect(collectionItemAlt(picture({ src: "a", caption: "Cap" }))).toBe("Cap");
  });

  it("falls back to an empty string, marking the image decorative", () => {
    expect(collectionItemAlt(picture({ src: "a" }))).toBe("");
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

// ---------------------------------------------------------------------------
// setItemBackgroundEffect
// ---------------------------------------------------------------------------

describe("setItemBackgroundEffect", () => {
  it("attaches an effect to the addressed slot only", () => {
    const next = setItemBackgroundEffect(
      items("a", "b"),
      1,
      DEFAULT_BACKGROUND_EFFECT,
    );
    expect(next[0].backgroundEffect).toBeUndefined();
    expect(next[1].backgroundEffect).toEqual(DEFAULT_BACKGROUND_EFFECT);
  });

  it("replaces an existing effect rather than merging into it", () => {
    const seeded = setItemBackgroundEffect(
      items("a"),
      0,
      DEFAULT_BACKGROUND_EFFECT,
    );
    const next = setItemBackgroundEffect(seeded, 0, {
      ...DEFAULT_BACKGROUND_EFFECT,
      rotation: 90,
    });
    expect(next[0].backgroundEffect?.rotation).toBe(90);
  });

  it("drops the KEY entirely when cleared, not just its value", () => {
    const seeded = setItemBackgroundEffect(
      items("a"),
      0,
      DEFAULT_BACKGROUND_EFFECT,
    );
    const cleared = setItemBackgroundEffect(seeded, 0, undefined);
    expect("backgroundEffect" in cleared[0]).toBe(false);
  });

  it("leaves the rest of the item alone", () => {
    const list = [picture({ src: "a", alt: "A", caption: "C" })];
    const next = setItemBackgroundEffect(list, 0, DEFAULT_BACKGROUND_EFFECT);
    expect(next[0]).toMatchObject(picture({ src: "a", alt: "A", caption: "C" }));
  });

  it("is a no-op for an index outside the collection", () => {
    const list = items("a", "b");
    expect(setItemBackgroundEffect(list, 5, DEFAULT_BACKGROUND_EFFECT)).toEqual(list);
    expect(setItemBackgroundEffect(list, -1, DEFAULT_BACKGROUND_EFFECT)).toEqual(list);
  });

  it("never mutates the array it is given", () => {
    const list = items("a");
    setItemBackgroundEffect(list, 0, DEFAULT_BACKGROUND_EFFECT);
    expect(list[0].backgroundEffect).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// setItemLayout
// ---------------------------------------------------------------------------

describe("setItemLayout", () => {
  it("patches one slot only", () => {
    const next = setItemLayout(items("a", "b"), 1, { objectFit: "contain" });
    expect(next[0].objectFit).toBeUndefined();
    expect(next[1].objectFit).toBe("contain");
  });

  it("merges into what the item already carries, rather than replacing it", () => {
    const once = setItemLayout(items("a"), 0, { objectFit: "contain" });
    const twice = setItemLayout(once, 0, { padding: 16 });
    expect(twice[0]).toMatchObject({ objectFit: "contain", padding: 16 });
  });

  it("drops the key when the value IS the default, so an untouched item stays bare", () => {
    const contained = setItemLayout(items("a"), 0, {
      objectFit: "contain",
      padding: 24,
    });
    const back = setItemLayout(contained, 0, { objectFit: "cover", padding: 0 });
    expect(back[0]).toEqual(picture({ src: "a" }));
    expect("objectFit" in back[0]).toBe(false);
    expect("padding" in back[0]).toBe(false);
  });

  it("leaves the list alone for an index that is not there", () => {
    const list = items("a", "b");
    expect(setItemLayout(list, 7, { padding: 8 })).toEqual(list);
  });

  it("never mutates the list it was given", () => {
    const list = items("a");
    setItemLayout(list, 0, { padding: 8 });
    expect(list[0]).toEqual(picture({ src: "a" }));
  });
});

describe("setItemLayout border radius", () => {
  // Zero is the DEFAULT now — no surface rounds a picture that has not asked to
  // be rounded — so a zero corner is nothing to record, exactly like a zero
  // inset. Rounding a picture and squaring it again leaves the document as it
  // started.
  it("drops a zero corner, which is now the default rather than an override", () => {
    const rounded = setItemLayout(items("a"), 0, { borderRadius: 12 });
    expect(setItemLayout(rounded, 0, { borderRadius: 0 })[0]).toEqual(
      picture({ src: "a" }),
    );
  });

  it("survives a later patch to another property", () => {
    const once = setItemLayout(items("a"), 0, { borderRadius: 12 });
    const twice = setItemLayout(once, 0, { padding: 16 });
    expect(twice[0]).toMatchObject({ borderRadius: 12, padding: 16 });
  });

  it("stores a set corner", () => {
    expect(setItemLayout(items("a"), 0, { borderRadius: 12 })[0].borderRadius).toBe(12);
  });
});
