"use server";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import {
  PostCategorySchema,
  type Document,
  type Post,
  type PostCategory,
} from "@/domain/post";
import { parsePost } from "@/lib/posts";
import { revalidatePostPaths } from "@/lib/revalidate-post";
import { generateSlug } from "@/utils/slug";

// ---------------------------------------------------------------------------
// Auth guard — uses auth.getSession() so it works regardless of whether the
// short-lived session_data cache cookie has expired.
// ---------------------------------------------------------------------------

async function requireAdmin(): Promise<void> {
  const { data: session } = await auth.getSession();
  if (!session?.user?.email || session.user.email !== env.ADMIN_GITHUB_ID) {
    throw new Error("Unauthorized");
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createDraft({
  title,
  document,
  category = "ARTICLE",
}: {
  title?: string;
  document: Document;
  category?: PostCategory;
}): Promise<Post> {
  await requireAdmin();

  const parsedCategory = PostCategorySchema.parse(category);
  const slug = generateSlug(title);

  let untitledIndex: number | null = null;
  if (!title?.trim()) {
    const result = await prisma.post.aggregate({ _max: { untitledIndex: true } });
    untitledIndex = (result._max.untitledIndex ?? 0) + 1;
  }

  const raw = await prisma.post.create({
    data: {
      title: title?.trim() || null,
      slug,
      category: parsedCategory,
      content: document as object,
      untitledIndex,
      publishedAt: null,
    },
  });

  const post = parsePost(raw);
  revalidatePostPaths(post);
  return post;
}

export async function saveDraft({
  id,
  title,
  document,
}: {
  id: string;
  title?: string;
  document: Document;
}): Promise<Post> {
  await requireAdmin();

  const raw = await prisma.post.update({
    where: { id },
    data: {
      title: title?.trim() || null,
      content: document as object,
    },
  });

  const post = parsePost(raw);
  revalidatePostPaths(post);
  return post;
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
