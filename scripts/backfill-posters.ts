// One-off: gives every clip without a still the poster it would get at upload, using local ffmpeg.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PutObjectCommand, S3Client, HeadObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { pickPosterFrame, posterSampleTimes } from "../src/utils/poster-frame.ts";

const run = promisify(execFile);

// Both must match `capture-poster.ts`.
const SAMPLE_WIDTH = 64;
const POSTER_MAX_WIDTH = 1280;

const {
  DATABASE_URL,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_BASE_URL,
} = process.env;

for (const [name, value] of Object.entries({
  DATABASE_URL,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_BASE_URL,
})) {
  if (!value) throw new Error(`${name} is not set — run with --env-file=.env`);
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: DATABASE_URL! }),
});

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

function keyFromSrc(src: string): string | null {
  const base = `${R2_PUBLIC_BASE_URL!.replace(/\/+$/, "")}/`;
  return src.startsWith(base) ? src.slice(base.length) : null;
}

/** Mirrors `posterKeyFor` in `src/lib/storage/r2.ts`. */
function posterKeyFor(mediaKey: string): string | null {
  if (!mediaKey.startsWith("media/")) return null;
  const name = mediaKey.slice("media/".length);
  const dot = name.lastIndexOf(".");
  return `posters/${dot === -1 ? name : name.slice(0, dot)}.jpg`;
}

async function probe(file: string) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration",
    "-of", "json",
    file,
  ]);
  const data = JSON.parse(stdout);
  return {
    width: Number(data.streams?.[0]?.width) || undefined,
    height: Number(data.streams?.[0]?.height) || undefined,
    duration: Number(data.format?.duration),
  };
}

async function sampleFrame(file: string, time: number): Promise<Uint8ClampedArray> {
  const { stdout } = await run(
    "ffmpeg",
    [
      "-v", "error",
      "-ss", String(time),
      "-i", file,
      "-frames:v", "1",
      "-vf", `scale=${SAMPLE_WIDTH}:-2`,
      "-f", "rawvideo",
      "-pix_fmt", "rgba",
      "-",
    ],
    { encoding: "buffer", maxBuffer: 1 << 26 },
  );
  return new Uint8ClampedArray(stdout as unknown as Buffer);
}

async function stillAt(file: string, time: number, out: string) {
  await run("ffmpeg", [
    "-v", "error",
    "-ss", String(time),
    "-i", file,
    "-frames:v", "1",
    "-vf", `scale='min(${POSTER_MAX_WIDTH},iw)':-2`,
    "-q:v", "4",
    "-y", out,
  ]);
}

/** Mirrors `finalizeMediaUpload`'s metadata stamp. */
async function stampPoster(key: string, posterUrl: string) {
  const head = await r2.send(
    new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
  );
  await r2.send(
    new CopyObjectCommand({
      Bucket: R2_BUCKET_NAME,
      CopySource: `${R2_BUCKET_NAME}/${key}`,
      Key: key,
      ContentType: head.ContentType,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: { ...head.Metadata, poster: posterUrl },
      MetadataDirective: "REPLACE",
    }),
  );
}

type Node = Record<string, unknown>;

function mediaNodes(content: Node): Node[] {
  const blocks = (content?.content ?? []) as Node[];
  return blocks.flatMap((block) =>
    block.type === "media"
      ? [block]
      : block.type === "collection"
        ? ((block.items ?? []) as Node[])
        : [],
  );
}

const work = await mkdtemp(join(tmpdir(), "posters-"));
let changed = 0;

try {
  const posts = await prisma.post.findMany({ select: { id: true, slug: true, content: true } });

  for (const post of posts) {
    const content = post.content as Node;
    let touched = false;

    for (const node of mediaNodes(content)) {
      if (node.kind !== "video" || node.poster) continue;

      const key = keyFromSrc(String(node.src));
      const posterKey = key && posterKeyFor(key);
      if (!key || !posterKey) {
        console.log(`  skip ${node.src} — not a library object`);
        continue;
      }

      console.log(`• ${post.slug}: ${key}`);
      const local = join(work, "clip.mp4");
      await run("curl", ["-sSL", "-o", local, String(node.src)]);

      const { width, height, duration } = await probe(local);
      const times = posterSampleTimes(duration);
      const samples = [];
      for (const time of times) {
        try {
          samples.push({ time, pixels: await sampleFrame(local, time) });
        } catch {
          /* dropped, as in the browser */
        }
      }

      const index = pickPosterFrame(samples);
      if (index === -1) {
        console.log("  no frame could be read — left without a still");
        continue;
      }
      const time = samples[index].time;
      const still = join(work, "poster.jpg");
      await stillAt(local, time, still);
      const bytes = await readFile(still);
      console.log(
        `  frame at ${time.toFixed(2)}s of ${duration.toFixed(2)}s → ${(bytes.length / 1024).toFixed(0)}KB`,
      );

      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: posterKey,
          Body: bytes,
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      const posterUrl = `${R2_PUBLIC_BASE_URL!.replace(/\/+$/, "")}/${posterKey}`;
      await stampPoster(key, posterUrl);

      node.poster = posterUrl;
      if (width && height && !node.width && !node.height) {
        node.width = width;
        node.height = height;
      }
      touched = true;
      console.log(`  stored ${posterKey}`);
    }

    if (touched) {
      await prisma.post.update({
        where: { id: post.id },
        data: { content: content as Prisma.InputJsonValue },
      });
      changed++;
    }
  }
} finally {
  await rm(work, { recursive: true, force: true });
  await prisma.$disconnect();
}

console.log(changed ? `\nUpdated ${changed} post(s).` : "\nNothing to do.");
