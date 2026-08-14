import type { CSSProperties } from "react";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Marks — inline formatting annotations attached to text nodes
// ---------------------------------------------------------------------------

export const MarkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("code") }),
  z.object({ type: z.literal("underline") }),
  z.object({ type: z.literal("strikethrough") }),
  z.object({ type: z.literal("highlight") }),
  z.object({ type: z.literal("link"), href: z.url() }),
  // A margin annotation. `id` groups the run and gives it a stable anchor name
  // (two adjacent sidenotes stay distinct); `text` is the note body shown in the
  // aside card. The visible ordinal is derived from document order, not stored.
  z.object({
    type: z.literal("sidenote"),
    id: z.string().min(1),
    text: z.string(),
  }),
]);

export type Mark = z.infer<typeof MarkSchema>;

// ---------------------------------------------------------------------------
// Inline nodes — valid inside block children arrays
// ---------------------------------------------------------------------------

export const TextNodeSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  marks: z.array(MarkSchema).optional(),
});

export type TextNode = z.infer<typeof TextNodeSchema>;

// InlineNodeSchema is a union — extend here as inline custom node types are added.
export const InlineNodeSchema = TextNodeSchema;
export type InlineNode = TextNode;

// ---------------------------------------------------------------------------
// Block nodes — top-level document elements.
//
// Each node type (including custom embeddable components) is a first-class
// member of the BlockNodeSchema union. To add a new embeddable component:
//   1. Define its schema in this file (or a sibling file in src/domain/nodes/
//      once this file grows large enough to split).
//   2. Add it to the BlockNodeSchema union below.
//   3. Register a renderer in src/lib/node-renderers.ts.
//
// If a custom node has `children: BlockNode[]`, declare its TypeScript type
// manually before its schema and use z.lazy(() => BlockNodeSchema) on the
// children field to break the circular reference.
// ---------------------------------------------------------------------------

// `indent` marks a block as shifted one list-level to the right (Tab in the
// editor) so its content aligns with bulleted/numbered list-item text.
export const ParagraphNodeSchema = z.object({
  type: z.literal("paragraph"),
  children: z.array(InlineNodeSchema),
  indent: z.boolean().optional(),
});

export const HeadingNodeSchema = z.object({
  type: z.literal("heading"),
  level: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  children: z.array(InlineNodeSchema),
  caption: z.string().optional(),
  indent: z.boolean().optional(),
});

export const BlockquoteNodeSchema = z.object({
  type: z.literal("blockquote"),
  children: z.array(InlineNodeSchema),
  caption: z.string().optional(),
  indent: z.boolean().optional(),
});

// A single ordered-list entry. Numbered lists are modelled as runs of
// consecutive `list_item` blocks — the renderer groups them into one <ol> and
// computes each ordinal (plus zero-padding width) from the run's length.
//
// Numbering behaviour (see src/utils/list-numbering.ts) is driven by three
// optional fields, all resolved at render time so the count stays live:
//   • `marker`   — run style, read from the run's first item ("alpha" ⇒ a,b,c…).
//   • `continued`— on the run's first item: begin one past the previous
//                  numbered list's last ordinal instead of at 1.
//   • `start`    — explicit ordinal for THIS item; "reset numbering" sets 1 here
//                  and the run counts on from it.
export const ListItemNodeSchema = z.object({
  type: z.literal("list_item"),
  children: z.array(InlineNodeSchema),
  marker: z.enum(["decimal", "alpha"]).optional(),
  continued: z.boolean().optional(),
  start: z.number().int().positive().optional(),
});

// A single unordered-list entry. Bulleted lists are runs of consecutive
// `bullet_list_item` blocks — the renderer groups them into one <ul>. `marker`
// swaps this item's bullet glyph between the default dot, a check, or a cross
// (per-item, so a list can mix them like a checklist).
export const BulletListItemNodeSchema = z.object({
  type: z.literal("bullet_list_item"),
  children: z.array(InlineNodeSchema),
  marker: z.enum(["check", "cross"]).optional(),
});

