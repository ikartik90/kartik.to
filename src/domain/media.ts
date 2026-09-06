import { z } from "zod";
import type { MediaKind } from "@/domain/nodes";

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

export const ALLOWED_VIDEO_CONTENT_TYPES = ["video/mp4"] as const;

/**
 * Files the bucket holds that are NOT media — a document is fetched, not
 * rendered, and there is no element that draws one.
 *
 * A separate list rather than a third arm of `ALLOWED_MEDIA_CONTENT_TYPES`, and
 * that separation is load-bearing: every media type has a `MediaKind`
 * (`mediaKindOf`), a document has none, and folding it in would make that
 * function's `"image"` fall-through — the branch its own test calls unreachable
 * — the answer for a whole real format. The image dialog would then list PDFs
 * as pictures that cannot load.
 *
 * The two lists meet again at {@link ALLOWED_UPLOAD_CONTENT_TYPES}, because the
 * bucket, the signer and the admin guard are one path for both.
 */
export const ALLOWED_DOCUMENT_CONTENT_TYPES = ["application/pdf"] as const;

/**
 * Everything the library takes. Pictures first, so the order the formats are
 * listed in — in the accept attribute, in the dialog's hint — stays the order
 * they were added in.
 */
export const ALLOWED_MEDIA_CONTENT_TYPES = [
  ...ALLOWED_IMAGE_CONTENT_TYPES,
  ...ALLOWED_VIDEO_CONTENT_TYPES,
] as const;

/** Everything that may be PUT into the bucket — media and documents alike. */
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

/**
 * Five times the image ceiling. A clip is a different order of file — ten
 * seconds of screen recording is routinely past the limit that would mean a
 * pathological screenshot — and one cap for both would either refuse ordinary
 * videos or stop being a guard on pictures.
 */
export const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Between the two, for the reason both of the others exist: a print-quality
 * portfolio or a scanned CV routinely clears the image ceiling and is nowhere
 * near a screen recording's, so one cap shared with either would be the wrong
 * guard in one direction or a refusal in the other.
 */
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

/** The ceiling this format is held to — see `MAX_VIDEO_UPLOAD_BYTES`. */
export function maxUploadBytesFor(contentType: string): number {
  if (isVideoContentType(contentType)) return MAX_VIDEO_UPLOAD_BYTES;
  if (isDocumentContentType(contentType)) return MAX_DOCUMENT_UPLOAD_BYTES;
  return MAX_IMAGE_UPLOAD_BYTES;
}

/**
 * The `kind` an upload of this content type becomes once it is in a document.
 *
 * This is the ONE place a `MediaKind` is ever derived — the crossing from what
 * the library knows about a file to what a document says about it. It had been
 * written out twice, byte-identically, in the insert hook and in the dialog,
 * which is one copy for each of the two things that happen at the moment
 * Insert is pressed: a block is written and a preview is drawn. Those two must
 * agree by construction, because disagreeing means the pane you checked the
 * file in showed a different element from the one the document got.
 *
 * It lives beside `maxUploadBytesFor` because it is the same shape of
 * question: a property of the FORMAT, read off the content type, which is the
 * only description of a file that survives upload — the filename does not
 * (`sanitizeMediaFilename` rewrites it, and an R2 key need carry no extension
 * at all). Takes the content type rather than a whole `MediaAsset` for the
 * same reason its neighbour does: the asset is not the subject, its format is,
 * and an upload in flight has one before it has an asset.
 *
 * Falls through to `"image"` on anything unrecognised, matching the bias
 * everywhere else this question is asked (`isVideoSource`, `withMediaKind`).
 * Every caller has already been past `isAllowedMediaContentType`, so the
 * fall-through is unreachable rather than lenient.
 */
export function mediaKindOf(contentType: string): MediaKind {
  return isVideoContentType(contentType) ? "video" : "image";
}

/**
 * The source's own pixel size, measured once at upload (`measureMediaFile`) and
 * carried from there into every node that points at it.
 *
 * It exists so a surface can reserve the box a media object will need BEFORE
 * the bytes arrive — see `mediaReservedAspect`. Only the ratio is ever read.
 *
 * Optional at every link in the chain, and it has to be: a browser can decline
 * to decode a file, an SVG can report no intrinsic size at all, and every
 * object already in the bucket was stored before there was anywhere to write
 * this. All three land in the same place — the house ratio — so an absent
 * measurement is a slightly worse reservation rather than a broken one.
 *
 * Positive integers, because zero is precisely what an element that decoded
 * nothing reports, and a stored zero is a shape claim no source can satisfy.
 */
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

// The size bound is a refinement rather than a `.max()`, because it depends on
// the sibling field: which ceiling applies is a question about the format.
export const CreateMediaUploadInputSchema = z
  .object({
    filename: z.string().min(1),
    contentType: z.enum(ALLOWED_UPLOAD_CONTENT_TYPES),
    size: z.number().int().positive(),
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

/**
 * Whether the bucket will take this at all — the guard the SERVER applies, and
 * the one the upload path shares between pictures, clips and documents.
 *
 * Distinct from `isAllowedMediaContentType`, which answers a narrower question:
 * whether anything can DRAW it. Every caller wants one or the other and never
 * both, so they are two functions rather than one with a flag.
 */
export function isAllowedUploadContentType(
  value: string,
): value is AllowedUploadContentType {
  return (ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]).includes(value);
}

export function sanitizeMediaFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "media";
  const cleaned = base.replace(/[^\w.\-()+]/g, "-").replace(/-+/g, "-");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "media";
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
/**
 * The same recovery, from the public URL a document node actually stores.
 *
 * Surfaces that hold a media NODE have a src and no key — the node deliberately
 * stores the URL so it renders without a lookup — but they still want to show
 * the author which file they picked, and `https://cdn…/media/<uuid>-cv.pdf` is
 * not a name anyone reads. This is the last path segment put through the same
 * stamp-stripper, so a picture named in the library and a picture named in the
 * properties rail cannot come out differently.
 *
 * A best effort by construction: a CDN is free to rewrite the path, and then
 * this returns whatever the last segment happens to be. That is a worse label,
 * never a broken one.
 */
export function filenameFromMediaUrl(url: string): string {
  const path = url.split(/[?#]/)[0];
  const segment = path.split("/").pop() ?? "";
  return filenameFromMediaKey(decodeURIComponent(segment), "");
}

export function filenameFromMediaKey(key: string, prefix = "media/"): string {
  const segment = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return segment.replace(MEDIA_KEY_UUID_PREFIX, "");
}
