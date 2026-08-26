import { describe, it, expect, vi, beforeEach } from "vitest";
import { SHADER_SPECS, defaultState } from "@/data/shader-specs";
import { DEFAULT_COVER_ASPECT } from "@/domain/cover";

// ---------------------------------------------------------------------------
// Module mocks — declared before the dynamic import of the module under test.
//
// The session is the whole subject here: a cover's library is now readable by
// anyone and writable by the author alone, so every test below says who is
// asking before it says what it expects back.
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock("@/lib/auth/server", () => ({
  auth: { getSession: () => mockGetSession() },
}));

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockAggregate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cover: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      aggregate: (...args: unknown[]) => mockAggregate(...args),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: { ADMIN_GITHUB_ID: "admin@example.com" },
}));

const {
  getCovers,
  getCover,
  createCover,
  publishCover,
  unpublishCover,
} = await import("../cover");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-01T00:00:00.000Z");

const SETTINGS = {
  ...defaultState(SHADER_SPECS.cosmicTrack),
  aspect: DEFAULT_COVER_ASPECT,
  framing: {},
};

const row = (id: string, publishedAt: Date | null) => ({
  id,
  title: "Dusk",
  untitledIndex: null,
  shaderId: "cosmicTrack",
  settings: SETTINGS,
  publishedAt,
  createdAt: NOW,
  updatedAt: NOW,
});

/** Who is asking. */
const signedIn = () =>
  mockGetSession.mockResolvedValue({
    data: { user: { email: "admin@example.com" } },
  });
const signedOut = () => mockGetSession.mockResolvedValue({ data: null });

describe("cover actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedOut();
    mockFindMany.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue(null);
  });

  // --- Reading the library --------------------------------------------------

  // The playground is public and so is the strip along its foot — but a
  // visitor is shown the covers that have been PUBLISHED and no others, so a
  // half-tuned draft is not on display the moment it is saved.
  describe("getCovers", () => {
    it("shows a visitor only the published covers", async () => {
      mockFindMany.mockResolvedValue([row("a", NOW)]);

      const covers = await getCovers();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publishedAt: { not: null } } }),
      );
      expect(covers.map((cover) => cover.id)).toEqual(["a"]);
    });

    it("shows the author everything, published or not", async () => {
      signedIn();
      mockFindMany.mockResolvedValue([row("a", null), row("b", NOW)]);

      const covers = await getCovers();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(covers.map((cover) => cover.id)).toEqual(["a", "b"]);
    });

    // Newest first, and by creation rather than by last edit — see the action.
    it("asks for them newest first", async () => {
      await getCovers();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } }),
      );
    });

    it("hands the publication date over with each cover", async () => {
      mockFindMany.mockResolvedValue([row("a", NOW)]);

      expect((await getCovers())[0].publishedAt).toEqual(NOW);
    });
  });

  // --- Reading one ----------------------------------------------------------
  //
  // A visitor who reaches a cover's own route must not be able to tell an
  // unpublished cover from one that does not exist: both answer null, which the
  // route turns into the same 404.
  describe("getCover", () => {
    it("gives a visitor a published cover", async () => {
      mockFindUnique.mockResolvedValue(row("a", NOW));

      expect((await getCover("a"))?.id).toBe("a");
    });

    it("answers a visitor asking after an unpublished cover with nothing", async () => {
      mockFindUnique.mockResolvedValue(row("a", null));

      expect(await getCover("a")).toBeNull();
    });

    it("gives the author an unpublished cover", async () => {
      signedIn();
      mockFindUnique.mockResolvedValue(row("a", null));

      expect((await getCover("a"))?.id).toBe("a");
    });

    it("answers nothing for a cover that does not exist", async () => {
      signedIn();

      expect(await getCover("nope")).toBeNull();
    });
  });

  // --- Writing --------------------------------------------------------------

  describe("createCover", () => {
    it("refuses a visitor", async () => {
      mockAggregate.mockResolvedValue({ _max: { untitledIndex: 0 } });

      await expect(
        createCover({ shaderId: "cosmicTrack", settings: SETTINGS }),
      ).rejects.toThrow("Unauthorized");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    // A cover is saved long before it is worth showing anybody, so it arrives
    // unpublished and publishing is a separate, deliberate press.
    it("saves a new cover unpublished", async () => {
      signedIn();
      mockAggregate.mockResolvedValue({ _max: { untitledIndex: 0 } });
      mockCreate.mockResolvedValue(row("a", null));

      const cover = await createCover({
        shaderId: "cosmicTrack",
        settings: SETTINGS,
      });

      expect(mockCreate.mock.calls[0][0].data.publishedAt).toBeUndefined();
      expect(cover.publishedAt).toBeNull();
    });
  });

  describe("publishCover", () => {
    it("refuses a visitor", async () => {
      await expect(publishCover("a")).rejects.toThrow("Unauthorized");
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("stamps the cover with the moment it went out", async () => {
      signedIn();
      mockUpdate.mockResolvedValue(row("a", NOW));

      const cover = await publishCover("a");

      const call = mockUpdate.mock.calls[0][0] as {
        where: { id: string };
        data: { publishedAt: unknown };
      };
      expect(call.where).toEqual({ id: "a" });
      expect(call.data.publishedAt).toBeInstanceOf(Date);
      expect(cover.publishedAt).toEqual(NOW);
    });
  });

  describe("unpublishCover", () => {
    it("refuses a visitor", async () => {
      await expect(unpublishCover("a")).rejects.toThrow("Unauthorized");
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    // Clearing the date rather than deleting the row: the cover is still the
    // author's to open, tune and put back out.
    it("clears the date, leaving the cover where it is", async () => {
      signedIn();
      mockUpdate.mockResolvedValue(row("a", null));

      const cover = await unpublishCover("a");

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "a" },
        data: { publishedAt: null },
      });
      expect(cover.publishedAt).toBeNull();
    });
  });
});
