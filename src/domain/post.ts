import { z } from "zod";
import { BlockNodeSchema } from "./nodes";
// The pin and the span live in `component.ts` because the grid is the whole
// reason that model exists, whereas a Post merely gains a position and a width
// on it. Importing them rather than restating the bounds here is what keeps a
// project card and a component card placed by the same rules — see
// `GridIndexSchema` for why there is no unique constraint behind either of
// them, and `GridSpanSchema` for why a width has a ceiling.
import {
  ComponentAspectSchema,
  GridIndexSchema,
  GridSpanSchema,
} from "./component";

// ---------------------------------------------------------------------------
// Document — the root AST node stored in the database Json column
// ---------------------------------------------------------------------------

export const DocumentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(BlockNodeSchema),
});

export type Document = z.infer<typeof DocumentSchema>;

// ---------------------------------------------------------------------------
// Post
// ---------------------------------------------------------------------------

export const PostCategorySchema = z.enum([
  "ARTICLE",
  "WORK",
  "PAGE",
]);

export type PostCategory = z.infer<typeof PostCategorySchema>;

export const PostSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional(),
  slug: z.string().min(1),
  category: PostCategorySchema.default("ARTICLE"),
  content: DocumentSchema,
  coverImageKey: z.string().nullable().optional(),
  // The card's shape, overriding the listing default. Shares the component's
  // validator so one picker cannot mean two different things.
  aspect: ComponentAspectSchema.nullable().optional(),
  publishedAt: z.date().nullable().optional(),
  untitledIndex: z.number().int().nullable().optional(),
  gridIndex: GridIndexSchema.nullable().optional(),
  gridSpan: GridSpanSchema.nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Post = z.infer<typeof PostSchema>;

// Input schema for creating a new post — omits server-generated fields
export const CreatePostInputSchema = PostSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreatePostInput = z.infer<typeof CreatePostInputSchema>;

// Input schema for updating an existing post — all fields optional except id
export const UpdatePostInputSchema = PostSchema.partial().required({ id: true });

export type UpdatePostInput = z.infer<typeof UpdatePostInputSchema>;
