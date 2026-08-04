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

export const ImageNodeSchema = z.object({
  type: z.literal("image"),
  src: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
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
