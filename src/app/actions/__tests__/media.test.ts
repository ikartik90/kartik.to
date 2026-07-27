import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  auth: { getSession: () => mockGetSession() },
}));

vi.mock("@/lib/env", () => ({
  env: {
    ADMIN_GITHUB_ID: "admin@example.com",
    R2_PUBLIC_BASE_URL: "https://cdn.example.com",
  },
}));

const mockListR2MediaKeys = vi.fn();
const mockHeadR2Object = vi.fn();
const mockCreateR2UploadUrl = vi.fn();
const mockUpdateR2ObjectMetadata = vi.fn();
const mockDeleteR2Object = vi.fn();

vi.mock("@/lib/storage/r2", () => ({
  MEDIA_PREFIX: "media/",
  listR2MediaKeys: (...args: unknown[]) => mockListR2MediaKeys(...args),
  headR2Object: (...args: unknown[]) => mockHeadR2Object(...args),
  createR2UploadUrl: (...args: unknown[]) => mockCreateR2UploadUrl(...args),
  updateR2ObjectMetadata: (...args: unknown[]) =>
    mockUpdateR2ObjectMetadata(...args),
  deleteR2Object: (...args: unknown[]) => mockDeleteR2Object(...args),
  publicUrlForKey: (key: string) => `https://cdn.example.com/${key}`,
}));

const {
  listMediaAssets,
  createMediaUploadUrl,
  updateMediaAlt,
  updateMediaFilename,
  deleteMedia,
} = await import("../media");

// A realistic key: `media/<uuid>-<original name>`, uuid dashes and all.
const KEY = "media/550e8400-e29b-41d4-a716-446655440000-photo.png";

describe("media server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { user: { email: "admin@example.com" } },
    });
  });

  it("listMediaAssets returns parsed assets", async () => {
    mockListR2MediaKeys.mockResolvedValue([KEY]);
    mockHeadR2Object.mockResolvedValue({
      size: 100,
      contentType: "image/png",
      alt: "alt text",
      filename: "photo.png",
    });

    const assets = await listMediaAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0].filename).toBe("photo.png");
    expect(assets[0].alt).toBe("alt text");
  });

  it("prefers the stored filename over the key, so renames stick", async () => {
    mockListR2MediaKeys.mockResolvedValue([KEY]);
    mockHeadR2Object.mockResolvedValue({
      size: 100,
      contentType: "image/png",
      filename: "renamed-by-hand.png",
    });

    const [asset] = await listMediaAssets();
    expect(asset.filename).toBe("renamed-by-hand.png");
  });

  it("recovers the original name from the key for legacy objects", async () => {
    // Uploaded before the name was stored as metadata — the uuid must be
    // stripped WHOLE, not split at its first dash.
    mockListR2MediaKeys.mockResolvedValue([KEY]);
    mockHeadR2Object.mockResolvedValue({ size: 100, contentType: "image/png" });

    const [asset] = await listMediaAssets();
    expect(asset.filename).toBe("photo.png");
  });

  it("createMediaUploadUrl presigns with sanitized key", async () => {
    mockCreateR2UploadUrl.mockResolvedValue({
      uploadUrl: "https://upload",
      publicUrl: "https://cdn.example.com/media/x.png",
      key: "media/x.png",
    });

    const result = await createMediaUploadUrl({
      filename: "My Photo.png",
      contentType: "image/png",
      size: 500,
    });

    expect(result.uploadUrl).toBe("https://upload");
    expect(mockCreateR2UploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^media\/[\w-]+-My-Photo\.png$/),
      "image/png",
      { alt: "", filename: "My-Photo.png" },
    );
  });

  it("updateMediaAlt persists and returns asset", async () => {
    mockHeadR2Object.mockResolvedValue({
      size: 100,
      contentType: "image/png",
      alt: "updated",
      filename: "photo.png",
    });

    const asset = await updateMediaAlt({ key: KEY, alt: "updated" });

    // Patches only `alt` — the merge in the storage layer keeps the filename.
    expect(mockUpdateR2ObjectMetadata).toHaveBeenCalledWith(KEY, {
      alt: "updated",
    });
    expect(asset.alt).toBe("updated");
  });

  it("updateMediaFilename renames without touching the object key", async () => {
    mockHeadR2Object.mockResolvedValue({
      size: 100,
      contentType: "image/png",
      filename: "invoice.png",
    });

    const asset = await updateMediaFilename({ key: KEY, filename: "invoice.png" });

    expect(mockUpdateR2ObjectMetadata).toHaveBeenCalledWith(KEY, {
      filename: "invoice.png",
    });
    // The key — and every URL already published from it — is unchanged.
    expect(asset.key).toBe(KEY);
    expect(asset.url).toBe(`https://cdn.example.com/${KEY}`);
    expect(asset.filename).toBe("invoice.png");
  });

  it("sanitizes a renamed filename", async () => {
    mockHeadR2Object.mockResolvedValue({ size: 100, contentType: "image/png" });

    await updateMediaFilename({ key: KEY, filename: "my invoice!.png" });

    expect(mockUpdateR2ObjectMetadata).toHaveBeenCalledWith(KEY, {
      filename: "my-invoice-.png",
    });
  });

  it("deleteMedia removes object from R2", async () => {
    await deleteMedia({ key: KEY });

    expect(mockDeleteR2Object).toHaveBeenCalledWith(KEY);
  });

  it("throws when not admin", async () => {
    mockGetSession.mockResolvedValue({ data: null });
    await expect(listMediaAssets()).rejects.toThrow("Unauthorized");
  });
});
