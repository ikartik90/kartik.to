import { z } from "zod";

// ---------------------------------------------------------------------------
// Allowed upload types — validated on client and server
// ---------------------------------------------------------------------------

export const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/svg+xml",
  "image/webp",
  "image/jpeg",
  "image/gif",
] as const;

export type AllowedImageContentType = (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number];

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

export const MediaAssetSchema = z.object({
  key: z.string(),
  url: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  alt: z.string().optional(),
});

export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const CreateMediaUploadInputSchema = z.object({
  filename: z.string().min(1),
  contentType: z.enum(ALLOWED_IMAGE_CONTENT_TYPES),
  size: z.number().int().positive().max(MAX_IMAGE_UPLOAD_BYTES),
});

export type CreateMediaUploadInput = z.infer<typeof CreateMediaUploadInputSchema>;

export const UpdateMediaAltInputSchema = z.object({
  key: z.string().min(1),
  alt: z.string(),
});

export type UpdateMediaAltInput = z.infer<typeof UpdateMediaAltInputSchema>;

export const UpdateMediaFilenameInputSchema = z.object({
  key: z.string().min(1),
  filename: z.string().min(1),
});

export type UpdateMediaFilenameInput = z.infer<
  typeof UpdateMediaFilenameInputSchema
>;

export const DeleteMediaInputSchema = z.object({
  key: z.string().min(1),
});

export type DeleteMediaInput = z.infer<typeof DeleteMediaInputSchema>;

export function isAllowedImageContentType(
  value: string,
): value is AllowedImageContentType {
  return (ALLOWED_IMAGE_CONTENT_TYPES as readonly string[]).includes(value);
}

export function sanitizeMediaFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "image";
  const cleaned = base.replace(/[^\w.\-()+]/g, "-").replace(/-+/g, "-");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "image";
}

/** The `<uuid>-` stamp `createMediaUploadUrl` prefixes onto every object key. */
const MEDIA_KEY_UUID_PREFIX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

/**
 * Recover the original upload filename from an object key. Keys are stamped
 * `media/<uuid>-<filename>` to stay unique — and since `randomUUID()` is itself
 * dash-separated, the uuid has to be matched WHOLE. (Splitting on the first
 * dash left the uuid's own tail on the front: `e29b-41d4-…-favicon.png`.)
 * Only a fallback now: the filename is stored as object metadata, so it can be
 * renamed without moving the object. Legacy objects predating that still land
 * here.
 */
export function filenameFromMediaKey(key: string, prefix = "media/"): string {
  const segment = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return segment.replace(MEDIA_KEY_UUID_PREFIX, "");
}
