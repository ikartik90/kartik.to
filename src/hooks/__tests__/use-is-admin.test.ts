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

  // renderHook runs effects, so assert on the first render, not the settled value.
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
