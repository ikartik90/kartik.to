import { describe, it, expect } from "vitest";
import {
  CreateIconUploadInputSchema,
  DEFAULT_ICON_SETTINGS,
  FinalizeIconUploadInputSchema,
  ICON_SIZES,
  ICON_STROKES,
  ICON_ZOOMS,
  cleanIconAliases,
  iconTitleFrom,
  matchesIcon,
  IconAssetSchema,
  IconKeyInputSchema,
  MAX_ICON_BYTES,
  SetIconReviewInputSchema,
  downloadNameFor,
  iconLabelFor,
  iconNameFromKey,
  matchesIconName,
  reviewForUpload,
  sanitizeIconFilename,
} from "../icon";

const ASSET = {
  key: "icons/1f0c0f4e-1111-2222-3333-444455556666-check.svg",
  url: "https://cdn.example.com/icons/check.svg",
  name: "check.svg",
  native: 20,
  flattened: false,
  review: "approved",
  title: "Check",
  aliases: [],
};

describe("IconAssetSchema", () => {
  it("takes a listed icon", () => {
    expect(IconAssetSchema.parse(ASSET).name).toBe("check.svg");
  });

  it("refuses a grid that is not a whole number of pixels", () => {
    expect(() => IconAssetSchema.parse({ ...ASSET, native: 20.5 })).toThrow();
    expect(() => IconAssetSchema.parse({ ...ASSET, native: 0 })).toThrow();
  });

  it("refuses a review state it does not know", () => {
    expect(() => IconAssetSchema.parse({ ...ASSET, review: "pending" })).toThrow();
  });
});

describe("CreateIconUploadInputSchema", () => {
  const input = { filename: "check.svg", size: 1024 };

  it("takes the two facts a signature needs: a name and a size", () => {
    expect(CreateIconUploadInputSchema.parse(input).filename).toBe("check.svg");
  });

  it("refuses a file bigger than an icon could be", () => {
    expect(() =>
      CreateIconUploadInputSchema.parse({ ...input, size: MAX_ICON_BYTES + 1 }),
    ).toThrow();
  });

  it("refuses an empty name", () => {
    expect(() => CreateIconUploadInputSchema.parse({ ...input, filename: "" })).toThrow();
  });
});

describe("FinalizeIconUploadInputSchema", () => {
  const input = { key: "icons/a.svg", native: 16, flattened: false };

  it("takes the measurements, which arrive after the bytes do", () => {
    expect(FinalizeIconUploadInputSchema.parse(input).native).toBe(16);
  });

  it("refuses a grid that is not a whole number of pixels", () => {
    expect(() => FinalizeIconUploadInputSchema.parse({ ...input, native: 0 })).toThrow();
    expect(() =>
      FinalizeIconUploadInputSchema.parse({ ...input, native: 20.5 }),
    ).toThrow();
  });

  it("refuses an empty key", () => {
    expect(() => FinalizeIconUploadInputSchema.parse({ ...input, key: "" })).toThrow();
  });

  it("has no say in the review state — that is the server's alone", () => {
    const parsed = FinalizeIconUploadInputSchema.parse({
      ...input,
      review: "approved",
    });
    expect(parsed).not.toHaveProperty("review");
  });
});

describe("SetIconReviewInputSchema", () => {
  it("takes either state", () => {
    expect(
      SetIconReviewInputSchema.parse({ key: "icons/a.svg", review: "held" }).review,
    ).toBe("held");
    expect(
      SetIconReviewInputSchema.parse({ key: "icons/a.svg", review: "approved" }).review,
    ).toBe("approved");
  });

  it("refuses anything else", () => {
    expect(() =>
      SetIconReviewInputSchema.parse({ key: "icons/a.svg", review: "yes" }),
    ).toThrow();
  });
});

describe("IconKeyInputSchema", () => {
  it("refuses an empty key", () => {
    expect(() => IconKeyInputSchema.parse({ key: "" })).toThrow();
  });
});

