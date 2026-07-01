import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn();
const mockGetSignedUrl = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function MockS3Client() {
    return { send: mockSend };
  }),
  PutObjectCommand: vi.fn(function PutObjectCommand(input: unknown) {
    return { input };
  }),
  ListObjectsV2Command: vi.fn(function ListObjectsV2Command(input: unknown) {
    return { input };
  }),
  HeadObjectCommand: vi.fn(function HeadObjectCommand(input: unknown) {
    return { input };
  }),
  CopyObjectCommand: vi.fn(function CopyObjectCommand(input: unknown) {
    return { input };
  }),
  DeleteObjectCommand: vi.fn(function DeleteObjectCommand(input: unknown) {
    return { input };
  }),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

vi.mock("@/lib/env", () => ({
  env: {
    R2_ACCOUNT_ID: "acct",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET_NAME: "bucket",
    R2_PUBLIC_BASE_URL: "https://cdn.example.com",
  },
}));

const {
  createR2UploadUrl,
  listR2MediaKeys,
  headR2Object,
  updateR2ObjectAlt,
  deleteR2Object,
  publicUrlForKey,
} = await import("../r2");

describe("r2 storage helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSignedUrl.mockResolvedValue("https://signed-upload.example");
  });

  it("publicUrlForKey builds CDN URL", () => {
    expect(publicUrlForKey("media/foo.png")).toBe(
      "https://cdn.example.com/media/foo.png",
    );
  });

  it("createR2UploadUrl returns presigned URL and public URL", async () => {
    const result = await createR2UploadUrl("media/x.png", "image/png", {
      alt: "",
    });
    expect(result.uploadUrl).toBe("https://signed-upload.example");
    expect(result.publicUrl).toBe("https://cdn.example.com/media/x.png");
  });

  it("listR2MediaKeys filters to image extensions", async () => {
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: "media/a.png" },
        { Key: "media/readme.txt" },
        { Key: "media/b.jpg" },
      ],
      IsTruncated: false,
    });

    const keys = await listR2MediaKeys();
    expect(keys).toEqual(["media/b.jpg", "media/a.png"]);
  });

  it("headR2Object returns metadata", async () => {
    mockSend.mockResolvedValueOnce({
      ContentLength: 512,
      ContentType: "image/png",
      Metadata: { alt: "desc" },
    });

    const head = await headR2Object("media/a.png");
    expect(head).toEqual({
      size: 512,
      contentType: "image/png",
      alt: "desc",
    });
  });

  it("updateR2ObjectAlt copies in place with metadata replace", async () => {
    mockSend.mockResolvedValueOnce({});
    await updateR2ObjectAlt("media/a.png", "new alt");
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("deleteR2Object removes the object", async () => {
    mockSend.mockResolvedValueOnce({});
    await deleteR2Object("media/a.png");
    expect(mockSend).toHaveBeenCalledOnce();
  });
});
