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
