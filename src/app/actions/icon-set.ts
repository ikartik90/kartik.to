"use server";

import { randomUUID } from "crypto";
import { isAdmin, requireAdmin } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { keyToIcon, listAllIcons } from "@/lib/icons";
import { env } from "@/lib/env";
import {
  CreateIconUploadInputSchema,
  FinalizeIconUploadInputSchema,
  IconKeyInputSchema,
  SetIconLabelsInputSchema,
  SetIconReviewInputSchema,
  cleanIconAliases,
  iconNameFromKey,
  reviewForUpload,
  sanitizeIconFilename,
  type IconAsset,
} from "@/domain/icon";
import {
  ICON_PREFIX,
  createR2UploadUrl,
  deleteR2Object,
  updateR2ObjectMetadata,
} from "@/lib/storage/r2";

// ---------------------------------------------------------------------------
// NOT `icon.ts`, and the name is load-bearing: `icon` is one of Next's
// metadata file conventions and it is valid in `app/**/*`, so a module called
// `icon.ts` anywhere under `app/` — this folder included — is compiled as an
// app-icon route and the build fails asking for a default export. Dev never
// notices, because a route nobody requests is never compiled.
//
// The icon set's server side: one public read, and three doors only the author
// can open.
//
// The READ is split in two, and the split is WHO IS ASKING:
//
//   approved   the same set for everyone, so it is read without a session at
//              all (`@/lib/icons`) and the page prerenders from it. A visit
//              costs no icon requests.
//
//   held       the author's alone, and `listHeldIcons` checks. A held icon is
//              not dimmed or badged on the way out to a visitor — it is not in
//              the answer, and it is not in the prerendered HTML either, which
//              is the only way to hold something back that a client cannot
//              undo.
//
// Because the page is prerendered, every write below has to rebuild it — see
// `ICONS_PATH`.
//
// Every writing action names its key against {@link ICON_PREFIX} before it
// does anything. The bucket is shared with the media library, and an
// unchecked key on `deleteIcon` would be a signed-in delete of any published
// article's picture from a page that has no business naming one.
// ---------------------------------------------------------------------------

/**
 * The route drawn from this set. A write that does not rebuild it leaves the
 * page showing the set as it was at the last build — an icon uploaded a minute
 * ago simply is not there, and nothing on screen can explain why.
 */
const ICONS_PATH = "/playground/icons";

/** An icon key, or a thrown error. See the note above about the shared bucket. */
function requireIconKey(key: string): string {
  if (!key.startsWith(ICON_PREFIX)) throw new Error("Invalid icon key");
  return key;
}

function requirePublicBase(): void {
  if (!env.R2_PUBLIC_BASE_URL) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured");
  }
}

/**
 * The set as the caller may see it: the whole bucket for the author, the
 * published part of it for everyone else.
 *
 * Used by the author's page after a write, when it re-reads what it has just
 * changed. A visitor's first view of the set does not come through here at all
 * — it is prerendered into the HTML (`@/lib/icons`), which is the point.
 */
export async function listIcons(): Promise<IconAsset[]> {
  const author = await isAdmin();
  const icons = await listAllIcons();
  return icons.filter((icon) => author || icon.review === "approved");
}

/**
 * The part of the set the page could NOT prerender — the author's own, held
 * back for review. Fetched by the author's browser on arrival and added to
 * what the HTML already carried.
 *
 * It is the one icon read that checks, because it is the one whose answer
 * depends on who is asking.
 */
export async function listHeldIcons(): Promise<IconAsset[]> {
  await requireAdmin();
  const icons = await listAllIcons();
  return icons.filter((icon) => icon.review === "held");
}

export async function createIconUploadUrl(
  input: unknown,
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  await requireAdmin();
  requirePublicBase();

  const { filename } = CreateIconUploadInputSchema.parse(input);
  const safeName = sanitizeIconFilename(filename);
  const key = `${ICON_PREFIX}${randomUUID()}-${safeName}`;

  // The signature carries the key and the type, and that is all it CAN carry:
  // metadata signed into a presigned PUT is discarded by R2 without a word.
  // Everything this icon is comes next, in `finalizeIconUpload`.
  const { uploadUrl, publicUrl } = await createR2UploadUrl(key, "image/svg+xml");

  if (!publicUrl) throw new Error("R2_PUBLIC_BASE_URL is not configured");

  return { uploadUrl, publicUrl, key };
}

