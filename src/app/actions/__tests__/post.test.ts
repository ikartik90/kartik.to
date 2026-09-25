import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Document } from "@/domain/post";

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

// Mocked at the session source, not `requireAdmin`, so the real admin check runs.
vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: () => ({ getSession: () => mockGetSession() }),
}));

const mockPrismaCreate = vi.fn();
const mockPrismaUpdate = vi.fn();
const mockPrismaDelete = vi.fn();
const mockPrismaFindUnique = vi.fn();
const mockPrismaAggregate = vi.fn();
const mockPrismaFindMany = vi.fn();
const mockPrismaFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      create: (...args: unknown[]) => mockPrismaCreate(...args),
      update: (...args: unknown[]) => mockPrismaUpdate(...args),
      delete: (...args: unknown[]) => mockPrismaDelete(...args),
      findUnique: (...args: unknown[]) => mockPrismaFindUnique(...args),
      aggregate: (...args: unknown[]) => mockPrismaAggregate(...args),
      findMany: (...args: unknown[]) => mockPrismaFindMany(...args),
      findFirst: (...args: unknown[]) => mockPrismaFindFirst(...args),
    },
  },
}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockCookiesGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: mockCookiesGet }),
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEON_AUTH_COOKIE_SECRET: "a".repeat(32),
    ADMIN_GITHUB_ID: "admin@example.com",
  },
}));

vi.mock("jose", () => ({
  jwtVerify: vi.fn().mockResolvedValue({
    payload: { user: { email: "admin@example.com" } },
  }),
}));

const NOW = new Date("2025-01-01T00:00:00.000Z");

const EMPTY_DOC: Document = { type: "doc", content: [] };

