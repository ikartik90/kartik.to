"use server";

import { randomUUID } from "crypto";
import { isAdmin, requireAdmin } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  CreateIconUploadInputSchema,
  FinalizeIconUploadInputSchema,
  IconAssetSchema,
  IconKeyInputSchema,
  SetIconLabelsInputSchema,
  SetIconReviewInputSchema,
  cleanIconAliases,
  iconTitleFrom,
  iconNameFromKey,
  reviewForUpload,
  sanitizeIconFilename,
  type IconAsset,
} from "@/domain/icon";
import {
  ICON_PREFIX,
  createR2UploadUrl,
  deleteR2Object,
  headR2Object,
  listR2IconKeys,
  publicUrlForKey,
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
// `listIcons` asks for no session in order to answer, because the page it
// feeds is public — but it does ASK, because the author sees more of the set
// than a visitor does. A held icon is not dimmed or badged on the way out to a
// visitor; it is not in the list at all, which is the only way to hold
// something back that a client cannot undo.
//
// Every writing action names its key against {@link ICON_PREFIX} before it
// does anything. The bucket is shared with the media library, and an
// unchecked key on `deleteIcon` would be a signed-in delete of any published
// article's picture from a page that has no business naming one.
// ---------------------------------------------------------------------------

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
 * One object as an icon.
 *
 * The three metadata fields are all optional in practice, because an object
 * could have been put in the bucket by hand — and each falls back in the
 * direction that cannot mislead: the key's own name, the grid the set is
 * authored on, and `held`, which shows it to nobody until it has been looked
 * at.
 */
async function keyToIcon(
  key: string,
  labels?: IconLabels,
): Promise<IconAsset | null> {
  const url = publicUrlForKey(key);
  if (!url) return null;

  const { metadata } = await headR2Object(key);
  const native = Number.parseInt(metadata.native ?? "", 10);
  const name = metadata.filename || iconNameFromKey(key);

  return IconAssetSchema.parse({
    key,
    url,
    name,
    native: Number.isInteger(native) && native > 0 ? native : 20,
    flattened: metadata.flattened === "1",
    review: metadata.review === "approved" ? "approved" : "held",
    // The row is the exception. An icon nobody has renamed is called what its
    // filename says, which is why nothing was ever backfilled into `Icon`.
    title: labels?.title || iconTitleFrom(name),
    aliases: labels?.aliases ?? [],
  });
}

/** What the `Icon` table has to say about one key, where it has anything. */
interface IconLabels {
  title: string;
  aliases: string[];
}

/**
 * The set, in name order — the author's whole bucket, or the published part of
 * it for everyone else.
 *
 * Sorted by NAME rather than by key or by upload date, because the key carries
 * a uuid and the date is invisible on screen: an icon grid that reshuffles
 * between visits is one you cannot learn the shape of.
 */
export async function listIcons(): Promise<IconAsset[]> {
  requirePublicBase();

  const author = await isAdmin();
  const keys = await listR2IconKeys();

  // ONE query for the set, against one HEAD per object — which is the reason
  // these two facts are in a table and not in the object's metadata: metadata
  // rides along with a HEAD but cannot be searched, and this listing is what
  // the search box filters. Keyed up front so the mapping below stays a
  // lookup rather than a scan per icon.
  const rows = await prisma.icon.findMany({ where: { key: { in: keys } } });
  const labels = new Map(
    rows.map((row) => [row.key, { title: row.title, aliases: row.aliases }]),
  );

  const icons = await Promise.all(
    keys.map((key) => keyToIcon(key, labels.get(key))),
  );

  return icons
    .filter((icon): icon is IconAsset => icon !== null)
    .filter((icon) => author || icon.review === "approved")
    .sort((a, b) => a.name.localeCompare(b.name));
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
    return;
  }

  await prisma.icon.upsert({
    where: { key },
    create: { key, title: name, aliases: words },
    update: { title: name, aliases: words },
  });
}
