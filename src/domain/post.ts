import { z } from "zod";
import { BlockNodeSchema } from "./nodes";

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
  title: z.string().optional(),
  slug: z.string().min(1),
  category: PostCategorySchema.default("ARTICLE"),
  content: DocumentSchema,
  coverImageKey: z.string().optional(),
  publishedAt: z.date().nullable().optional(),
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
