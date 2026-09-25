import { describe, it, expect, vi, beforeEach } from "vitest";
import { SHADER_SPECS, defaultState } from "@/data/shader-specs";

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

// Mocked at the session source, not `requireAdmin`, so the real admin check runs.
vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: () => ({ getSession: () => mockGetSession() }),
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

  describe("getPublishedShaderPresets", () => {
    it("shows a visitor only the published presets", async () => {
      mockFindMany.mockResolvedValue([row("a", NOW)]);

      const presets = await getPublishedShaderPresets();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { publishedAt: { not: null } } }),
      );
      expect(presets.map((preset) => preset.id)).toEqual(["a"]);
    });

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

  describe("createShaderPreset", () => {
    it("refuses a visitor", async () => {
      mockAggregate.mockResolvedValue({ _max: { untitledIndex: 0 } });

      await expect(
        createShaderPreset({ shaderId: "cosmicTrack", settings: SETTINGS }),
      ).rejects.toThrow("Unauthorized");
      expect(mockCreate).not.toHaveBeenCalled();
    });

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
