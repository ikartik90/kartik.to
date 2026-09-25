import { prisma } from "@/lib/prisma";
import { DocumentSchema, PostSchema, type Document, type Post } from "@/domain/post";
import { DEFAULT_HOME_DOCUMENT } from "@/data/home-document";
import { HOME_SLUG } from "@/data/page-slugs";

/** The homepage's stored content, or null on any failure so the default shows; the homepage must never 500. */
export async function getHomeDocument(): Promise<Document | null> {
  try {
    const row = await prisma.post.findFirst({
      where: { slug: HOME_SLUG, category: "PAGE" },
      select: { content: true },
    });
    if (!row) return null;
    return DocumentSchema.parse(row.content);
  } catch {
    return null;
  }
}

export async function getHomeDescription(): Promise<string | null> {
  try {
    const row = await prisma.post.findFirst({
      where: { slug: HOME_SLUG, category: "PAGE" },
      select: { description: true },
    });
    return row?.description?.trim() || null;
  } catch {
    return null;
  }
}

/** Upserts the homepage's PAGE record (published: `/` is already live) so the editor always has a row. */
export async function getOrCreateHomePost(): Promise<Post> {
  const row = await prisma.post.upsert({
    where: { slug: HOME_SLUG },
    update: {},
    create: {
      slug: HOME_SLUG,
      category: "PAGE",
      content: DEFAULT_HOME_DOCUMENT,
      publishedAt: new Date(),
    },
  });
  return PostSchema.parse({
    ...row,
    content: DocumentSchema.parse(row.content),
  });
}
