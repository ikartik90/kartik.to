import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockIsAdmin } = vi.hoisted(() => ({ mockIsAdmin: vi.fn() }));
const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const mockGetTestimonials = vi.fn();

vi.mock("next/navigation", () => ({ notFound: () => mockNotFound() }));
vi.mock("@/lib/auth/server", () => ({
  isAdmin: () => mockIsAdmin(),
}));
// The board imports the action module, which reaches `@/lib/env`: that throws on import without DATABASE_URL.
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
    expect(screen.queryByRole("dialog")).toBeNull();
  });

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

  it("404s for anybody who is not the author", async () => {
    mockIsAdmin.mockResolvedValue(false);

    await expect(TestimonialsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
    expect(mockGetTestimonials).not.toHaveBeenCalled();
  });
});
