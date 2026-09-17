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

/**
 * Where a post that is not at this address any more lives now, or null for the
 * 404 — asked by a post's page only once `resolvePost` has found nothing.
 *
 * Two ways a post leaves an address, both made from the metadata sidebar. It
 * can be REFILED, which changes the prefix and keeps the slug — and slugs are
 * unique across categories, so `/writing/x` finds `x` wherever it went. Or it
 * can be RENAMED, and the save remembers the slug it left
 * (`Post.previousSlugs`). The current holder of a slug is asked for first, so a
 * post that has since taken an address wins over one that used to have it.
 *
 * Checked at the page rather than as a config redirect, for the reason
 * `/work/scheduling-extensions` always was: a redirect in `next.config.ts`
 * fires before the database is read, and would point at a page that did not
 * exist yet for as long as a deploy and a rename were apart.
 *
 * Drafts are followed for the author alone. A redirect is an answer, and
 * sending a visitor on to an unpublished post would confirm it exists. Pages
 * are never a destination: a page's address is its own route, so nothing is
 * ever moved into one.
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
