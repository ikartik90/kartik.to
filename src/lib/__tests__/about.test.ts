import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpsert = vi.fn();
const mockCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      count: (...args: unknown[]) => mockCount(...args),
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

const { getOrCreateAboutPost, isAboutPublished } = await import("../about");

describe("isAboutPublished", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks only for a published About page", async () => {
    mockCount.mockResolvedValue(1);
    await isAboutPublished();

    expect(mockCount).toHaveBeenCalledWith({
      where: { slug: "about", category: "PAGE", publishedAt: { not: null } },
    });
  });

  it("is true once the About page is published", async () => {
    mockCount.mockResolvedValue(1);
    expect(await isAboutPublished()).toBe(true);
  });

  it("is false while there is no published About page", async () => {
    mockCount.mockResolvedValue(0);
    expect(await isAboutPublished()).toBe(false);
  });

  // It is read by the homepage, which must not 500 over a button.
  it("is false when the database cannot be reached", async () => {
    mockCount.mockRejectedValue(new Error("unreachable"));
    expect(await isAboutPublished()).toBe(false);
  });
});

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

  // Slugs are unique across every category, so an article titled "About" would
  // already own the slug. That article is not the About page.
  it("returns null when the slug belongs to a post that is not a page", async () => {
    mockUpsert.mockResolvedValue(row({ category: "ARTICLE" }));
    expect(await getOrCreateAboutPost()).toBeNull();
  });
});
