// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shaderPresetContentFor } from "@/domain/shader-preset";
import type { ReelPreset } from "@/components/shader-preset-reel-player";

const getPublishedShaderPresets = vi.fn();
vi.mock("@/app/actions/shader-preset", () => ({
  getPublishedShaderPresets: () => getPublishedShaderPresets(),
}));

// The player mounts webgl2 contexts, which jsdom has none of. Stubbed with a
// marker carrying what this wrapper is actually responsible for: which presets
// it handed over, and at what shape. `toReelPresets` stays REAL — the narrowing
// is the behaviour under test, not a collaborator.
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
  // The fetch belongs to the LOAD, not to a mount: the registry's loader is
  // what the demo frame's preloader is waiting on, so a reel prepared this way
  // arrives with its presets already in hand instead of opening on an empty box
  // and filling a round trip later.
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

  // A second card, a re-mount, a scroll back — none of them is a reason to ask
  // the database again. `useDemoLoader` caches the prepared component by id, so
  // rendering it repeatedly must not fetch.
  it("does not fetch again for a second render of the same load", async () => {
    getPublishedShaderPresets.mockResolvedValue([row("a")]);
    const Reel = await prepareShaderPresetReel();

    render(<Reel />);
    cleanup();
    render(<Reel />);

    expect(getPublishedShaderPresets).toHaveBeenCalledTimes(1);
  });
});
