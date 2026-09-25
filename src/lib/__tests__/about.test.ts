import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

const NOW = new Date("2026-09-15T00:00:00.000Z");

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "about-1",
  title: "About",
  slug: "about",
  category: "PAGE",
  content: { type: "doc", content: [] },
  coverImageKey: null,
  publishedAt: null,
  untitledIndex: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const { getOrCreateAboutPost } = await import("../about");

describe("getOrCreateAboutPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an unpublished About page the first time, and never overwrites one", async () => {
    mockUpsert.mockResolvedValue(row());
    await getOrCreateAboutPost();

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { slug: "about" },
      update: {},
      create: {
        slug: "about",
        category: "PAGE",
        title: "About",
        content: { type: "doc", content: [] },
        publishedAt: null,
      },
    });
  });

  it("returns the page as a post", async () => {
    mockUpsert.mockResolvedValue(row({ publishedAt: NOW }));
    const post = await getOrCreateAboutPost();

    expect(post?.id).toBe("about-1");
    expect(post?.category).toBe("PAGE");
    expect(post?.publishedAt).toEqual(NOW);
  });

  it("returns null when the slug belongs to a post that is not a page", async () => {
    mockUpsert.mockResolvedValue(row({ category: "ARTICLE" }));
    expect(await getOrCreateAboutPost()).toBeNull();
  });
});
