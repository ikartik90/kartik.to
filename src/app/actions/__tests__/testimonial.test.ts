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
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    testimonial: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: { ADMIN_GITHUB_ID: "admin@example.com" },
}));

const { submitTestimonial, getTestimonials, updateTestimonialDetails } =
  await import("../testimonial");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-01T00:00:00.000Z");

const submission = {
  name: "Ada Lovelace",
  quote: "Shipped the thing, on time, and it was beautiful.",
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    ...submission,
    createdAt: NOW,
    avatarUrl: null,
    linkedinUrl: null,
    excerpt: null,
    ...overrides,
  };
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

// ---------------------------------------------------------------------------
// updateTestimonialDetails
//
// The author's door onto the author's two fields. Everything worth testing here
// is a boundary: who may open it, what it will take, and — the one that matters
// most — what it refuses to touch on the way through.
// ---------------------------------------------------------------------------

describe("updateTestimonialDetails", () => {
  const details = {
    id: "t1",
    avatarUrl: "https://cdn.example.com/media/ada.jpg",
    linkedinUrl: "https://www.linkedin.com/in/ada",
  };

  it("writes a picture and a profile onto one row", async () => {
    signedInAsAdmin();
    mockUpdate.mockResolvedValue(row(details));

    await expect(updateTestimonialDetails(details)).resolves.toEqual(
      row(details),
    );
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: {
        avatarUrl: "https://cdn.example.com/media/ada.jpg",
        linkedinUrl: "https://www.linkedin.com/in/ada",
      },
    });
  });

  // The rail clears a field by emptying it, and an empty box has to reach the
  // column as NULL rather than as the empty string — otherwise "no profile"
  // becomes a profile whose URL happens to be nothing.
  it("clears both fields when they are emptied", async () => {
    signedInAsAdmin();
    mockUpdate.mockResolvedValue(row());

    await updateTestimonialDetails({ id: "t1", avatarUrl: "", linkedinUrl: "" });

    expect(mockUpdate.mock.calls[0][0].data).toEqual({
      avatarUrl: null,
      linkedinUrl: null,
    });
  });

  it("stores a profile in one spelling however it was typed", async () => {
    signedInAsAdmin();
    mockUpdate.mockResolvedValue(row());

    await updateTestimonialDetails({
      id: "t1",
      avatarUrl: null,
      linkedinUrl: "uk.linkedin.com/in/ada/?trk=nav",
    });

    expect(mockUpdate.mock.calls[0][0].data.linkedinUrl).toBe(
      "https://www.linkedin.com/in/ada",
    );
  });

  // THE IMPORTANT ONE, and the line moved once: the name became editable (it is
  // a label on an attribution, and people put job titles in it), the QUOTE did
  // not. A caller that posts a quote must not be able to edit what somebody else
  // wrote through a door that was opened for a picture.
  it("cannot reach the quote", async () => {
    signedInAsAdmin();
    mockUpdate.mockResolvedValue(row());

    await updateTestimonialDetails({
      ...details,
      quote: "Words I did not write.",
    });

    expect(Object.keys(mockUpdate.mock.calls[0][0].data).sort()).toEqual([
      "avatarUrl",
      "linkedinUrl",
    ]);
  });

  it.each([
    ["a URL that is not a profile", { linkedinUrl: "https://example.com/ada" }],
    ["a picture that is not a URL", { avatarUrl: "ada.jpg" }],
    ["no row to write to", { id: "" }],
  ])("refuses %s", async (_label, bad) => {
    signedInAsAdmin();

    await expect(
      updateTestimonialDetails({ ...details, ...bad }),
    ).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // Writing is open on the way IN because it has to be. Nothing about that
  // applies here: this edits a row that already exists, from a board only I can
  // reach, and the guard is checked before the input is even looked at.
  it.each([
    ["a visitor with no session", signedOut],
    ["somebody else's session", signedInAsSomeoneElse],
  ])("refuses %s", async (_label, arrange) => {
    arrange();

    await expect(updateTestimonialDetails(details)).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// The excerpt — the one field on this row whose validity depends on ANOTHER
// field, which is why the action reads the row before it writes it.
// ---------------------------------------------------------------------------

describe("updateTestimonialDetails (excerpt)", () => {
  const base = { id: "t1", avatarUrl: null, linkedinUrl: null };

  beforeEach(() => {
    signedInAsAdmin();
    mockFindUnique.mockResolvedValue(row());
    mockUpdate.mockImplementation(async ({ data }) => row(data));
  });

  it("stores a portion of what they wrote", async () => {
    await updateTestimonialDetails({ ...base, excerpt: "Shipped the thing" });

    expect(mockUpdate.mock.calls[0][0].data.excerpt).toBe("Shipped the thing");
  });

  // THE ONE THAT MATTERS. The excerpt is checked against the stored quote, not
  // against anything the caller sent alongside — otherwise "is this their
  // words" is answered by the same request that is trying to change them.
  it("refuses words they never wrote", async () => {
    await expect(
      updateTestimonialDetails({ ...base, excerpt: "Shipped it late, badly." }),
    ).rejects.toThrow(/their words/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuses a quote stitched out of two real fragments", async () => {
    await expect(
      updateTestimonialDetails({ ...base, excerpt: "Shipped the beautiful." }),
    ).rejects.toThrow(/their words/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // A caller cannot smuggle its own quote in to make the check pass.
  it("checks against the STORED quote, not a supplied one", async () => {
    await expect(
      updateTestimonialDetails({
        ...base,
        quote: "Anything I like.",
        excerpt: "Anything I like.",
      }),
    ).rejects.toThrow(/their words/i);
  });

  it("clears the excerpt back to the whole quote", async () => {
    await updateTestimonialDetails({ ...base, excerpt: "" });

    expect(mockUpdate.mock.calls[0][0].data.excerpt).toBeNull();
    // Cleared without consulting the quote — there is nothing to check.
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  // Editing only the picture must not silently wipe a chosen excerpt.
  it("leaves an existing excerpt alone when it is not named", async () => {
    await updateTestimonialDetails({
      id: "t1",
      avatarUrl: "https://cdn.example.com/media/ada.jpg",
      linkedinUrl: null,
    });

    expect("excerpt" in mockUpdate.mock.calls[0][0].data).toBe(false);
  });

  it("writes a corrected name", async () => {
    await updateTestimonialDetails({ ...base, name: "Lalit Arya" });

    expect(mockUpdate.mock.calls[0][0].data.name).toBe("Lalit Arya");
  });

  it("leaves the name alone when it is not named", async () => {
    await updateTestimonialDetails(base);

    expect("name" in mockUpdate.mock.calls[0][0].data).toBe(false);
  });

  it("refuses a blank name rather than clearing it", async () => {
    await expect(
      updateTestimonialDetails({ ...base, name: "  " }),
    ).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // The line that did not move: the name became editable, the words did not.
  it("still cannot touch the quote", async () => {
    await updateTestimonialDetails({
      ...base,
      name: "Lalit Arya",
      quote: "Words I did not write.",
    });

    expect("quote" in mockUpdate.mock.calls[0][0].data).toBe(false);
  });

  it("refuses when the row is gone", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      updateTestimonialDetails({ ...base, excerpt: "Shipped the thing" }),
    ).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