export const CodeLanguageSchema = z.enum([
  "html",
  "css",
  "json",
  "javascript",
  "jsx",
  "typescript",
  "tsx",
]);

export type CodeLanguage = z.infer<typeof CodeLanguageSchema>;

export const CodeBlockNodeSchema = z.object({
  type: z.literal("code_block"),
  language: CodeLanguageSchema.optional(),
  children: z.array(TextNodeSchema),
});

export const HorizontalRuleNodeSchema = z.object({
  type: z.literal("horizontal_rule"),
});

// ---------------------------------------------------------------------------
// Background effect — a Paper `StaticMeshGradient` painted BEHIND an image.
//
// For screenshots of UI that don't fill their frame: the gradient gives the
// artifact a ground to sit on instead of dead space. It is `Static`, so it
// renders one frame and stops — there is no animation to pause and nothing for
// `prefers-reduced-motion` to object to.
//
// Every field carries the shader's own default, so an effect stored by an older
// build still parses once a parameter is added here — `{}` is a complete,
// valid effect. Ranges are the shader's documented uniform ranges, not
// invented: a value outside them is silently clamped by the GPU, which would
// make the slider lie about what it is doing.
// ---------------------------------------------------------------------------

/** The shader's own ceiling — `u_colors` is a `vec4[10]`. */
export const BACKGROUND_EFFECT_MAX_COLORS = 10;

// 8-digit only. The opacity is part of the colour rather than a sibling field,
// so there is exactly one place a colour's alpha can live and no way for the
// two to disagree. See `@/utils/color-value`.
const BackgroundColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{8}$/, "Expected an #RRGGBBAA colour");

export const BackgroundEffectSchema = z.object({
  colors: z
    .array(BackgroundColorSchema)
    .min(1)
    .max(BACKGROUND_EFFECT_MAX_COLORS)
    .default(["#FFAB6FFF", "#FF4D97FF"]),
  /** Colour-spot placement seed, not a position — the whole field re-rolls. */
  positions: z.number().min(0).max(100).default(2),
  waveX: z.number().min(0).max(1).default(1),
  waveXShift: z.number().min(0).max(1).default(0.6),
  waveY: z.number().min(0).max(1).default(1),
  waveYShift: z.number().min(0).max(1).default(0.21),
  /** 0 = hard stripes, 0.5 = smooth, 1 = fully gradual. */
  mixing: z.number().min(0).max(1).default(0.93),
  grainMixer: z.number().min(0).max(1).default(0),
  grainOverlay: z.number().min(0).max(1).default(0),
  scale: z.number().min(0.01).max(4).default(1),
  rotation: z.number().min(0).max(360).default(270),
  offsetX: z.number().min(-1).max(1).default(0),
  offsetY: z.number().min(-1).max(1).default(0),
});

export type BackgroundEffect = z.infer<typeof BackgroundEffectSchema>;

/** What a freshly enabled effect starts as — the shader's defaults, brand-coloured. */
export const DEFAULT_BACKGROUND_EFFECT: BackgroundEffect =
  BackgroundEffectSchema.parse({});

/**
 * How the media fills the box it is given (Figma 885:1963).
 *
 * Two values rather than the CSS property's five: `cover` crops to fill, and
 * `contain` fits the whole frame inside. `fill`, `none` and `scale-down` are
 * left out on purpose — the first distorts the picture and the other two hand
 * the layout to the source's intrinsic size, which is not a choice a tile grid
 * can honour.
 */
export const MediaFitSchema = z.enum(["cover", "contain"]);

export type MediaFit = z.infer<typeof MediaFitSchema>;

/** What an image that has never been told otherwise does — today's behaviour. */
export const DEFAULT_MEDIA_FIT: MediaFit = "cover";

/**
 * The padding slider's grid. The step is the design's (Figma 885:1963); the
 * ceiling is eleven stops at that step, which is exactly the number of marks
 * the slider draws — so every tick lands on a value the thumb can actually
 * stop at, rather than on a ruler that only approximately describes the scale.
 */
