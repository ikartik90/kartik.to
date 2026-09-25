import { afterAll, afterEach, describe, it, expect, vi } from "vitest";
import {
  BACKGROUND_EFFECT_MAX_COLORS,
  BlockNodeSchema,
  ButtonLinkHrefSchema,
  MarkSchema,
  ButtonLinkNodeSchema,
  BackgroundEffectSchema,
  CollectionItemSchema,
  CollectionNodeSchema,
  DEFAULT_BACKGROUND_EFFECT,
  DEFAULT_MEDIA_FIT,
  MediaNodeSchema,
  MEDIA_PADDING_MAX,
  MEDIA_PADDING_REFERENCE,
  MEDIA_PADDING_STEP,
  MEDIA_RADIUS_MAX,
  MEDIA_RADIUS_STEP,
  DEFAULT_MEDIA_RADIUS,
  hasMediaLayout,
  mediaBoxStyle,
  mediaFrameStyle,
  mediaContainerWidth,
  mediaHeightBudgetFactor,
  mediaInsetPx,
  mediaObjectStyle,
  mediaPictureShare,
  mediaRadiusPx,
  mediaReservedAspect,
  mediaReservationStyle,
  MEDIA_PLACEHOLDER_ASPECT,
} from "../nodes";

describe("BackgroundEffectSchema", () => {
  it("fills every parameter from the defaults, so `{}` is a valid effect", () => {
    expect(BackgroundEffectSchema.parse({})).toEqual(DEFAULT_BACKGROUND_EFFECT);
  });

  it("keeps the two brand colours as the starting gradient", () => {
    expect(DEFAULT_BACKGROUND_EFFECT.colors).toEqual(["#FFAB6FFF", "#FF4D97FF"]);
  });

  it("accepts a full parameter set unchanged", () => {
    const effect = {
      ...DEFAULT_BACKGROUND_EFFECT,
      colors: ["#000000FF", "#FFFFFF80"],
      positions: 42,
      waveX: 0.25,
      rotation: 180,
      offsetX: -0.5,
    };
    expect(BackgroundEffectSchema.parse(effect)).toEqual(effect);
  });

  it("rejects a wave outside 0-1", () => {
    expect(() => BackgroundEffectSchema.parse({ waveX: 1.5 })).toThrow();
    expect(() => BackgroundEffectSchema.parse({ waveY: -0.1 })).toThrow();
  });

  it("takes a rotation anywhere in the signed range", () => {
    for (const rotation of [-180, -90, 0, 90, 180]) {
      expect(BackgroundEffectSchema.parse({ rotation }).rotation).toBe(rotation);
    }
  });

  it("carries a rotation saved under the old 0-360 range across", () => {
    expect(BackgroundEffectSchema.parse({ rotation: 270 }).rotation).toBe(-90);
    expect(BackgroundEffectSchema.parse({ rotation: 360 }).rotation).toBe(0);
  });

  it("wraps a rotation past the end of the range rather than refusing it", () => {
    expect(BackgroundEffectSchema.parse({ rotation: 400 }).rotation).toBe(40);
  });

  it("still rejects a rotation that is not a number", () => {
    expect(() => BackgroundEffectSchema.parse({ rotation: "sideways" })).toThrow();
  });

  it("opens on the turn it has always had, in the new notation", () => {
    expect(DEFAULT_BACKGROUND_EFFECT.rotation).toBe(-90);
  });

  it("rejects an offset outside -1..1", () => {
    expect(() => BackgroundEffectSchema.parse({ offsetY: 2 })).toThrow();
  });

  it("rejects a scale outside the shader's own 0.01-4", () => {
    expect(() => BackgroundEffectSchema.parse({ scale: 0 })).toThrow();
    expect(() => BackgroundEffectSchema.parse({ scale: 5 })).toThrow();
  });

  it("rejects a colour list past the shader's ten-colour ceiling", () => {
    const colors = Array.from({ length: BACKGROUND_EFFECT_MAX_COLORS + 1 }, () => "#000000FF");
    expect(() => BackgroundEffectSchema.parse({ colors })).toThrow();
  });

  it("rejects an empty colour list — a gradient needs something to blend", () => {
    expect(() => BackgroundEffectSchema.parse({ colors: [] })).toThrow();
  });

  it("rejects a colour that is not 8-digit hex", () => {
    expect(() => BackgroundEffectSchema.parse({ colors: ["red"] })).toThrow();
    expect(() => BackgroundEffectSchema.parse({ colors: ["#FFAB6F"] })).toThrow();
  });
});

