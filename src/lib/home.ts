import { prisma } from "@/lib/prisma";
import { DocumentSchema, PostSchema, type Document, type Post } from "@/domain/post";
import { DEFAULT_HOME_DOCUMENT } from "@/data/home-document";
import { HOME_SLUG } from "@/data/page-slugs";

/**
 * The homepage's stored content, or null if it has never been edited.
 *
 * Null rather than a thrown error on every failure path — an unreachable
 * database, a row that does not parse, or simply no row yet all mean the same
 * thing to the caller: fall back to the default document. The homepage is the
 * last page that should be able to 500.
 */
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

/**
 * What the author wrote in the metadata sidebar for search engines to say about
 * the homepage, or null — for no row, no description, or a database that cannot
 * be reached, all of which leave the site's own description standing.
 */
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

/**
 * The homepage's record, created from the default document if it has none yet.
 *
 * An upsert on the slug, which is unique, so this is idempotent and safe to run
 * on every load of the edit route. Writing on a GET is not lovely, but the
 * alternative is an editor with no row behind it — and the first save would
 * then have to invent a slug, which `createDraft` derives from the title and
 * would not make "home".
 *
 * Published on creation: the homepage is already live. It is a record of what
 * `/` shows, arriving late, not a draft of it.
 */
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
