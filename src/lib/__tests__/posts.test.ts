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

const { parseCategory, getPublishedPostBySlug, resolvePost } = await import(
  "../posts"
);

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
