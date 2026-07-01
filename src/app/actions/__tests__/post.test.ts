import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Document } from "@/domain/post";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before dynamic imports of the module
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  auth: { getSession: () => mockGetSession() },
}));

const mockPrismaCreate = vi.fn();
const mockPrismaUpdate = vi.fn();
const mockPrismaDelete = vi.fn();
const mockPrismaAggregate = vi.fn();
const mockPrismaFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      create: (...args: unknown[]) => mockPrismaCreate(...args),
      update: (...args: unknown[]) => mockPrismaUpdate(...args),
      delete: (...args: unknown[]) => mockPrismaDelete(...args),
      aggregate: (...args: unknown[]) => mockPrismaAggregate(...args),
      findMany: (...args: unknown[]) => mockPrismaFindMany(...args),
    },
  },
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

// Stub jwtVerify to skip real crypto
vi.mock("jose", () => ({
  jwtVerify: vi.fn().mockResolvedValue({
    payload: { user: { email: "admin@example.com" } },
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2025-01-01T00:00:00.000Z");

const EMPTY_DOC: Document = { type: "doc", content: [] };

const RAW_POST = {
  id: "post-1",
  title: "Hello",
  slug: "hello",
  category: "ARTICLE",
  content: EMPTY_DOC,
  coverImageKey: null,
  publishedAt: null,
  untitledIndex: null,
  createdAt: NOW,
  updatedAt: NOW,
};

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------

const { createDraft, saveDraft, publishPost, deleteDraft, getDrafts } =
  await import("../post");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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
    mockPrismaAggregate.mockResolvedValue({ _max: { untitledIndex: null } });
    mockPrismaFindMany.mockResolvedValue([RAW_POST]);
  });

  // -------------------------------------------------------------------------
  // createDraft
  // -------------------------------------------------------------------------

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
  });

  // -------------------------------------------------------------------------
  // saveDraft
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // publishPost
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // deleteDraft
  // -------------------------------------------------------------------------

  describe("deleteDraft", () => {
    it("calls prisma.post.delete with the correct id", async () => {
      await deleteDraft("post-1");
      expect(mockPrismaDelete).toHaveBeenCalledWith({ where: { id: "post-1" } });
    });
  });

  // -------------------------------------------------------------------------
  // getDrafts
  // -------------------------------------------------------------------------

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
});