describe("background effect on media nodes", () => {
  it("is optional — a media node without one still parses", () => {
    expect(
      MediaNodeSchema.parse({ type: "media", kind: "image", src: "/a.png" })
        .backgroundEffect,
    ).toBeUndefined();
  });

  it("rides along on collection items, which ARE media nodes", () => {
    const item = CollectionItemSchema.parse({
      src: "/a.png",
      backgroundEffect: {},
    });
    expect(item.backgroundEffect).toEqual(DEFAULT_BACKGROUND_EFFECT);
  });
});

describe("media layout on media nodes", () => {
  it("leaves both properties absent on a node that never set them", () => {
    const node = MediaNodeSchema.parse({
      type: "media",
      kind: "image",
      src: "/a.png",
    });
    expect(node.objectFit).toBeUndefined();
    expect(node.padding).toBeUndefined();
  });

  it("accepts the two fits the segmented control offers, and nothing else", () => {
    expect(
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        objectFit: "contain",
      }).objectFit,
    ).toBe("contain");
    expect(
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        objectFit: "cover",
      }).objectFit,
    ).toBe("cover");
    expect(() =>
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        objectFit: "fill",
      }),
    ).toThrow();
  });

  it("holds padding to the slider's own grid — multiples of the step, within range", () => {
    expect(
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        padding: 0,
      }).padding,
    ).toBe(0);
    expect(
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        padding: MEDIA_PADDING_MAX,
      }).padding,
    ).toBe(MEDIA_PADDING_MAX);
    expect(() =>
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        padding: 5,
      }),
    ).toThrow();
    expect(() =>
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        padding: -8,
      }),
    ).toThrow();
    expect(() =>
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        padding: MEDIA_PADDING_MAX + MEDIA_PADDING_STEP,
      }),
    ).toThrow();
  });

  it("rides along on collection items, like the background effect does", () => {
    const item = CollectionItemSchema.parse({
      src: "/a.png",
      objectFit: "contain",
      padding: 16,
    });
    expect(item).toMatchObject({ objectFit: "contain", padding: 16 });
  });
});

