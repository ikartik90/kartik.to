import { afterAll, afterEach, describe, it, expect, vi } from "vitest";
import {
  BACKGROUND_EFFECT_MAX_COLORS,
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

  // Signed about zero, the same range the shader playground turns a shader
  // through — a preset authored there is reused as a background here, and one
  // picture must not be described two ways.
  it("takes a rotation anywhere in the signed range", () => {
    for (const rotation of [-180, -90, 0, 90, 180]) {
      expect(BackgroundEffectSchema.parse({ rotation }).rotation).toBe(rotation);
    }
  });

  // Every effect saved under the old 0..360 range holds an angle this range has
  // no room for, and the field ENFORCES its range rather than clamping — so
  // without the wrap a background tuned to 270° would stop parsing and take the
  // node with it. Wrapped, not clamped: 270 and -90 are the same picture.
  it("carries a rotation saved under the old 0-360 range across", () => {
    expect(BackgroundEffectSchema.parse({ rotation: 270 }).rotation).toBe(-90);
    expect(BackgroundEffectSchema.parse({ rotation: 360 }).rotation).toBe(0);
  });

  // An angle is MODULAR, unlike every other control here, so a value past the
  // end is wrapped rather than refused — 400° names the same picture as 40°.
  // The waves and offsets above have no such reading and are still rejected.
  it("wraps a rotation past the end of the range rather than refusing it", () => {
    expect(BackgroundEffectSchema.parse({ rotation: 400 }).rotation).toBe(40);
  });

  it("still rejects a rotation that is not a number", () => {
    expect(() => BackgroundEffectSchema.parse({ rotation: "sideways" })).toThrow();
  });

  // What a freshly enabled effect opens on: the three-quarter turn it has
  // always had, written the way the signed range reads it.
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
    // Off the 8px grid, below the floor, and past the ceiling.
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

  // The corner is the one thing an untouched picture still states, because
  // stating nothing is what let a surface's own class round it — the panel then
  // read 0 over a picture drawn with a 20px corner. Absent IS zero here, and
  // zero is written down.
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

  // Nothing to inset and nothing to round means no frame is needed — a zero
  // corner needs no query container to be zero.
  it("wants no boxes for a square, uninset picture", () => {
    expect(hasMediaLayout({})).toBe(false);
    expect(hasMediaLayout({ borderRadius: 0 })).toBe(false);
    expect(hasMediaLayout({ borderRadius: 2 })).toBe(true);
    expect(hasMediaLayout({ padding: 8 })).toBe(true);
  });

  // The corner is the media OBJECT's and stops there. The surfaces showing it
  // — the collection cell, the lightbox card — carry `radii.xxl` from their own
  // recipes, so nothing here may hand a container a corner derived from the
  // picture inside it.
  it("styles the object alone, never the surface or the ground behind it", () => {
    const media = { borderRadius: 20, padding: 32 };
    expect(Object.keys(mediaFrameStyle(media))).not.toContain("borderRadius");
    expect(Object.keys(mediaBoxStyle(media))).not.toContain("borderRadius");
    expect(mediaObjectStyle(media).borderRadius).toBe("3.125cqw");
  });

  // The frame is the box the corner is a share of, so it must span the FULL
  // width — which is exactly why the inset is not on it.
  it("declares the frame a query container and keeps the inset off it", () => {
    const media = { padding: 32, borderRadius: 12 };
    expect(mediaFrameStyle(media).containerType).toBe("inline-size");
    // A non-atomic inline box cannot be a container, so the frame must state a
    // display. Without it `container-type` is ignored and the corner silently
    // resolves against the viewport instead — a wrong number, not an error.
    expect(mediaFrameStyle(media).display).toBe("block");
    expect("padding" in mediaFrameStyle(media)).toBe(false);
    expect(mediaBoxStyle(media).padding).toBe("5%");
  });

  // A container may not take its inline size from its contents, so a surface
  // that shrink-wraps its picture — the lightbox's frame — collapses to zero
  // around one, and the picture goes off the screen with it. Only a corner
  // needs measuring; an inset is a percentage of the containing block and needs
  // no container at all.
  it("claims a query container only for a corner, never merely for an inset", () => {
    expect(mediaFrameStyle({ padding: 32 })).toEqual({ display: "contents" });
    expect(mediaFrameStyle({ borderRadius: 0, padding: 32 })).toEqual({
      display: "contents",
    });
    expect(mediaFrameStyle({ borderRadius: 12 }).containerType).toBe("inline-size");
    // The inset still applies — it just no longer drags a container in with it.
    expect(mediaBoxStyle({ padding: 32 }).padding).toBe("5%");
  });

  // The authored number is px AT THE REFERENCE WIDTH; a percentage is what
  // makes it track the container, since percentage padding resolves against
  // the containing block's inline size.
  it("expresses padding as a share of the reference container, not as pixels", () => {
    expect(mediaBoxStyle({ padding: MEDIA_PADDING_REFERENCE }).padding).toBe("100%");
    // 32 of 640 — which is 32px in a 640 container and 16px in a 320 one.
    expect(mediaBoxStyle({ padding: 32 }).padding).toBe("5%");
    expect(mediaBoxStyle({ padding: 64 }).padding).toBe("10%");
  });

  // The whole reason the two are split: a corner clips the BORDER box while the
  // picture renders in the CONTENT box, so an inset on the same element would
  // round empty space and leave the picture square.
  it("keeps the inset on the box and the corner on the object", () => {
    const media = { padding: 32, borderRadius: 12 };
    expect(mediaBoxStyle(media).padding).toBe("5%");
    expect("borderRadius" in mediaBoxStyle(media)).toBe(false);
    expect(mediaObjectStyle(media).borderRadius).toBeDefined();
    expect("padding" in mediaObjectStyle(media)).toBe(false);
  });

  // Scaled by the same reference as the inset, so a composition authored once
  // reproduces at any size instead of looking rounder the smaller it gets.
  it("scales the corner with the container, in width-relative units", () => {
    // `cqw`, never a percentage: percentage border-radius resolves per axis and
    // would draw an ellipse on any photo that is not square.
    expect(mediaObjectStyle({ borderRadius: MEDIA_PADDING_REFERENCE }).borderRadius)
      .toBe("100cqw");
    // 20 of 640 — 20px at the reference width, 10px at half of it.
    expect(mediaObjectStyle({ borderRadius: 20 }).borderRadius).toBe("3.125cqw");
  });

  // A zero corner is the one value NOT expressed in `cqw`. `0cqw` is also zero,
  // but only where a container exists to measure it — and a square picture is
  // exactly the case that renders with no frame around it at all. A plain zero
  // means the same thing everywhere, the drag clone parented to <body>
  // included.
  it("writes a square corner as a plain zero, which needs no container", () => {
    expect(mediaObjectStyle({ borderRadius: 0 }).borderRadius).toBe(0);
  });

  // For the one surface that cannot be a query container at all: the lightbox
  // frame shrink-wraps its picture, so it has no width of its own to be a share
  // of and the caller has to measure what the picture actually came out at.
  it("resolves the corner in pixels against whatever width it is handed", () => {
    // Enlarged past the reference, the corner grows with the picture — the
    // whole point of a composition that reproduces at any size.
    expect(mediaRadiusPx({ borderRadius: 20 }, MEDIA_PADDING_REFERENCE * 2)).toBe(40);
    expect(mediaRadiusPx({ borderRadius: 20 }, MEDIA_PADDING_REFERENCE / 2)).toBe(10);
    // The same share the `cqw` corner draws — one rule, two units.
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

  // The inset is the OTHER half of that arithmetic, and the same surface needs
  // it: an enlargement whose band stays the number it was authored as is a
  // composition drawn at one size and shown at another.
  it("resolves the inset in pixels against whatever width it is handed", () => {
    expect(mediaInsetPx({ padding: 40 }, MEDIA_PADDING_REFERENCE * 2)).toBe(80);
    expect(mediaInsetPx({ padding: 40 }, MEDIA_PADDING_REFERENCE / 2)).toBe(20);
    // The same share the percentage padding lays down — one rule, two units.
    expect(mediaInsetPx({ padding: 40 }, 1280)).toBe(
      (parseFloat(mediaBoxStyle({ padding: 40 }).padding as string) / 100) *
        1280,
    );
  });

  it("falls back to the authored inset when no width is known", () => {
    expect(mediaInsetPx({ padding: 40 })).toBe(40);
    expect(mediaInsetPx({})).toBe(0);
  });

  // What the picture itself is left of the box, once the band round it is
  // taken out — the factor that keeps an enlarged COMPOSITION inside the
  // viewport rather than just the picture at the heart of it.
  it("reports the share of the box the picture itself takes", () => {
    expect(mediaPictureShare({})).toBe(1);
    // 40 of 640 a side, so the picture is 640 − 80 of it.
    expect(mediaPictureShare({ padding: 40 })).toBe(0.875);
    expect(mediaPictureShare({ padding: MEDIA_PADDING_MAX })).toBe(0.75);
  });

  // The height budget is the awkward one: both bands come out of the box's
  // WIDTH, so on a wide picture they are a bigger share of the height than of
  // the width, and taking the height through the picture's share alone leaves a
  // composition taller than the screen it was supposed to fit.
  it("takes the height budget through the shape of the picture", () => {
    // Nothing to fit around, so nothing to divide by.
    expect(mediaHeightBudgetFactor({}, 1.778)).toBe(1);
    // A square picture is the case where the two axes agree, so the factor is
    // exactly the share the width cap uses.
    expect(mediaHeightBudgetFactor({ padding: 40 }, 1)).toBeCloseTo(
      1 / mediaPictureShare({ padding: 40 }),
      10,
    );
    // 16:9 needs more room than that, and a portrait needs less.
    expect(mediaHeightBudgetFactor({ padding: 40 }, 16 / 9)).toBeGreaterThan(
      mediaHeightBudgetFactor({ padding: 40 }, 1),
    );
    expect(mediaHeightBudgetFactor({ padding: 40 }, 9 / 16)).toBeLessThan(
      mediaHeightBudgetFactor({ padding: 40 }, 1),
    );
  });

  // The property that matters: picture plus both bands is exactly the budget,
  // whatever shape the picture is.
  it("spends the whole height budget and no more", () => {
    const media = { padding: MEDIA_PADDING_MAX };
    for (const aspect of [16 / 9, 1, 9 / 16, 3]) {
      const budget = 800;
      const height = budget / mediaHeightBudgetFactor(media, aspect);
      const box = mediaContainerWidth(media, height * aspect);
      expect(height + 2 * mediaInsetPx(media, box)).toBeCloseTo(budget, 10);
    }
  });

  // The measurement runs the other way round on the one surface sized BY its
  // picture: what is knowable there is how wide the picture came out, and the
  // container it implies is what both the inset and the corner are shares of.
  // Recovering it is what breaks the loop — a band derived from the box it is
  // part of would chase its own tail.
  it("recovers the container width an enlarged picture implies", () => {
    expect(mediaContainerWidth({}, 640)).toBe(640);
    // A 560px picture with a 40px-per-640 band: 560 / 0.875.
    expect(mediaContainerWidth({ padding: 40 }, 560)).toBe(640);

    // And it round-trips at any size, which is the property the lightbox needs:
    // picture + both bands is exactly the container they were measured from.
    const media = { padding: MEDIA_PADDING_MAX };
    const box = mediaContainerWidth(media, 1200);
    expect(1200 + 2 * mediaInsetPx(media, box)).toBeCloseTo(box, 10);
  });

  // A `contain` picture cannot fill its frame, so a stretched element would be
  // mostly empty box and its corner would round nothing. Sized to its own
  // content, the element IS the picture.
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

  // Untouched media keeps whatever sizing its surface's own class gives it —
  // the corner is the one thing it states regardless (see above).
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

// ---------------------------------------------------------------------------
// The media union — WHAT a source is, asked separately from WHICH block holds
// it.
//
// The two questions used to share the `type` field, and sharing it is what
// made the field untrustworthy: `type: "image"` was a block's identity long
// before it was ever a claim about a file, so every mp4 inserted as a
// standalone block is stored under it. `type` is now the constant `"media"`
// and cannot be false about a format it no longer describes; `kind` is fresh,
// has never been written by anything but this code, and so has no falsehoods
// to inherit.
// ---------------------------------------------------------------------------

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

  // The point of the fresh field: the document's own word about the format
  // wins over anything the URL happens to look like, in both directions.
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

  // `type` is the block's identity and is not a place to put a format. The
  // union takes the raw shape only; the legacy spellings go through the
  // migration below.
  it("takes no identity but `media`", () => {
    expect(() =>
      MediaNodeSchema.parse({ type: "image", kind: "image", src: "/a.png" }),
    ).toThrow();
    expect(() =>
      MediaNodeSchema.parse({ kind: "image", src: "/a.png" }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// The migration. Every `kind` that will ever exist is either derived here from
// the file extension or written at insert time from the upload's content type
// — the old `type: "image"` is discarded as the identity it always was, so its
// falsehoods about format have nowhere to propagate to.
// ---------------------------------------------------------------------------

describe("CollectionItemSchema (documents written before `kind`)", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  afterEach(() => warn.mockClear());
  // A spy installed in a `describe` body is installed for the whole FILE — the
  // block scopes when the callback runs, not when the module-level side effect
  // does — so without this `console.warn` stays swallowed for every suite after
  // this one. Restored here rather than by turning on `restoreMocks` in
  // `vitest.config.ts`: that is a global with a blast radius across every spec
  // in the repo, and the leak is local.
  afterAll(() => warn.mockRestore());

  // The asymmetry with `BlockNodeSchema`, which refuses a typeless object (see
  // "refuses a block that never says what it is" in `post.test.ts`). It is not
  // an inconsistency but a record of what was actually written: a collection
  // item came straight from an `ImageInsertPayload`, `{ src, alt? }`, with no
  // type — every slot held a picture, so a field with one possible value was
  // six bytes of noise. A block's `type` was a required literal on the old
  // schema and is present on every one that has ever parsed. Each entry point
  // is exactly as permissive as its own history requires, and no more.
  it("takes a legacy item's stray `type` as readily as its absence", () => {
    // Items were parsed by `ImageNodeSchema.omit({ type: true })`, and a Zod
    // object strips unknown keys rather than rejecting them — so an item that
    // did carry a `type` was silently accepted and may sit in stored data.
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

  // The filename is where the answer was left, and the only place it was.
  it("recovers a clip from the extension the renderer used to sniff", () => {
    expect(CollectionItemSchema.parse({ src: "/media/demo.mp4" }).kind).toBe(
      "video",
    );
  });

  // `isVideoSource`'s bias, which has to survive the move: an unnameable
  // source is a picture, because every legacy src actually is one.
  it("calls a source it cannot name a picture, never a clip", () => {
    for (const src of ["/media/8f2c-key", "/a.svg", "/v1.2/shot"]) {
      expect(CollectionItemSchema.parse({ src }).kind).toBe("image");
    }
  });

  // The legacy STANDALONE block, which the collection path never produced but
  // `BlockNodeSchema` sends through the same preprocess. Its `type: "image"`
  // is the block's identity and says nothing true about the file, so the
  // extension — not the stored word — decides.
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

  // A stamped `kind` is baked in — nothing downstream sniffs the src any more,
  // so a wrong guess has no later chance to be corrected. The log is how the
  // backfill is audited, and the extensionless case is the one worth auditing:
  // `src` is a plain string, so an externally hosted clip with no extension
  // migrates to `image` on the bias and only the log will say so.
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

  // The log was a required deliverable so the backfill would not run blind, and
  // it stays one — but the preprocess is PERMANENT (a document is only
  // rewritten if somebody edits it), so an ungated warning is one that fires
  // forever, on every parse of every legacy node, for the life of the app.
  // Auditing a migration is a thing you do while watching; production is where
  // nobody is. Media nodes parse server-side only (`src/lib/posts.ts`,
  // `src/app/edit/[slug]/page.tsx`), so what is saved is server log volume.
  it("keeps the audit trail out of production", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const item = CollectionItemSchema.parse({ src: "/media/demo.mp4" });
      // Silent, but NOT inert — the backfill itself is what makes the document
      // parse at all, so gating the log must not gate the stamp.
      expect(item.kind).toBe("video");
      expect(warn).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

// ---------------------------------------------------------------------------
// The reserved box — what a media object occupies BEFORE its source can paint.
//
// An <img> with no bytes yet is zero pixels tall, so a block that sized itself
// from its picture occupied nothing at all until the picture arrived and then
// shoved the rest of the article down the page. The shape is the answer, and
// the document is where it has to come from: a picture's own dimensions when
// they were recorded at insert, and a stated house ratio when they were not.
// ---------------------------------------------------------------------------

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

  // A measurement, not a style: half a pixel and a negative one are both a bug
  // upstream rather than an unusual picture, and zero is what an element that
  // has not loaded reports — precisely the value that must never be written
  // down as if it were the answer.
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

  // The one case a ratio cannot carry on its own: `mediaObjectStyle` sizes a
  // `contain` picture in a padded frame to its own content, and an unloaded
  // source has no content — `auto` against `auto` reserves nothing however
  // definite the ratio between them is.
  it("gives a sized-to-content picture a width to apply the ratio to", () => {
    expect(
      mediaReservationStyle({}, { objectFit: "contain", padding: MEDIA_PADDING_STEP }),
    ).toEqual({
      aspectRatio: MEDIA_PLACEHOLDER_ASPECT,
      width: "100%",
      height: "auto",
    });
  });

  // `contain` with nothing else set is not sized to its content at all (see
  // `hasMediaLayout`), so it needs no width of its own.
  it("leaves a `contain` picture with no frame around it alone", () => {
    expect(mediaReservationStyle({}, { objectFit: "contain" })).toEqual({
      aspectRatio: MEDIA_PLACEHOLDER_ASPECT,
    });
  });
});
