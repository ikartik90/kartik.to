import { z } from "zod";
import type { MediaKind } from "@/domain/nodes";

export const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/svg+xml",
  "image/webp",
  "image/jpeg",
  "image/gif",
] as const;

export const ALLOWED_VIDEO_CONTENT_TYPES = ["video/mp4"] as const;

/** Kept out of the media lists: a document has no `MediaKind`. */
export const ALLOWED_DOCUMENT_CONTENT_TYPES = ["application/pdf"] as const;

export const ALLOWED_MEDIA_CONTENT_TYPES = [
  ...ALLOWED_IMAGE_CONTENT_TYPES,
  ...ALLOWED_VIDEO_CONTENT_TYPES,
] as const;

export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  ...ALLOWED_MEDIA_CONTENT_TYPES,
  ...ALLOWED_DOCUMENT_CONTENT_TYPES,
] as const;

export type AllowedImageContentType = (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number];

export type AllowedVideoContentType = (typeof ALLOWED_VIDEO_CONTENT_TYPES)[number];

export type AllowedDocumentContentType =
  (typeof ALLOWED_DOCUMENT_CONTENT_TYPES)[number];

export type AllowedMediaContentType = (typeof ALLOWED_MEDIA_CONTENT_TYPES)[number];

export type AllowedUploadContentType =
  (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number];

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

export const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;

export const MAX_DOCUMENT_UPLOAD_BYTES = 25 * 1024 * 1024;

export function isVideoContentType(
  value: string,
): value is AllowedVideoContentType {
  return (ALLOWED_VIDEO_CONTENT_TYPES as readonly string[]).includes(value);
}

export function isDocumentContentType(
  value: string,
): value is AllowedDocumentContentType {
  return (ALLOWED_DOCUMENT_CONTENT_TYPES as readonly string[]).includes(value);
}

export function maxUploadBytesFor(contentType: string): number {
  if (isVideoContentType(contentType)) return MAX_VIDEO_UPLOAD_BYTES;
  if (isDocumentContentType(contentType)) return MAX_DOCUMENT_UPLOAD_BYTES;
  return MAX_IMAGE_UPLOAD_BYTES;
}

/** The only place a `MediaKind` is derived; unknown types fall through to `"image"`. */
export function mediaKindOf(contentType: string): MediaKind {
  return isVideoContentType(contentType) ? "video" : "image";
}

/** Measured at upload; optional because not every source reports a size. */
const mediaDimensionFields = {
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
};

export const MediaAssetSchema = z.object({
  key: z.string(),
  url: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  alt: z.string().optional(),
  ...mediaDimensionFields,
});

export type MediaAsset = z.infer<typeof MediaAssetSchema>;

/** An enum, not a string: it becomes a key prefix in the bucket. */
export const MediaFolderSchema = z.enum(["media", "profiles"]);

export type MediaFolder = z.infer<typeof MediaFolderSchema>;

export const CreateMediaUploadInputSchema = z
  .object({
    filename: z.string().min(1),
    contentType: z.enum(ALLOWED_UPLOAD_CONTENT_TYPES),
    size: z.number().int().positive(),
    folder: MediaFolderSchema.default("media"),
    ...mediaDimensionFields,
  })
  .refine(({ contentType, size }) => size <= maxUploadBytesFor(contentType), {
    message: "File is too large",
    path: ["size"],
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

export function isAllowedMediaContentType(
  value: string,
): value is AllowedMediaContentType {
  return (ALLOWED_MEDIA_CONTENT_TYPES as readonly string[]).includes(value);
}

/** What the bucket accepts; `isAllowedMediaContentType` is what can be drawn. */
export function isAllowedUploadContentType(
  value: string,
): value is AllowedUploadContentType {
  return (ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]).includes(value);
}

const MAX_MEDIA_NAME_LENGTH = 120;

/** A display-only label: strips only what US-ASCII object metadata can't hold. */
export function sanitizeMediaDisplayName(name: string): string {
  return (
    name
      // Decomposes accents so only the marks are dropped below.
      .normalize("NFD")
      // Before the ASCII strip, so a tab becomes a space instead of vanishing.
      .replace(/\s+/g, " ")
      .replace(/[^\x20-\x7e]/g, "")
      .trim()
      .slice(0, MAX_MEDIA_NAME_LENGTH)
  );
}

export function sanitizeMediaFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "media";
  const cleaned = base.replace(/[^\w.\-()+]/g, "-").replace(/-+/g, "-");
  return cleaned.length > 0 ? cleaned.slice(0, MAX_MEDIA_NAME_LENGTH) : "media";
}

const MEDIA_KEY_UUID_PREFIX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

export function filenameFromMediaUrl(url: string): string {
  const path = url.split(/[?#]/)[0];
  const segment = path.split("/").pop() ?? "";
  return filenameFromMediaKey(decodeURIComponent(segment), "");
}

export function filenameFromMediaKey(key: string, prefix = "media/"): string {
  const segment = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return segment.replace(MEDIA_KEY_UUID_PREFIX, "");
}
