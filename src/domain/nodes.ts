import { z } from "zod";

// ---------------------------------------------------------------------------
// Marks — inline formatting annotations attached to text nodes
// ---------------------------------------------------------------------------

export const MarkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("code") }),
  z.object({ type: z.literal("underline") }),
  z.object({ type: z.literal("wavy_underline") }),
  z.object({ type: z.literal("strikethrough") }),
  z.object({ type: z.literal("link"), href: z.url() }),
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

export const ParagraphNodeSchema = z.object({
  type: z.literal("paragraph"),
  children: z.array(InlineNodeSchema),
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
});

export const BlockquoteNodeSchema = z.object({
  type: z.literal("blockquote"),
  children: z.array(InlineNodeSchema),
  caption: z.string().optional(),
});

// A single ordered-list entry. Numbered lists are modelled as runs of
// consecutive `list_item` blocks — the renderer groups them into one <ol> and
// computes each ordinal (plus zero-padding width) from the run's length.
export const ListItemNodeSchema = z.object({
  type: z.literal("list_item"),
  children: z.array(InlineNodeSchema),
});

// A single unordered-list entry. Bulleted lists are runs of consecutive
// `bullet_list_item` blocks — the renderer groups them into one <ul>.
export const BulletListItemNodeSchema = z.object({
  type: z.literal("bullet_list_item"),
  children: z.array(InlineNodeSchema),
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

export const ComponentNodeSchema = z.object({
  type: z.literal("component"),
  componentId: z.string().min(1),
  caption: z.string().optional(),
});

// A metric callout — a large brand-gradient `value` (e.g. "$377k") stacked over
// a descriptive `label`. Modelled like a blockquote: the value is the primary
// inline-node `children` array and the label reuses the shared `caption` field.
export const MetricNodeSchema = z.object({
  type: z.literal("metric"),
  children: z.array(InlineNodeSchema),
  caption: z.string().optional(),
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
  ComponentNodeSchema,
  MetricNodeSchema,
]);
