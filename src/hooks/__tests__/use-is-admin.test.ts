// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn().mockReturnValue({ data: null });
vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

const { useIsAdmin } = await import("../use-is-admin");

describe("useIsAdmin", () => {
  afterEach(() => mockUseSession.mockReturnValue({ data: null }));

  it("is false with no session", () => {
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
  });

  it("is true once a session with a user is in hand", () => {
    mockUseSession.mockReturnValue({ data: { user: { email: "a@b.c" } } });
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(true);
  });

  // The admin session lives in localStorage, invisible to the server, so the
  // server always renders the logged-out tree. Answering `true` on the first
  // client render would put admin-only nodes against server markup that has
  // none of them, which is React error #418 — hydration aborted.
  //
  // `renderHook` runs effects, so the assertion is on what the FIRST render
  // returned rather than on the settled value: the flip is meant to happen, one
  // commit later.
  it("answers false on the render that hydrates, whatever the session says", () => {
    mockUseSession.mockReturnValue({ data: { user: { email: "a@b.c" } } });
    const seen: boolean[] = [];
    renderHook(() => {
      const isAdmin = useIsAdmin();
      seen.push(isAdmin);
      return isAdmin;
    });
    expect(seen[0]).toBe(false);
    expect(seen[seen.length - 1]).toBe(true);
  });
});