export const MEDIA_PADDING_STEP = 8;
export const MEDIA_PADDING_MAX = 80;

/**
 * The container width a padding value is authored AGAINST.
 *
 * Padding is stored as the pixels it should come to in a container this wide,
 * and rendered as the equivalent PERCENTAGE — so the same picture keeps its
 * proportions wherever it is shown. A 32px inset chosen while looking at a
 * 640px article image is 16px in a 320px tile, not a band four times as heavy
 * relative to the picture inside it.
 *
 * 640 because that IS the article's content column (`sizes.articleContent`),
 * which is the widest a single image is ever drawn and therefore the box the
 * author is looking at when they choose a number.
 */
export const MEDIA_PADDING_REFERENCE = 640;

/**
 * The corner slider's grid. Applied to the media OBJECT rather than to the box
 * around it, so it is the picture's own corner that rounds — which only becomes
 * visible once there is padding to lift it off the container's edge.
 *
 * Eleven stops at a 2px step, matching the eleven marks the slider draws. The
 * ceiling is 20px — `radii.xxl`, the roundest corner in the system, and a step
 * past the `xl` card the picture sits on, so "rounder than the tile it is in"
 * is available and nothing beyond it is.
 */
export const MEDIA_RADIUS_STEP = 2;
export const MEDIA_RADIUS_MAX = 20;

/**
 * What a picture nobody has rounded is: square.
 *
 * The corner belongs to the MEDIA, and the surfaces showing it never write one
 * ONTO it: the panel's slider is a readout of the picture rather than of the
 * place it happens to be shown. What a card does draw is its own corner, which
 * clips whatever fills it — a different property, and not one this control has
 * any business editing (see the `collectionGrid` recipe's `cell` slot).
 */
export const DEFAULT_MEDIA_RADIUS = 0;

export const ImageNodeSchema = z.object({
  type: z.literal("image"),
  src: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  // Absent means no effect; there is no `false`. Lives on the IMAGE node rather
  // than on the collection item so a standalone image block inherits it for
  // free — `CollectionItemSchema` is this schema minus its discriminant.
  backgroundEffect: BackgroundEffectSchema.optional(),
  // Both absent-means-default rather than `.default()`, matching the effect
  // above. A Zod default would make the PARSED type require them, and every
  // image literal in `src/data/articles.ts` and the editor's own insert would
  // have to state a fit and a padding it has no opinion about. Absent is also
  // the honest record of "this picture predates the control".
  objectFit: MediaFitSchema.optional(),
  // Snapped to the slider's own grid, so a document can never hold a padding
  // the control that wrote it could not have produced. Stored in px AT
  // `MEDIA_PADDING_REFERENCE` and rendered as a share of the container — see
  // that constant.
  padding: z
    .number()
    .min(0)
    .max(MEDIA_PADDING_MAX)
    .multipleOf(MEDIA_PADDING_STEP)
    .optional(),
  // Absent is zero — square — exactly as it is for `padding`, and it is dropped
  // for being zero the same way.
  //
  // It used to mean "no opinion, leave whatever corner the surface draws", and
  // the surfaces drew 20px on a tile and 16px on an article image. That made
  // the panel a liar: a freshly inserted picture read `Radius 0` under a
  // visibly rounded corner, and there was no number the slider could show that
  // was true of every surface at once. A corner is now a property of the media
  // and of nothing else, so the panel's reading is the picture's reading.
  borderRadius: z
    .number()
    .min(0)
    .max(MEDIA_RADIUS_MAX)
    .multipleOf(MEDIA_RADIUS_STEP)
    .optional(),
});

// A set of related images authored as ONE block. The editor exposes exactly
// this many slots (a 3×2 grid), so the cap is the layout, not an arbitrary
// limit; the reader shows the first three and folds the rest into a surplus
// badge. Items are ordered, and index 0 is the featured image by definition —
// "feature this one" is a move-to-front, not a flag, so the order alone
// determines the layout and there is no second source of truth to keep in sync.
export const COLLECTION_MAX_ITEMS = 6;

