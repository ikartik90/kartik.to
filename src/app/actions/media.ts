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

const FOLDER_PREFIX: Record<MediaFolder, string> = {
  media: MEDIA_PREFIX,
  profiles: PROFILE_PREFIX,
};

function isLibraryKey(key: string): boolean {
  return Object.values(FOLDER_PREFIX).some((prefix) => key.startsWith(prefix));
}

function prefixOfKey(key: string): string {
  return key.startsWith(PROFILE_PREFIX) ? PROFILE_PREFIX : MEDIA_PREFIX;
}

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
    filename: head.filename || filenameFromMediaKey(key, prefixOfKey(key)),
    contentType: head.contentType,
    size: head.size,
    alt: head.alt || undefined,
    width: numericMetadata(head.width),
    height: numericMetadata(head.height),
  });
}

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

/** Renames for display only: the key stays, so URLs already embedded never break. */
export async function updateMediaFilename(input: unknown): Promise<MediaAsset> {
  await requireAdmin();

  if (!env.R2_PUBLIC_BASE_URL) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured");
  }

  const { key, filename } = UpdateMediaFilenameInputSchema.parse(input);
  if (!isLibraryKey(key)) {
    throw new Error("Invalid media key");
  }

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
