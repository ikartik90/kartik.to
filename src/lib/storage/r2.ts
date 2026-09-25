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

// Must stay outside MEDIA_PREFIX: the guards in `actions/icon-set.ts` rely on an icon key never naming media.
export const ICON_PREFIX = "icons/";

// Outside MEDIA_PREFIX so the media library never lists profile pictures.
export const PROFILE_PREFIX = "profiles/";

// Must cover every type in `ALLOWED_UPLOAD_CONTENT_TYPES`, or uploads of that type never list.
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
  /** All stored metadata, as strings; the named fields below are the media library's. */
  metadata: Record<string, string>;
  alt?: string;
  /** The original upload name; editable, unlike the key. */
  filename?: string;
  /** Pixel size recorded at upload, as strings; absent on older objects. */
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

// Safe because every key carries a uuid: an object's bytes never change.
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

// A self-copy with REPLACE resets the whole map and system headers, so the current metadata and ContentType are re-sent.
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
