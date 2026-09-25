import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocked at the session source, not `@/lib/auth/server`: the comparison is what is under test.
const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: () => ({ getSession: () => mockGetSession() }),
}));

vi.mock("@/lib/env", () => ({
  env: { ADMIN_GITHUB_ID: "admin@example.com" },
}));

const { isAdmin, requireAdmin } = await import("../server");

beforeEach(() => vi.clearAllMocks());

describe("isAdmin", () => {
  it("is true for the author's session", async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { email: "admin@example.com" } },
    });

    await expect(isAdmin()).resolves.toBe(true);
  });

  it("is false when nobody is signed in", async () => {
    mockGetSession.mockResolvedValue({ data: null });

    await expect(isAdmin()).resolves.toBe(false);
  });

  it("is false for somebody else's session", async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { email: "someone@example.com" } },
    });

    await expect(isAdmin()).resolves.toBe(false);
  });

  it("is false for a session carrying no email", async () => {
    mockGetSession.mockResolvedValue({ data: { user: {} } });

    await expect(isAdmin()).resolves.toBe(false);
  });
});

describe("requireAdmin", () => {
  it("resolves for the author", async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { email: "admin@example.com" } },
    });

    await expect(requireAdmin()).resolves.toBeUndefined();
  });

  it("throws Unauthorized for anybody else", async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { email: "someone@example.com" } },
    });

    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
  });

  it("throws Unauthorized when nobody is signed in", async () => {
    mockGetSession.mockResolvedValue({ data: null });

    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
  });
});
