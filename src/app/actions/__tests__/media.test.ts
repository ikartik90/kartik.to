import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

// Mocked at the session source, not `requireAdmin`, so the real admin check runs.
vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: () => ({ getSession: () => mockGetSession() }),
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
  PROFILE_PREFIX: "profiles/",
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
    expect(asset.key).toBe(KEY);
    expect(asset.url).toBe(`https://cdn.example.com/${KEY}`);
    expect(asset.filename).toBe("invoice.png");
  });

  it("keeps a renamed file readable, and only strips what a header cannot hold", async () => {
    mockHeadR2Object.mockResolvedValue({ size: 100, contentType: "image/png" });

    await updateMediaFilename({ key: KEY, filename: "  my invoice!.png  " });

    expect(mockUpdateR2ObjectMetadata).toHaveBeenCalledWith(KEY, {
      filename: "my invoice!.png",
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

describe("media folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { user: { email: "admin@example.com" } },
    });
  });

  it("createMediaUploadUrl puts a profile picture under profiles/", async () => {
    mockCreateR2UploadUrl.mockResolvedValue({
      uploadUrl: "https://upload",
      publicUrl: "https://cdn.example.com/profiles/x.png",
      key: "profiles/x.png",
    });

    await createMediaUploadUrl({
      filename: "Head Shot.png",
      contentType: "image/png",
      size: 500,
      folder: "profiles",
    });

    expect(mockCreateR2UploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^profiles\/[\w-]+-Head-Shot\.png$/),
      "image/png",
      expect.anything(),
    );
  });

  it("createMediaUploadUrl still defaults to the library", async () => {
    mockCreateR2UploadUrl.mockResolvedValue({
      uploadUrl: "https://upload",
      publicUrl: "https://cdn.example.com/media/x.png",
      key: "media/x.png",
    });

    await createMediaUploadUrl({
      filename: "photo.png",
      contentType: "image/png",
      size: 500,
    });

    expect(mockCreateR2UploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^media\//),
      "image/png",
      expect.anything(),
    );
  });

  it("listMediaAssets lists the folder it is asked for", async () => {
    mockListR2MediaKeys.mockResolvedValue([]);

    await listMediaAssets("profiles");
    expect(mockListR2MediaKeys).toHaveBeenCalledWith("profiles/");

    await listMediaAssets();
    expect(mockListR2MediaKeys).toHaveBeenLastCalledWith("media/");
  });

  it("names a profile object by its file, not its path", async () => {
    const key = "profiles/550e8400-e29b-41d4-a716-446655440000-face.png";
    mockListR2MediaKeys.mockResolvedValue([key]);
    mockHeadR2Object.mockResolvedValue({
      size: 100,
      contentType: "image/png",
      alt: "",
      filename: "",
      metadata: {},
    });

    const [asset] = await listMediaAssets("profiles");
    expect(asset.filename).toBe("face.png");
  });

  it("listMediaAssets refuses an unknown folder rather than falling back", async () => {
    mockListR2MediaKeys.mockResolvedValue([]);
    await expect(listMediaAssets("elsewhere")).rejects.toThrow();
    expect(mockListR2MediaKeys).not.toHaveBeenCalled();
  });

  it("refuses a folder it does not have", async () => {
    await expect(
      createMediaUploadUrl({
        filename: "photo.png",
        contentType: "image/png",
        size: 500,
        folder: "../secrets",
      }),
    ).rejects.toThrow();
  });

  const PROFILE_KEY = "profiles/550e8400-e29b-41d4-a716-446655440000-face.png";

  it("renames a profile picture, like any other object in the library", async () => {
    mockHeadR2Object.mockResolvedValue({
      size: 100,
      contentType: "image/png",
      filename: "Rajat Saxena",
    });

    const asset = await updateMediaFilename({
      key: PROFILE_KEY,
      filename: "Rajat Saxena",
    });

    expect(mockUpdateR2ObjectMetadata).toHaveBeenCalledWith(PROFILE_KEY, {
      filename: "Rajat Saxena",
    });
    expect(asset.filename).toBe("Rajat Saxena");
  });

  it("describes a profile picture", async () => {
    mockHeadR2Object.mockResolvedValue({
      size: 100,
      contentType: "image/png",
      alt: "Rajat, smiling",
    });

    const asset = await updateMediaAlt({
      key: PROFILE_KEY,
      alt: "Rajat, smiling",
    });

    expect(mockUpdateR2ObjectMetadata).toHaveBeenCalledWith(PROFILE_KEY, {
      alt: "Rajat, smiling",
    });
    expect(asset.alt).toBe("Rajat, smiling");
  });

  it("deletes a profile picture", async () => {
    await deleteMedia({ key: PROFILE_KEY });
    expect(mockDeleteR2Object).toHaveBeenCalledWith(PROFILE_KEY);
  });

  it.each(["icons/star.svg", "posters/x.jpg", "secrets.env", "../etc/passwd"])(
    "refuses %s, which is not a library object",
    async (key) => {
      await expect(
        updateMediaFilename({ key, filename: "anything" }),
      ).rejects.toThrow("Invalid media key");
      await expect(updateMediaAlt({ key, alt: "anything" })).rejects.toThrow(
        "Invalid media key",
      );
      await expect(deleteMedia({ key })).rejects.toThrow("Invalid media key");
      expect(mockUpdateR2ObjectMetadata).not.toHaveBeenCalled();
      expect(mockDeleteR2Object).not.toHaveBeenCalled();
    },
  );
});