const RAW_POST = {
  id: "post-1",
  title: "Hello",
  slug: "hello",
  previousSlugs: [] as string[],
  category: "ARTICLE",
  content: EMPTY_DOC,
  coverImageKey: null,
  publishedAt: null,
  untitledIndex: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const {
  createDraft,
  saveDraft,
  publishPost,
  deleteDraft,
  getDrafts,
  getPublishedProjects,
  isPostSlugAvailable,
} = await import("../post");

describe("post server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { user: { email: "admin@example.com" } },
    });
    mockCookiesGet.mockReturnValue({ value: "fake-jwt-token" });
    mockPrismaCreate.mockResolvedValue(RAW_POST);
    mockPrismaUpdate.mockResolvedValue({ ...RAW_POST, publishedAt: NOW });
    mockPrismaDelete.mockResolvedValue(RAW_POST);
    mockPrismaFindUnique.mockResolvedValue(RAW_POST);
    mockPrismaAggregate.mockResolvedValue({ _max: { untitledIndex: null } });
    mockPrismaFindMany.mockResolvedValue([RAW_POST]);
    mockPrismaFindFirst.mockResolvedValue(null);
  });

  describe("createDraft", () => {
    it("persists the provided category", async () => {
      await createDraft({
        title: "Project",
        document: EMPTY_DOC,
        category: "WORK",
      });
      expect(mockPrismaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ category: "WORK" }),
        }),
      );
    });

    it("calls prisma.post.create with the correct data", async () => {
      await createDraft({ title: "Hello", document: EMPTY_DOC });
      expect(mockPrismaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: "Hello", category: "ARTICLE" }),
        }),
      );
    });

    it("sets untitledIndex when no title is provided", async () => {
      mockPrismaAggregate.mockResolvedValue({ _max: { untitledIndex: 2 } });
      await createDraft({ document: EMPTY_DOC });
      expect(mockPrismaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ untitledIndex: 3 }),
        }),
      );
    });

    it("sets untitledIndex to 1 when no previous untitled drafts exist", async () => {
      mockPrismaAggregate.mockResolvedValue({ _max: { untitledIndex: null } });
      await createDraft({ document: EMPTY_DOC });
      expect(mockPrismaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ untitledIndex: 1 }),
        }),
      );
    });

    it("sets publishedAt to null", async () => {
      await createDraft({ title: "Hello", document: EMPTY_DOC });
      expect(mockPrismaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ publishedAt: null }),
        }),
      );
    });

    it("returns a parsed Post", async () => {
      const post = await createDraft({ title: "Hello", document: EMPTY_DOC });
      expect(post.id).toBe("post-1");
    });

    it("revalidates affected routes", async () => {
      await createDraft({ title: "Hello", document: EMPTY_DOC });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/writing/hello");
    });
  });

  describe("saveDraft", () => {
    it("calls prisma.post.update with the correct data", async () => {
      await saveDraft({ id: "post-1", title: "Updated", document: EMPTY_DOC });
      expect(mockPrismaUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "post-1" },
          data: expect.objectContaining({ title: "Updated" }),
        }),
      );
    });

    it("stores null title when title is empty", async () => {
      await saveDraft({ id: "post-1", title: "  ", document: EMPTY_DOC });
      expect(mockPrismaUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: null }),
        }),
      );
    });

    it("returns a parsed Post", async () => {
      mockPrismaUpdate.mockResolvedValue(RAW_POST);
      const post = await saveDraft({ id: "post-1", document: EMPTY_DOC });
      expect(post.id).toBe("post-1");
    });
  });

  describe("publishPost", () => {
    it("sets publishedAt to a Date", async () => {
      await publishPost("post-1");
      const call = mockPrismaUpdate.mock.calls[0][0] as {
        data: { publishedAt: unknown };
      };
      expect(call.data.publishedAt).toBeInstanceOf(Date);
    });

    it("updates the correct post", async () => {
      await publishPost("post-1");
      expect(mockPrismaUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "post-1" } }),
      );
    });
  });

  describe("deleteDraft", () => {
    it("calls prisma.post.delete with the correct id", async () => {
      await deleteDraft("post-1");
      expect(mockPrismaDelete).toHaveBeenCalledWith({ where: { id: "post-1" } });
    });
  });

  describe("getDrafts", () => {
    it("fetches only posts where publishedAt is null", async () => {
      await getDrafts();
      expect(mockPrismaFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { publishedAt: null },
        }),
      );
    });

    it("returns an array of parsed Posts", async () => {
      const posts = await getDrafts();
      expect(Array.isArray(posts)).toBe(true);
      expect(posts[0].id).toBe("post-1");
    });
  });

  describe("getPublishedProjects", () => {
    beforeEach(() => {
      mockPrismaFindMany.mockResolvedValue([{ slug: "hello", title: "Hello" }]);
    });

    it("asks for published work alone, newest first", async () => {
      await getPublishedProjects();
      expect(mockPrismaFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: "WORK", publishedAt: { not: null } },
          orderBy: { publishedAt: "desc" },
        }),
      );
    });

    it("fetches only what a row needs, never the document", async () => {
      await getPublishedProjects();
      const [args] = mockPrismaFindMany.mock.calls[0] as [{ select?: object }];
      expect(args.select).toEqual({ slug: true, title: true });
    });

    it("returns the links", async () => {
      expect(await getPublishedProjects()).toEqual([
        { slug: "hello", title: "Hello" },
      ]);
    });

    it("is open to a visitor — no session is asked for", async () => {
      mockGetSession.mockResolvedValue({ data: null });
      await expect(getPublishedProjects()).resolves.toHaveLength(1);
      expect(mockGetSession).not.toHaveBeenCalled();
    });
  });

  describe("createDraft — metadata", () => {
    it("takes the address the author typed over the one the title mints", async () => {
      await createDraft({
        title: "Hello",
        document: EMPTY_DOC,
        slug: "custom-address",
      });
      expect(mockPrismaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: "custom-address" }),
        }),
      );
    });

    it("stores a written description", async () => {
      await createDraft({
        title: "Hello",
        document: EMPTY_DOC,
        description: "  A line for search.  ",
      });
      expect(mockPrismaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: "A line for search." }),
        }),
      );
    });

    it("refuses an address the domain refuses", async () => {
      await expect(
        createDraft({ title: "Hello", document: EMPTY_DOC, slug: "Not OK" }),
      ).rejects.toThrow();
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });
  });

  describe("saveDraft — metadata", () => {
    const save = (metadata: Record<string, unknown>) =>
      saveDraft({ id: "post-1", title: "Hello", document: EMPTY_DOC, ...metadata });

    const written = () =>
      (mockPrismaUpdate.mock.calls[0] as [{ data: Record<string, unknown> }])[0]
        .data;

    it("files the post under another category", async () => {
      mockPrismaUpdate.mockResolvedValue({ ...RAW_POST, category: "WORK" });
      await save({ category: "WORK" });
      expect(written()).toMatchObject({ category: "WORK" });
    });

    it("moves the post to a new address and remembers the old one", async () => {
      mockPrismaFindUnique.mockResolvedValue({
        ...RAW_POST,
        previousSlugs: ["older"],
      });
      mockPrismaUpdate.mockResolvedValue({ ...RAW_POST, slug: "renamed" });
      await save({ slug: "renamed" });
      expect(written()).toMatchObject({
        slug: "renamed",
        previousSlugs: ["older", "hello"],
      });
    });

    it("drops an address from the old ones when the post takes it back", async () => {
      mockPrismaFindUnique.mockResolvedValue({
        ...RAW_POST,
        slug: "renamed",
        previousSlugs: ["hello"],
      });
      await save({ slug: "hello" });
      expect(written()).toMatchObject({
        slug: "hello",
        previousSlugs: ["renamed"],
      });
    });

    it("leaves the old addresses alone when the address is unchanged", async () => {
      await save({ slug: "hello", category: "ARTICLE" });
      expect(written()).not.toHaveProperty("previousSlugs");
    });

    it("writes a description, and clears an emptied one", async () => {
      await save({ description: "For search." });
      expect(written()).toMatchObject({ description: "For search." });

      mockPrismaUpdate.mockClear();
      await save({ description: "" });
      expect(written()).toMatchObject({ description: null });
    });

    it("leaves the description alone when none is sent", async () => {
      await save({});
      expect(written()).not.toHaveProperty("description");
    });

    it("refuses a bad address before touching the row", async () => {
      await expect(save({ slug: "Bad Address" })).rejects.toThrow();
      expect(mockPrismaUpdate).not.toHaveBeenCalled();
    });

    it("refuses to move or refile a page", async () => {
      mockPrismaFindUnique.mockResolvedValue({
        ...RAW_POST,
        slug: "about",
        category: "PAGE",
      });
      await expect(save({ slug: "about-me" })).rejects.toThrow(
        "A page's address is fixed.",
      );
      await expect(save({ category: "ARTICLE" })).rejects.toThrow(
        "A page's address is fixed.",
      );
      expect(mockPrismaUpdate).not.toHaveBeenCalled();
    });

    it("accepts a page's own address and category back unchanged", async () => {
      mockPrismaFindUnique.mockResolvedValue({
        ...RAW_POST,
        slug: "about",
        category: "PAGE",
      });
      mockPrismaUpdate.mockResolvedValue({
        ...RAW_POST,
        slug: "about",
        category: "PAGE",
      });
      await save({ slug: "about", category: "PAGE", description: "Me." });
      expect(written()).toMatchObject({ description: "Me." });
    });

    it("refuses to file a post as a page", async () => {
      await expect(save({ category: "PAGE" })).rejects.toThrow(
        "A post can't be filed as a page.",
      );
    });

    it("says so when another post already has the address", async () => {
      mockPrismaUpdate.mockRejectedValue(
        Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
      );
      await expect(save({ slug: "taken" })).rejects.toThrow(
        "Another post already uses that address.",
      );
    });

    it("refreshes the page at the address it left as well as the new one", async () => {
      mockPrismaUpdate.mockResolvedValue({
        ...RAW_POST,
        slug: "renamed",
        category: "WORK",
      });
      await save({ slug: "renamed", category: "WORK" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/writing/hello");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/work/renamed");
    });

    it("is the author's alone", async () => {
      mockGetSession.mockResolvedValue({ data: null });
      await expect(save({ slug: "renamed" })).rejects.toThrow();
      expect(mockPrismaUpdate).not.toHaveBeenCalled();
    });
  });

  describe("isPostSlugAvailable", () => {
    it("is true for an address nobody has", async () => {
      await expect(isPostSlugAvailable("free", "post-1")).resolves.toBe(true);
      expect(mockPrismaFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: "free", NOT: { id: "post-1" } },
        }),
      );
    });

    it("is false for an address another post has", async () => {
      mockPrismaFindFirst.mockResolvedValue({ id: "post-2" });
      await expect(isPostSlugAvailable("taken", "post-1")).resolves.toBe(false);
    });

    it("asks about every post when the draft has no row yet", async () => {
      await isPostSlugAvailable("free", null);
      expect(mockPrismaFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: "free" } }),
      );
    });

    it("is false, without asking, for an address the domain refuses", async () => {
      await expect(isPostSlugAvailable("new", null)).resolves.toBe(false);
      await expect(isPostSlugAvailable("Bad", null)).resolves.toBe(false);
      expect(mockPrismaFindFirst).not.toHaveBeenCalled();
    });

    it("is the author's alone", async () => {
      mockGetSession.mockResolvedValue({ data: null });
      await expect(isPostSlugAvailable("free", null)).rejects.toThrow();
      expect(mockPrismaFindFirst).not.toHaveBeenCalled();
    });
  });
});
