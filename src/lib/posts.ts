import { prisma } from "@/lib/prisma";
import {
  DocumentSchema,
  PostCategorySchema,
  PostSchema,
  type Post,
  type PostCategory,
} from "@/domain/post";

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

/**
 * The post a public URL names, or null for the 404.
 *
 * Published first, then — for the admin alone — the unpublished draft, so that
 * writing can be read at its real address before it goes out.
 *
 * There is deliberately no third step. This used to fall back to
 * `src/data/articles.ts` / `src/data/projects.ts`, which kept those slugs
 * reachable at `/writing/…` and `/work/…`; the fixtures are not a shadow copy
 * of the site, and a post nobody can edit, unpublish or take down through the
 * app has no business being served by it. They stay in the tree for the
 * playgrounds, where a document is wanted as INPUT rather than as a page.
 */
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
