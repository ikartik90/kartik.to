"use server";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import {
  ShaderPresetContentSchema,
  type ShaderPreset,
  type ShaderPresetContent,
} from "@/domain/shader-preset";
import type { ShaderId } from "@/data/shader-specs";

// ---------------------------------------------------------------------------
// Mutations for saved presets — the shader backgrounds authored in the
// playground and reused wherever a surface wants a ground.
//
// Every write goes through `ShaderPresetContentSchema` rather than trusting the
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
// playground and take up a saved preset — but only one that has been PUBLISHED,
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
function parseShaderPreset(row: {
  id: string;
  title: string | null;
  untitledIndex: number | null;
  shaderId: string;
  settings: unknown;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ShaderPreset & ShaderPresetContent {
  const content = ShaderPresetContentSchema.parse({
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
export async function getShaderPresets(): Promise<(ShaderPreset & ShaderPresetContent)[]> {
  // A visitor is shown the PUBLISHED presets and no others. The playground is
  // public and so is its strip, but saving is how the author keeps a half-tuned
  // idea overnight — and a library that showed those would turn every save into
  // an act of publishing, which is the pressure that stops you saving.
  const rows = await prisma.shaderPreset.findMany({
    where: (await isAdmin()) ? {} : { publishedAt: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(parseShaderPreset);
}

/**
 * One saved preset, by id — the route `/playground/shader/[id]` opens on.
 *
 * An unpublished preset answers NULL to a visitor rather than throwing, and the
 * difference matters: the route turns null into a 404, so "not published" and
 * "no such preset" are indistinguishable from outside. An Unauthorized here
 * would have said a preset by that id exists.
 */
export async function getShaderPreset(
  id: string,
): Promise<(ShaderPreset & ShaderPresetContent) | null> {
  const row = await prisma.shaderPreset.findUnique({ where: { id } });
  if (!row) return null;
  if (!row.publishedAt && !(await isAdmin())) return null;
  return parseShaderPreset(row);
}

export async function createShaderPreset({
  title,
  shaderId,
  settings,
}: {
  title?: string | null;
  shaderId: ShaderId;
  settings: unknown;
}): Promise<ShaderPreset & ShaderPresetContent> {
  await requireAdmin();
  const content = ShaderPresetContentSchema.parse({ shaderId, settings });

  // Named the way an untitled draft is, and counted the same way: the highest
  // index so far plus one, so a deleted preset does not hand its number to the
  // next one and leave two "Untitled 3"s a month apart.
  let untitledIndex: number | null = null;
  if (!title?.trim()) {
    const result = await prisma.shaderPreset.aggregate({
      _max: { untitledIndex: true },
    });
    untitledIndex = (result._max.untitledIndex ?? 0) + 1;
  }

  const row = await prisma.shaderPreset.create({
    data: {
      title: title?.trim() || null,
      untitledIndex,
      shaderId: content.shaderId,
      settings: content.settings as object,
    },
  });
  return parseShaderPreset(row);
}

export async function saveShaderPreset({
  id,
  title,
  shaderId,
  settings,
}: {
  id: string;
  title?: string | null;
  shaderId: ShaderId;
  settings: unknown;
}): Promise<ShaderPreset & ShaderPresetContent> {
  await requireAdmin();
  const content = ShaderPresetContentSchema.parse({ shaderId, settings });

  const row = await prisma.shaderPreset.update({
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
  return parseShaderPreset(row);
}

/**
 * Put a preset on show — which is what makes it visible to anybody but the
 * author, in the strip and at its own route.
 *
 * The SAVED preset, not what is currently in the panel: publishing and saving
 * are separate presses here exactly as they are for an article, so that ⌘S
 * stays the only thing that decides between creating and updating a row.
 */
export async function publishShaderPreset(
  id: string,
): Promise<ShaderPreset & ShaderPresetContent> {
  await requireAdmin();
  const row = await prisma.shaderPreset.update({
    where: { id },
    data: { publishedAt: new Date() },
  });
  return parseShaderPreset(row);
}

/**
 * Take a preset back off show, without destroying it.
 *
 * Clearing the date rather than deleting the row, the same call `unpublishPost`
 * makes: the preset is still the author's to open, tune and put back out, and
 * the destructive half of "remove this" is `deleteShaderPreset`.
 *
 * No confirmation in front of it, unlike unpublishing an article. This one is
 * undone by pressing the same button again, and `ConfirmDialog` is for what
 * cannot be.
 */
export async function unpublishShaderPreset(
  id: string,
): Promise<ShaderPreset & ShaderPresetContent> {
  await requireAdmin();
  const row = await prisma.shaderPreset.update({
    where: { id },
    data: { publishedAt: null },
  });
  return parseShaderPreset(row);
}

export async function deleteShaderPreset(id: string): Promise<void> {
  await requireAdmin();
  await prisma.shaderPreset.delete({ where: { id } });
}
