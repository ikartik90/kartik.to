import { describe, it, expect } from "vitest";
import {
  BACKGROUND_EFFECT_MAX_COLORS,
  BackgroundEffectSchema,
  CollectionItemSchema,
  DEFAULT_BACKGROUND_EFFECT,
  DEFAULT_MEDIA_FIT,
  ImageNodeSchema,
  MEDIA_PADDING_MAX,
  MEDIA_PADDING_REFERENCE,
  MEDIA_PADDING_STEP,
  MEDIA_RADIUS_MAX,
  MEDIA_RADIUS_STEP,
  DEFAULT_MEDIA_RADIUS,
  hasMediaLayout,
  mediaBoxStyle,
  mediaFrameStyle,
  mediaGroundStyle,
  mediaObjectStyle,
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

  it("rejects a rotation outside 0-360", () => {
    expect(() => BackgroundEffectSchema.parse({ rotation: 400 })).toThrow();
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

describe("background effect on image nodes", () => {
  it("is optional — an image without one still parses", () => {
    expect(ImageNodeSchema.parse({ type: "image", src: "/a.png" }).backgroundEffect)
      .toBeUndefined();
  });

  it("rides along on collection items, which are image nodes minus the type", () => {
    const item = CollectionItemSchema.parse({
      src: "/a.png",
      backgroundEffect: {},
    });
    expect(item.backgroundEffect).toEqual(DEFAULT_BACKGROUND_EFFECT);
  });
});

describe("media layout on image nodes", () => {
  it("leaves both properties absent on an image that never set them", () => {
    const node = ImageNodeSchema.parse({ type: "image", src: "/a.png" });
    expect(node.objectFit).toBeUndefined();
    expect(node.padding).toBeUndefined();
  });

  it("accepts the two fits the segmented control offers, and nothing else", () => {
    expect(
      ImageNodeSchema.parse({ type: "image", src: "/a.png", objectFit: "contain" })
        .objectFit,
    ).toBe("contain");
    expect(
      ImageNodeSchema.parse({ type: "image", src: "/a.png", objectFit: "cover" })
        .objectFit,
    ).toBe("cover");
    expect(() =>
      ImageNodeSchema.parse({ type: "image", src: "/a.png", objectFit: "fill" }),
    ).toThrow();
  });

  it("holds padding to the slider's own grid — multiples of the step, within range", () => {
    expect(
      ImageNodeSchema.parse({ type: "image", src: "/a.png", padding: 0 }).padding,
    ).toBe(0);
    expect(
      ImageNodeSchema.parse({ type: "image", src: "/a.png", padding: MEDIA_PADDING_MAX })
        .padding,
    ).toBe(MEDIA_PADDING_MAX);
    // Off the 8px grid, below the floor, and past the ceiling.
    expect(() =>
      ImageNodeSchema.parse({ type: "image", src: "/a.png", padding: 5 }),
    ).toThrow();
    expect(() =>
      ImageNodeSchema.parse({ type: "image", src: "/a.png", padding: -8 }),
    ).toThrow();
    expect(() =>
      ImageNodeSchema.parse({
        type: "image",
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

  // The gradient behind a picture is the same artifact as the picture, so it
  // takes the same corner. Left square while the picture rounded, its corners
  // showed as four wedges poking out from behind a transparent PNG.
  it("gives the ground behind a picture the picture's own corner", () => {
    expect(mediaGroundStyle({ borderRadius: 20 }).borderRadius).toBe(
      mediaObjectStyle({ borderRadius: 20 }).borderRadius,
    );
    expect(mediaGroundStyle({}).borderRadius).toBe(DEFAULT_MEDIA_RADIUS);
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

describe("border radius on image nodes", () => {
  it("holds the corner to the slider's grid — multiples of the step, within range", () => {
    expect(
      ImageNodeSchema.parse({ type: "image", src: "/a.png", borderRadius: 0 })
        .borderRadius,
    ).toBe(0);
    expect(
      ImageNodeSchema.parse({
        type: "image",
        src: "/a.png",
        borderRadius: MEDIA_RADIUS_MAX,
      }).borderRadius,
    ).toBe(MEDIA_RADIUS_MAX);
    expect(() =>
      ImageNodeSchema.parse({ type: "image", src: "/a.png", borderRadius: 3 }),
    ).toThrow();
    expect(() =>
      ImageNodeSchema.parse({ type: "image", src: "/a.png", borderRadius: -2 }),
    ).toThrow();
    expect(() =>
      ImageNodeSchema.parse({
        type: "image",
        src: "/a.png",
        borderRadius: MEDIA_RADIUS_MAX + MEDIA_RADIUS_STEP,
      }),
    ).toThrow();
  });
});