describe("mediaFrameStyle / mediaObjectStyle", () => {
  it("costs an untouched picture no BOXES — both collapse out of the layout", () => {
    expect(mediaFrameStyle({})).toEqual({ display: "contents" });
    expect(mediaBoxStyle({})).toEqual({ display: "contents" });
  });

  it("states the corner even for an untouched picture, so no surface can supply one", () => {
    expect(mediaObjectStyle({})).toEqual({
      objectFit: DEFAULT_MEDIA_FIT,
      borderRadius: DEFAULT_MEDIA_RADIUS,
    });
    expect(DEFAULT_MEDIA_RADIUS).toBe(0);
  });

  it("reads absent and zero as the same square corner", () => {
    expect(mediaObjectStyle({ borderRadius: 0 })).toEqual(mediaObjectStyle({}));
  });

  it("wants no boxes for a square, uninset picture", () => {
    expect(hasMediaLayout({})).toBe(false);
    expect(hasMediaLayout({ borderRadius: 0 })).toBe(false);
    expect(hasMediaLayout({ borderRadius: 2 })).toBe(true);
    expect(hasMediaLayout({ padding: 8 })).toBe(true);
  });

  it("styles the object alone, never the surface or the ground behind it", () => {
    const media = { borderRadius: 20, padding: 32 };
    expect(Object.keys(mediaFrameStyle(media))).not.toContain("borderRadius");
    expect(Object.keys(mediaBoxStyle(media))).not.toContain("borderRadius");
    expect(mediaObjectStyle(media).borderRadius).toBe("3.125cqw");
  });

  it("declares the frame a query container and keeps the inset off it", () => {
    const media = { padding: 32, borderRadius: 12 };
    expect(mediaFrameStyle(media).containerType).toBe("inline-size");
    expect(mediaFrameStyle(media).display).toBe("block");
    expect("padding" in mediaFrameStyle(media)).toBe(false);
    expect(mediaBoxStyle(media).padding).toBe("5%");
  });

  it("claims a query container only for a corner, never merely for an inset", () => {
    expect(mediaFrameStyle({ padding: 32 })).toEqual({ display: "contents" });
    expect(mediaFrameStyle({ borderRadius: 0, padding: 32 })).toEqual({
      display: "contents",
    });
    expect(mediaFrameStyle({ borderRadius: 12 }).containerType).toBe("inline-size");
    expect(mediaBoxStyle({ padding: 32 }).padding).toBe("5%");
  });

  it("expresses padding as a share of the reference container, not as pixels", () => {
    expect(mediaBoxStyle({ padding: MEDIA_PADDING_REFERENCE }).padding).toBe("100%");
    // 32 of 640 — which is 32px in a 640 container and 16px in a 320 one.
    expect(mediaBoxStyle({ padding: 32 }).padding).toBe("5%");
    expect(mediaBoxStyle({ padding: 64 }).padding).toBe("10%");
  });

  it("keeps the inset on the box and the corner on the object", () => {
    const media = { padding: 32, borderRadius: 12 };
    expect(mediaBoxStyle(media).padding).toBe("5%");
    expect("borderRadius" in mediaBoxStyle(media)).toBe(false);
    expect(mediaObjectStyle(media).borderRadius).toBeDefined();
    expect("padding" in mediaObjectStyle(media)).toBe(false);
  });

  it("scales the corner with the container, in width-relative units", () => {
    expect(mediaObjectStyle({ borderRadius: MEDIA_PADDING_REFERENCE }).borderRadius)
      .toBe("100cqw");
    // 20 of 640 — 20px at the reference width, 10px at half of it.
    expect(mediaObjectStyle({ borderRadius: 20 }).borderRadius).toBe("3.125cqw");
  });

  it("writes a square corner as a plain zero, which needs no container", () => {
    expect(mediaObjectStyle({ borderRadius: 0 }).borderRadius).toBe(0);
  });

  it("resolves the corner in pixels against whatever width it is handed", () => {
    expect(mediaRadiusPx({ borderRadius: 20 }, MEDIA_PADDING_REFERENCE * 2)).toBe(40);
    expect(mediaRadiusPx({ borderRadius: 20 }, MEDIA_PADDING_REFERENCE / 2)).toBe(10);
    expect(mediaRadiusPx({ borderRadius: 20 }, 1280)).toBe(
      (parseFloat(mediaObjectStyle({ borderRadius: 20 }).borderRadius as string) /
        100) *
        1280,
    );
  });

  it("falls back to the authored pixels when no width is known", () => {
    expect(mediaRadiusPx({ borderRadius: 20 })).toBe(20);
    expect(mediaRadiusPx({ borderRadius: 20 }, MEDIA_PADDING_REFERENCE)).toBe(20);
    expect(mediaRadiusPx({})).toBe(DEFAULT_MEDIA_RADIUS);
  });

  it("resolves the inset in pixels against whatever width it is handed", () => {
    expect(mediaInsetPx({ padding: 40 }, MEDIA_PADDING_REFERENCE * 2)).toBe(80);
    expect(mediaInsetPx({ padding: 40 }, MEDIA_PADDING_REFERENCE / 2)).toBe(20);
    expect(mediaInsetPx({ padding: 40 }, 1280)).toBe(
      (parseFloat(mediaBoxStyle({ padding: 40 }).padding as string) / 100) *
        1280,
    );
  });

  it("falls back to the authored inset when no width is known", () => {
    expect(mediaInsetPx({ padding: 40 })).toBe(40);
    expect(mediaInsetPx({})).toBe(0);
  });

  it("reports the share of the box the picture itself takes", () => {
    expect(mediaPictureShare({})).toBe(1);
    // 40 of 640 a side, so the picture is 640 − 80 of it.
    expect(mediaPictureShare({ padding: 40 })).toBe(0.875);
    expect(mediaPictureShare({ padding: MEDIA_PADDING_MAX })).toBe(0.75);
  });

  it("takes the height budget through the shape of the picture", () => {
    expect(mediaHeightBudgetFactor({}, 1.778)).toBe(1);
    expect(mediaHeightBudgetFactor({ padding: 40 }, 1)).toBeCloseTo(
      1 / mediaPictureShare({ padding: 40 }),
      10,
    );
    expect(mediaHeightBudgetFactor({ padding: 40 }, 16 / 9)).toBeGreaterThan(
      mediaHeightBudgetFactor({ padding: 40 }, 1),
    );
    expect(mediaHeightBudgetFactor({ padding: 40 }, 9 / 16)).toBeLessThan(
      mediaHeightBudgetFactor({ padding: 40 }, 1),
    );
  });

  it("spends the whole height budget and no more", () => {
    const media = { padding: MEDIA_PADDING_MAX };
    for (const aspect of [16 / 9, 1, 9 / 16, 3]) {
      const budget = 800;
      const height = budget / mediaHeightBudgetFactor(media, aspect);
      const box = mediaContainerWidth(media, height * aspect);
      expect(height + 2 * mediaInsetPx(media, box)).toBeCloseTo(budget, 10);
    }
  });

  it("recovers the container width an enlarged picture implies", () => {
    expect(mediaContainerWidth({}, 640)).toBe(640);
    // A 560px picture with a 40px-per-640 band: 560 / 0.875.
    expect(mediaContainerWidth({ padding: 40 }, 560)).toBe(640);

    const media = { padding: MEDIA_PADDING_MAX };
    const box = mediaContainerWidth(media, 1200);
    expect(1200 + 2 * mediaInsetPx(media, box)).toBeCloseTo(box, 10);
  });

  it("sizes a laid-out `contain` object to its content, so the corner rounds the picture", () => {
    expect(mediaObjectStyle({ objectFit: "contain", padding: 32 })).toMatchObject({
      objectFit: "contain",
      width: "auto",
      height: "auto",
      maxWidth: "100%",
      maxHeight: "100%",
    });
  });

  it("lets a `cover` object fill its frame, which it can", () => {
    const style = mediaObjectStyle({ objectFit: "cover", padding: 32 });
    expect(style.objectFit).toBe("cover");
    expect("width" in style).toBe(false);
  });

  it("adds no sizing to an untouched `contain` picture", () => {
    const style = mediaObjectStyle({ objectFit: "contain" });
    expect(style.objectFit).toBe("contain");
    expect("width" in style).toBe(false);
    expect("maxWidth" in style).toBe(false);
  });
});

