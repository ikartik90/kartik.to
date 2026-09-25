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

// Not `icon.ts`: Next compiles that name under app/ as an app-icon route and the build fails.
// Deliberately public: `listIcons`, which shows visitors approved icons only.

/** Prerendered, so every write must revalidate it. */
const ICONS_PATH = "/playground/icons";

/** The bucket is shared with media, so an unchecked key could delete any article's picture. */
function requireIconKey(key: string): string {
  if (!key.startsWith(ICON_PREFIX)) throw new Error("Invalid icon key");
  return key;
}

function requirePublicBase(): void {
  if (!env.R2_PUBLIC_BASE_URL) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured");
  }
}

export async function listIcons(): Promise<IconAsset[]> {
  const author = await isAdmin();
  const icons = await listAllIcons();
  return icons.filter((icon) => author || icon.review === "approved");
}

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

  // R2 silently drops metadata signed into a presigned PUT; `finalizeIconUpload` sets it.
  const { uploadUrl, publicUrl } = await createR2UploadUrl(key, "image/svg+xml");

  if (!publicUrl) throw new Error("R2_PUBLIC_BASE_URL is not configured");

  return { uploadUrl, publicUrl, key };
}

/** Stamps an uploaded icon's metadata; the review state is the server's call, never the client's. */
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
  // `deleteMany`: most icons have no row.
  await prisma.icon.deleteMany({ where: { key } });

  revalidatePath(ICONS_PATH);
}

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

  revalidatePath(ICONS_PATH);
}
