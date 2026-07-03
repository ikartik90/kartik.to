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

export async function resolvePost(
  slug: string,
  category: PostCategory,
  options: {
    staticFallback: Post[];
    allowDraft: boolean;
  },
): Promise<Post | null> {
  const published = await getPublishedPostBySlug(slug, category);
  if (published) return published;

  if (options.allowDraft) {
    const draft = await getDraftPostBySlug(slug, category);
    if (draft) return draft;
  }

  const staticPost = options.staticFallback.find((p) => p.slug === slug);
  if (staticPost) return staticPost;

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

export function mergePosts(dbPosts: Post[], staticPosts: Post[]): Post[] {
  const dbSlugs = new Set(dbPosts.map((p) => p.slug));
  const staticOnly = staticPosts.filter((p) => !dbSlugs.has(p.slug));
  return [...dbPosts, ...staticOnly];
}