/**
 * Stamp an uploaded object with what it is — the second half of every upload,
 * and the half that decides whether anyone will see it.
 *
 * It exists because a presigned PUT cannot carry metadata to R2 (see
 * `createR2UploadUrl`), so the bytes arrive first and the facts about them
 * arrive here. The measurements are the client's, since it parsed the file to
 * draw it and measuring again would mean a DOM on the server for no new fact.
 * The review state is NOT the client's: one that could name its own would be
 * able to publish a flattened icon by asking nicely.
 *
 * An upload whose finalize never runs is left with no metadata at all, which
 * `keyToIcon` reads as `held` — the failure lands on the safe side, and the
 * author can publish it by hand.
 */
export async function finalizeIconUpload(input: unknown): Promise<IconAsset> {
  await requireAdmin();
  requirePublicBase();

  const { key, native, flattened } = FinalizeIconUploadInputSchema.parse(input);
  requireIconKey(key);

  await updateR2ObjectMetadata(key, {
    // From the key this server minted, never from anything sent alongside.
    filename: iconNameFromKey(key),
    native: String(native),
    flattened: flattened ? "1" : "0",
    review: reviewForUpload(flattened),
  });

  const icon = await keyToIcon(key);
  if (!icon) throw new Error("Icon not found");

  revalidatePath(ICONS_PATH);
  return icon;
}

/**
 * Put a held icon on show, or take a shown one back. One action for one fact
 * with two settings — a pair of them would always have one inert.
 */
export async function setIconReview(input: unknown): Promise<IconAsset> {
  await requireAdmin();
  requirePublicBase();

  const { key, review } = SetIconReviewInputSchema.parse(input);
  requireIconKey(key);

  await updateR2ObjectMetadata(key, { review });

  const icon = await keyToIcon(key);
  if (!icon) throw new Error("Icon not found");

  revalidatePath(ICONS_PATH);
  return icon;
}

export async function deleteIcon(input: unknown): Promise<void> {
  await requireAdmin();

  const { key } = IconKeyInputSchema.parse(input);
  requireIconKey(key);

  await deleteR2Object(key);
  // The row is about an object that no longer exists. `deleteMany` rather than
  // `delete` because most icons have no row at all, and deleting one that was
  // never written is not an error worth throwing on the way out of a delete
  // that already succeeded.
  await prisma.icon.deleteMany({ where: { key } });

  revalidatePath(ICONS_PATH);
}

/**
 * What an icon is CALLED, and the words it can be found under.
 *
 * One write for both, because they are one row and one panel. The tidying is
 * the domain's (`cleanIconAliases`): trimmed, no empties from a row the add
 * button opened and nobody filled, and no word twice on one icon — though the
 * same word on twenty icons is exactly what makes it worth typing.
 *
 * An emptied name DELETES the row rather than storing "". An icon with no row
 * is called what its filename says, so clearing the field is how that name is
 * got back; a stored empty string would be a second way to spell "unset" that
 * every reader would then have to know about.
 */
export async function setIconLabels(input: unknown): Promise<void> {
  await requireAdmin();

  const { key, title, aliases } = SetIconLabelsInputSchema.parse(input);
  requireIconKey(key);

  const name = title.trim();
  const words = cleanIconAliases(aliases);

  if (!name) {
    await prisma.icon.deleteMany({ where: { key } });
    revalidatePath(ICONS_PATH);
    return;
  }

  await prisma.icon.upsert({
    where: { key },
    create: { key, title: name, aliases: words },
    update: { title: name, aliases: words },
  });

  // The name is IN the prerendered HTML — it is what a taken icon's label says
  // and what the search box filters on — so renaming one is a change to the
  // page, not only to a row.
  revalidatePath(ICONS_PATH);
}
