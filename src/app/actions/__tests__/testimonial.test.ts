import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — declared before the dynamic import of the module under test.
//
// WHO IS ASKING is the subject of this file, and the answer differs by action
// in a way no other action module here does: `submitTestimonial` serves people
// with no session at all — that is the entire point of the form — while
// `getTestimonials` serves the author alone. So every test says who is asking
// before it says what it expects back, and the ones that say "nobody" are the
// important ones.
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

// The guard now lives in `@/lib/auth/server` and is shared by every action
// module. Stubbed at its SESSION source rather than by replacing the module, so
// these tests still run the real comparison — a mock of `requireAdmin` would
// make every "Unauthorized" case below assert its own stub.
vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: () => ({ getSession: () => mockGetSession() }),
}));

const mockCreate = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    testimonial: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: { ADMIN_GITHUB_ID: "admin@example.com" },
}));

const { submitTestimonial, getTestimonials } = await import("../testimonial");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-01T00:00:00.000Z");

const submission = {
  name: "Ada Lovelace",
  quote: "Shipped the thing, on time, and it was beautiful.",
};

function row(overrides: Record<string, unknown> = {}) {
  return { id: "t1", ...submission, createdAt: NOW, ...overrides };
}

function signedOut() {
  mockGetSession.mockResolvedValue({ data: null });
}

function signedInAsAdmin() {
  mockGetSession.mockResolvedValue({
    data: { user: { email: "admin@example.com" } },
  });
}

function signedInAsSomeoneElse() {
  mockGetSession.mockResolvedValue({
    data: { user: { email: "someone@example.com" } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  signedOut();
  mockCreate.mockResolvedValue(row());
  mockFindMany.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// submitTestimonial
// ---------------------------------------------------------------------------

describe("submitTestimonial", () => {
  // The whole reason this action exists. Every other write in this app refuses
  // a caller without the author's session; this one must not, or the form is a
  // page only I can fill in.
  it("accepts a submission from someone with no session", async () => {
    const result = await submitTestimonial(submission);

    expect(result).toEqual({ ok: true });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  // The row is built from the PARSED value, not from the caller's object — so
  // a caller that posted padded text still stores it trimmed.
  it("writes the normalised submission rather than the raw input", async () => {
    await submitTestimonial({ name: "  Ada Lovelace  ", quote: "  Shipped it.  " });

    expect(mockCreate.mock.calls[0][0].data).toEqual({
      name: "Ada Lovelace",
      quote: "Shipped it.",
    });
  });

  // The LinkedIn URL is gone, and with it the unique key that made a repeat
  // send a correction. Nothing replaces it — `name` as a key would let anybody
  // overwrite somebody else's words — so a plain CREATE is the honest write and
  // two sends are two rows for me to sort out by hand.
  it("creates a row rather than keying on anything", async () => {
    await submitTestimonial(submission);

    const args = mockCreate.mock.calls[0][0];
    expect(args.where).toBeUndefined();
    expect(args.update).toBeUndefined();
    expect(Object.keys(args.data)).toEqual(["name", "quote"]);
  });

  // A caller that still posts the retired field must not be able to widen the
  // write with it — the schema strips unknown keys, and this is what proves the
  // stripped value never reaches Prisma.
  it("drops a retired field a stale caller still sends", async () => {
    await submitTestimonial({
      ...submission,
      linkedinUrl: "https://www.linkedin.com/in/ada",
    } as Parameters<typeof submitTestimonial>[0]);

    expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty("linkedinUrl");
  });

  // Errors come back keyed BY FIELD, because the form shows them under the box
  // they belong to. One flat message would make the caller guess.
  it.each([
    ["name", { name: "   " }],
    ["quote", { quote: "" }],
    ["quote", { quote: "x".repeat(281) }],
  ])("refuses a bad %s without writing", async (field, patch) => {
    const result = await submitTestimonial({ ...submission, ...patch });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a refusal");
    expect(result.errors[field as "name" | "quote"]).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // The honeypot is a field no human sees and every form-filling bot completes.
  // A filled one is DISCARDED but reported as success on purpose: telling a bot
  // it failed is telling it to try again with the field left blank.
  it("silently discards a submission with the honeypot filled", async () => {
    const result = await submitTestimonial({ ...submission, website: "spam.example" });

    expect(result).toEqual({ ok: true });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("writes normally when the honeypot is present but empty", async () => {
    await submitTestimonial({ ...submission, website: "" });

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  // A crash here would show a stranger a Next.js error page on a form I asked
  // them to fill in as a favour.
  it("reports a write that fails rather than throwing", async () => {
    mockCreate.mockRejectedValue(new Error("connection lost"));

    const result = await submitTestimonial(submission);

    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getTestimonials
// ---------------------------------------------------------------------------

describe("getTestimonials", () => {
  it("returns what has come in, newest first", async () => {
    signedInAsAdmin();
    mockFindMany.mockResolvedValue([row()]);

    await expect(getTestimonials()).resolves.toEqual([row()]);
    expect(mockFindMany.mock.calls[0][0]).toMatchObject({
      orderBy: { createdAt: "desc" },
    });
  });

  // Reading is the author's alone. Writing is open because it has to be; that
  // is not a reason for the collected words to be.
  it.each([
    ["a visitor with no session", signedOut],
    ["somebody else's session", signedInAsSomeoneElse],
  ])("refuses %s", async (_label, arrange) => {
    arrange();

    await expect(getTestimonials()).rejects.toThrow();
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
