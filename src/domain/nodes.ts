import type { CSSProperties } from "react";
import { z } from "zod";
import { isVideoSource, sourceExtension } from "@/utils/media-source";
import { ROTATION_MAX, ROTATION_MIN, wrapRotation } from "@/utils/rotation";

export const MarkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("code") }),
  z.object({ type: z.literal("underline") }),
  z.object({ type: z.literal("strikethrough") }),
  z.object({ type: z.literal("highlight") }),
  z.object({
    type: z.literal("link"),
    href: z.url(),
    newTab: z.boolean().optional(),
  }),
  // `id` groups the run and anchors it; the ordinal comes from document order.
  z.object({
    type: z.literal("sidenote"),
    id: z.string().min(1),
    text: z.string(),
  }),
]);

export type Mark = z.infer<typeof MarkSchema>;

export const TextNodeSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  marks: z.array(MarkSchema).optional(),
});

export type TextNode = z.infer<typeof TextNodeSchema>;

export const InlineNodeSchema = TextNodeSchema;
export type InlineNode = TextNode;

// `indent` shifts a block one list level right, aligning it with list-item text.
export const ParagraphNodeSchema = z.object({
  type: z.literal("paragraph"),
  children: z.array(InlineNodeSchema),
  indent: z.boolean().optional(),
  // Left is the absence of this field; there is deliberately no "left".
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

// Consecutive items form one list, numbered at render (src/utils/list-numbering.ts).
// `marker` and `continued` are read from a run's first item; `start` restarts the count.
export const ListItemNodeSchema = z.object({
  type: z.literal("list_item"),
  children: z.array(InlineNodeSchema),
  marker: z.enum(["decimal", "alpha"]).optional(),
  continued: z.boolean().optional(),
  start: z.number().int().positive().optional(),
});

// `marker` is per item here, unlike `list_item`'s per-run marker.
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

/** `u_colors` is a `vec4[10]`. */
export const BACKGROUND_EFFECT_MAX_COLORS = 10;

// #RRGGBBAA only: alpha lives in the colour, never in a sibling field.
const BackgroundColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{8}$/, "Expected an #RRGGBBAA colour");

/** Wraps stored 0..360 rotations into the signed range before the field enforces it. */
function normaliseEffectRotation(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const effect = { ...(value as Record<string, unknown>) };
  if (typeof effect.rotation === "number") {
    effect.rotation = wrapRotation(effect.rotation);
  }
  return effect;
}

// Every field needs a default so older stored effects still parse. Ranges are the
// shader's own uniform ranges: the GPU silently clamps anything outside them.
export const BackgroundEffectSchema = z.preprocess(
  normaliseEffectRotation,
  z.object({
  colors: z
    .array(BackgroundColorSchema)
    .min(1)
    .max(BACKGROUND_EFFECT_MAX_COLORS)
    .default(["#FFAB6FFF", "#FF4D97FF"]),
  /** Placement seed, not a position. */
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
  rotation: z
    .number()
    .min(ROTATION_MIN)
    .max(ROTATION_MAX)
    .default(wrapRotation(270)),
  offsetX: z.number().min(-1).max(1).default(0),
  offsetY: z.number().min(-1).max(1).default(0),
  }),
);

export type BackgroundEffect = z.infer<typeof BackgroundEffectSchema>;

export const DEFAULT_BACKGROUND_EFFECT: BackgroundEffect =
  BackgroundEffectSchema.parse({});

export const MediaFitSchema = z.enum(["cover", "contain"]);

export type MediaFit = z.infer<typeof MediaFitSchema>;

export const DEFAULT_MEDIA_FIT: MediaFit = "cover";

/** Eleven stops, one per tick the slider draws. */
export const MEDIA_PADDING_STEP = 8;
export const MEDIA_PADDING_MAX = 80;

/** Padding is authored in px at this width (the article column), rendered as a percentage. */
export const MEDIA_PADDING_REFERENCE = 640;

/** Eleven stops, one per tick the slider draws. */
export const MEDIA_RADIUS_STEP = 2;
export const MEDIA_RADIUS_MAX = 20;

export const DEFAULT_MEDIA_RADIUS = 0;

const BaseMediaSchema = z.object({
  type: z.literal("media"),
  src: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  backgroundEffect: BackgroundEffectSchema.optional(),
  // Absent-means-default, not `.default()`: a default would make the parsed type require it.
  objectFit: MediaFitSchema.optional(),
  // Stored in px at `MEDIA_PADDING_REFERENCE`, rendered as a share of the container.
  padding: z
    .number()
    .min(0)
    .max(MEDIA_PADDING_MAX)
    .multipleOf(MEDIA_PADDING_STEP)
    .optional(),
  // Absent is zero (square).
  borderRadius: z
    .number()
    .min(0)
    .max(MEDIA_RADIUS_MAX)
    .multipleOf(MEDIA_RADIUS_STEP)
    .optional(),
  // The source's pixel size, recorded at insert; only the ratio is read (`mediaReservedAspect`).
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

/**
 * `type` is the block's identity and `kind` the format. `type` stays "media" on both
 * arms so `BlockNodeSchema` routes on it; clip-only fields go on the video arm.
 */
export const MediaNodeSchema = z.discriminatedUnion("kind", [
  BaseMediaSchema.extend({ kind: z.literal("image") }),
  BaseMediaSchema.extend({
    kind: z.literal("video"),
    /** Still shown where the clip can't play (first paint, OG images). */
    poster: z.url().optional(),
  }),
]);

export type MediaNode = z.infer<typeof MediaNodeSchema>;

export type MediaKind = MediaNode["kind"];

// The editor's 3×2 grid of slots. Index 0 is the featured item; featuring is a move to the front.
export const COLLECTION_MAX_ITEMS = 6;

/**
 * Backfills `kind` on legacy media. Runs as a preprocess because the discriminated
 * union routes on the raw `kind`; unrecognised sources default to `"image"`.
 */
function withMediaKind(node: unknown, typeRequired: boolean): unknown {
  if (!node || typeof node !== "object" || "kind" in node) return node;
  const { type, src } = node as { type?: unknown; src?: unknown };
  // Other block types pass through this preprocess untouched.
  if (type !== undefined && type !== "image") return node;
  // A missing `type` here is malformed, not legacy: leave it for the union to reject.
  if (type === undefined && typeRequired) return node;
  if (typeof src !== "string") return node;

  const kind = isVideoSource(src) ? "video" : "image";
  // Only the log is dev-only; the stamp below must stay unconditional.
  if (process.env.NODE_ENV !== "production") {
    const extension = sourceExtension(src);
    console.warn(
      `[media-migration] ${src} → kind: "${kind}"` +
        (extension ? ` (from .${extension})` : " (no extension — picture bias)"),
    );
  }
  return { ...node, type: "media", kind };
}

/** The preprocess is a permanent migration: documents nobody re-saves must still parse. */
export const StoredMediaBlockSchema = z.preprocess(
  (node) => withMediaKind(node, true),
  MediaNodeSchema,
);

/** As `StoredMediaBlockSchema`, but also accepts typeless legacy collection items. */
export const StoredMediaItemSchema = z.preprocess(
  (node) => withMediaKind(node, false),
  MediaNodeSchema,
);

export const CollectionItemSchema = StoredMediaItemSchema;

export type CollectionItem = MediaNode;

export type MediaLayout = Pick<
  MediaNode,
  "objectFit" | "padding" | "borderRadius"
>;

export function hasMediaLayout(media: MediaLayout): boolean {
  return Boolean(media.padding) || Boolean(media.borderRadius);
}

function mediaRadiusValue(media: MediaLayout): string | number {
  const radius = media.borderRadius ?? DEFAULT_MEDIA_RADIUS;
  if (radius === 0) return DEFAULT_MEDIA_RADIUS;
  return `${(radius / MEDIA_PADDING_REFERENCE) * 100}cqw`;
}

/** For the lightbox, which can't be a query container: the radius against a measured width. */
export function mediaRadiusPx(
  media: MediaLayout,
  width: number = MEDIA_PADDING_REFERENCE,
): number {
  const radius = media.borderRadius ?? DEFAULT_MEDIA_RADIUS;
  return (radius / MEDIA_PADDING_REFERENCE) * width;
}

export function mediaInsetPx(
  media: MediaLayout,
  width: number = MEDIA_PADDING_REFERENCE,
): number {
  return ((media.padding ?? 0) / MEDIA_PADDING_REFERENCE) * width;
}

/** The picture's share of its box's width once both bands are taken out. */
export function mediaPictureShare(media: MediaLayout): number {
  return 1 - (2 * (media.padding ?? 0)) / MEDIA_PADDING_REFERENCE;
}

/** Divides a height budget to leave room for the top and bottom bands; `aspect` is the file's. */
export function mediaHeightBudgetFactor(
  media: MediaLayout,
  aspect: number = 1,
): number {
  const padding = media.padding ?? 0;
  if (!padding) return 1;
  const share = (padding / MEDIA_PADDING_REFERENCE) * aspect;
  return 1 + (2 * share) / mediaPictureShare(media);
}

/** The lightbox frame width implied by the picture's measured width (the reverse would loop). */
export function mediaContainerWidth(
  media: MediaLayout,
  pictureWidth: number,
): number {
  return pictureWidth / mediaPictureShare(media);
}

/**
 * The query container the corner is measured against. The inset lives on the inner
 * box (`mediaBoxStyle`) so the corner measures the full width.
 */
export function mediaFrameStyle(media: MediaLayout): CSSProperties {
  // Only a corner needs containment: in a shrink-wrapping box (the lightbox) it collapses to zero.
  if (!media.borderRadius) return { display: "contents" };
  return {
    // `inline-size`, not `size`: the height still comes from the contents.
    containerType: "inline-size",
    // Containment is silently ignored on an inline box (e.g. a `<span>`).
    display: "block",
    width: "100%",
    height: "100%",
  };
}

export function mediaBoxStyle(media: MediaLayout): CSSProperties {
  if (!hasMediaLayout(media)) return { display: "contents" };
  return {
    // A percentage padding resolves against the containing block's width on all four sides.
    padding: `${((media.padding ?? 0) / MEDIA_PADDING_REFERENCE) * 100}%`,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

/** The corner is in `cqw`: a percentage border-radius resolves per axis and draws an ellipse. */
export function mediaObjectStyle(media: MediaLayout): CSSProperties {
  const objectFit = media.objectFit ?? DEFAULT_MEDIA_FIT;
  return {
    objectFit,
    ...(hasMediaLayout(media) && objectFit === "contain"
      ? { width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }
      : {}),
    // Always stated, zero included, so it outranks any corner class the surface applies.
    borderRadius: mediaRadiusValue(media),
  };
}

/** The reserved shape for media with no recorded dimensions. */
export const MEDIA_PLACEHOLDER_ASPECT = "3 / 2";

export type MediaShape = Pick<MediaNode, "width" | "height">;

export function mediaReservedAspect(shape: MediaShape): string {
  const { width, height } = shape;
  if (!width || !height) return MEDIA_PLACEHOLDER_ASPECT;
  return `${width} / ${height}`;
}

/** Holds the box until the source can size itself; a padded `contain` picture also needs a width. */
export function mediaReservationStyle(
  shape: MediaShape,
  media?: MediaLayout,
): CSSProperties {
  const reserved: CSSProperties = { aspectRatio: mediaReservedAspect(shape) };
  const sizedToItsContent =
    media &&
    hasMediaLayout(media) &&
    (media.objectFit ?? DEFAULT_MEDIA_FIT) === "contain";
  return sizedToItsContent
    ? { ...reserved, width: "100%", height: "auto" }
    : reserved;
}

// `items` may be empty: removing items one by one passes through zero.
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

// `children` is the large value; `caption` the eyebrow above it, `subtext` the line below.
export const MetricNodeSchema = z.object({
  type: z.literal("metric"),
  children: z.array(InlineNodeSchema),
  caption: z.string().optional(),
  subtext: z.string().optional(),
  indent: z.boolean().optional(),
});

/** Refuses schemes that run (`javascript:`, `data:`): the value becomes a public `href`. */
export const ButtonLinkHrefSchema = z.union([
  z.literal(""),
  z.string().regex(/^[/#?]/),
  z.url({ protocol: /^(https?|mailto|tel)$/ }),
]);

export const ButtonLinkNodeSchema = z.object({
  type: z.literal("button_link"),
  text: z.string(),
  href: ButtonLinkHrefSchema,
  newTab: z.boolean().optional(),
  /** Pinned to the screen's foot until its place scrolls up, then to the head. */
  sticky: z.boolean().optional(),
  color: z.enum(["neutral", "accent"]).optional(),
});

export type ButtonLinkNode = z.infer<typeof ButtonLinkNodeSchema>;
export type ButtonLinkColor = NonNullable<ButtonLinkNode["color"]>;

// Fieldless blocks that mark where a fixed piece of the site renders.

/** The homepage's masonry of projects, articles and published components. */
export const ProjectGridNodeSchema = z.object({
  type: z.literal("project_grid"),
});

export const SocialLinksNodeSchema = z.object({
  type: z.literal("social_links"),
});

// Keep the type union and the `z.union` array below in sync.

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
  | ButtonLinkNode
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
  ButtonLinkNodeSchema,
  ProjectGridNodeSchema,
  SocialLinksNodeSchema,
]);
