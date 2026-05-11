import { z } from "zod";

// ---------------------------------------------------------------------------
// Marks — inline formatting annotations attached to text nodes
// ---------------------------------------------------------------------------

export const MarkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("code") }),
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
});

export const BlockquoteNodeSchema = z.object({
  type: z.literal("blockquote"),
  children: z.array(InlineNodeSchema),
});

export const CodeBlockNodeSchema = z.object({
  type: z.literal("code_block"),
  language: z.string().optional(),
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

// ---------------------------------------------------------------------------
// BlockNode union — the single source of truth for all valid block types.
// Add new node schemas to both the type union and the z.union() array below.
// ---------------------------------------------------------------------------

export type BlockNode =
  | z.infer<typeof ParagraphNodeSchema>
  | z.infer<typeof HeadingNodeSchema>
  | z.infer<typeof BlockquoteNodeSchema>
  | z.infer<typeof CodeBlockNodeSchema>
  | z.infer<typeof HorizontalRuleNodeSchema>
  | z.infer<typeof ImageNodeSchema>;

export const BlockNodeSchema: z.ZodType<BlockNode> = z.union([
  ParagraphNodeSchema,
  HeadingNodeSchema,
  BlockquoteNodeSchema,
  CodeBlockNodeSchema,
  HorizontalRuleNodeSchema,
  ImageNodeSchema,
]);
