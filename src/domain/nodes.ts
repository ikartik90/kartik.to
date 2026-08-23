import type { CSSProperties } from "react";
import { z } from "zod";
import { isVideoSource, sourceExtension } from "@/utils/media-source";

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
  // Centred rather than ranged left. Only "center" exists because left IS the
  // absence of this field, and an explicit "left" would be a second way to say
  // the default that documents would then disagree about.
  //
  // This is what the homepage's opening lines are: an ordinary paragraph that
  // happens to be centred, not a special "intro" block. The distinction earns
  // its keep — an intro block would have been a second paragraph
  // implementation, with its own marks, its own inline handling and its own
  // bugs, to express one property of the text.
  align: z.literal("center").optional(),
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

// ---------------------------------------------------------------------------
// Media — a picture or a clip, and the box either one sits in.
//
// Every field below is a property of a piece of MEDIA in a frame, and not one
// of them is any less true of thirty seconds of screen recording than of a
// screenshot: the alt, the caption, the background effect, the fit, the inset,
// the corner. So they are written down ONCE, here, and both arms of the union
// extend this. Two hand-written lists would drift the first time a field
// landed on one of them, and the properties panel edits both through a single
// `MediaLayout`.
// ---------------------------------------------------------------------------
const BaseMediaSchema = z.object({
  // The BLOCK's identity, and only that. It is constant across pictures and
  // clips on purpose — see `MediaNodeSchema` for why the format is asked
  // separately.
  type: z.literal("media"),
  src: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  // Absent means no effect; there is no `false`. Lives on the MEDIA node rather
  // than on the collection item so a standalone block inherits it for free —
  // a collection item IS a media node (`CollectionItemSchema`) — and on the
  // shared base rather than on either arm, so a field added here reaches a
  // picture and a clip in the same edit.
  backgroundEffect: BackgroundEffectSchema.optional(),
  // Both absent-means-default rather than `.default()`, matching the effect
  // above. A Zod default would make the PARSED type require them, and every
  // media literal in `src/data/articles.ts` and the editor's own insert would
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

/**
 * A picture or a clip — told apart by the DOCUMENT, and told apart from the
 * question of which block this is.
 *
 * TWO fields, and that is the whole design. `type` is the block's identity and
 * `kind` is the format, and they are separate because they were briefly the
 * same field and that field could not be trusted. `type: "image"` had carried
 * block identity since long before the library accepted mp4s, so every clip
 * ever inserted as a standalone block is stored under it; reusing that literal
 * as a format claim would have meant a discriminant that is simply false about
 * a whole population of real documents, and no migration can tell a truthful
 * `"image"` from a legacy one by looking at it. `kind` is FRESH — nothing has
 * ever written one — so every value it will ever hold is either derived by the
 * migration below from the file extension or written at insert time from the
 * upload's `contentType`. It starts with nothing to inherit.
 *
 * The content type is known at upload (`CreateMediaUploadInputSchema`
 * validates it, `MediaAssetSchema` stores it) and it used to be thrown away on
 * the way into the document, leaving the renderer to recover it from the
 * filename (`isVideoSource`) on every paint. That guess is only ever as good
 * as the naming, and the naming is not ours to rely on: a bare R2 key carries
 * no extension, a signed URL buries it behind a query, a CDN is free to
 * rewrite the path entirely. Writing down an answer already in hand costs one
 * field and retires the question.
 *
 * A discriminated union rather than one node with a `kind` string, because a
 * clip will eventually hold things a picture cannot have: whether it loops,
 * whether it offers the browser's controls, the frame it shows before it
 * plays. On a single flat node every one of those would be an optional field
 * meaningless on every photograph in the library, and "optional and
 * meaningless" is exactly the shape a schema cannot tell apart from "optional
 * and not set yet". None of them exist yet; this shape is what makes adding
 * them additive, landing on the video arm alone with nothing dangling on
 * pictures.
 *
 * `type` being constant across both arms is what lets `BlockNodeSchema` go on
 * routing blocks by `type` and the editor's dozen `block.type === "media"`
 * predicates see one stable value — every one of them is a format-agnostic
 * editor concern (captions, arrow traversal, toolbars, selection), so they
 * start working for clips at no cost.
 */
export const MediaNodeSchema = z.discriminatedUnion("kind", [
  BaseMediaSchema.extend({ kind: z.literal("image") }),
  BaseMediaSchema.extend({ kind: z.literal("video") }),
]);

export type MediaNode = z.infer<typeof MediaNodeSchema>;

/** Picture or clip — the format, asked without asking which block holds it. */
export type MediaKind = MediaNode["kind"];

// A set of related images authored as ONE block. The editor exposes exactly
// this many slots (a 3×2 grid), so the cap is the layout, not an arbitrary
// limit; the reader shows the first three and folds the rest into a surplus
// badge. Items are ordered, and index 0 is the featured image by definition —
// "feature this one" is a move-to-front, not a flag, so the order alone
// determines the layout and there is no second source of truth to keep in sync.
export const COLLECTION_MAX_ITEMS = 6;

/**
 * Turns a media object written before `kind` existed into one that has it.
 *
 * Separate from the union rather than folded into it, because it CANNOT be
 * folded into it: `z.discriminatedUnion` routes on the RAW input, reading
 * `kind` to pick a branch before any schema in the union has run. So a
 * `.default("image")` on the literal is never reached — there is no branch to
 * default INTO — and the backfill has to happen upstream of the routing.
 *
 * Exactly two legacy shapes reach here, and they are the only two ever
 * persisted. A collection item was written `{ src, ... }` with no `type` at
 * all, because every item was a picture and a field with one possible value is
 * six bytes of noise per slot. A standalone block was written
 * `{ type: "image", src, ... }`, where the literal is the BLOCK's identity and
 * says nothing whatever about the file — which is why the incoming `type` is
 * read only to recognise the shape and never to answer the question. Both come
 * out as `{ type: "media", kind: <derived>, ...rest }`.
 *
 * `typeRequired` is which of those two shapes the caller can actually receive,
 * and it exists because accepting both everywhere COSTS something. A block has
 * always had to say what it is: `type` was a required literal on the old image
 * schema, so a typeless object could never parse as a block, and `BlockNodeSchema`
 * is a plain union with no other member that would take one either — a
 * malformed block was a parse error, loudly. Tolerating an absent `type` there
 * silently reclassifies any object with a string `src` as media, which is a
 * validation quietly lost rather than a legacy shape accommodated. So the
 * block entry (`StoredMediaBlockSchema`) sets this and the item entry
 * (`StoredMediaItemSchema`) does not, and each ends up exactly as permissive as
 * its own history requires.
 *
 * The item entry stays open to BOTH spellings rather than only the typeless
 * one, deliberately: items were parsed by `ImageNodeSchema.omit({ type: true })`
 * and a Zod object strips unknown keys instead of rejecting them, so an item
 * that did carry a `type` was accepted without complaint and may well be
 * sitting in stored data. Nothing that has ever parsed stops parsing.
 *
 * (The interim `{ type: "image" | "video" }` spelling is not handled, and does
 * not need to be: this stamps on PARSE rather than on storage, so it never
 * reached a document.)
 *
 * The guess is the one the renderer used to make on every paint, with the same
 * bias, and the bias is the load-bearing part: an unrecognised source is a
 * PICTURE, because every src written before mp4s were accepted actually is
 * one. Guessing that way, a clip nobody can name from its URL comes up as a
 * broken image — visibly wrong, and wrong about a file that is genuinely
 * unusual. Guessing the other way turns every extensionless legacy key in
 * every old collection into a silent empty `<video>`.
 */
function withMediaKind(node: unknown, typeRequired: boolean): unknown {
  if (!node || typeof node !== "object" || "kind" in node) return node;
  const { type, src } = node as { type?: unknown; src?: unknown };
  // The two legacy spellings and nothing else. Anything carrying some other
  // `type` is a different block entirely, and it does reach here: this
  // preprocess sits inside `BlockNodeSchema`'s union, so a heading or a metric
  // can pass through on the way to its own schema and has to come back out
  // untouched.
  if (type !== undefined && type !== "image") return node;
  // And where a `type` was always written, its absence is not a legacy
  // spelling — it is a malformed node, which must reach the union unstamped so
  // it is rejected rather than reclassified as media. See `typeRequired` above.
  if (type === undefined && typeRequired) return node;
  // Nothing to derive a kind FROM. Left alone so the union rejects it for the
  // missing src it actually has, rather than for a `kind` it was never asked
  // to carry.
  if (typeof src !== "string") return node;

  const kind = isVideoSource(src) ? "video" : "image";
  // Nothing downstream sniffs the src any more, so this guess is the last one
  // anybody makes about this document: it is baked in the moment it is stamped
  // and there is no render-time correction left to save it. `src` is a plain
  // string rather than a URL, so an externally hosted clip with no extension
  // migrates to `image` on the bias above and this line is the only place that
  // will ever say so. Re-saving the document from the editor replaces the
  // guess with the insert path's first-hand answer and retires the warning.
  //
  // Off in production, and that is a correction to the original spec rather
  // than a walking-back of it. Logging was required so the backfill would not
  // run blind — but this preprocess is permanent, not a pass to be run once and
  // deleted, so an ungated warning is not a migration record, it is a line
  // emitted on every parse of every legacy node for as long as the app lives.
  // Auditing is something done while somebody is watching; production is
  // precisely where nobody is. Gated on the LOG alone — the stamp below is what
  // makes a legacy document parse at all and can never be conditional.
  if (process.env.NODE_ENV !== "production") {
    const extension = sourceExtension(src);
    console.warn(
      `[media-migration] ${src} → kind: "${kind}"` +
        (extension ? ` (from .${extension})` : " (no extension — picture bias)"),
    );
  }
  return { ...node, type: "media", kind };
}

/**
 * A media node as documents actually hold one — legacy spellings included.
 *
 * The preprocess IS the migration, and it is permanent rather than a pass to
 * be run and deleted: a document is only rewritten if somebody edits it, and
 * the ones nobody opens again still have to parse. See `withMediaKind` for why
 * it cannot live inside the union.
 *
 * TWO of them, because the two positions media occupies were written down
 * differently and so have different things to forgive — the block entry has
 * never had to accept a node with no `type`, and must not start. The split is
 * about the legacy INPUT only: both stamp the same field, both produce the same
 * `MediaNode`, and an item is still literally a block node once parsed.
 */
export const StoredMediaBlockSchema = z.preprocess(
  (node) => withMediaKind(node, true),
  MediaNodeSchema,
);

/** The same, for a node that was written into a collection slot. */
export const StoredMediaItemSchema = z.preprocess(
  (node) => withMediaKind(node, false),
  MediaNodeSchema,
);

/**
 * A collection's items ARE media nodes — the same picture-or-clip a document
 * holds anywhere else, standing in a numbered slot.
 *
 * This was `ImageNodeSchema.omit({ type: true })`, defended as keeping the two
 * in lockstep as the image schema grew. Lockstep was the effect; the reason was
 * narrower. An item had no discriminant to keep, because every item was a
 * picture, and the omit was how a schema that wanted to be an image node said
 * so without saying "image" over and over.
 *
 * The `type: "media"` an item now carries is redundant in a collection — every
 * slot holds media, so the field decides nothing there — and it is kept anyway,
 * deliberately. It makes an item LITERALLY a block node, so a picture can move
 * between a collection slot and a block position untransformed, which is what
 * a planned sibling grid node (arbitrary block content, not media-only) will
 * need. Lockstep also stops being an arrangement to maintain, because this is
 * no longer a second schema.
 */
export const CollectionItemSchema = StoredMediaItemSchema;

/** A media node, named for the position it occupies. */
export type CollectionItem = MediaNode;

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
  MediaNode,
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
 * The inset in PIXELS, against a width the caller has measured — the corner's
 * twin above, for the same surface and the same reason.
 *
 * A band that stayed the number it was authored as while the picture beside it
 * quadrupled is not the composition anyone drew: the whole rule this file
 * implements is that an inset is a SHARE of the box, so at four times the size
 * it is four times the pixels.
 */
export function mediaInsetPx(
  media: MediaLayout,
  width: number = MEDIA_PADDING_REFERENCE,
): number {
  return ((media.padding ?? 0) / MEDIA_PADDING_REFERENCE) * width;
}

/**
 * How much of its box an inset picture is — `1` when nothing surrounds it, and
 * less as the band widens. Both bands come out of the same axis, so it is the
 * inset twice over.
 *
 * The factor a viewport cap has to be taken through: `85vw` is what the whole
 * COMPOSITION may occupy, so the picture at the heart of it may have only this
 * share of that. Capping the picture itself at `85vw` and then hanging bands
 * off it composes something wider than the screen.
 */
export function mediaPictureShare(media: MediaLayout): number {
  return 1 - (2 * (media.padding ?? 0)) / MEDIA_PADDING_REFERENCE;
}

/**
 * What a HEIGHT budget has to be divided by to leave room for the bands above
 * and below the picture — the vertical twin of `mediaPictureShare`, and not the
 * same number, because the two bands are the same PIXELS on every side while
 * the height they eat into is not the width they came out of.
 *
 * On a square picture the two agree and this is exactly `1 / share`. On a wide
 * one the bands are a larger fraction of the height, so a 16:9 clip taken
 * through the width's share alone composes taller than the screen it was meant
 * to fit; on a tall one they are a smaller fraction, and the same arithmetic
 * leaves the picture needlessly small.
 *
 * The shape comes from the FILE (`naturalWidth / naturalHeight`), never from
 * what the screen gave it, so this stays a constant of the picture and the cap
 * it feeds can never chase the layout it constrains.
 */
export function mediaHeightBudgetFactor(
  media: MediaLayout,
  aspect: number = 1,
): number {
  const padding = media.padding ?? 0;
  if (!padding) return 1;
  const share = (padding / MEDIA_PADDING_REFERENCE) * aspect;
  return 1 + (2 * share) / mediaPictureShare(media);
}

/**
 * The container an enlarged picture implies, recovered from the width the
 * picture itself came out at.
 *
 * The lightbox is sized BY its picture, so it is the one surface where the box
 * is the unknown and the picture is what can be measured — the reverse of every
 * other surface, where the box is given and the picture takes what is left.
 * Running the arithmetic in that direction is also what keeps it out of a loop:
 * an inset derived from the frame it is PART OF would feed its own next value,
 * settling over several frames of visibly growing picture, while the picture's
 * own width owes the band nothing.
 */
export function mediaContainerWidth(
  media: MediaLayout,
  pictureWidth: number,
): number {
  return pictureWidth / mediaPictureShare(media);
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
// Furniture — blocks that render a fixed piece of the site rather than content
// stored in the node.
//
// Both carry no fields, and that is the point: what they render is owned
// elsewhere (the grid by the two tables behind `getGridCards`, the icon row by
// `SocialLinks`), and the document only says WHERE it goes. Giving them
// options would start a second, weaker copy of a thing that already has one
// home.
//
// They exist so the homepage can be an ordinary document. It was three
// hardcoded sections; making the grid part of it must not mean losing the
// ability to write above and below it, and the intro's icon row is not
// something to delete on the way past.
// ---------------------------------------------------------------------------

/** The homepage's masonry of projects, articles and published components. */
export const ProjectGridNodeSchema = z.object({
  type: z.literal("project_grid"),
});

/** The row of social icons. */
export const SocialLinksNodeSchema = z.object({
  type: z.literal("social_links"),
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
  | MediaNode
  | z.infer<typeof CollectionNodeSchema>
  | z.infer<typeof ComponentNodeSchema>
  | z.infer<typeof MetricNodeSchema>
  | z.infer<typeof ProjectGridNodeSchema>
  | z.infer<typeof SocialLinksNodeSchema>;

export const BlockNodeSchema: z.ZodType<BlockNode> = z.union([
  ParagraphNodeSchema,
  HeadingNodeSchema,
  BlockquoteNodeSchema,
  ListItemNodeSchema,
  BulletListItemNodeSchema,
  CodeBlockNodeSchema,
  HorizontalRuleNodeSchema,
  StoredMediaBlockSchema,
  CollectionNodeSchema,
  ComponentNodeSchema,
  MetricNodeSchema,
  ProjectGridNodeSchema,
  SocialLinksNodeSchema,
]);
