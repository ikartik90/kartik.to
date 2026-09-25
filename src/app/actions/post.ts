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

// Deliberately public: `getPublishedProjects`, which returns only published titles and slugs.

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
  // Only a CHANGED slug is validated: a page's own slug is on the reserved list.
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
  if (movesCategory || movesSlug) revalidatePostPaths(existing);
  revalidatePostPaths(post);
  return post;
}

/** Admin-only: answering a visitor would confirm which drafts exist. */
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

export async function getPublishedProjects(): Promise<PostLink[]> {
  const rows = await prisma.post.findMany({
    where: { category: "WORK", publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, title: true },
  });

  return rows.map((row) => PostLinkSchema.parse(row));
}
