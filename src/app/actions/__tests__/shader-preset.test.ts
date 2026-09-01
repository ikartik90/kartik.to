import { describe, it, expect, vi, beforeEach } from "vitest";
import { SHADER_SPECS, defaultState } from "@/data/shader-specs";

// ---------------------------------------------------------------------------
// Module mocks — declared before the dynamic import of the module under test.
//
// The session is the whole subject here: a preset's library is now readable by
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
    shaderPreset: {
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
  getShaderPresets,
  getPublishedShaderPresets,
  getShaderPreset,
  createShaderPreset,
  publishShaderPreset,
  unpublishShaderPreset,
} = await import("../shader-preset");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-01T00:00:00.000Z");

const SETTINGS = {
  ...defaultState(SHADER_SPECS.cosmicTrack),
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

describe("preset actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedOut();
    mockFindMany.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue(null);
  });

  // --- Reading the library --------------------------------------------------

  // The playground is public and so is the strip along its foot — but a
  // visitor is shown the presets that have been PUBLISHED and no others, so a
  // half-tuned draft is not on display the moment it is saved.
  describe("getShaderPresets", () => {
    it("shows a visitor only the published presets", async () => {
      mockFindMany.mockResolvedValue([row("a", NOW)]);

      const presets = await getShaderPresets();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publishedAt: { not: null } } }),
      );
      expect(presets.map((preset) => preset.id)).toEqual(["a"]);
    });

    it("shows the author everything, published or not", async () => {
      signedIn();
      mockFindMany.mockResolvedValue([row("a", null), row("b", NOW)]);

      const presets = await getShaderPresets();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(presets.map((preset) => preset.id)).toEqual(["a", "b"]);
    });

    // Newest first, and by creation rather than by last edit — see the action.
    it("asks for them newest first", async () => {
      await getShaderPresets();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } }),
      );
    });

    it("hands the publication date over with each preset", async () => {
      mockFindMany.mockResolvedValue([row("a", NOW)]);

      expect((await getShaderPresets())[0].publishedAt).toEqual(NOW);
    });
  });

  // The other read, and the difference between them is WHO is asking.
  //
  // `getShaderPresets` answers the author with everything, which is right for
  // the strip along the playground's foot: that is the author's workbench, and
  // a draft is exactly what you go there to pick up. It is wrong for anything
  // that DISPLAYS presets — the author's own homepage would put a half-tuned
  // idea on the front page and show it to nobody else, so the page the author
  // sees would not be the page that shipped.
  describe("getPublishedShaderPresets", () => {
    it("shows a visitor only the published presets", async () => {
      mockFindMany.mockResolvedValue([row("a", NOW)]);

      const presets = await getPublishedShaderPresets();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publishedAt: { not: null } } }),
      );
      expect(presets.map((preset) => preset.id)).toEqual(["a"]);
    });

    // The one that matters: signed in as the author changes nothing.
    it("shows the author only the published presets too", async () => {
      signedIn();
      mockFindMany.mockResolvedValue([row("b", NOW)]);

      const presets = await getPublishedShaderPresets();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publishedAt: { not: null } } }),
      );
      expect(presets.map((preset) => preset.id)).toEqual(["b"]);
    });

    it("asks for them newest first, as the other read does", async () => {
      await getPublishedShaderPresets();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } }),
      );
    });
  });

  // --- Reading one ----------------------------------------------------------
  //
  // A visitor who reaches a preset's own route must not be able to tell an
  // unpublished preset from one that does not exist: both answer null, which the
  // route turns into the same 404.
  describe("getShaderPreset", () => {
    it("gives a visitor a published preset", async () => {
      mockFindUnique.mockResolvedValue(row("a", NOW));

      expect((await getShaderPreset("a"))?.id).toBe("a");
    });

    it("answers a visitor asking after an unpublished preset with nothing", async () => {
      mockFindUnique.mockResolvedValue(row("a", null));

      expect(await getShaderPreset("a")).toBeNull();
    });

    it("gives the author an unpublished preset", async () => {
      signedIn();
      mockFindUnique.mockResolvedValue(row("a", null));

      expect((await getShaderPreset("a"))?.id).toBe("a");
    });

    it("answers nothing for a preset that does not exist", async () => {
      signedIn();

      expect(await getShaderPreset("nope")).toBeNull();
    });
  });

  // --- Writing --------------------------------------------------------------

  describe("createShaderPreset", () => {
    it("refuses a visitor", async () => {
      mockAggregate.mockResolvedValue({ _max: { untitledIndex: 0 } });

      await expect(
        createShaderPreset({ shaderId: "cosmicTrack", settings: SETTINGS }),
      ).rejects.toThrow("Unauthorized");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    // A preset is saved long before it is worth showing anybody, so it arrives
    // unpublished and publishing is a separate, deliberate press.
    it("saves a new preset unpublished", async () => {
      signedIn();
      mockAggregate.mockResolvedValue({ _max: { untitledIndex: 0 } });
      mockCreate.mockResolvedValue(row("a", null));

      const preset = await createShaderPreset({
        shaderId: "cosmicTrack",
        settings: SETTINGS,
      });

      expect(mockCreate.mock.calls[0][0].data.publishedAt).toBeUndefined();
      expect(preset.publishedAt).toBeNull();
    });
  });

  describe("publishShaderPreset", () => {
    it("refuses a visitor", async () => {
      await expect(publishShaderPreset("a")).rejects.toThrow("Unauthorized");
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("stamps the preset with the moment it went out", async () => {
      signedIn();
      mockUpdate.mockResolvedValue(row("a", NOW));

      const preset = await publishShaderPreset("a");

      const call = mockUpdate.mock.calls[0][0] as {
        where: { id: string };
        data: { publishedAt: unknown };
      };
      expect(call.where).toEqual({ id: "a" });
      expect(call.data.publishedAt).toBeInstanceOf(Date);
      expect(preset.publishedAt).toEqual(NOW);
    });
  });

  describe("unpublishShaderPreset", () => {
    it("refuses a visitor", async () => {
      await expect(unpublishShaderPreset("a")).rejects.toThrow("Unauthorized");
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    // Clearing the date rather than deleting the row: the preset is still the
    // author's to open, tune and put back out.
    it("clears the date, leaving the preset where it is", async () => {
      signedIn();
      mockUpdate.mockResolvedValue(row("a", null));

      const preset = await unpublishShaderPreset("a");

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "a" },
        data: { publishedAt: null },
      });
      expect(preset.publishedAt).toBeNull();
    });
  });
});
