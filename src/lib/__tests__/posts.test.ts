import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const NOW = new Date("2025-01-01T00:00:00.000Z");

const EMPTY_DOC = { type: "doc" as const, content: [] };

const RAW_POST = {
  id: "post-1",
  title: "Hello",
  slug: "hello",
  category: "WORK",
  content: EMPTY_DOC,
  coverImageKey: null,
  publishedAt: NOW,
  untitledIndex: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const {
  parseCategory,
  getPublishedPostBySlug,
  resolvePost,
  findMovedPostPath,
} = await import("../posts");

describe("parseCategory", () => {
  it("parses valid categories", () => {
    expect(parseCategory("WORK")).toBe("WORK");
    expect(parseCategory("ARTICLE")).toBe("ARTICLE");
  });

  it("returns null for invalid categories", () => {
    expect(parseCategory("INVALID")).toBeNull();
    expect(parseCategory(undefined)).toBeNull();
  });
});

describe("getPublishedPostBySlug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters by slug and category", async () => {
    mockFindFirst.mockResolvedValue(RAW_POST);
    await getPublishedPostBySlug("hello", "WORK");
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { slug: "hello", category: "WORK", publishedAt: { not: null } },
    });
  });
});

describe("resolvePost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A slug the database does not know is a 404, even when `src/data` still
  // holds a post by that name. The fixtures are not a shadow copy of the site:
  // an article nobody can edit or unpublish should not stay reachable just
  // because a module in the tree happens to spell its slug.
  it("returns null when the database has no match", async () => {
    mockFindFirst.mockResolvedValue(null);
    const post = await resolvePost("static", "WORK", { allowDraft: false });
    expect(post).toBeNull();
  });

  it("falls through to a draft when allowDraft is true", async () => {
    const draftPost = {
      ...RAW_POST,
      id: "draft-1",
      title: "Draft version",
      publishedAt: null,
    };
    mockFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(draftPost);

    const post = await resolvePost("static", "WORK", { allowDraft: true });

    expect(post?.title).toBe("Draft version");
  });

  // The admin's draft is a courtesy, not a bypass: a visitor asking for the
  // same slug gets nothing.
  it("does not reach for a draft when allowDraft is false", async () => {
    mockFindFirst.mockResolvedValue(null);
    await resolvePost("static", "WORK", { allowDraft: false });
    expect(mockFindFirst).toHaveBeenCalledOnce();
  });
});

describe("findMovedPostPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
  });

  // Slugs are unique across categories, so an article refiled as a project is
  // found by its slug alone.
  it("sends a post's old category address to its new one", async () => {
    mockFindFirst.mockResolvedValueOnce({ slug: "hello", category: "WORK" });
    await expect(
      findMovedPostPath("hello", "ARTICLE", { allowDraft: false }),
    ).resolves.toBe("/work/hello");
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: "hello",
          category: { in: ["WORK", "PROTOTYPE"] },
          publishedAt: { not: null },
        },
      }),
    );
  });

  it("sends an address the post has since left to where it is now", async () => {
    mockFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ slug: "renamed", category: "WORK" });
    await expect(
      findMovedPostPath("old-name", "WORK", { allowDraft: false }),
    ).resolves.toBe("/work/renamed");
    expect(mockFindFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          previousSlugs: { has: "old-name" },
          category: { in: ["WORK", "ARTICLE", "PROTOTYPE"] },
          publishedAt: { not: null },
        },
        orderBy: { updatedAt: "desc" },
      }),
    );
  });

  // The post that holds an address NOW wins over one that used to.
  it("asks for the current holder before the former ones", async () => {
    mockFindFirst.mockResolvedValueOnce({ slug: "x", category: "ARTICLE" });
    await findMovedPostPath("x", "WORK", { allowDraft: false });
    expect(mockFindFirst).toHaveBeenCalledOnce();
  });

  it("is null when nothing was ever there", async () => {
    await expect(
      findMovedPostPath("nothing", "ARTICLE", { allowDraft: false }),
    ).resolves.toBeNull();
  });

  // A refusal is a 404: redirecting a visitor to a draft would confirm it.
  it("follows drafts for the author alone", async () => {
    await findMovedPostPath("hello", "ARTICLE", { allowDraft: true });
    for (const [args] of mockFindFirst.mock.calls as [
      { where: Record<string, unknown> },
    ][]) {
      expect(args.where).not.toHaveProperty("publishedAt");
    }
  });

  it("never sends a reader to a page", async () => {
    await findMovedPostPath("about", "ARTICLE", { allowDraft: false });
    for (const [args] of mockFindFirst.mock.calls as [
      { where: { category: { in: string[] } } },
    ][]) {
      expect(args.where.category.in).not.toContain("PAGE");
    }
  });

  it("is null rather than a 500 when the database cannot be read", async () => {
    mockFindFirst.mockRejectedValue(new Error("down"));
    await expect(
      findMovedPostPath("hello", "ARTICLE", { allowDraft: false }),
    ).resolves.toBeNull();
  });
});
