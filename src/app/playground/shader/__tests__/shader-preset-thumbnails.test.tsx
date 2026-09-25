// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SHADER_SPECS, defaultState } from "@/data/shader-specs";

// jsdom has no WebGL; a canvas is what the thumbnailer looks for.
vi.mock("@/components/shaders/shader-stage", () => ({
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

// A plain string so the pure functions can be given two shaders; mounting tests use the real one.
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
  it("changes when the preset is edited", () => {
    expect(
      thumbnailKey(preset("a", "cosmicTrack", "2026-01-01"), "light"),
    ).not.toBe(thumbnailKey(preset("a", "cosmicTrack", "2026-02-02"), "light"));
  });

  it("is stable for the same preset at the same edit", () => {
    expect(thumbnailKey(preset("a", "cosmicTrack"), "light")).toBe(
      thumbnailKey(preset("a", "cosmicTrack"), "light"),
    );
  });
});

describe("captureOrder", () => {
  it("groups what is left to capture by shader", () => {
    const order = captureOrder(
      [
        preset("a", "cosmicTrack"),
        preset("b", "otherShader"),
        preset("c", "cosmicTrack"),
        preset("d", "otherShader"),
      ],
      new Set(),
      "light",
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
      new Set([thumbnailKey(done, "light")]),
      "light",
    );
    expect(order.map((p) => p.id)).toEqual(["b"]);
  });

  it("is empty once every preset has a picture", () => {
    const presets = [preset("a", "cosmicTrack"), preset("b", "otherShader")];
    expect(
      captureOrder(
        presets,
        new Set(presets.map((preset) => thumbnailKey(preset, "light"))),
        "light",
      ),
    ).toEqual([]);
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

  // The real shader, because this one mounts.
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
    expect(captured[thumbnailKey(presets[0], "light")]).toContain("cosmicTrack");
    expect(captured[thumbnailKey(presets[1], "light")]).toContain("cosmicTrack");
    expect(thumbnailKey(presets[0], "light")).not.toBe(
      thumbnailKey(presets[1], "light"),
    );
  });

  // Asserts both keys: a capture writing both would hide the fault.
  it("files a picture under the ground it was drawn on", async () => {
    const captured: Record<string, string> = {};
    const presets = [preset("a")];

    render(
      <ShaderPresetThumbnails
        presets={presets}
        theme="dark"
        onCaptured={(key, url) => {
          captured[key] = url;
        }}
      />,
    );

    await waitFor(() => expect(Object.keys(captured)).toHaveLength(1), {
      timeout: 3000,
    });
    expect(captured[thumbnailKey(presets[0], "dark")]).toContain("cosmicTrack");
    expect(captured[thumbnailKey(presets[0], "light")]).toBeUndefined();
  });

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
