// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SHADER_SPECS, defaultState } from "@/data/shader-specs";

// The stage is the real thing's only job — mounting a webgl2 context, which
// jsdom has none of. Stubbed with a canvas, because a canvas is exactly what
// the thumbnailer goes looking for.
vi.mock("../shader-stage", () => ({
  MAX_PIXELS: 1,
  layerStyle: "",
  ShaderStage: ({ spec }: { spec: { id: string } }) => (
    <canvas data-shader={spec.id} width={160} height={160} />
  ),
}));

const {
  ShaderPresetThumbnails,
  captureOrder,
  thumbnailKey,
  clearThumbnailCache,
} = await import("../shader-preset-thumbnails");

// The shader is a plain STRING here rather than a `ShaderId`, so that the two
// pure functions below can be handed two different ones. `captureOrder` and
// `thumbnailKey` treat the column as opaque — they group and hash it, they
// never look it up — and the table holds a single shader today, so a real
// second id does not exist to group against. Anything that MOUNTS is given the
// real one, because the thumbnailer does look that up (see `SHADER_SPECS`
// there); the settings come from the real spec either way.
const preset = (id: string, shaderId = "cosmicTrack", updatedAt = "2026-01-01") =>
  ({
    id,
    title: id,
    untitledIndex: null,
    shaderId,
    settings: {
      ...defaultState(SHADER_SPECS.cosmicTrack),
      framing: {},
    },
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date(updatedAt),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe("thumbnailKey", () => {
  // Keyed on the EDIT, not just the row: a preset that has been retuned is a
  // different picture under the same id, and a cache that could not tell them
  // apart would show the old one until a reload.
  it("changes when the preset is edited", () => {
    expect(thumbnailKey(preset("a", "cosmicTrack", "2026-01-01"))).not.toBe(
      thumbnailKey(preset("a", "cosmicTrack", "2026-02-02")),
    );
  });

  it("is stable for the same preset at the same edit", () => {
    expect(thumbnailKey(preset("a", "cosmicTrack"))).toBe(
      thumbnailKey(preset("a", "cosmicTrack")),
    );
  });
});

describe("captureOrder", () => {
  // Presets are grouped by SHADER because the mount is only reused while the
  // fragment shader stays the same — the library keys its context on that, and
  // an alternating order would create one context per preset, which is the
  // whole thing this strip is avoiding.
  it("groups what is left to capture by shader", () => {
    const order = captureOrder(
      [
        preset("a", "cosmicTrack"),
        preset("b", "otherShader"),
        preset("c", "cosmicTrack"),
        preset("d", "otherShader"),
      ],
      new Set(),
    );
    expect(order.map((p) => p.shaderId)).toEqual([
      "cosmicTrack",
      "cosmicTrack",
      "otherShader",
      "otherShader",
    ]);
  });

  it("leaves out anything already captured", () => {
    const done = preset("a", "cosmicTrack");
    const order = captureOrder(
      [done, preset("b", "otherShader")],
      new Set([thumbnailKey(done)]),
    );
    expect(order.map((p) => p.id)).toEqual(["b"]);
  });

  it("is empty once every preset has a picture", () => {
    const presets = [preset("a", "cosmicTrack"), preset("b", "otherShader")];
    expect(captureOrder(presets, new Set(presets.map((preset) => thumbnailKey(preset))))).toEqual([]);
  });
});

describe("ShaderPresetThumbnails", () => {
  beforeEach(() => {
    clearThumbnailCache();
    HTMLCanvasElement.prototype.toDataURL = vi.fn(function (
      this: HTMLCanvasElement,
    ) {
      return `data:image/png;base64,${this.dataset.shader}`;
    });
  });
  afterEach(cleanup);

  // Both on the real shader, because this one MOUNTS — and with one shader in
  // the table "one at a time" is one group of two rather than two groups of
  // one. What it proves is unchanged: every preset comes back with a picture of
  // its own, taken through a single stage.
  it("hands back a picture for every preset, one shader at a time", async () => {
    const captured: Record<string, string> = {};
    const presets = [preset("a"), preset("b")];

    render(
      <ShaderPresetThumbnails
        presets={presets}
        theme="light"
        onCaptured={(key, url) => {
          captured[key] = url;
        }}
      />,
    );

    await waitFor(() => expect(Object.keys(captured)).toHaveLength(2), {
      timeout: 3000,
    });
    expect(captured[thumbnailKey(presets[0])]).toContain("cosmicTrack");
    expect(captured[thumbnailKey(presets[1])]).toContain("cosmicTrack");
    // Two pictures, not one picture counted twice.
    expect(thumbnailKey(presets[0])).not.toBe(thumbnailKey(presets[1]));
  });

  // Nothing left to draw means nothing mounted: the renderer holds a webgl2
  // context for as long as it is on screen, and the strip is at rest far more
  // often than it is capturing.
  it("unmounts itself once there is nothing left to capture", async () => {
    const presets = [preset("a", "cosmicTrack")];
    const { container } = render(
      <ShaderPresetThumbnails presets={presets} theme="light" onCaptured={() => {}} />,
    );

    expect(container.querySelector("canvas")).not.toBeNull();
    await waitFor(() => expect(container.querySelector("canvas")).toBeNull(), {
      timeout: 3000,
    });
  });

  // The cache is what makes navigating between presets free — the strip
  // re-reads its list on every one, and re-rendering forty presets each time
  // would be forty contexts' worth of work for pictures already taken.
  it("does not redraw a preset it has already captured", async () => {
    const presets = [preset("a", "cosmicTrack")];
    const onCaptured = vi.fn();

    const first = render(
      <ShaderPresetThumbnails presets={presets} theme="light" onCaptured={onCaptured} />,
    );
    await waitFor(() => expect(onCaptured).toHaveBeenCalledOnce());
    first.unmount();

    const { container } = render(
      <ShaderPresetThumbnails presets={presets} theme="light" onCaptured={vi.fn()} />,
    );
    expect(container.querySelector("canvas")).toBeNull();
  });
});
