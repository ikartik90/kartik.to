"use server";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import {
  CoverContentSchema,
  type Cover,
  type CoverContent,
} from "@/domain/cover";
import type { ShaderId } from "@/data/shader-specs";

// ---------------------------------------------------------------------------
// Mutations for saved covers — the shader backgrounds authored in the
// playground and reused wherever a surface wants a ground.
//
// Every write goes through `CoverContentSchema` rather than trusting the
// caller's object. These actions are a public HTTP surface, not an internal
// function call, so "the playground only ever sends valid params" is not a
// guarantee this layer is allowed to make on its own — and the schema is also
// what NORMALISES on the way in (six-digit colours padded, retired keys
// stripped, missing ones defaulted), so parsing here is what keeps one shape in
// the column rather than whatever a given build happened to send.
// ---------------------------------------------------------------------------

async function requireAdmin(): Promise<void> {
  const { data: session } = await auth.getSession();
  if (!session?.user?.email || session.user.email !== env.ADMIN_GITHUB_ID) {
    throw new Error("Unauthorized");
  }
}

/** The row as the app holds it, with the blob parsed back into content. */
function parseCover(row: {
  id: string;
  title: string | null;
  untitledIndex: number | null;
  shaderId: string;
  settings: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Cover & CoverContent {
  const content = CoverContentSchema.parse({
    shaderId: row.shaderId,
    settings: row.settings,
  });
  return { ...row, ...content };
}

export async function getCovers(): Promise<(Cover & CoverContent)[]> {
  await requireAdmin();
  const rows = await prisma.cover.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map(parseCover);
}

export async function getCover(
  id: string,
): Promise<(Cover & CoverContent) | null> {
  await requireAdmin();
  const row = await prisma.cover.findUnique({ where: { id } });
  return row ? parseCover(row) : null;
}

export async function createCover({
  title,
  shaderId,
  settings,
}: {
  title?: string | null;
  shaderId: ShaderId;
  settings: unknown;
}): Promise<Cover & CoverContent> {
  await requireAdmin();
  const content = CoverContentSchema.parse({ shaderId, settings });

  // Named the way an untitled draft is, and counted the same way: the highest
  // index so far plus one, so a deleted cover does not hand its number to the
  // next one and leave two "Untitled 3"s a month apart.
  let untitledIndex: number | null = null;
  if (!title?.trim()) {
    const result = await prisma.cover.aggregate({
      _max: { untitledIndex: true },
    });
    untitledIndex = (result._max.untitledIndex ?? 0) + 1;
  }

  const row = await prisma.cover.create({
    data: {
      title: title?.trim() || null,
      untitledIndex,
      shaderId: content.shaderId,
      settings: content.settings as object,
    },
  });
  return parseCover(row);
}

export async function saveCover({
  id,
  title,
  shaderId,
  settings,
}: {
  id: string;
  title?: string | null;
  shaderId: ShaderId;
  settings: unknown;
}): Promise<Cover & CoverContent> {
  await requireAdmin();
  const content = CoverContentSchema.parse({ shaderId, settings });

  const row = await prisma.cover.update({
    where: { id },
    data: {
      // `title` is only written when the caller has an opinion. Undefined is
      // Prisma's "leave it", which is what a save from the playground wants:
      // it edits the picture, not the name.
      ...(title === undefined ? {} : { title: title?.trim() || null }),
      shaderId: content.shaderId,
      settings: content.settings as object,
    },
  });
  return parseCover(row);
}

export async function deleteCover(id: string): Promise<void> {
  await requireAdmin();
  await prisma.cover.delete({ where: { id } });
}