// Structurally an image node minus its discriminant, so the two stay in
// lockstep as the image schema grows (alt/caption additions land on both).
export const CollectionItemSchema = ImageNodeSchema.omit({ type: true });

export type CollectionItem = z.infer<typeof CollectionItemSchema>;

/**
 * The two layout properties as the style the media element wears — resolved
 * once, here, because FOUR places render the same picture (the editor's cell,
 * the reader's tile, the lightbox, the standalone block) and each would
 * otherwise spell out its own fallback. A picture that cropped in the editor
 * and letterboxed in the reader would make the panel a guess rather than a
 * preview, which is the same argument that put `backgroundEffect` on the node.
 *
 * Padding rather than an inset on the shader: the gradient is sized by the
 * BOX and the picture is what shrinks inside it, so whatever is behind the
 * media — a background effect, the transparency checkerboard — is what fills
 * the gap. `object-fit` applies to the CONTENT box, so the two compose without
 * either having to know about the other.
 *
 * That padding comes out as a PERCENTAGE, which is the whole scaling rule in
 * one line: a percentage padding resolves against the containing block's
 * inline size, so the inset is always the same share of the box and the
 * browser does the arithmetic on every resize with nothing measured in JS.
 * All four sides resolve against the WIDTH — that is the CSS rule, not an
 * oversight, and it is what keeps the band even all the way round instead of
 * heavier top and bottom on a tile that is taller than it is wide.
 *
 * The corner scales with it, for the same reason and by the same reference:
 * the point of the pair is that a composition authored once REPRODUCES at any
 * size, and an inset that halved beside a corner that did not would make the
 * same picture read as a rounder object in a smaller tile. Both are authored
 * against `MEDIA_PADDING_REFERENCE`.
 *
 * The corner cannot use a percentage the way the inset does: percentage
 * `border-radius` resolves PER AXIS — horizontal radii against width, vertical
 * against height — so on any non-square photo it draws an ellipse rather than a
 * circle (the same trap `radii.full` is annotated with). Container query units
 * are the width-relative length CSS otherwise lacks, which is why the frame
 * declares itself a container.
 */
export type MediaLayout = Pick<
  CollectionItem,
  "objectFit" | "padding" | "borderRadius"
>;

/**
 * Is there anything to lay out at all, or is this picture as it always was?
 *
 * A zero corner answers NO, unlike before: zero is the default now, and — being
 * written as a plain `0` rather than `0cqw` — it needs no query container to be
 * zero. So the frame is still free for every picture that has neither an inset
 * nor a corner.
 */
export function hasMediaLayout(media: MediaLayout): boolean {
  return Boolean(media.padding) || Boolean(media.borderRadius);
}

/**
 * The corner, as the length CSS should draw it.
 *
 * Zero comes out as a plain `0`, and everything else as a share of the frame's
 * width — see `mediaObjectStyle` for why the unit is `cqw`. The zero case is
 * not merely an optimisation: a square picture is exactly the picture that
 * renders with no frame around it, and `0cqw` without a container would fall
 * back to measuring the viewport. Zero is zero anywhere.
 */
function mediaRadiusValue(media: MediaLayout): string | number {
  const radius = media.borderRadius ?? DEFAULT_MEDIA_RADIUS;
  if (radius === 0) return DEFAULT_MEDIA_RADIUS;
  return `${(radius / MEDIA_PADDING_REFERENCE) * 100}cqw`;
}

/*
 * NOTE — the corner stops at the media, and the SURFACE has one of its own.
 *
 * A collection cell, and the lightbox card behind an enlarged picture, wear
 * `radii.xxl` from their recipes: a container's corner is a constant of the
 * design system, not a per-image property, and the panel's slider is a control
 * over the media OBJECT. The two meet without either having to know about the
 * other — the cell clips, so a picture filling its slot takes the card's shape,
 * and its own corner is what shows once an inset lifts it off that edge.
 *
 * There was briefly a `mediaGroundStyle` here that handed the gradient the
 * picture's corner. It is gone: the gradient fills the CARD, so the card's
 * corner is the one it has to take, and a ground that tracked the picture drew
 * a shape neither of them had.
 */

