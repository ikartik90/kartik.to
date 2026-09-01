import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — declared before the dynamic import of the module under test.
//
// The subject here is the handshake, not the session: nobody is signed in yet,
// which is the whole reason this action exists. So the only thing worth
// standing in for is Neon Auth's answer to "where do I send this browser".
// ---------------------------------------------------------------------------

const { mockSignInSocial } = vi.hoisted(() => ({ mockSignInSocial: vi.fn() }));

vi.mock("@/lib/auth/server", () => ({
  auth: {
    signIn: {
      social: (...args: unknown[]) => mockSignInSocial(...args),
    },
  },
}));

const { startAdminLogin } = await import("../auth");

const OAUTH_URL = "https://github.com/login/oauth/authorize?client_id=abc";

describe("startAdminLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInSocial.mockResolvedValue({
      data: { url: OAUTH_URL, redirect: true },
      error: null,
    });
  });

  it("hands back the GitHub authorize URL for the browser to follow", async () => {
    await expect(startAdminLogin()).resolves.toBe(OAUTH_URL);
  });

  it("asks GitHub for the handshake, and comes back to the site's front door", async () => {
    await startAdminLogin();

    expect(mockSignInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "github", callbackURL: "/" }),
    );
  });

  it("declines the redirect, because the caller is the one doing the sending", async () => {
    await startAdminLogin();

    expect(mockSignInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ disableRedirect: true }),
    );
  });

  it("throws when the handshake itself fails", async () => {
    mockSignInSocial.mockResolvedValue({
      data: null,
      error: { message: "provider unavailable" },
    });

    await expect(startAdminLogin()).rejects.toThrow("provider unavailable");
  });

  it("throws when the answer carries no URL, rather than returning an empty one", async () => {
    mockSignInSocial.mockResolvedValue({
      data: { redirect: false },
      error: null,
    });

    await expect(startAdminLogin()).rejects.toThrow();
  });
});
