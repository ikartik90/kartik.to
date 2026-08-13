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
 * What counts as a library object. The bucket is not exclusively the media
 * library's, so listing filters by extension rather than trusting the prefix —
 * and the extension is also what the renderer later reads the KIND back off
 * (see `isVideoSource`), so the two lists have to grow together.
 */
const MEDIA_KEY_PATTERN = /\.(png|jpe?g|gif|webp|svg|mp4)$/i;

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

export interface R2ObjectHead {
  size: number;
  contentType: string;
  alt?: string;
  /** The original upload name, editable independently of the immutable key. */
  filename?: string;
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
    alt: response.Metadata?.alt,
    filename: response.Metadata?.filename,
  };
}

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
