import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// The admin board's PAGE, which is the guard, the read, and the line of prose
// over the top of it. A server component, so it is called as the async function
// it is and the element it returns is rendered — which is enough to catch the
// thing a page like this actually gets wrong: a guard that lets the wrong
// person through, or an empty table drawn as a broken one.
//
// What the cards and the rail DO with the rows belongs to
// `testimonial-board.test.tsx` and `testimonial-card.test.tsx`. The overlap
// here is deliberate and small: these cases assert that the rows reached the
// board at all, not how it draws them.
// ---------------------------------------------------------------------------

const { mockIsAdmin } = vi.hoisted(() => ({ mockIsAdmin: vi.fn() }));
const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const mockGetTestimonials = vi.fn();

vi.mock("next/navigation", () => ({ notFound: () => mockNotFound() }));
// The SHARED guard, mocked where it lives. The page used to hand-roll its own
// copy of this against `auth.getSession()` and `env.ADMIN_GITHUB_ID`; it now
// asks `@/lib/auth/server`, which is the one server-side answer to "is this the
// author" and the thing worth stubbing.
vi.mock("@/lib/auth/server", () => ({
  isAdmin: () => mockIsAdmin(),
}));
// Still stubbed even though the guard no longer reads it: the board below this
// page imports the action module, which reaches `@/lib/env` — and that module
// validates the whole environment on import and throws without a DATABASE_URL.
vi.mock("@/lib/env", () => ({
  env: { ADMIN_GITHUB_ID: "admin@example.com" },
}));
vi.mock("@/app/actions/testimonial", () => ({
  getTestimonials: () => mockGetTestimonials(),
}));

const { default: TestimonialsPage } = await import("../page");

function signedInAsAdmin() {
  mockIsAdmin.mockResolvedValue(true);
}

const row = {
  id: "t1",
  name: "Ada Lovelace",
  quote: "Turned a vague brief into something we could actually ship.",
  createdAt: new Date("2026-03-09T10:00:00.000Z"),
  // The author's half, empty — which is how every row arrives.
  avatarUrl: null,
  linkedinUrl: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTestimonials.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe("TestimonialsPage", () => {
  it("draws each testimonial with its name", async () => {
    signedInAsAdmin();
    mockGetTestimonials.mockResolvedValue([row]);

    render(await TestimonialsPage());

    expect(screen.getByText(row.quote)).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    // Nothing is open until a card is pressed.
    expect(screen.queryByRole("dialog")).toBeNull();
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

  it("counts what has come in, and says what to do with it", async () => {
    signedInAsAdmin();
    mockGetTestimonials.mockResolvedValue([row, { ...row, id: "t2" }]);

    render(await TestimonialsPage());

    expect(
      screen.getByText(/2 in, newest first\. Select one to add/i),
    ).toBeTruthy();
  });

  // 404, never 401 — the route must not admit to existing. The two cases that
  // used to be asserted here (no session, somebody else's session) are the
  // shared guard's to tell apart, and are tested where it lives; what this page
  // owes is that a `false` becomes a 404 and that the table is never read.
  it("404s for anybody who is not the author", async () => {
    mockIsAdmin.mockResolvedValue(false);

    await expect(TestimonialsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
    expect(mockGetTestimonials).not.toHaveBeenCalled();
  });
});
