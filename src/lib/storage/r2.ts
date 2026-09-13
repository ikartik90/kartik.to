import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export const MEDIA_PREFIX = "media/";

/**
 * The icon set's own corner of the bucket. Separate from the media library's
 * prefix rather than a folder inside it, and the separation is what every
 * guard in `actions/icon-set.ts` is written against: an icon key can never name a
 * media object, so approving or deleting an icon cannot reach a published
 * article's picture.
 */
export const ICON_PREFIX = "icons/";

/**
 * Where a testimonial's profile picture goes. A sibling of {@link
 * MEDIA_PREFIX} rather than a folder inside it, so `listR2MediaKeys` on the
 * library never returns one and the two sets stay genuinely separate.
 */
export const PROFILE_PREFIX = "profiles/";

/**
 * What counts as a library object. The bucket is not exclusively the media
 * library's, so listing filters by extension rather than trusting the prefix.
 *
 * It covers everything the bucket will TAKE (`ALLOWED_UPLOAD_CONTENT_TYPES`),
 * documents included — the two halves of the picker are a filter the dialog
 * applies to this list, not two listings. While `pdf` was missing here the
 * document half was permanently empty: an uploaded CV landed in the bucket and
 * was never listed again, so it could not be inserted, renamed or deleted.
 *
 * This is the ONE remaining place an extension decides anything, and it decides
 * only whether an object belongs to the library — never what it is. The
 * renderer used to read the kind back off the same string, which made this list
 * and `VIDEO_EXTENSIONS` a pair that had to grow together; a media node now
 * records its `kind` outright and nothing renders off a filename, so adding a
 * format here is only a question of what the library will list. Note the
 * asymmetry it leaves: an object under a bare key is invisible to this filter
 * but perfectly renderable once it is in a document.
 */
const MEDIA_KEY_PATTERN = /\.(png|jpe?g|gif|webp|svg|mp4|pdf)$/i;

export function publicUrlForKey(key: string): string | null {
  return env.R2_PUBLIC_BASE_URL ? `${env.R2_PUBLIC_BASE_URL}/${key}` : null;
}

export async function createR2UploadUrl(
  key: string,
  contentType: string,
  metadata: Record<string, string> = {},
) {
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    Metadata: metadata,
  });

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 60 });
  const publicUrl = publicUrlForKey(key);

  return { uploadUrl, publicUrl, key };
}

export async function listR2MediaKeys(prefix = MEDIA_PREFIX): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await r2.send(
      new ListObjectsV2Command({
        Bucket: env.R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const item of response.Contents ?? []) {
      if (item.Key && MEDIA_KEY_PATTERN.test(item.Key)) {
        keys.push(item.Key);
      }
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys.sort((a, b) => b.localeCompare(a));
}

/**
 * Every icon in the set. An icon is an SVG and nothing else, so the filter is
 * the extension alone — and unlike the media library's, this one is a fact
 * about the format rather than a guess about the kind.
 */
export async function listR2IconKeys(): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await r2.send(
      new ListObjectsV2Command({
        Bucket: env.R2_BUCKET_NAME,
        Prefix: ICON_PREFIX,
        ContinuationToken: continuationToken,
      }),
    );

    for (const item of response.Contents ?? []) {
      if (item.Key && /\.svg$/i.test(item.Key)) keys.push(item.Key);
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
}

export interface R2ObjectHead {
  size: number;
  contentType: string;
  /**
   * Everything the object was stored with, as the map of strings S3 keeps it
   * as. The named fields below are the media library's, read out for it; a
   * caller storing its own facts (the icon set's grid, weight and review
   * state) reads them from here and parses them itself.
   */
  metadata: Record<string, string>;
  alt?: string;
  /** The original upload name, editable independently of the immutable key. */
  filename?: string;
  /**
   * The source's own pixel size, written at upload so a surface can reserve
   * the box it will need before the bytes arrive. Object metadata is a map of
   * STRINGS, so these arrive as strings and the caller parses them; absent for
   * everything stored before the measurement existed.
   */
  width?: string;
  height?: string;
}

export async function headR2Object(key: string): Promise<R2ObjectHead> {
  const response = await r2.send(
    new HeadObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }),
  );

  return {
    size: response.ContentLength ?? 0,
    contentType: response.ContentType ?? "application/octet-stream",
    metadata: response.Metadata ?? {},
    alt: response.Metadata?.alt,
    filename: response.Metadata?.filename,
    width: response.Metadata?.width,
    height: response.Metadata?.height,
  };
}

/**
 * How long a stored object may be held. Every key under this bucket carries a
 * uuid, so an object's bytes never change — a re-upload mints a new key — and
 * the public endpoint sends no cache header of its own. Without this, every
 * visit re-fetches every object: the icons playground was pulling all two
 * hundred of its files down again on each load, which at 568 bytes apiece is
 * entirely a cost in ROUND TRIPS rather than in bytes.
 *
 * Metadata edits (an alt text, a review state) rewrite the object without
 * touching its bytes, so a year is safe for those too.
 */
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Patch a subset of an object's user metadata in place. S3/R2 has no partial
 * metadata update — the only way is a self-copy with `MetadataDirective:
 * REPLACE`, which swaps the WHOLE metadata map and resets system headers. So
 * read the current state first and re-send it merged, carrying `ContentType`
 * across too; otherwise editing the alt text would drop the filename (and
 * re-serve the image as `application/octet-stream`).
 */
export async function updateR2ObjectMetadata(
  key: string,
  patch: Record<string, string>,
): Promise<void> {
  const current = await r2.send(
    new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
  );

  await r2.send(
    new CopyObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      CopySource: `${env.R2_BUCKET_NAME}/${key}`,
      Key: key,
      ContentType: current.ContentType,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
      Metadata: { ...current.Metadata, ...patch },
      MetadataDirective: "REPLACE",
    }),
  );
}

export async function deleteR2Object(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }),
  );
}
