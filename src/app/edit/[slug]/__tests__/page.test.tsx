import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockIsAdmin, mockFindUnique } = vi.hoisted(() => ({
  mockIsAdmin: vi.fn(),
  mockFindUnique: vi.fn(),
}));
const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
  redirect: (url: string) => mockRedirect(url),
}));
vi.mock("@/lib/auth/server", () => ({ isAdmin: () => mockIsAdmin() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { post: { findUnique: (...a: unknown[]) => mockFindUnique(...a) } },
}));
vi.mock("@/components/article-editor", () => ({
  ArticleEditor: (props: unknown) => props,
}));

const { default: EditPostPage } = await import("../page");

const NOW = new Date("2026-09-16T00:00:00.000Z");
const row = (category: string) => ({
  id: "p1",
  title: "Hello",
  slug: "hello",
  category,
  content: { type: "doc", content: [] },
  previousSlugs: [],
  createdAt: NOW,
  updatedAt: NOW,
});

const open = (category: string | undefined) =>
  EditPostPage({
    params: Promise.resolve({ slug: "hello" }),
    searchParams: Promise.resolve({ category }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdmin.mockResolvedValue(true);
  mockFindUnique.mockResolvedValue(row("ARTICLE"));
});

describe("EditPostPage", () => {
  it("is a 404 for anyone but the author, before reading anything", async () => {
    mockIsAdmin.mockResolvedValue(false);
    await expect(open("ARTICLE")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("finds the post by its slug", async () => {
    await expect(open("ARTICLE")).resolves.toBeDefined();
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { slug: "hello" } });
  });

  it("is a 404 for a slug that is nothing", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(open("ARTICLE")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is a 404 for a category that is nothing", async () => {
    await expect(open("DRAFT")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("follows a post refiled under another category", async () => {
    mockFindUnique.mockResolvedValue(row("PROTOTYPE"));
    await expect(open("ARTICLE")).rejects.toThrow(
      "NEXT_REDIRECT /edit/hello?category=PROTOTYPE",
    );
  });
});
