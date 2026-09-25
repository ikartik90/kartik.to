import { z } from "zod";
import { BlockNodeSchema, type MediaNode } from "./nodes";
import { LinkCardMediaSchema, LinkCardToneSchema } from "./link-card";
import { SUMMARY_MAX_CHARS } from "@/utils/post-summary";
import {
  ComponentAspectSchema,
  GridIndexSchema,
  GridSpanSchema,
} from "./component";

export const DocumentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(BlockNodeSchema),
});

export type Document = z.infer<typeof DocumentSchema>;

/**
 * A post card's authored overrides. `media` present means the author took the picture
 * over (absent: the document's cover); `meta` shows only where the post has no line of its own.
 */
export const PostCardConfigSchema = z.object({
  media: LinkCardMediaSchema.optional(),
  meta: z.string().optional(),
  scrim: z.boolean().optional(),
  tone: LinkCardToneSchema.optional(),
});

export type PostCardConfig = z.infer<typeof PostCardConfigSchema>;

/** An empty dark slot (`null`) means the light picture shows in both themes. */
export function postCardMedia(
  config: PostCardConfig,
  derived: MediaNode | null,
): { light: MediaNode | null; dark: MediaNode | null } {
  if (!config.media) return { light: derived, dark: null };
  return {
    light: config.media.light ?? null,
    dark: config.media.dark ?? null,
  };
}

// Keep in step with the Prisma enum; `POST_CATEGORIES` won't compile until a new value is described.
export const PostCategorySchema = z.enum([
  "ARTICLE",
  "WORK",
  "PROTOTYPE",
  "PAGE",
]);

export type PostCategory = z.infer<typeof PostCategorySchema>;

/** Addresses the site already answers at (e.g. `/edit/new`, page records). */
export const RESERVED_POST_SLUGS = ["new", "home", "about", "testimonials"];

/** The alphabet `generateSlug` mints (doubled hyphens included), so live slugs stay saveable. */
export const PostSlugSchema = z
  .string()
  .trim()
  .min(1, "An address needs at least one character.")
  .max(80, "Keep an address to 80 characters.")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Use lowercase letters, numbers and hyphens.",
  )
  .refine(
    (slug) => !RESERVED_POST_SLUGS.includes(slug),
    "The site already uses that address.",
  );

export const POST_DESCRIPTION_MAX_LENGTH = SUMMARY_MAX_CHARS;

/** An emptied box is stored as null, handing the page back to its opening summary. */
export const PostDescriptionSchema = z
  .string()
  .trim()
  .max(
    POST_DESCRIPTION_MAX_LENGTH,
    `Keep a description to ${POST_DESCRIPTION_MAX_LENGTH} characters.`,
  )
  .nullable()
  .transform((description) => description || null);

/** Omitted parts are left alone; whether a change is allowed is `saveDraft`'s call. */
export const PostMetadataSchema = z.object({
  category: PostCategorySchema.optional(),
  slug: PostSlugSchema.optional(),
  description: PostDescriptionSchema.optional(),
});

export type PostMetadata = z.input<typeof PostMetadataSchema>;

export const PostSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional(),
  slug: z.string().min(1),
  category: PostCategorySchema.default("ARTICLE"),
  content: DocumentSchema,
  description: z.string().nullable().optional(),
  coverImageKey: z.string().nullable().optional(),
  aspect: ComponentAspectSchema.nullable().optional(),
  publishedAt: z.date().nullable().optional(),
  untitledIndex: z.number().int().nullable().optional(),
  gridIndex: GridIndexSchema.nullable().optional(),
  gridSpan: GridSpanSchema.nullable().optional(),
  // Read leniently: a blob that no longer parses must not 404 the post. The write
  // (`saveGridLayout`) is strict.
  card: PostCardConfigSchema.nullable().catch(null).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Post = z.infer<typeof PostSchema>;

/** Served to every visitor via the palette: must carry nothing the post's page doesn't. */
export const PostLinkSchema = PostSchema.pick({ slug: true, title: true });

export type PostLink = z.infer<typeof PostLinkSchema>;

export const CreatePostInputSchema = PostSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreatePostInput = z.infer<typeof CreatePostInputSchema>;

export const UpdatePostInputSchema = PostSchema.partial().required({ id: true });

export type UpdatePostInput = z.infer<typeof UpdatePostInputSchema>;
