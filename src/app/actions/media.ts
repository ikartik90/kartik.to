"use server";

import { randomUUID } from "crypto";
import { auth } from "@/lib/auth/server";
import { env } from "@/lib/env";
import {
  CreateMediaUploadInputSchema,
  DeleteMediaInputSchema,
  MediaAssetSchema,
  UpdateMediaAltInputSchema,
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
  updateR2ObjectAlt,
} from "@/lib/storage/r2";

async function requireAdmin(): Promise<void> {
  const { data: session } = await auth.getSession();
  if (!session?.user?.email || session.user.email !== env.ADMIN_GITHUB_ID) {
    throw new Error("Unauthorized");
  }
}

function filenameFromKey(key: string): string {
  const segment = key.slice(MEDIA_PREFIX.length);
  const dash = segment.indexOf("-");
  return dash === -1 ? segment : segment.slice(dash + 1);
}

async function keyToMediaAsset(key: string): Promise<MediaAsset | null> {
  const url = publicUrlForKey(key);
  if (!url) return null;

  const head = await headR2Object(key);
  return MediaAssetSchema.parse({
    key,
    url,
    filename: filenameFromKey(key),
    contentType: head.contentType,
    size: head.size,
    alt: head.alt || undefined,
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

  const { filename, contentType } = CreateMediaUploadInputSchema.parse(input);
  const safeName = sanitizeMediaFilename(filename);
  const key = `${MEDIA_PREFIX}${randomUUID()}-${safeName}`;

  const { uploadUrl, publicUrl } = await createR2UploadUrl(key, contentType, {
    alt: "",
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

  await updateR2ObjectAlt(key, alt);
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
