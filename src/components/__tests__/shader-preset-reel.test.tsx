// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shaderPresetContentFor } from "@/domain/shader-preset";
import type { ShaderId } from "@/data/shader-specs";
import type { ReelPreset } from "../shader-preset-reel-player";

// The stage's only job is mounting a webgl2 context, which jsdom has none of.
// Stubbed with a marker element carrying the two things every assertion below
// is about: WHICH shader this layer is, and what speed it was handed.
vi.mock("@/components/shaders/shader-stage", () => ({
  MAX_PIXELS: 1,
  layerStyle: "",
  ShaderStage: ({
    spec,
    params,
  }: {
    spec: { id: string };
    params: Record<string, number>;
  }) => (
    <canvas data-shader={spec.id} data-speed={String(params.speed)} />
  ),
}));

const getShaderPresets = vi.fn();
vi.mock("@/app/actions/shader-preset", () => ({
  getShaderPresets: () => getShaderPresets(),
}));

const {
  ShaderPresetReelPlayer,
  advanceReel,
  reelLayers,
  reelRampIndex,
  REEL_START,
  DWELL_MS,
  FADE_MS,
} = await import("../shader-preset-reel-player");
const { ShaderPresetReel, REEL_LENGTH } = await import("../shader-preset-reel");

/**
 * A preset carrying nothing but the two facts the reel reads off one: which
 * shader it needs a layer of, and the settings its colours come out of. Built
 * through the domain's own constructor rather than assembled here, so the
 * fixture cannot be a shape the database would reject.
 */
const preset = (id: string, shaderId: ShaderId = "cosmicTrack"): ReelPreset => ({
  id,
  ...shaderPresetContentFor(shaderId),
});

/**
 * The same, tuned to actually animate. Every control table defaults `speed` to
 * zero, so a preset off the shelf is a still — which is a fine ground and a
 * useless fixture for asserting which layer is running.
 */
const moving = (id: string, shaderId: ShaderId): ReelPreset => {
  const base = preset(id, shaderId);
  return {
    ...base,
    settings: { ...base.settings, params: { ...base.settings.params, speed: 2 } },
  };
};

/** The same, as the action hands it over — a row, with columns the reel drops. */
const row = (id: string, shaderId: ShaderId = "cosmicTrack") => ({
  ...preset(id, shaderId),
  title: id,
  untitledIndex: null,
  publishedAt: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  getShaderPresets.mockReset();
});

// ---------------------------------------------------------------------------
// The phase machine. A handover is two halves rather than one crossfade,
// because the two presets do not always have two canvases to fade between —
// see the module's own note.
// ---------------------------------------------------------------------------
describe("advanceReel", () => {
  it("leaves the picture up for the whole hold", () => {
    expect(advanceReel({ index: 0, phase: "holding" }, 3)).toEqual({
      index: 0,
      phase: "fadingOut",
    });
  });

  // The index turns over at the BOTTOM of the fade, where nothing is on
  // screen. Advancing it any earlier would swap the picture in full view.
  it("advances the preset at the bottom of the fade", () => {
    expect(advanceReel({ index: 0, phase: "fadingOut" }, 3)).toEqual({
      index: 1,
      phase: "fadingIn",
    });
  });

  it("settles into the hold once the new preset is up", () => {
    expect(advanceReel({ index: 1, phase: "fadingIn" }, 3)).toEqual({
      index: 1,
      phase: "holding",
    });
  });

  it("wraps back to the newest after the last one", () => {
    expect(advanceReel({ index: 2, phase: "fadingOut" }, 3)).toEqual({
      index: 0,
      phase: "fadingIn",
    });
  });

  // Fewer than three presets is the ordinary case, not an error — and one is
  // the case where a reel is not a reel. It has nothing to hand over TO, so it
  // never leaves the hold rather than fading out and back into itself.
  it("holds a single preset still", () => {
    expect(advanceReel(REEL_START, 1)).toEqual(REEL_START);
  });

  it("holds when there is nothing at all", () => {
    expect(advanceReel(REEL_START, 0)).toEqual(REEL_START);
  });

  it("hands two presets back and forth", () => {
    expect(advanceReel({ index: 1, phase: "fadingOut" }, 2)).toEqual({
      index: 0,
      phase: "fadingIn",
    });
  });
});