describe("border radius on media nodes", () => {
  it("holds the corner to the slider's grid — multiples of the step, within range", () => {
    expect(
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        borderRadius: 0,
      }).borderRadius,
    ).toBe(0);
    expect(
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        borderRadius: MEDIA_RADIUS_MAX,
      }).borderRadius,
    ).toBe(MEDIA_RADIUS_MAX);
    expect(() =>
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        borderRadius: 3,
      }),
    ).toThrow();
    expect(() =>
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        borderRadius: -2,
      }),
    ).toThrow();
    expect(() =>
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        borderRadius: MEDIA_RADIUS_MAX + MEDIA_RADIUS_STEP,
      }),
    ).toThrow();
  });
});

describe("MediaNodeSchema", () => {
  it("holds a picture and a clip under one block identity", () => {
    expect(
      MediaNodeSchema.parse({ type: "media", kind: "image", src: "/a.png" })
        .type,
    ).toBe("media");
    expect(
      MediaNodeSchema.parse({ type: "media", kind: "video", src: "/a.mp4" })
        .type,
    ).toBe("media");
  });

  it("takes every field on the clip arm that it takes on the picture arm", () => {
    const node = MediaNodeSchema.parse({
      type: "media",
      kind: "video",
      src: "/demo.mp4",
      alt: "A demo",
      caption: "The flow, end to end",
      objectFit: "contain",
      padding: MEDIA_PADDING_STEP,
      borderRadius: MEDIA_RADIUS_STEP,
      backgroundEffect: {},
    });
    expect(node).toMatchObject({
      type: "media",
      kind: "video",
      src: "/demo.mp4",
      alt: "A demo",
      caption: "The flow, end to end",
      objectFit: "contain",
      padding: MEDIA_PADDING_STEP,
      borderRadius: MEDIA_RADIUS_STEP,
    });
    expect(node.backgroundEffect).toEqual(DEFAULT_BACKGROUND_EFFECT);
  });

  it("holds the clip arm to the same bounds, so the panel edits one thing", () => {
    expect(() =>
      MediaNodeSchema.parse({
        type: "media",
        kind: "video",
        src: "/a.mp4",
        padding: 5,
      }),
    ).toThrow();
    expect(() =>
      MediaNodeSchema.parse({
        type: "media",
        kind: "video",
        src: "/a.mp4",
        objectFit: "fill",
      }),
    ).toThrow();
  });

  it("routes on the declared kind, not on the filename", () => {
    expect(
      MediaNodeSchema.parse({ type: "media", kind: "video", src: "/clip" })
        .kind,
    ).toBe("video");
    expect(
      MediaNodeSchema.parse({ type: "media", kind: "image", src: "/still.mp4" })
        .kind,
    ).toBe("image");
  });

  it("takes neither a third kind nor a missing one", () => {
    expect(() =>
      MediaNodeSchema.parse({ type: "media", kind: "audio", src: "/a.mp3" }),
    ).toThrow();
    expect(() =>
      MediaNodeSchema.parse({ type: "media", src: "/a.png" }),
    ).toThrow();
  });

  it("takes no identity but `media`", () => {
    expect(() =>
      MediaNodeSchema.parse({ type: "image", kind: "image", src: "/a.png" }),
    ).toThrow();
    expect(() =>
      MediaNodeSchema.parse({ kind: "image", src: "/a.png" }),
    ).toThrow();
  });
});