describe("sanitizeIconFilename", () => {
  it("keeps a name that is already one", () => {
    expect(sanitizeIconFilename("chevron-down.svg")).toBe("chevron-down.svg");
  });

  it("drops any path in front of it", () => {
    expect(sanitizeIconFilename("/Users/me/Icons/check.svg")).toBe("check.svg");
    expect(sanitizeIconFilename("C:\\icons\\check.svg")).toBe("check.svg");
  });

  it("replaces what an object key should not carry", () => {
    expect(sanitizeIconFilename("arrow up right.svg")).toBe("arrow-up-right.svg");
    expect(sanitizeIconFilename("caf<>é.svg")).toBe("caf-.svg");
  });

  it("gives it the extension it will be stored as", () => {
    expect(sanitizeIconFilename("check")).toBe("check.svg");
    expect(sanitizeIconFilename("check.png")).toBe("check.png.svg");
  });

  it("never answers with nothing", () => {
    expect(sanitizeIconFilename("")).toBe("icon.svg");
    expect(sanitizeIconFilename("///")).toBe("icon.svg");
  });
});

describe("iconNameFromKey", () => {
  it("takes the name back off a stamped key", () => {
    expect(iconNameFromKey(ASSET.key)).toBe("check.svg");
  });

  it("leaves a key that was never stamped alone", () => {
    expect(iconNameFromKey("icons/check.svg")).toBe("check.svg");
  });
});

describe("reviewForUpload", () => {
  it("publishes a stroked icon on the spot", () => {
    expect(reviewForUpload(false)).toBe("approved");
  });

  it("holds a flattened one back until it has been looked at", () => {
    expect(reviewForUpload(true)).toBe("held");
  });
});

describe("iconLabelFor", () => {
  it("drops the extension every icon in the set shares", () => {
    expect(iconLabelFor("chevron-down.svg")).toBe("chevron-down");
    expect(iconLabelFor("Check.SVG")).toBe("Check");
  });

  it("leaves the rest of the name exactly as it was stored", () => {
    // Not prettified: the label names the FILE, and a tooltip reading
    // "chevron down" over a file called `chevron-down.svg` is a small lie
    // about what a download will be called.
    expect(iconLabelFor("arrow-up-right.svg")).toBe("arrow-up-right");
  });

  it("leaves a name that never had one", () => {
    expect(iconLabelFor("check")).toBe("check");
  });

  it("only takes it off the END", () => {
    expect(iconLabelFor("svg-file.svg")).toBe("svg-file");
  });
});

describe("downloadNameFor", () => {
  it("says the settings the file was baked at", () => {
    expect(downloadNameFor("check.svg", { size: 24, stroke: 1.5 })).toBe(
      "check-24-1.5.svg",
    );
    expect(downloadNameFor("check.svg", { size: 20, stroke: 1.25 })).toBe(
      "check-20-1.25.svg",
    );
  });

  it("works from a name with no extension", () => {
    expect(downloadNameFor("check", { size: 16, stroke: 1 })).toBe("check-16-1.svg");
  });
});

describe("matchesIconName", () => {
  it("matches everything on an empty query", () => {
    expect(matchesIconName("check.svg", "")).toBe(true);
    expect(matchesIconName("check.svg", "   ")).toBe(true);
  });

  it("matches any part of the name, in any case", () => {
    expect(matchesIconName("chevron-down.svg", "chev")).toBe(true);
    expect(matchesIconName("chevron-down.svg", "DOWN")).toBe(true);
    expect(matchesIconName("chevron-down.svg", "ron-do")).toBe(true);
  });

  it("does not match what is not there", () => {
    expect(matchesIconName("chevron-down.svg", "arrow")).toBe(false);
  });

  it("ignores the extension, which every icon shares", () => {
    // Every name ends `.svg`, so a query of "svg" that matched everything
    // would be a search box that never narrows anything.
    expect(matchesIconName("check.svg", "svg")).toBe(false);
  });

  it("takes a separator or a space for either", () => {
    expect(matchesIconName("chevron-down.svg", "chevron down")).toBe(true);
    expect(matchesIconName("arrow up right.svg", "arrow-up")).toBe(true);
  });

  it("takes several terms in any order", () => {
    expect(matchesIconName("chevron-down.svg", "down chevron")).toBe(true);
    expect(matchesIconName("chevron-down.svg", "chevron up")).toBe(false);
  });
});

