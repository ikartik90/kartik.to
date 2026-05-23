"use server";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import { DocumentSchema, PostSchema, type Document, type Post } from "@/domain/post";
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
// Helpers
// ---------------------------------------------------------------------------

function parsePost(raw: unknown): Post {
  const record = raw as Record<string, unknown>;
  return PostSchema.parse({
    ...record,
    content: DocumentSchema.parse(record.content),
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createDraft({
  title,
  document,
}: {
  title?: string;
  document: Document;
}): Promise<Post> {
  await requireAdmin();

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
      category: "ARTICLE",
      content: document as object,
      untitledIndex,
      publishedAt: null,
    },
  });

  return parsePost(raw);
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

  return parsePost(raw);
}

export async function publishPost(id: string): Promise<Post> {
  await requireAdmin();

  const raw = await prisma.post.update({
    where: { id },
    data: { publishedAt: new Date() },
  });

  return parsePost(raw);
}

export async function deleteDraft(id: string): Promise<void> {
  await requireAdmin();
  await prisma.post.delete({ where: { id } });
}

export async function getDrafts(): Promise<Post[]> {
  await requireAdmin();

  const raws = await prisma.post.findMany({
    where: { publishedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return raws.map(parsePost);
}
