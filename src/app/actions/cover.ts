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
//
// READING is public and WRITING is the author's, which is a split the file used
// to not have: every action required the admin session, so the playground's
// preset strip was the author's alone. A visitor can now walk into the
// playground and take up a saved cover — but only one that has been PUBLISHED,
// which is `publishedAt`'s whole job. The gate is here rather than in the
// components that draw the strip: a component decides what to draw, and this is
// the layer that decides what may be seen.
// ---------------------------------------------------------------------------

/**
 * Whether the caller is the author — the question `requireAdmin` throws on.
 *
 * Separate from it because the reads need the ANSWER rather than the throw:
 * they serve everybody and only the size of the answer changes. Written once,
 * so the two can never come to different conclusions about the same session.
 */
async function isAdmin(): Promise<boolean> {
  const { data: session } = await auth.getSession();
  return (
    !!session?.user?.email && session.user.email === env.ADMIN_GITHUB_ID
  );
}

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}

/** The row as the app holds it, with the blob parsed back into content. */
function parseCover(row: {
  id: string;
  title: string | null;
  untitledIndex: number | null;
  shaderId: string;
  settings: unknown;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Cover & CoverContent {
  const content = CoverContentSchema.parse({
    shaderId: row.shaderId,
    settings: row.settings,
  });
  return { ...row, ...content };
}

/**
 * The saved library, newest FIRST — the order the playground's presets strip
 * shows them in, stated here because the database is the only thing that knows
 * it. Nothing downstream re-sorts: a second answer to "what order are these in"
 * is a second place for it to be wrong.
 *
 * By `createdAt`, not `updatedAt`, and the difference is the whole point: the
 * strip is a record of what has been ADDED, and ordering by last-touched would
 * make a preset jump to the front of the row every time you pressed ⌘S while
 * editing it — the row reshuffling under the pointer that is using it.
 */
export async function getCovers(): Promise<(Cover & CoverContent)[]> {
  // A visitor is shown the PUBLISHED covers and no others. The playground is
  // public and so is its strip, but saving is how the author keeps a half-tuned
  // idea overnight — and a library that showed those would turn every save into
  // an act of publishing, which is the pressure that stops you saving.
  const rows = await prisma.cover.findMany({
    where: (await isAdmin()) ? {} : { publishedAt: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(parseCover);
}

/**
 * One saved cover, by id — the route `/playground/cover/[id]` opens on.
 *
 * An unpublished cover answers NULL to a visitor rather than throwing, and the
 * difference matters: the route turns null into a 404, so "not published" and
 * "no such cover" are indistinguishable from outside. An Unauthorized here
 * would have said a cover by that id exists.
 */
export async function getCover(
  id: string,
): Promise<(Cover & CoverContent) | null> {
  const row = await prisma.cover.findUnique({ where: { id } });
  if (!row) return null;
  if (!row.publishedAt && !(await isAdmin())) return null;
  return parseCover(row);
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

/**
 * Put a cover on show — which is what makes it visible to anybody but the
 * author, in the strip and at its own route.
 *
 * The SAVED cover, not what is currently in the panel: publishing and saving
 * are separate presses here exactly as they are for an article, so that ⌘S
 * stays the only thing that decides between creating and updating a row.
 */
export async function publishCover(
  id: string,
): Promise<Cover & CoverContent> {
  await requireAdmin();
  const row = await prisma.cover.update({
    where: { id },
    data: { publishedAt: new Date() },
  });
  return parseCover(row);
}

/**
 * Take a cover back off show, without destroying it.
 *
 * Clearing the date rather than deleting the row, the same call `unpublishPost`
 * makes: the cover is still the author's to open, tune and put back out, and
 * the destructive half of "remove this" is `deleteCover`.
 *
 * No confirmation in front of it, unlike unpublishing an article. This one is
 * undone by pressing the same button again, and `ConfirmDialog` is for what
 * cannot be.
 */
export async function unpublishCover(
  id: string,
): Promise<Cover & CoverContent> {
  await requireAdmin();
  const row = await prisma.cover.update({
    where: { id },
    data: { publishedAt: null },
  });
  return parseCover(row);
}

export async function deleteCover(id: string): Promise<void> {
  await requireAdmin();
  await prisma.cover.delete({ where: { id } });
}
