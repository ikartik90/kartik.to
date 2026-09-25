import { prisma } from "@/lib/prisma";
import {
  DocumentSchema,
  PostCategorySchema,
  PostSchema,
  type Post,
  type PostCategory,
} from "@/domain/post";
import { LISTED_CATEGORIES } from "@/data/post-categories";
import { getPostReadUrl } from "@/utils/post-urls";

export function parsePost(raw: unknown): Post {
  const record = raw as Record<string, unknown>;
  return PostSchema.parse({
    ...record,
    content: DocumentSchema.parse(record.content),
  });
}

export function parseCategory(value: string | undefined): PostCategory | null {
  const result = PostCategorySchema.safeParse(value);
  return result.success ? result.data : null;
}

export async function getPublishedPostBySlug(
  slug: string,
  category: PostCategory,
): Promise<Post | null> {
  try {
    const raw = await prisma.post.findFirst({
      where: { slug, category, publishedAt: { not: null } },
    });
    if (!raw) return null;
    return parsePost(raw);
  } catch {
    return null;
  }
}

export async function getDraftPostBySlug(
  slug: string,
  category: PostCategory,
): Promise<Post | null> {
  try {
    const raw = await prisma.post.findFirst({
      where: { slug, category, publishedAt: null },
    });
    if (!raw) return null;
    return parsePost(raw);
  } catch {
    return null;
  }
}

/** Published first, then the draft when `allowDraft` (the admin); null means 404. */
export async function resolvePost(
  slug: string,
  category: PostCategory,
  options: { allowDraft: boolean },
): Promise<Post | null> {
  const published = await getPublishedPostBySlug(slug, category);
  if (published) return published;

  if (options.allowDraft) {
    const draft = await getDraftPostBySlug(slug, category);
    if (draft) return draft;
  }

  return null;
}

/**
 * A refiled or renamed post's current path. Checked here rather than as a config redirect,
 * which fires before the database is read. Drafts only with `allowDraft`, lest it confirm them.
 */
export async function findMovedPostPath(
  slug: string,
  category: PostCategory,
  options: { allowDraft: boolean },
): Promise<string | null> {
  const published = options.allowDraft ? {} : { publishedAt: { not: null } };
  try {
    const holder = await prisma.post.findFirst({
      where: {
        slug,
        category: { in: LISTED_CATEGORIES.filter((c) => c !== category) },
        ...published,
      },
      select: { slug: true, category: true },
    });
    const moved =
      holder ??
      (await prisma.post.findFirst({
        where: {
          previousSlugs: { has: slug },
          category: { in: LISTED_CATEGORIES },
          ...published,
        },
        orderBy: { updatedAt: "desc" },
        select: { slug: true, category: true },
      }));
    return moved ? getPostReadUrl(moved.category, moved.slug) : null;
  } catch {
    return null;
  }
}

export async function getPublishedPostsByCategory(
  category: PostCategory,
): Promise<Post[]> {
  try {
    const raws = await prisma.post.findMany({
      where: { category, publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
    });
    return raws.map(parsePost);
  } catch {
    return [];
  }
}