/**
 * The corner in PIXELS, against a width the caller has measured.
 *
 * For the one surface that cannot be a query container at all: a container's
 * inline size may not depend on its contents, so a box that shrink-wraps its
 * picture — the lightbox's frame — can never be one, and a `cqw` there would
 * silently measure the VIEWPORT instead. Measuring the box in JS is what is
 * left, and it buys the same rule every other surface gets for free: the corner
 * is `R` px at `MEDIA_PADDING_REFERENCE` and the same SHARE of any other width,
 * so a picture enlarged to fill a wide screen is rounded like the tile it was
 * composed in rather than progressively sharper the bigger it gets.
 *
 * The default is the authored number, which is what an unmeasured surface —
 * the first paint, before the picture has loaded — draws until it knows better.
 */
export function mediaRadiusPx(
  media: MediaLayout,
  width: number = MEDIA_PADDING_REFERENCE,
): number {
  const radius = media.borderRadius ?? DEFAULT_MEDIA_RADIUS;
  return (radius / MEDIA_PADDING_REFERENCE) * width;
}

/**
 * The FRAME's style — the padded box the picture sits inside.
 *
 * The inset lives here and not on the media element, and that split is
 * load-bearing rather than tidiness: `border-radius` clips an element's BORDER
 * box while its content renders in the CONTENT box, so padding and a corner on
 * the same element means the rounding happens out in the padding where there
 * are no pixels to round, and the picture stays visibly square. One of the two
 * has to move, and it is the padding — the corner belongs to the object, which
 * is what the control says it does.
 *
 * It is also the QUERY CONTAINER the corner is measured against — see
 * `mediaObjectStyle`. That is why the padding sits on an inner box rather than
 * here: a container's query units resolve against its CONTENT box, so padding
 * on this element would quietly measure the corner against the already-inset
 * width and leave it short by twice the inset.
 *
 * `display: contents` when there is nothing to apply, so a picture nobody has
 * touched has no extra box in its layout at all — the frame is free until it
 * is used.
 */
export function mediaFrameStyle(media: MediaLayout): CSSProperties {
  // Only a CORNER needs it. Containment is what makes this box's inline size
  // independent of its contents, and that is a promise only a surface with a
  // width of its own can keep: inside a box that shrink-wraps its picture (the
  // lightbox's frame) the two are circular and BOTH collapse to zero, taking
  // the picture off the screen entirely. The inset needs no container — a
  // percentage padding resolves against the containing block — so a picture
  // that is only inset skips this box and keeps its old one.
  if (!media.borderRadius) return { display: "contents" };
  return {
    // Declares the box the corner is a share OF. `inline-size` and not `size`:
    // the height still comes from the contents, which is what a `contain`
    // picture in an auto-height surface (the article block) depends on.
    containerType: "inline-size",
    // Load-bearing, not tidiness. Containment does not apply to a non-atomic
    // inline box, so on a `<span>`'s default `display: inline` the whole
    // `container-type` is ignored — silently, and the corner then resolves
    // against the next container up or the viewport. It looks like the radius
    // simply came out wrong rather than like a container that was never there.
    display: "block",
    width: "100%",
    height: "100%",
  };
}

/**
 * The INNER box — the inset itself, and the centring a `contain` picture needs
 * because it sizes to its own content rather than filling.
 *
 * Separate from the frame only so the frame's query units measure the full
 * container; everything else about it could have lived there.
 */
