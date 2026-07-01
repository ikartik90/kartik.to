import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Post } from "@/domain/post";

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

const STATIC_PROJECT: Post = {
  id: "project-1",
  title: "Static",
  slug: "static",
  category: "WORK",
  content: EMPTY_DOC,
  publishedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

const {
  parseCategory,
  mergePosts,
  getPublishedPostBySlug,
  resolvePost,
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

describe("mergePosts", () => {
  it("prefers DB posts over static posts with the same slug", () => {
    const dbPost: Post = { ...STATIC_PROJECT, id: "db-1", title: "From DB" };
    const merged = mergePosts([dbPost], [STATIC_PROJECT]);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("From DB");
  });

  it("appends static-only posts after DB posts", () => {
    const dbPost: Post = {
      ...STATIC_PROJECT,
      id: "db-1",
      slug: "db-only",
    };
    const merged = mergePosts([dbPost], [STATIC_PROJECT]);
    expect(merged).toHaveLength(2);
    expect(merged[0].slug).toBe("db-only");
    expect(merged[1].slug).toBe("static");
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

  it("returns static fallback when DB has no match", async () => {
    mockFindFirst.mockResolvedValue(null);
    const post = await resolvePost("static", "WORK", {
      staticFallback: [STATIC_PROJECT],
      allowDraft: false,
    });
    expect(post?.slug).toBe("static");
  });
});
