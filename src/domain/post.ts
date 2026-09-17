import { z } from "zod";
import { BlockNodeSchema, type MediaNode } from "./nodes";
import { LinkCardMediaSchema, LinkCardToneSchema } from "./link-card";
import { SUMMARY_MAX_CHARS } from "@/utils/post-summary";
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
 * picture to show where the reader's theme is dark, the line above the name on
 * a card the post files under nothing, whether the caption stands on a scrim,
 * and which tone that band is pinned to. The same things a link card's author
 * sets, from the same schemas, so the two cards cannot be given different
 * vocabularies for one band.
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
 * `meta` is the one LINE of the caption a post can leave unwritten. The name
 * and the destination are always the post's, and so is the line above the name
 * wherever the post has one — an article's card is filed by its publication
 * date. A project is filed by nothing, so that line is empty and this fills
 * it: "Case Study", a client, a year. The post's own line still wins where
 * there is one (see `PostCard`), which is what lets the rail offer this row
 * only on the cards it can honestly claim it authors.
 *
 * `meta`, `scrim` and `tone` sit at the top level rather than under a
 * `content` key as the link card's do, because a post's card has no content
 * section — the rest of the words are the post's. They are the one line, and
 * the ground the words stand on.
 *
 * Nothing is required, for the reason nothing in `LinkCardConfigSchema` is: an
 * empty object is a card nobody has touched, and it draws exactly as it did.
 */
export const PostCardConfigSchema = z.object({
  media: LinkCardMediaSchema.optional(),
  meta: z.string().optional(),
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

// Keep in step with the Prisma enum, and describe each value in
// `POST_CATEGORIES` (`src/data/post-categories.ts`) — the Record there fails to
// compile until a new one is.
export const PostCategorySchema = z.enum([
  "ARTICLE",
  "WORK",
  "PROTOTYPE",
  "PAGE",
]);

export type PostCategory = z.infer<typeof PostCategorySchema>;

/**
 * Slugs a post may not take, because the site already answers at them.
 *
 * Every post is edited at `/edit/<slug>`, and that folder also holds the admin
 * surface's own pages: a post called `new` would be edited at the address that
 * starts a draft. `home` and `about` are pages' records as well, which the
 * unique index would refuse anyway — they are listed so the sidebar can say so
 * before a save fails on them.
 */
export const RESERVED_POST_SLUGS = ["new", "home", "about", "testimonials"];

/**
 * A post's address, as the author types it into the metadata sidebar.
 *
 * Lowercase letters, digits and hyphens, beginning and ending on a letter or a
 * digit — the same alphabet `generateSlug` mints from a title, including the
 * doubled hyphen it leaves where a title had a dash between spaces, so an
 * address that is already live stays saveable as it is. 80 characters is where
 * `generateSlug` cuts.
 */
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

/**
 * How long a written search description may run — the summary's own cap, so a
 * description typed by hand is held to the length the one read off the opening
 * paragraph is trimmed to. See `SUMMARY_MAX_CHARS` for why that is 200.
 */
export const POST_DESCRIPTION_MAX_LENGTH = SUMMARY_MAX_CHARS;

/**
 * What a post says about itself to search engines and link previews, in place
 * of the summary read off its opening (`postSummary`).
 *
 * Empty is not a description. An emptied box is the author taking the override
 * away, so it is stored as null — and null is what hands the page back to its
 * opening paragraph.
 */
export const PostDescriptionSchema = z
  .string()
  .trim()
  .max(
    POST_DESCRIPTION_MAX_LENGTH,
    `Keep a description to ${POST_DESCRIPTION_MAX_LENGTH} characters.`,
  )
  .nullable()
  .transform((description) => description || null);

/**
 * What the metadata sidebar edits: which category a post is filed under, its
 * address, and its search description. Each part is optional, so a save that
 * does not touch one leaves it alone. Whether a CHANGE to the category or the
 * address is allowed depends on the post being changed, which is the save's to
 * decide (`saveDraft`) — a page's address is fixed by its route.
 */
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
  // The written search description, or null for the summary read off the
  // opening. Read as stored rather than through `PostDescriptionSchema`, which
  // is the WRITE's rule — see `postDescription` for how the two are chosen.
  description: z.string().nullable().optional(),
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

/**
 * A post as a LIST knows it: enough to name it and to go there, and nothing
 * of the document. The palette lists every published project this way, for
 * everyone, so it has to be light enough to fetch on every open and must carry
 * nothing a visitor is not already served at the post's own address.
 */
export const PostLinkSchema = PostSchema.pick({ slug: true, title: true });

export type PostLink = z.infer<typeof PostLinkSchema>;

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
