"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/server";
import {
  PostCategorySchema,
  PostLinkSchema,
  PostMetadataSchema,
  PostSlugSchema,
  type Document,
  type Post,
  type PostCategory,
  type PostLink,
  type PostMetadata,
} from "@/domain/post";
import { POST_CATEGORIES } from "@/data/post-categories";
import { parsePost } from "@/lib/posts";
import { revalidatePostPaths } from "@/lib/revalidate-post";
import { generateSlug } from "@/utils/slug";

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * The unique index on `slug` refusing a write, said in words.
 *
 * The sidebar asks `isPostSlugAvailable` before it offers an address, so this
 * is the race that check cannot close — another tab taking the address between
 * the question and the save. Anything else is rethrown as it came.
 */
function explainSlugConflict(error: unknown): unknown {
  return (error as { code?: unknown } | null)?.code === "P2002"
    ? new Error("Another post already uses that address.")
    : error;
}

export async function createDraft({
  title,
  document,
  category = "ARTICLE",
  slug: typedSlug,
  description,
}: {
  title?: string;
  document: Document;
  category?: PostCategory;
  /** An address typed before the first save; minted from the title if absent. */
  slug?: string;
  description?: string | null;
}): Promise<Post> {
  await requireAdmin();

  const parsedCategory = PostCategorySchema.parse(category);
  const metadata = PostMetadataSchema.parse({ slug: typedSlug, description });
  const slug = metadata.slug ?? generateSlug(title);

  let untitledIndex: number | null = null;
  if (!title?.trim()) {
    const result = await prisma.post.aggregate({ _max: { untitledIndex: true } });
    untitledIndex = (result._max.untitledIndex ?? 0) + 1;
  }

  const raw = await prisma.post
    .create({
      data: {
        title: title?.trim() || null,
        slug,
        category: parsedCategory,
        content: document as object,
        untitledIndex,
        publishedAt: null,
        ...(metadata.description !== undefined
          ? { description: metadata.description }
          : {}),
      },
    })
    .catch((error: unknown) => {
      throw explainSlugConflict(error);
    });

  const post = parsePost(raw);
  revalidatePostPaths(post);
  return post;
}

/**
 * Write the document being edited, and whatever the metadata sidebar changed
 * with it — one save, so the address and the words it serves cannot land apart.
 *
 * A metadata field left out is left alone. Moving a post (a new category or a
 * new address) is refused for a page, whose address is its own route rather
 * than a prefix and a slug; and the address it leaves is remembered, so a link
 * to it still arrives (`findMovedPostPath`).
 */
export async function saveDraft({
  id,
  title,
  document,
  ...fields
}: {
  id: string;
  title?: string;
  document: Document;
} & PostMetadata): Promise<Post> {
  await requireAdmin();

  const { slug: typedSlug, ...rest } = fields;
  const { category, description } = PostMetadataSchema.omit({
    slug: true,
  }).parse(rest);

  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) throw new Error("That post no longer exists.");

  const movesCategory =
    category !== undefined && category !== existing.category;
  // The address is judged only when it CHANGES. A page's own slug is on the
  // reserved list precisely because it is taken — by this post — and saving it
  // back unchanged is not taking it.
  const movesSlug =
    typedSlug !== undefined && typedSlug.trim() !== existing.slug;

  if ((movesCategory || movesSlug) && !POST_CATEGORIES[existing.category].listed) {
    throw new Error("A page's address is fixed.");
  }
  if (movesCategory && !POST_CATEGORIES[category].listed) {
    throw new Error("A post can't be filed as a page.");
  }
  const slug = movesSlug ? PostSlugSchema.parse(typedSlug) : undefined;

  const raw = await prisma.post
    .update({
      where: { id },
      data: {
        title: title?.trim() || null,
        content: document as object,
        ...(movesCategory ? { category } : {}),
        ...(movesSlug
          ? {
              slug,
              // The address being left goes last, and the one being taken is
              // dropped — a post renamed back must not list where it now is.
              previousSlugs: [
                ...existing.previousSlugs.filter((old) => old !== slug),
                existing.slug,
              ],
            }
          : {}),
        ...(description !== undefined ? { description } : {}),
      },
    })
    .catch((error: unknown) => {
      throw explainSlugConflict(error);
    });

  const post = parsePost(raw);
  // The page at the address it left is a redirect now, and the listings that
  // linked there have to be rebuilt as well as the ones at the new address.
  if (movesCategory || movesSlug) revalidatePostPaths(existing);
  revalidatePostPaths(post);
  return post;
}

/**
 * Whether a post other than `id` already has this address — asked by the
 * metadata sidebar while the author types, so a taken address is said under
 * the box rather than discovered by a save that fails.
 *
 * The author's alone: answered for a visitor it would confirm which drafts
 * exist. An address the domain refuses is not available, and is refused
 * without a query.
 */
export async function isPostSlugAvailable(
  slug: string,
  id: string | null,
): Promise<boolean> {
  await requireAdmin();

  const parsed = PostSlugSchema.safeParse(slug);
  if (!parsed.success) return false;

  const holder = await prisma.post.findFirst({
    where: id ? { slug: parsed.data, NOT: { id } } : { slug: parsed.data },
    select: { id: true },
  });
  return holder === null;
}

export async function publishPost(id: string): Promise<Post> {
  await requireAdmin();

  const raw = await prisma.post.update({
    where: { id },
    data: { publishedAt: new Date() },
  });

  const post = parsePost(raw);
  revalidatePostPaths(post);
  return post;
}

/**
 * Take a published post off the site without destroying it.
 *
 * Clearing `publishedAt` rather than deleting: unlike a published component —
 * which is only ever a row saying "show this demo" — an article is the writing
 * itself, and the reversible half of "remove this" is the one that should be a
 * click away. Deleting it outright is `deleteDraft`, and it asks first.
 */
export async function unpublishPost(id: string): Promise<Post> {
  await requireAdmin();

  const raw = await prisma.post.update({
    where: { id },
    data: { publishedAt: null },
  });

  const post = parsePost(raw);
  revalidatePostPaths(post);
  return post;
}

export async function deleteDraft(id: string): Promise<void> {
  await requireAdmin();

  const existing = await prisma.post.findUnique({ where: { id } });
  await prisma.post.delete({ where: { id } });

  if (existing) {
    revalidatePostPaths(parsePost(existing));
  }
}

export async function getDrafts(): Promise<Post[]> {
  await requireAdmin();

  const raws = await prisma.post.findMany({
    where: { publishedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return raws.map(parsePost);
}

/**
 * The published projects, as the palette lists them — for everyone, which is
 * why this is the one read here that asks nobody who they are. It hands out
 * only what a row needs (see `PostLinkSchema`): the title and the address a
 * visitor already gets from the homepage card, and none of the document.
 * Newest first, as the homepage files them.
 */
export async function getPublishedProjects(): Promise<PostLink[]> {
  const rows = await prisma.post.findMany({
    where: { category: "WORK", publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, title: true },
  });

  return rows.map((row) => PostLinkSchema.parse(row));
}