describe("CollectionItemSchema (documents written before `kind`)", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  afterEach(() => warn.mockClear());
  // A spy made in a describe body lives for the whole file; restore it or `console.warn` stays swallowed.
  afterAll(() => warn.mockRestore());

  it("takes a legacy item's stray `type` as readily as its absence", () => {
    expect(CollectionItemSchema.parse({ type: "image", src: "/a.png" })).toEqual(
      { type: "media", kind: "image", src: "/a.png" },
    );
    expect(CollectionItemSchema.parse({ src: "/a.png" })).toEqual({
      type: "media",
      kind: "image",
      src: "/a.png",
    });
  });

  it("stamps a whole media node onto an item that carries no type at all", () => {
    expect(CollectionItemSchema.parse({ src: "/a.png", alt: "A" })).toEqual({
      type: "media",
      kind: "image",
      src: "/a.png",
      alt: "A",
    });
  });

  it("recovers a clip from the extension the renderer used to sniff", () => {
    expect(CollectionItemSchema.parse({ src: "/media/demo.mp4" }).kind).toBe(
      "video",
    );
  });

  it("calls a source it cannot name a picture, never a clip", () => {
    for (const src of ["/media/8f2c-key", "/a.svg", "/v1.2/shot"]) {
      expect(CollectionItemSchema.parse({ src }).kind).toBe("image");
    }
  });

  it("derives a legacy block's kind from the src, never from its `type`", () => {
    expect(
      CollectionItemSchema.parse({ type: "image", src: "/media/demo.mp4" }),
    ).toEqual({ type: "media", kind: "video", src: "/media/demo.mp4" });
    expect(
      CollectionItemSchema.parse({ type: "image", src: "/a.png" }).kind,
    ).toBe("image");
  });

  it("never overrules a kind the item already states", () => {
    expect(
      CollectionItemSchema.parse({
        type: "media",
        kind: "image",
        src: "/still.mp4",
      }).kind,
    ).toBe("image");
    expect(
      CollectionItemSchema.parse({ type: "media", kind: "video", src: "/clip" })
        .kind,
    ).toBe("video");
  });

  it("leaves everything the author applied to the slot untouched", () => {
    expect(
      CollectionItemSchema.parse({
        src: "/a.png",
        caption: "A caption",
        objectFit: "contain",
        padding: MEDIA_PADDING_STEP,
      }),
    ).toMatchObject({
      type: "media",
      kind: "image",
      caption: "A caption",
      objectFit: "contain",
      padding: MEDIA_PADDING_STEP,
    });
  });

  it("still rejects an item the schema would have rejected anyway", () => {
    expect(() =>
      CollectionItemSchema.parse({ src: "/a.png", padding: 5 }),
    ).toThrow();
    expect(() => CollectionItemSchema.parse({ alt: "no source" })).toThrow();
  });

  it("backfills every slot of a whole legacy collection block", () => {
    const node = CollectionNodeSchema.parse({
      type: "collection",
      items: [{ src: "/a.png" }, { src: "/demo.mp4" }],
    });
    expect(node.items.map((item) => item.kind)).toEqual(["image", "video"]);
  });

  it("says what it stamped, and on what evidence", () => {
    CollectionItemSchema.parse({ src: "/media/demo.mp4" });
    expect(warn.mock.calls[0][0]).toContain("/media/demo.mp4");
    expect(warn.mock.calls[0][0]).toContain("video");
    expect(warn.mock.calls[0][0]).toContain("mp4");

    warn.mockClear();
    CollectionItemSchema.parse({ src: "/media/8f2c-key" });
    expect(warn.mock.calls[0][0]).toContain("/media/8f2c-key");
    expect(warn.mock.calls[0][0]).toContain("image");
    expect(warn.mock.calls[0][0]).toMatch(/no extension/i);
  });

  it("stays quiet for an item that already states its kind", () => {
    CollectionItemSchema.parse({ type: "media", kind: "video", src: "/clip" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps the audit trail out of production", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const item = CollectionItemSchema.parse({ src: "/media/demo.mp4" });
      expect(item.kind).toBe("video");
      expect(warn).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("intrinsic dimensions on media nodes", () => {
  it("leaves both absent on a node written before they were recorded", () => {
    const node = MediaNodeSchema.parse({
      type: "media",
      kind: "image",
      src: "/a.png",
    });
    expect(node.width).toBeUndefined();
    expect(node.height).toBeUndefined();
  });

  it("stores the source's own pixel size, on either arm", () => {
    expect(
      MediaNodeSchema.parse({
        type: "media",
        kind: "image",
        src: "/a.png",
        width: 1600,
        height: 900,
      }),
    ).toMatchObject({ width: 1600, height: 900 });
    expect(
      MediaNodeSchema.parse({
        type: "media",
        kind: "video",
        src: "/a.mp4",
        width: 1280,
        height: 720,
      }),
    ).toMatchObject({ width: 1280, height: 720 });
  });

  it("refuses a dimension no picture could have", () => {
    for (const size of [0, -4, 12.5]) {
      expect(() =>
        MediaNodeSchema.parse({
          type: "media",
          kind: "image",
          src: "/a.png",
          width: size,
          height: 100,
        }),
      ).toThrow();
    }
  });
});

describe("mediaReservedAspect", () => {
  it("reserves the picture's own shape once the document knows it", () => {
    expect(mediaReservedAspect({ width: 1600, height: 900 })).toBe("1600 / 900");
  });

  it("falls back to the house ratio when either dimension is missing", () => {
    expect(mediaReservedAspect({})).toBe(MEDIA_PLACEHOLDER_ASPECT);
    expect(mediaReservedAspect({ width: 1600 })).toBe(MEDIA_PLACEHOLDER_ASPECT);
    expect(mediaReservedAspect({ height: 900 })).toBe(MEDIA_PLACEHOLDER_ASPECT);
  });
});

describe("mediaReservationStyle", () => {
  it("is the ratio alone wherever the box gives the picture its width", () => {
    expect(mediaReservationStyle({ width: 1600, height: 900 })).toEqual({
      aspectRatio: "1600 / 900",
    });
    expect(mediaReservationStyle({}, { objectFit: "cover", padding: MEDIA_PADDING_STEP })).toEqual({
      aspectRatio: MEDIA_PLACEHOLDER_ASPECT,
    });
  });

  it("gives a sized-to-content picture a width to apply the ratio to", () => {
    expect(
      mediaReservationStyle({}, { objectFit: "contain", padding: MEDIA_PADDING_STEP }),
    ).toEqual({
      aspectRatio: MEDIA_PLACEHOLDER_ASPECT,
      width: "100%",
      height: "auto",
    });
  });

  it("leaves a `contain` picture with no frame around it alone", () => {
    expect(mediaReservationStyle({}, { objectFit: "contain" })).toEqual({
      aspectRatio: MEDIA_PLACEHOLDER_ASPECT,
    });
  });
});

describe("a clip's poster", () => {
  const clip = (node: Record<string, unknown>) => {
    const parsed = MediaNodeSchema.parse(node);
    if (parsed.kind !== "video") throw new Error("not a clip");
    return parsed;
  };

  it("is the frame a clip shows before it plays", () => {
    expect(
      clip({
        type: "media",
        kind: "video",
        src: "/a.mp4",
        poster: "https://cdn.example.com/posters/a.jpg",
      }).poster,
    ).toBe("https://cdn.example.com/posters/a.jpg");
  });

  it("is absent on a clip uploaded before there was one to take", () => {
    expect(
      clip({ type: "media", kind: "video", src: "/a.mp4" }).poster,
    ).toBeUndefined();
  });

  it("is not a thing a picture has", () => {
    const picture = MediaNodeSchema.parse({
      type: "media",
      kind: "image",
      src: "/a.png",
      poster: "https://cdn.example.com/posters/a.jpg",
    });
    expect("poster" in picture).toBe(false);
  });
});

describe("ButtonLinkNodeSchema", () => {
  it("is a label and a destination", () => {
    const node = { type: "button_link", text: "Read more", href: "/about" };
    expect(ButtonLinkNodeSchema.parse(node)).toEqual(node);
    expect(BlockNodeSchema.parse(node)).toEqual(node);
  });

  it("may be saved with neither yet", () => {
    expect(
      BlockNodeSchema.safeParse({ type: "button_link", text: "", href: "" })
        .success,
    ).toBe(true);
  });

  it("may open in a new tab, and may stay in view", () => {
    const node = {
      type: "button_link",
      text: "Go",
      href: "/",
      newTab: true,
      sticky: true,
    };
    expect(ButtonLinkNodeSchema.parse(node)).toEqual(node);
    expect(
      ButtonLinkNodeSchema.safeParse({ ...node, sticky: "yes" }).success,
    ).toBe(false);
  });

  it("may wear the accent colour, and only a colour the toolbar offers", () => {
    const node = {
      type: "button_link",
      text: "Go",
      href: "/",
      color: "accent",
    };
    expect(ButtonLinkNodeSchema.parse(node)).toEqual(node);
    expect(
      ButtonLinkNodeSchema.safeParse({ ...node, color: "pink" }).success,
    ).toBe(false);
  });

  it("needs both fields to be present", () => {
    expect(
      BlockNodeSchema.safeParse({ type: "button_link", text: "Go" }).success,
    ).toBe(false);
    expect(
      BlockNodeSchema.safeParse({ type: "button_link", href: "/" }).success,
    ).toBe(false);
  });
});

describe("link mark", () => {
  it("takes an optional new-tab flag", () => {
    const link = { type: "link", href: "https://example.com" };
    expect(MarkSchema.parse(link)).toEqual(link);
    expect(MarkSchema.parse({ ...link, newTab: true })).toEqual({
      ...link,
      newTab: true,
    });
    expect(MarkSchema.safeParse({ ...link, newTab: "yes" }).success).toBe(
      false,
    );
  });
});

describe("ButtonLinkHrefSchema", () => {
  it.each([
    "",
    "/about",
    "/work/shift#results",
    "#section",
    "?q=1",
    "https://kartik.to",
    "http://example.com/a?b=c",
    "mailto:hi@kartik.to",
    "tel:+14165550100",
  ])("accepts %s", (href) => {
    expect(ButtonLinkHrefSchema.safeParse(href).success).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "ftp://example.com",
    "example.com",
    "about me",
  ])("refuses %s", (href) => {
    expect(ButtonLinkHrefSchema.safeParse(href).success).toBe(false);
  });
});
