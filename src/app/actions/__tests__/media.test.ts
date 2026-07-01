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
const mockUpdateR2ObjectAlt = vi.fn();
const mockDeleteR2Object = vi.fn();

vi.mock("@/lib/storage/r2", () => ({
  MEDIA_PREFIX: "media/",
  listR2MediaKeys: (...args: unknown[]) => mockListR2MediaKeys(...args),
  headR2Object: (...args: unknown[]) => mockHeadR2Object(...args),
  createR2UploadUrl: (...args: unknown[]) => mockCreateR2UploadUrl(...args),
  updateR2ObjectAlt: (...args: unknown[]) => mockUpdateR2ObjectAlt(...args),
  deleteR2Object: (...args: unknown[]) => mockDeleteR2Object(...args),
  publicUrlForKey: (key: string) => `https://cdn.example.com/${key}`,
}));

const { listMediaAssets, createMediaUploadUrl, updateMediaAlt, deleteMedia } =
  await import("../media");

describe("media server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { user: { email: "admin@example.com" } },
    });
  });

  it("listMediaAssets returns parsed assets", async () => {
    mockListR2MediaKeys.mockResolvedValue(["media/id-photo.png"]);
    mockHeadR2Object.mockResolvedValue({
      size: 100,
      contentType: "image/png",
      alt: "alt text",
    });

    const assets = await listMediaAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0].filename).toBe("photo.png");
    expect(assets[0].alt).toBe("alt text");
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
      { alt: "" },
    );
  });

  it("updateMediaAlt persists and returns asset", async () => {
    mockHeadR2Object.mockResolvedValue({
      size: 100,
      contentType: "image/png",
      alt: "updated",
    });

    const asset = await updateMediaAlt({
      key: "media/id-photo.png",
      alt: "updated",
    });

    expect(mockUpdateR2ObjectAlt).toHaveBeenCalledWith(
      "media/id-photo.png",
      "updated",
    );
    expect(asset.alt).toBe("updated");
  });

  it("deleteMedia removes object from R2", async () => {
    await deleteMedia({ key: "media/id-photo.png" });

    expect(mockDeleteR2Object).toHaveBeenCalledWith("media/id-photo.png");
  });

  it("throws when not admin", async () => {
    mockGetSession.mockResolvedValue({ data: null });
    await expect(listMediaAssets()).rejects.toThrow("Unauthorized");
  });
});