export function mediaBoxStyle(media: MediaLayout): CSSProperties {
  if (!hasMediaLayout(media)) return { display: "contents" };
  return {
    // A percentage IS the scaling rule: it resolves against the containing
    // block's inline size, so the inset is always the same share of the box and
    // the browser redoes the arithmetic on every resize with nothing measured
    // in JS. All four sides resolve against the WIDTH — that is the CSS rule,
    // not an oversight, and it is what keeps the band even all the way round
    // rather than heavier top and bottom on a tall tile.
    padding: `${((media.padding ?? 0) / MEDIA_PADDING_REFERENCE) * 100}%`,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

/**
 * The OBJECT's style — the picture itself.
 *
 * `cover` fills the frame, so the element's box IS the picture and a corner on
 * it rounds what you see. `contain` cannot fill it, so the element is sized to
 * its own content instead of stretched-and-letterboxed: a letterboxed element
 * is mostly empty box, and a corner on THAT would again round nothing. Sized to
 * the picture, the same corner rounds the picture.
 *
 * The corner scales with the container, like the inset, so the composition
 * reproduces at any size instead of looking rounder the smaller it gets. It is
 * expressed in `cqw` — a share of the frame's width — because that is the only
 * width-relative LENGTH available: a percentage `border-radius` resolves per
 * axis and would draw an ellipse on any photo that is not square.
 *
 * `100cqw` is the frame's full width, so `R / REFERENCE * 100cqw` is exactly
 * `R` px at the reference width and half of it at half the width — the same
 * arithmetic the inset does with its percentage.
 */
export function mediaObjectStyle(media: MediaLayout): CSSProperties {
  const objectFit = media.objectFit ?? DEFAULT_MEDIA_FIT;
  return {
    objectFit,
    ...(hasMediaLayout(media) && objectFit === "contain"
      ? { width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }
      : {}),
    // ALWAYS stated, zero included. Omitting it is what let each surface round
    // the picture with a corner of its own — a class the media element was
    // already wearing — while the panel, reading the media, showed 0. An inline
    // declaration outranks every one of those classes, so the picture's corner
    // is the picture's to state and the panel cannot disagree with it.
    borderRadius: mediaRadiusValue(media),
  };
}

// `items` may be empty: removing images one by one has to pass through zero,
// and a minimum would make the document unparseable mid-edit. `caption` is the
// block's own caption, alongside the per-item captions shown in the lightbox.
export const CollectionNodeSchema = z.object({
  type: z.literal("collection"),
  items: z.array(CollectionItemSchema).max(COLLECTION_MAX_ITEMS),
  caption: z.string().optional(),
});

export const ComponentNodeSchema = z.object({
  type: z.literal("component"),
  componentId: z.string().min(1),
  caption: z.string().optional(),
});

// A metric callout — a large brand-gradient `value` (e.g. "$377k") with an
// optional eyebrow `caption` above it and a descriptive `subtext` line below.
// The value is the primary inline-node `children` array; `caption` reuses the
// shared eyebrow-caption field (as headings do), `subtext` is metric-specific.
export const MetricNodeSchema = z.object({
  type: z.literal("metric"),
  children: z.array(InlineNodeSchema),
  caption: z.string().optional(),
  subtext: z.string().optional(),
  indent: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// BlockNode union — the single source of truth for all valid block types.
// Add new node schemas to both the type union and the z.union() array below.
// ---------------------------------------------------------------------------

export type BlockNode =
  | z.infer<typeof ParagraphNodeSchema>
  | z.infer<typeof HeadingNodeSchema>
  | z.infer<typeof BlockquoteNodeSchema>
  | z.infer<typeof ListItemNodeSchema>
  | z.infer<typeof BulletListItemNodeSchema>
  | z.infer<typeof CodeBlockNodeSchema>
  | z.infer<typeof HorizontalRuleNodeSchema>
  | z.infer<typeof ImageNodeSchema>
  | z.infer<typeof CollectionNodeSchema>
  | z.infer<typeof ComponentNodeSchema>
  | z.infer<typeof MetricNodeSchema>;

export const BlockNodeSchema: z.ZodType<BlockNode> = z.union([
  ParagraphNodeSchema,
  HeadingNodeSchema,
  BlockquoteNodeSchema,
  ListItemNodeSchema,
  BulletListItemNodeSchema,
  CodeBlockNodeSchema,
  HorizontalRuleNodeSchema,
  ImageNodeSchema,
  CollectionNodeSchema,
  ComponentNodeSchema,
  MetricNodeSchema,
]);
