import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// The one server-side answer to "is the caller the author", and the throw built
// on top of it.
//
// This file exists because the predicate used to be re-typed at every call
// site — four different spellings of the same comparison, two of which guarded
// an empty admin id and two of which quietly relied on `src/lib/env.ts`
// validating it. Now there is one spelling, so this is the only place the
// distinction between "nobody is signed in" and "somebody else is signed in"
// has to be told apart; every page and action above it only ever sees the
// answer.
//
// Mocked at the SESSION source rather than at `@/lib/auth/server` itself: the
// thing under test is the comparison, so stubbing the module that holds it
// would leave nothing to assert.
// ---------------------------------------------------------------------------

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

  // The other half of the same question, and the one a bare `!==` gets right
  // only by accident: somebody who signed in with GitHub perfectly well and is
  // still not the author.
  it("is false for somebody else's session", async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { email: "someone@example.com" } },
    });

    await expect(isAdmin()).resolves.toBe(false);
  });

  // `env.ADMIN_GITHUB_ID` is `z.email()`, so it cannot be empty — but a session
  // with no email must not match one that has been loosened to allow it. This
  // is the case the four hand-rolled copies disagreed about.
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
