import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// The admin list. A server component, so it is called as the async function it
// is and the element it returns is rendered — which is enough to catch the
// thing a page like this actually gets wrong: a field that does not render, a
// date that throws, a guard that lets the wrong person through.
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));
const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const mockGetTestimonials = vi.fn();

vi.mock("next/navigation", () => ({ notFound: () => mockNotFound() }));
// The guard now lives in `@/lib/auth/server` and is shared by every admin page.
// Stubbed at its SESSION source rather than by replacing the module, so the
// 404 cases below still run the real comparison — a mock of `isAdmin` would
// make each of them assert its own stub.
vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: () => ({ getSession: () => mockGetSession() }),
}));
// Still stubbed: `@/lib/auth/server` reads the admin id from here, and that
// module validates the whole environment on import and throws without a
// DATABASE_URL.
vi.mock("@/lib/env", () => ({
  env: { ADMIN_GITHUB_ID: "admin@example.com" },
}));
vi.mock("@/app/actions/testimonial", () => ({
  getTestimonials: () => mockGetTestimonials(),
}));

const { default: TestimonialsPage } = await import("../page");

function signedInAsAdmin() {
  mockGetSession.mockResolvedValue({
    data: { user: { email: "admin@example.com" } },
  });
}

const row = {
  id: "t1",
  name: "Ada Lovelace",
  quote: "Turned a vague brief into something we could actually ship.",
  createdAt: new Date("2026-03-09T10:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTestimonials.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe("TestimonialsPage", () => {
  it("draws each testimonial with its name and date", async () => {
    signedInAsAdmin();
    mockGetTestimonials.mockResolvedValue([row]);

    render(await TestimonialsPage());

    expect(screen.getByText(row.quote)).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("9 Mar 2026")).toBeTruthy();
    // The profile link went with the LinkedIn column.
    expect(screen.queryByRole("link")).toBeNull();
  });

  // Without a unique key, one person sending twice is two rows. The list has to
  // draw both rather than collapsing or keying on the name.
  it("lists two entries from the same name separately", async () => {
    signedInAsAdmin();
    mockGetTestimonials.mockResolvedValue([
      row,
      { ...row, id: "t2", quote: "A second thing entirely." },
    ]);

    render(await TestimonialsPage());

    expect(screen.getAllByText("Ada Lovelace")).toHaveLength(2);
    expect(screen.getByText("A second thing entirely.")).toBeTruthy();
  });

  // An empty table is the NORMAL state on day one, and a page that says nothing
  // in that state reads as broken. It says where the form is instead.
  it("says where the form is when nothing has come in", async () => {
    signedInAsAdmin();

    render(await TestimonialsPage());

    expect(screen.getByText(/nothing yet/i).textContent).toContain("/vouch");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("counts what has come in", async () => {
    signedInAsAdmin();
    mockGetTestimonials.mockResolvedValue([row, { ...row, id: "t2" }]);

    render(await TestimonialsPage());

    expect(screen.getByText("2 in, newest first.")).toBeTruthy();
  });

  // 404, never 401 — the route must not admit to existing. Asserted for a
  // visitor AND for somebody else's session, and in both cases the list is
  // never even asked for.
  it.each([
    ["a visitor with no session", { data: null }],
    ["somebody else's session", { data: { user: { email: "x@example.com" } } }],
  ])("404s for %s", async (_label, session) => {
    mockGetSession.mockResolvedValue(session);

    await expect(TestimonialsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
    expect(mockGetTestimonials).not.toHaveBeenCalled();
  });
});