describe("the settings the grid opens on", () => {
  it("opens on the middle of each scale — the set's own size and weight", () => {
    expect(DEFAULT_ICON_SETTINGS.size).toBe(20);
    expect(DEFAULT_ICON_SETTINGS.stroke).toBe(1.25);
    // True size, which is what the grid is for; the zoom is opt-in.
    expect(DEFAULT_ICON_SETTINGS.zoom).toBe(1);
  });

  it("steps evenly, so all three scales can be sliders", () => {
    // Even steps are what lets each be a real scale rather than a segmented
    // control dressed as one: 4px, 0.25px and half a multiple of true size,
    // the whole way along. The house pairings still fall on stops (16 at 1,
    // 20 at 1.25, 24 at 1.5), they are simply no longer the only ones.
    expect(ICON_SIZES).toEqual([
      16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64,
    ]);
    expect(ICON_STROKES).toEqual([
      0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5,
    ]);
    expect(ICON_ZOOMS).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4]);

    for (const scale of [ICON_SIZES, ICON_STROKES, ICON_ZOOMS]) {
      const step = scale[1] - scale[0];
      for (let i = 1; i < scale.length; i += 1) {
        expect(Number((scale[i] - scale[i - 1]).toFixed(4))).toBe(step);
      }
    }
  });
});

describe("an icon's name and the words it answers to", () => {
  it("titles a filename by dropping the hyphens it was stored with", () => {
    expect(iconTitleFrom("chevron-down.svg")).toBe("Chevron Down");
    expect(iconTitleFrom("font-weight-600.svg")).toBe("Font Weight 600");
    expect(iconTitleFrom("ratio-16-9.svg")).toBe("Ratio 16 9");
  });

  it("leaves a word's own spelling alone past its first letter", () => {
    // Only the first letter is decided here. A file that arrived camelCased
    // knows its own shape better than a rule about hyphens does.
    expect(iconTitleFrom("myIcon.svg")).toBe("MyIcon");
    expect(iconTitleFrom("QR-code.svg")).toBe("QR Code");
  });

  it("survives a name with nothing to title", () => {
    expect(iconTitleFrom(".svg")).toBe("");
    expect(iconTitleFrom("---.svg")).toBe("");
  });

  it("finds an icon by its filename, its name, or any alias", () => {
    const icon = {
      name: "chevron-down.svg",
      title: "Chevron Down",
      aliases: ["Arrow", "Caret", "Expand more"],
    };

    expect(matchesIcon(icon, "chevron")).toBe(true);
    expect(matchesIcon(icon, "Chevron Down")).toBe(true);
    expect(matchesIcon(icon, "caret")).toBe(true);
    // Part of an alias, as with a name: the box filters while you type.
    expect(matchesIcon(icon, "exp")).toBe(true);
    // Terms may come from different aliases — they are one bag of words.
    expect(matchesIcon(icon, "arrow caret")).toBe(true);
    expect(matchesIcon(icon, "sparkle")).toBe(false);
    // An empty box means the set, not nothing.
    expect(matchesIcon(icon, "  ")).toBe(true);
  });

  it("keeps an alias list to one of each, in the spelling first given", () => {
    // The same word twice on ONE icon says nothing the first one did not.
    // Two different icons sharing an alias is the whole point of aliases,
    // and nothing here touches that.
    expect(cleanIconAliases([" Arrow ", "arrow", "ARROW", "Caret"])).toEqual([
      "Arrow",
      "Caret",
    ]);
  });

  it("drops the empties a half-filled row leaves behind", () => {
    expect(cleanIconAliases(["Arrow", "", "   ", "Caret"])).toEqual([
      "Arrow",
      "Caret",
    ]);
  });
});
