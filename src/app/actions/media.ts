"use server";

import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/auth/server";
import { env } from "@/lib/env";
import {
  CreateMediaUploadInputSchema,
  DeleteMediaInputSchema,
  MediaAssetSchema,
  MediaFolderSchema,
  UpdateMediaAltInputSchema,
  UpdateMediaFilenameInputSchema,
  filenameFromMediaKey,
  sanitizeMediaDisplayName,
  sanitizeMediaFilename,
  type MediaAsset,
  type MediaFolder,
} from "@/domain/media";
import {
  MEDIA_PREFIX,
  PROFILE_PREFIX,
  createR2UploadUrl,
  deleteR2Object,
  headR2Object,
  listR2MediaKeys,
  publicUrlForKey,
  updateR2ObjectMetadata,
} from "@/lib/storage/r2";

/**
 * A folder's key prefix. The only place the two are tied together — a second
 * copy of this map is how an object gets written under one prefix and looked
 * for under another.
 */
const FOLDER_PREFIX: Record<MediaFolder, string> = {
  media: MEDIA_PREFIX,
  profiles: PROFILE_PREFIX,
};

/**
 * Whether a key names an object in the media LIBRARY — under any of its
 * folders.
 *
 * Every edit used to ask `startsWith(MEDIA_PREFIX)` instead, which is the
 * library as it was before it had folders: a face under `profiles/` could be
 * uploaded, listed and inserted, and then could not be renamed, described or
 * deleted. Derived from `FOLDER_PREFIX` rather than spelling the folders out
 * again, so a third folder is editable the day it is added.
 *
 * Still a guard, not a formality — an icon, a poster and anything under a bare
 * key are all outside it, and each of those has its own actions and its own
 * rules about what may happen to it.
 */
function isLibraryKey(key: string): boolean {
  return Object.values(FOLDER_PREFIX).some((prefix) => key.startsWith(prefix));
}

/** The prefix an existing key already carries, for reading its name back. */
function prefixOfKey(key: string): string {
  return key.startsWith(PROFILE_PREFIX) ? PROFILE_PREFIX : MEDIA_PREFIX;
}

/** One metadata string as the positive integer it claims to be, or nothing. */
function numericMetadata(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function keyToMediaAsset(key: string): Promise<MediaAsset | null> {
  const url = publicUrlForKey(key);
  if (!url) return null;

  const head = await headR2Object(key);
  return MediaAssetSchema.parse({
    key,
    url,
    // The stored name is the source of truth (it survives renaming); the key is
    // only the fallback for objects uploaded before the name was recorded.
    filename: head.filename || filenameFromMediaKey(key, prefixOfKey(key)),
    contentType: head.contentType,
    size: head.size,
    alt: head.alt || undefined,
    // Object metadata is a map of strings, so the shape comes back as a pair
    // of them. `undefined` rather than `NaN` for anything unparseable: the
    // schema takes an absent measurement and refuses a nonsensical one, and an
    // object stored before this was recorded has neither key.
    width: numericMetadata(head.width),
    height: numericMetadata(head.height),
  });
}

/**
 * One folder's objects. Defaults to the library, so every caller that predates
 * profiles keeps the behaviour it was written against.
 */
export async function listMediaAssets(folder?: unknown): Promise<MediaAsset[]> {
  await requireAdmin();

  if (!env.R2_PUBLIC_BASE_URL) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured");
  }

  const keys = await listR2MediaKeys(
    FOLDER_PREFIX[MediaFolderSchema.default("media").parse(folder)],
  );
  const assets = await Promise.all(keys.map(keyToMediaAsset));
  return assets.filter((a): a is MediaAsset => a !== null);
}

export async function createMediaUploadUrl(
  input: unknown,
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  await requireAdmin();

  if (!env.R2_PUBLIC_BASE_URL) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured");
  }

  const { filename, contentType, width, height, folder } =
    CreateMediaUploadInputSchema.parse(input);
  const safeName = sanitizeMediaFilename(filename);
  const key = `${FOLDER_PREFIX[folder]}${randomUUID()}-${safeName}`;

  // Record the name alongside the object so it can later be edited without
  // moving the object (the key is immutable once anything links to it).
  //
  // The shape rides along in the same map, and is signed into the PUT rather
  // than patched on afterwards — the client measured the file before it asked
  // for this URL, so the answer is already in hand and costs no second round
  // trip. Both keys or neither: a ratio is not a thing half a measurement can
  // express (`mediaReservedAspect`).
  const { uploadUrl, publicUrl } = await createR2UploadUrl(key, contentType, {
    alt: "",
    filename: safeName,
    ...(width && height
      ? { width: String(width), height: String(height) }
      : {}),
  });

  if (!publicUrl) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured");
  }

  return { uploadUrl, publicUrl, key };
}

export async function updateMediaAlt(input: unknown): Promise<MediaAsset> {
  await requireAdmin();

  if (!env.R2_PUBLIC_BASE_URL) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured");
  }

  const { key, alt } = UpdateMediaAltInputSchema.parse(input);
  if (!isLibraryKey(key)) {
    throw new Error("Invalid media key");
  }

  await updateR2ObjectMetadata(key, { alt });
  const asset = await keyToMediaAsset(key);
  if (!asset) {
    throw new Error("Media asset not found");
  }
  return asset;
}

/**
 * Rename an asset for display. The object KEY (and therefore every URL already
 * embedded in a published article) is left untouched — only the stored name
 * changes, so renaming can never break a live image.
 */
export async function updateMediaFilename(input: unknown): Promise<MediaAsset> {
  await requireAdmin();

  if (!env.R2_PUBLIC_BASE_URL) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured");
  }

  const { key, filename } = UpdateMediaFilenameInputSchema.parse(input);
  if (!isLibraryKey(key)) {
    throw new Error("Invalid media key");
  }

  // The DISPLAY sanitiser, not the key's: nothing here touches the object key,
  // so the only thing a name has to survive is the header it is stored in.
  await updateR2ObjectMetadata(key, {
    filename: sanitizeMediaDisplayName(filename),
  });
  const asset = await keyToMediaAsset(key);
  if (!asset) {
    throw new Error("Media asset not found");
  }
  return asset;
}

export async function deleteMedia(input: unknown): Promise<void> {
  await requireAdmin();

  const { key } = DeleteMediaInputSchema.parse(input);
  if (!isLibraryKey(key)) {
    throw new Error("Invalid media key");
  }

  await deleteR2Object(key);
}
