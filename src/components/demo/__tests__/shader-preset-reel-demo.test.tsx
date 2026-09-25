// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shaderPresetContentFor } from "@/domain/shader-preset";
import type { ReelPreset } from "@/components/shader-preset-reel-player";

const getPublishedShaderPresets = vi.fn();
vi.mock("@/app/actions/shader-preset", () => ({
  getPublishedShaderPresets: () => getPublishedShaderPresets(),
}));

// jsdom has no webgl2. `toReelPresets` stays real: the narrowing is under test.
vi.mock("@/components/shader-preset-reel-player", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/components/shader-preset-reel-player")
  >()),
  ShaderPresetReelPlayer: ({
    presets,
    aspect,
  }: {
    presets: ReelPreset[];
    aspect?: string;
  }) => (
    <div
      data-testid="player"
      data-presets={presets.map((preset) => preset.id).join(",")}
      data-aspect={aspect ?? ""}
    />
  ),
}));

const { prepareShaderPresetReel } = await import("../shader-preset-reel-demo");

const row = (id: string) => ({
  id,
  ...shaderPresetContentFor("cosmicTrack"),
  title: id,
  untitledIndex: null,
  publishedAt: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
});

afterEach(() => {
  cleanup();
  getPublishedShaderPresets.mockReset();
});

describe("prepareShaderPresetReel", () => {
  it("fetches while loading and hands the newest three over", async () => {
    getPublishedShaderPresets.mockResolvedValue([row("a"), row("b"), row("c"), row("d")]);

    const Reel = await prepareShaderPresetReel();
    expect(getPublishedShaderPresets).toHaveBeenCalledTimes(1);

    render(<Reel />);
    expect(screen.getByTestId("player").dataset.presets).toBe("a,b,c");
  });

  it("draws the shape the frame says it is in", async () => {
    getPublishedShaderPresets.mockResolvedValue([row("a")]);
    const Reel = await prepareShaderPresetReel();

    render(<Reel aspect="16/9" />);

    expect(screen.getByTestId("player").dataset.aspect).toBe("16/9");
  });

  it("does not fetch again for a second render of the same load", async () => {
    getPublishedShaderPresets.mockResolvedValue([row("a")]);
    const Reel = await prepareShaderPresetReel();

    render(<Reel />);
    cleanup();
    render(<Reel />);

    expect(getPublishedShaderPresets).toHaveBeenCalledTimes(1);
  });
});