// ---------------------------------------------------------------------------
// The ramp — the preset's colours as a plain CSS gradient, which is what the
// handover fades THROUGH.
// ---------------------------------------------------------------------------
describe("reelRampIndex", () => {
  // The colours arrive BEFORE the picture does: the ramp is already the next
  // preset's while the current one is still fading off it.
  it("names the incoming preset while the current one fades out", () => {
    expect(reelRampIndex({ index: 0, phase: "fadingOut" }, 3)).toBe(1);
  });

  it("names the current preset once the handover is under way", () => {
    expect(reelRampIndex({ index: 1, phase: "fadingIn" }, 3)).toBe(1);
    expect(reelRampIndex({ index: 1, phase: "holding" }, 3)).toBe(1);
  });

  it("wraps with the reel", () => {
    expect(reelRampIndex({ index: 2, phase: "fadingOut" }, 3)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The layers — one per SHADER, not one per preset, and mounted for the life of
// the reel. This is the whole context budget.
// ---------------------------------------------------------------------------
describe("reelLayers", () => {
  it("mounts one layer per distinct shader", () => {
    const layers = reelLayers(
      [preset("a", "cosmicTrack"), preset("b", "pixelComets"), preset("c", "cosmicTrack")],
      REEL_START,
    );
    expect(layers.map((layer) => layer.shaderId)).toEqual([
      "cosmicTrack",
      "pixelComets",
    ]);
  });

  it("mounts one layer when every preset shares a shader", () => {
    const layers = reelLayers(
      [preset("a"), preset("b"), preset("c")],
      REEL_START,
    );
    expect(layers).toHaveLength(1);
  });

  it("lights only the current preset's layer", () => {
    const layers = reelLayers(
      [preset("a", "cosmicTrack"), preset("b", "pixelComets")],
      { index: 1, phase: "holding" },
    );
    expect(layers.find((layer) => layer.shaderId === "pixelComets")?.lit).toBe(true);
    expect(layers.find((layer) => layer.shaderId === "cosmicTrack")?.lit).toBe(false);
  });

  // Nothing is lit at the bottom of the fade — which is what makes the two
  // halves read the same whether or not the shader changed.
  it("lights nothing while the current preset fades out", () => {
    const layers = reelLayers(
      [preset("a", "cosmicTrack"), preset("b", "pixelComets")],
      { index: 0, phase: "fadingOut" },
    );
    expect(layers.every((layer) => !layer.lit)).toBe(true);
  });

  it("carries the current preset on the lit layer", () => {
    const layers = reelLayers(
      [preset("a", "cosmicTrack"), preset("b", "pixelComets"), preset("c", "cosmicTrack")],
      { index: 2, phase: "holding" },
    );
    expect(layers.find((layer) => layer.shaderId === "cosmicTrack")?.presetIndex).toBe(2);
  });

  // A dark layer keeps the last preset it actually showed, rather than being
  // reset to the list's first: re-uploading its uniforms would be a wasted
  // pass over a canvas nobody can see.
  it("leaves a dark layer on the last preset it showed", () => {
    const layers = reelLayers(
      [preset("a", "cosmicTrack"), preset("b", "pixelComets"), preset("c", "cosmicTrack")],
      { index: 2, phase: "holding" },
    );
    expect(layers.find((layer) => layer.shaderId === "pixelComets")?.presetIndex).toBe(1);
  });

  it("looks back around the end of the reel for a dark layer's preset", () => {
    const layers = reelLayers(
      [preset("a", "cosmicTrack"), preset("b", "pixelComets"), preset("c", "cosmicTrack")],
      { index: 0, phase: "holding" },
    );
    expect(layers.find((layer) => layer.shaderId === "pixelComets")?.presetIndex).toBe(1);
  });
});

describe("<ShaderPresetReelPlayer>", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const play = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it("mounts one canvas per distinct shader, and no more", () => {
    render(
      <ShaderPresetReelPlayer
        presets={[
          preset("a", "cosmicTrack"),
          preset("b", "pixelComets"),
          preset("c", "cosmicTrack"),
        ]}
      />,
    );
    expect(screen.getAllByTestId(/^reel-layer-/)).toHaveLength(2);
  });

  it("hands the reel over once the hold is up", () => {
    render(
      <ShaderPresetReelPlayer
        presets={[preset("a", "cosmicTrack"), preset("b", "pixelComets")]}
      />,
    );

    expect(screen.getByTestId("reel-ramp-0")).toHaveProperty("style.opacity", "1");
    play(DWELL_MS);
    // The colours have arrived; the picture has not yet.
    expect(screen.getByTestId("reel-ramp-1")).toHaveProperty("style.opacity", "1");
    play(FADE_MS);
    play(FADE_MS);
    expect(
      screen.getByTestId("reel-layer-pixelComets"),
    ).toHaveProperty("style.opacity", "1");
  });

  // Two presets is a reel; one is a picture. Nothing to hand over to means no
  // timer at all, rather than a fade out and back into the same preset.
  it("holds still on a single preset", () => {
    render(<ShaderPresetReelPlayer presets={[preset("a")]} />);
    play(DWELL_MS * 10);
    expect(screen.getByTestId("reel-ramp-0")).toHaveProperty("style.opacity", "1");
  });

  it("renders nothing when there are no presets", () => {
    const { container } = render(<ShaderPresetReelPlayer presets={[]} />);
    expect(container.innerHTML).toBe("");
  });

  // A dark layer still holds its context — that is the cost the design accepts.
  // What it must NOT hold is a rAF: zero is not merely slow, it cancels the
  // library's loop outright, so an idle layer costs nothing per frame.
  it("holds every layer but the current one at a still", () => {
    render(
      <ShaderPresetReelPlayer
        presets={[moving("a", "cosmicTrack"), moving("b", "pixelComets")]}
      />,
    );
    const speed = (shaderId: string) =>
      screen
        .getByTestId(`reel-layer-${shaderId}`)
        .querySelector("canvas")
        ?.getAttribute("data-speed");

    // The reel opens on the newest, so the other shader is idle from the start.
    expect(speed("cosmicTrack")).toBe("2");
    expect(speed("pixelComets")).toBe("0");
  });

  // The outgoing picture keeps MOVING while it fades off — being handed over is
  // not the same as being dark, and a shader that froze the instant the fade
  // began would read as a stall rather than a handover.
  it("keeps the outgoing shader running through its fade", () => {
    render(
      <ShaderPresetReelPlayer
        presets={[moving("a", "cosmicTrack"), moving("b", "pixelComets")]}
      />,
    );
    play(DWELL_MS);
    expect(
      screen
        .getByTestId("reel-layer-cosmicTrack")
        .querySelector("canvas")
        ?.getAttribute("data-speed"),
    ).toBe("2");
  });

  // `useShaderPolicy` already pins every shader to a still under reduced
  // motion. The reel has to stop ADVANCING too, or the visitor still gets
  // content changing under them — a slideshow of stills is still a slideshow.
  it("holds on the newest under reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduced-motion"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    render(
      <ShaderPresetReelPlayer
        presets={[preset("a", "cosmicTrack"), preset("b", "pixelComets")]}
      />,
    );
    play(DWELL_MS * 10);
    expect(screen.getByTestId("reel-ramp-0")).toHaveProperty("style.opacity", "1");
    vi.unstubAllGlobals();
  });
});

describe("<ShaderPresetReel>", () => {
  it("plays the three latest and no more", async () => {
    getShaderPresets.mockResolvedValue([
      row("a"),
      row("b"),
      row("c"),
      row("d"),
    ]);
    render(await ShaderPresetReel({}));
    expect(screen.getAllByTestId(/^reel-ramp-/)).toHaveLength(REEL_LENGTH);
  });

  // Fewer than three is not a shortfall to pad or an error to throw — it is
  // a shorter reel, which is the same reel.
  it("plays however few there are", async () => {
    getShaderPresets.mockResolvedValue([row("a"), row("b")]);
    render(await ShaderPresetReel({}));
    expect(screen.getAllByTestId(/^reel-ramp-/)).toHaveLength(2);
  });

  it("draws nothing at all when none are published", async () => {
    getShaderPresets.mockResolvedValue([]);
    const { container } = render(await ShaderPresetReel({}));
    expect(container.innerHTML).toBe("");
  });
});
