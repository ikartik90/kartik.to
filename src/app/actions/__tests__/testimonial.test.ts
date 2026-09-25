import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

// Mocked at the session source, not `requireAdmin`, so the real admin check runs.
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

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const {
  submitTestimonial,
  getTestimonials,
  getPublishedTestimonials,
  updateTestimonialDetails,
} = await import("../testimonial");

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
    tagline: null,
    publishedAt: null,
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

describe("submitTestimonial", () => {
  it("accepts a submission from someone with no session", async () => {
    const result = await submitTestimonial(submission);

    expect(result).toEqual({ ok: true });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("writes the normalised submission rather than the raw input", async () => {
    await submitTestimonial({ name: "  Ada Lovelace  ", quote: "  Shipped it.  " });

    expect(mockCreate.mock.calls[0][0].data).toEqual({
      name: "Ada Lovelace",
      quote: "Shipped it.",
    });
  });

  it("creates a row rather than keying on anything", async () => {
    await submitTestimonial(submission);

    const args = mockCreate.mock.calls[0][0];
    expect(args.where).toBeUndefined();
    expect(args.update).toBeUndefined();
    expect(Object.keys(args.data)).toEqual(["name", "quote"]);
  });

  it("drops a retired field a stale caller still sends", async () => {
    await submitTestimonial({
      ...submission,
      linkedinUrl: "https://www.linkedin.com/in/ada",
    } as Parameters<typeof submitTestimonial>[0]);

    expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty("linkedinUrl");
  });

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

  it("silently discards a submission with the honeypot filled", async () => {
    const result = await submitTestimonial({ ...submission, website: "spam.example" });

    expect(result).toEqual({ ok: true });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("writes normally when the honeypot is present but empty", async () => {
    await submitTestimonial({ ...submission, website: "" });

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("reports a write that fails rather than throwing", async () => {
    mockCreate.mockRejectedValue(new Error("connection lost"));

    const result = await submitTestimonial(submission);

    expect(result.ok).toBe(false);
  });
});

describe("getTestimonials", () => {
  it("returns what has come in, newest first", async () => {
    signedInAsAdmin();
    mockFindMany.mockResolvedValue([row()]);

    await expect(getTestimonials()).resolves.toEqual([row()]);
    expect(mockFindMany.mock.calls[0][0]).toMatchObject({
      orderBy: { createdAt: "desc" },
    });
  });

  it.each([
    ["a visitor with no session", signedOut],
    ["somebody else's session", signedInAsSomeoneElse],
  ])("refuses %s", async (_label, arrange) => {
    arrange();

    await expect(getTestimonials()).rejects.toThrow();
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

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

  it.each([
    ["a visitor with no session", signedOut],
    ["somebody else's session", signedInAsSomeoneElse],
  ])("refuses %s", async (_label, arrange) => {
    arrange();

    await expect(updateTestimonialDetails(details)).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

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
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("leaves an existing excerpt alone when it is not named", async () => {
    await updateTestimonialDetails({
      id: "t1",
      avatarUrl: "https://cdn.example.com/media/ada.jpg",
      linkedinUrl: null,
    });

    expect("excerpt" in mockUpdate.mock.calls[0][0].data).toBe(false);
  });

  it("writes a tagline under the name", async () => {
    signedInAsAdmin();
    mockUpdate.mockResolvedValue(row());

    await updateTestimonialDetails({
      id: "t1",
      avatarUrl: null,
      linkedinUrl: null,
      tagline: "Senior Product Designer at Shyft",
    });

    expect(mockUpdate.mock.calls[0][0].data.tagline).toBe(
      "Senior Product Designer at Shyft",
    );
  });

  it("clears the tagline when the box is emptied", async () => {
    signedInAsAdmin();
    mockUpdate.mockResolvedValue(row());

    await updateTestimonialDetails({
      id: "t1",
      avatarUrl: null,
      linkedinUrl: null,
      tagline: "",
    });

    expect(mockUpdate.mock.calls[0][0].data.tagline).toBeNull();
  });

  it("leaves a stored tagline alone when it is not named", async () => {
    signedInAsAdmin();
    mockUpdate.mockResolvedValue(row());

    await updateTestimonialDetails({ id: "t1", avatarUrl: null, linkedinUrl: null });

    expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty("tagline");
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

describe("getPublishedTestimonials", () => {
  it("serves a stranger — the homepage has no session to offer", async () => {
    signedOut();
    mockFindMany.mockResolvedValue([]);

    await expect(getPublishedTestimonials()).resolves.toEqual([]);
  });

  it("asks the database for published rows only", async () => {
    signedOut();
    mockFindMany.mockResolvedValue([]);

    await getPublishedTestimonials();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publishedAt: { not: null } },
      }),
    );
  });

  it("reads newest first, the order the board shows", async () => {
    signedOut();
    mockFindMany.mockResolvedValue([]);

    await getPublishedTestimonials();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });

  it("hands back what the database gave it", async () => {
    signedOut();
    const published = [row({ id: "t1", publishedAt: NOW })];
    mockFindMany.mockResolvedValue(published);

    await expect(getPublishedTestimonials()).resolves.toEqual(published);
  });
});

describe("updateTestimonialDetails (published)", () => {
  const details = { id: "t1", avatarUrl: null, linkedinUrl: null };

  it("is the author's alone", async () => {
    signedOut();

    await expect(
      updateTestimonialDetails({ ...details, published: true }),
    ).rejects.toThrow("Unauthorized");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("stamps the moment when the switch goes on", async () => {
    signedInAsAdmin();
    mockUpdate.mockResolvedValue(row());

    await updateTestimonialDetails({ ...details, published: true });

    const { data } = mockUpdate.mock.calls[0][0];
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it("clears the column when the switch goes off", async () => {
    signedInAsAdmin();
    mockUpdate.mockResolvedValue(row());

    await updateTestimonialDetails({ ...details, published: false });

    expect(mockUpdate.mock.calls[0][0].data.publishedAt).toBeNull();
  });

  it("leaves publication alone when it was not asked about", async () => {
    signedInAsAdmin();
    mockUpdate.mockResolvedValue(row());

    await updateTestimonialDetails({
      ...details,
      avatarUrl: "https://example.com/ada.png",
    });

    expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty("publishedAt");
  });

  it("refuses a publication date chosen by the caller", async () => {
    signedInAsAdmin();
    mockUpdate.mockResolvedValue(row());

    await updateTestimonialDetails({
      ...details,
      publishedAt: new Date("1999-01-01T00:00:00.000Z"),
    });

    expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty("publishedAt");
  });
});

describe("updateTestimonialDetails (revalidation)", () => {
  const stored = row({ id: "t1" });

  beforeEach(() => {
    signedInAsAdmin();
    mockUpdate.mockResolvedValue(stored);
  });

  it("rebuilds the homepage when a row is published", async () => {
    await updateTestimonialDetails({
      id: "t1",
      avatarUrl: null,
      linkedinUrl: null,
      published: true,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("rebuilds the homepage when a row is taken down", async () => {
    await updateTestimonialDetails({
      id: "t1",
      avatarUrl: null,
      linkedinUrl: null,
      published: false,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("rebuilds the homepage when any other field is edited", async () => {
    await updateTestimonialDetails({
      id: "t1",
      avatarUrl: "https://cdn.test/ada.jpg",
      linkedinUrl: null,
      tagline: "Countess",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("rebuilds the board it was edited from", async () => {
    await updateTestimonialDetails({
      id: "t1",
      avatarUrl: null,
      linkedinUrl: null,
      published: true,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/edit/testimonials");
  });

  it("rebuilds nothing when the write was refused", async () => {
    signedOut();
    await expect(
      updateTestimonialDetails({
        id: "t1",
        avatarUrl: null,
        linkedinUrl: null,
        published: true,
      }),
    ).rejects.toThrow();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
