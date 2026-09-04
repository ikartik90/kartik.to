"use server";

import { randomUUID } from "crypto";
import { auth } from "@/lib/auth/server";
import { env } from "@/lib/env";
import {
  CreateMediaUploadInputSchema,
  DeleteMediaInputSchema,
  MediaAssetSchema,
  UpdateMediaAltInputSchema,
  UpdateMediaFilenameInputSchema,
  filenameFromMediaKey,
  sanitizeMediaFilename,
  type MediaAsset,
} from "@/domain/media";
import {
  MEDIA_PREFIX,
  createR2UploadUrl,
  deleteR2Object,
  headR2Object,
  listR2MediaKeys,
  publicUrlForKey,
  updateR2ObjectMetadata,
} from "@/lib/storage/r2";

async function requireAdmin(): Promise<void> {
  const { data: session } = await auth.getSession();
  if (!session?.user?.email || session.user.email !== env.ADMIN_GITHUB_ID) {
    throw new Error("Unauthorized");
  }
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
    filename: head.filename || filenameFromMediaKey(key, MEDIA_PREFIX),
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

export async function listMediaAssets(): Promise<MediaAsset[]> {
  await requireAdmin();

  if (!env.R2_PUBLIC_BASE_URL) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured");
  }

  const keys = await listR2MediaKeys();
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

  const { filename, contentType, width, height } =
    CreateMediaUploadInputSchema.parse(input);
  const safeName = sanitizeMediaFilename(filename);
  const key = `${MEDIA_PREFIX}${randomUUID()}-${safeName}`;

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
  if (!key.startsWith(MEDIA_PREFIX)) {
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
  if (!key.startsWith(MEDIA_PREFIX)) {
    throw new Error("Invalid media key");
  }

  await updateR2ObjectMetadata(key, { filename: sanitizeMediaFilename(filename) });
  const asset = await keyToMediaAsset(key);
  if (!asset) {
    throw new Error("Media asset not found");
  }
  return asset;
}

export async function deleteMedia(input: unknown): Promise<void> {
  await requireAdmin();

  const { key } = DeleteMediaInputSchema.parse(input);
  if (!key.startsWith(MEDIA_PREFIX)) {
    throw new Error("Invalid media key");
  }

  await deleteR2Object(key);
}
