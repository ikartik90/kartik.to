import { z } from "zod";
import { BlockNodeSchema, type MediaNode } from "./nodes";
import { LinkCardMediaSchema, LinkCardToneSchema } from "./link-card";
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
// The post's card — what the homepage draws for it beyond what it decides
// ---------------------------------------------------------------------------

/**
 * How a post's card is drawn, beyond what the post itself decides.
 *
 * A post's card is DERIVED. Its words are the post's title and date, its
 * destination is the slug, and its picture is the first media in the document
 * (`postCover`) — none of that is authored twice. This is the remainder: which
 * picture to show where the reader's theme is dark, whether the caption stands
 * on a scrim, and which tone that band is pinned to. The same three things a
 * link card's author sets, from the same schemas, so the two cards cannot be
 * given different vocabularies for one band.
 *
 * `media` PRESENT means the author has taken the picture over: what is in it
 * is what shows, and an emptied slot is a flat plate. Absent means the document
 * decides, which is what every card that predates this does. It is the whole
 * pair rather than a slot at a time, because that is the only reading the rail
 * can be honest about: the section is seeded with the document's picture when
 * it is opened (see `PostCardSections`), so the slot always names the file the
 * card is actually showing, and clearing it means what "Remove" means
 * everywhere else. A light slot that fell back to the document when empty
 * would be a slot reading "Add" over a card wearing a picture.
 *
 * `scrim` and `tone` sit at the top level rather than under a `content` key as
 * the link card's do, because a post's card has no content section — the words
 * are the post's. They are the ground the words stand on, and nothing else.
 *
 * Nothing is required, for the reason nothing in `LinkCardConfigSchema` is: an
 * empty object is a card nobody has touched, and it draws exactly as it did.
 */
export const PostCardConfigSchema = z.object({
  media: LinkCardMediaSchema.optional(),
  scrim: z.boolean().optional(),
  tone: LinkCardToneSchema.optional(),
});

export type PostCardConfig = z.infer<typeof PostCardConfigSchema>;

/**
 * The pictures a post's card shows, per theme: the authored pair where the
 * author has taken the picture over, and the document's own otherwise.
 *
 * One function rather than a rule restated at each reader, because there are
 * two — the grid draws the card from it, and the rail reads the scrim's default
 * off it — and the two must never disagree about which picture is showing.
 *
 * `null` per slot, not `undefined`: these are answers, not absent keys. An
 * authored dark slot left empty is "no dark picture", which the card reads as
 * "show the light one in both themes" — the same thing it reads off a post
 * that never had one.
 */
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
  // How the card is drawn beyond what the post decides — see the schema. Read
  // LENIENTLY, unlike every other column here: `parsePost` is the one reader
  // of a post and it throws, so a card blob that no longer parsed (a tone
  // renamed, say) would 404 the article over its tile. The card is the trim
  // and the post is the page; a blob that fails reads as no card at all.
  // Strictness lives at the write instead (`saveGridLayout`), which is the
  // only door this ever comes in by.
  card: PostCardConfigSchema.nullable().catch(null).optional(),
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
