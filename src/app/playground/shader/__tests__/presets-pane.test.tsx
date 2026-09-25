// @vitest-environment jsdom
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { ShaderId } from "@/data/shader-specs";
import { shaderPresetContentFor, type ThemedColor } from "@/domain/shader-preset";
import { useShaderPresetDraftStore } from "@/store/shader-preset-draft";

// The actions import `@/lib/env`, which throws on import without DATABASE_URL.
vi.mock("@/app/actions/shader-preset", () => ({
  getShaderPresets: vi.fn().mockResolvedValue([]),
  getShaderPreset: vi.fn(),
  createShaderPreset: vi.fn(),
  saveShaderPreset: vi.fn(),
  deleteShaderPreset: vi.fn(),
}));

// jsdom has no WebGL; a canvas lets the capture path run for real.
vi.mock("@/components/shaders/shader-stage", () => ({
  MAX_PIXELS: 1,
  layerStyle: "",
  ShaderStage: ({ spec }: { spec: { id: string } }) => (
    <canvas data-shader={spec.id} width={160} height={160} />
  ),
}));

// Signed in as the author by default.
const mockUseSession = vi.fn();
vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

const signedIn = () =>
  mockUseSession.mockReturnValue({ data: { user: { email: "a@b.c" } } });
const signedOut = () => mockUseSession.mockReturnValue({ data: null });

// Stubbed so a stray `useRouter` fails loudly instead of reaching a real router.
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const path = () => window.location.pathname;

const { PresetsPane } = await import("../presets-pane");
const { clearThumbnailCache } = await import("../shader-preset-thumbnails");
const { getShaderPresets, createShaderPreset } = await import("@/app/actions/shader-preset");

// Parsed: a preset holds a light/dark pair per stop, unlike the spec's defaults.
const settingsFor = (shaderId: ShaderId) => ({
  ...shaderPresetContentFor(shaderId).settings,
  framing: {},
});

/** A saved preset as the action hands it over; published, as a visitor's always are. */
const preset = (id: string, title: string | null, colors: string[]) => ({
  id,
  title,
  untitledIndex: title ? null : 1,
  shaderId: "cosmicTrack" as const,
  settings: {
    ...settingsFor("cosmicTrack"),
    colors: colors.map((color) => ({ light: color, dark: color })),
  },
  publishedAt: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
});

describe("PresetsPane", () => {
  beforeEach(() => {
    // jsdom has no `<dialog>` behaviour; `open` is what the confirm keys off.
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });

    signedIn();
    clearThumbnailCache();
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => "data:image/png;base64,PICTURE",
    );

    useShaderPresetDraftStore.getState().reset();
    (getShaderPresets as Mock).mockReset();
    (getShaderPresets as Mock).mockResolvedValue([]);
    (createShaderPreset as Mock).mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    window.history.replaceState(null, "", "/playground/shader");
  });
  afterEach(cleanup);

  /** Read off `open`, not the text: the confirm is always mounted. */
  const asking = () => !!document.querySelector("dialog")?.hasAttribute("open");

  /** The strip read left to right — scoped to it, so a modal's buttons cannot join in. */
  const tiles = () =>
    within(screen.getByRole("group", { name: "Presets" }))
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));

  it("leaves the author's blank draft alone", async () => {
    (getShaderPresets as Mock).mockResolvedValue([preset("c", "Newest", ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    await screen.findByRole("button", { name: "Newest" });
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBeNull();
    expect(path()).toBe("/playground/shader");
  });

  it("offers a way to add one even with nothing saved yet", async () => {
    render(<PresetsPane />);
    await waitFor(() => expect(getShaderPresets).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: "New preset" })).toBeTruthy();
  });

  it("shows the saved presets in the order it is given them", async () => {
    (getShaderPresets as Mock).mockResolvedValue([
      preset("c", "Newest", ["#FFFFFFFF"]),
      preset("b", "Middle", ["#000000FF"]),
      preset("a", "Oldest", ["#FF0000FF"]),
    ]);
    render(<PresetsPane />);

    await screen.findByRole("button", { name: "Newest" });
    expect(tiles()).toEqual(["New preset", "Newest", "Middle", "Oldest"]);
  });

  it("names an untitled preset the way the palette names an untitled draft", async () => {
    (getShaderPresets as Mock).mockResolvedValue([preset("a", null, ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    expect(await screen.findByRole("button", { name: "Untitled 1" })).toBeTruthy();
  });

  it("paints each tile from its preset's colours", async () => {
    (getShaderPresets as Mock).mockResolvedValue([
      preset("a", "Dusk", ["#2E6BFFFF", "#FFD9A0FF"]),
      preset("b", "Dawn", ["#FF4D97FF", "#12042BFF"]),
    ]);
    render(<PresetsPane />);

    const dusk = await screen.findByRole("button", { name: "Dusk" });
    const dawn = screen.getByRole("button", { name: "Dawn" });
    expect(dusk.style.background).toContain("linear-gradient");
    expect(dawn.style.background).toContain("linear-gradient");
    expect(dusk.style.background).not.toBe(dawn.style.background);
  });

  it("replaces the ramp with a picture of the preset once one is drawn", async () => {
    (getShaderPresets as Mock).mockResolvedValue([
      preset("a", "Dusk", ["#2E6BFFFF", "#FFD9A0FF"]),
    ]);
    render(<PresetsPane />);

    const tile = await screen.findByRole("button", { name: "Dusk" });
    expect(tile.style.background).toContain("linear-gradient");

    await waitFor(() =>
      expect(tile.style.backgroundImage).toContain("PICTURE"),
    );
  });

  it("re-reads the library when work is committed", async () => {
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);
    await waitFor(() => expect(getShaderPresets).toHaveBeenCalledOnce());

    await act(async () => {
      useShaderPresetDraftStore.getState().setParam("scale", 2);
    });
    expect(getShaderPresets).toHaveBeenCalledOnce();

    await act(async () => {
      useShaderPresetDraftStore.getState().load({
        id: "a",
        title: "Dusk",
        shaderId: "cosmicTrack",
        settings: settingsFor("cosmicTrack"),
        publishedAt: null,
      });
    });
    await waitFor(() => expect(getShaderPresets).toHaveBeenCalledTimes(2));
  });

  it("saves the draft as a new preset, and takes up editing that one", async () => {
    const user = userEvent.setup();
    (createShaderPreset as Mock).mockResolvedValue({
      id: "new-1",
      title: null,
      shaderId: "cosmicTrack",
      settings: settingsFor("cosmicTrack"),
    });
    render(<PresetsPane />);

    useShaderPresetDraftStore.getState().selectShader("cosmicTrack");
    await user.click(screen.getByRole("button", { name: "New preset" }));

    await waitFor(() =>
      expect(createShaderPreset).toHaveBeenCalledWith(
        expect.objectContaining({ shaderId: "cosmicTrack" }),
      ),
    );
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("new-1");
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
    expect(path()).toBe("/playground/shader/new-1");
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("leaves the draft alone when the save fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    (createShaderPreset as Mock).mockRejectedValue(new Error("no"));
    render(<PresetsPane />);

    await user.click(screen.getByRole("button", { name: "New preset" }));

    await waitFor(() => expect(createShaderPreset).toHaveBeenCalled());
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBeNull();
    expect(path()).toBe("/playground/shader");
  });

  it("opens a preset into the draft without navigating", async () => {
    const user = userEvent.setup();
    const dusk = preset("a", "Dusk", ["#FFFFFFFF"]);
    (getShaderPresets as Mock).mockResolvedValue([dusk]);
    render(<PresetsPane />);

    await user.click(await screen.findByRole("button", { name: "Dusk" }));

    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("a");
    expect(useShaderPresetDraftStore.getState().shaderId).toBe("cosmicTrack");
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
    expect(path()).toBe("/playground/shader/a");
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("marks the open preset as current, and does not reopen it", async () => {
    const user = userEvent.setup();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    useShaderPresetDraftStore.getState().load({
      id: "a",
      title: "Dusk",
      shaderId: "cosmicTrack",
      settings: settingsFor("cosmicTrack"),
      publishedAt: null,
    });
    render(<PresetsPane />);

    const tile = await screen.findByRole("button", { name: "Dusk" });
    expect(tile.getAttribute("aria-current")).toBe("true");

    await user.click(tile);
    expect(path()).toBe("/playground/shader");
  });

  it("opens a preset over unsaved work without asking", async () => {
    const user = userEvent.setup();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    await user.click(await screen.findByRole("button", { name: "Dusk" }));

    expect(asking()).toBe(false);
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("a");
    expect(path()).toBe("/playground/shader/a");
  });

  it("hands the work back when the draft is taken up again", async () => {
    const user = userEvent.setup();
    (getShaderPresets as Mock).mockResolvedValue([
      preset("a", "Dusk", ["#FFFFFFFF"]),
      preset("b", "Dawn", ["#000000FF"]),
    ]);
    render(<PresetsPane />);

    await user.click(await screen.findByRole("button", { name: "Dusk" }));
    useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    await user.click(screen.getByRole("button", { name: "Dawn" }));
    await user.click(screen.getByRole("button", { name: "Dusk" }));

    expect(useShaderPresetDraftStore.getState().settings.params.rampLength).toBe(4);
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(true);
  });

  it("does not report settled until the draft holds the preset it opens on", async () => {
    signedOut();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);

    // Captured at the moment of the call.
    let idWhenTold: string | null | undefined;
    let coloursWhenTold: ThemedColor[] | undefined;
    const onSettled = vi.fn(() => {
      const draft = useShaderPresetDraftStore.getState();
      idWhenTold = draft.shaderPresetId;
      coloursWhenTold = draft.settings.colors;
    });

    render(<PresetsPane onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalled());

    expect(idWhenTold).toBe("a");
    expect(coloursWhenTold).toEqual([
      { light: "#FFFFFFFF", dark: "#FFFFFFFF" },
    ]);
  });

  it("reports settled for the author, who is left on their own draft", async () => {
    signedIn();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    const onSettled = vi.fn();

    render(<PresetsPane onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBeNull();
  });

  it("reports settled when the library cannot be read", async () => {
    signedOut();
    (getShaderPresets as Mock).mockRejectedValue(new Error("no"));
    const onSettled = vi.fn();

    render(<PresetsPane onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalled());
  });

  it("reports settled only once, however the strip re-reads", async () => {
    signedOut();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    const onSettled = vi.fn();

    render(<PresetsPane onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    await act(async () => {
      useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  const marked = (label: string) =>
    !!screen
      .getByRole("button", { name: label })
      .parentElement?.querySelector("[data-unsaved]");

  it("marks a preset holding work you cannot see", async () => {
    const user = userEvent.setup();
    (getShaderPresets as Mock).mockResolvedValue([
      preset("a", "Dusk", ["#FFFFFFFF"]),
      preset("b", "Dawn", ["#000000FF"]),
    ]);
    render(<PresetsPane />);

    await user.click(await screen.findByRole("button", { name: "Dusk" }));
    useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    await user.click(screen.getByRole("button", { name: "Dawn" }));

    expect(marked("Dusk")).toBe(true);
    expect(marked("Dawn")).toBe(false);
  });

  it("marks the preset on screen once it is touched", async () => {
    const user = userEvent.setup();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    await user.click(await screen.findByRole("button", { name: "Dusk" }));
    expect(marked("Dusk")).toBe(false);

    await act(async () => {
      useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    });
    expect(marked("Dusk")).toBe(true);
  });

  it("gives the unsaved new draft a tile of its own, marked", async () => {
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);
    await screen.findByRole("button", { name: "Dusk" });

    expect(screen.queryByRole("button", { name: "Unsaved draft" })).toBeNull();

    await act(async () => {
      useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    });
    expect(marked("Unsaved draft")).toBe(true);
  });

  it("takes the new draft back up, with its work", async () => {
    const user = userEvent.setup();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);
    await screen.findByRole("button", { name: "Dusk" });

    await act(async () => {
      useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    });
    await user.click(screen.getByRole("button", { name: "Dusk" }));
    await user.click(screen.getByRole("button", { name: "Unsaved draft" }));

    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBeNull();
    expect(useShaderPresetDraftStore.getState().settings.params.rampLength).toBe(4);
    expect(path()).toBe("/playground/shader");
  });

  describe("for a visitor", () => {
    beforeEach(signedOut);

    it("marks no tile, having no save to be behind on", async () => {
      const user = userEvent.setup();
      (getShaderPresets as Mock).mockResolvedValue([
        preset("a", "Dusk", ["#FFFFFFFF"]),
        preset("b", "Dawn", ["#000000FF"]),
      ]);
      render(<PresetsPane />);

      await user.click(await screen.findByRole("button", { name: "Dusk" }));
      await act(async () => {
        useShaderPresetDraftStore.getState().setParam("rampLength", 4);
      });
      expect(useShaderPresetDraftStore.getState().isDirty).toBe(true);
      expect(marked("Dusk")).toBe(false);

      await user.click(screen.getByRole("button", { name: "Dawn" }));
      expect(marked("Dusk")).toBe(false);
    });


    it("offers no way to add one", async () => {
      (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
      render(<PresetsPane />);

      await screen.findByRole("button", { name: "Dusk" });
      expect(screen.queryByRole("button", { name: "New preset" })).toBeNull();
    });

    it("still opens a preset into the draft", async () => {
      const user = userEvent.setup();
      (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
      render(<PresetsPane />);

      await user.click(await screen.findByRole("button", { name: "Dusk" }));

      expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("a");
      expect(path()).toBe("/playground/shader/a");
    });

    it("opens on the newest published preset", async () => {
      (getShaderPresets as Mock).mockResolvedValue([
        preset("c", "Newest", ["#FFFFFFFF"]),
        preset("a", "Oldest", ["#FF0000FF"]),
      ]);
      render(<PresetsPane />);

      await waitFor(() =>
        expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("c"),
      );
      expect(
        (await screen.findByRole("button", { name: "Newest" })).getAttribute(
          "aria-current",
        ),
      ).toBe("true");
      expect(path()).toBe("/playground/shader/c");
      expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
    });

    it("leaves a preset the route was opened on alone", async () => {
      (getShaderPresets as Mock).mockResolvedValue([preset("c", "Newest", ["#FFFFFFFF"])]);
      useShaderPresetDraftStore.getState().load({
        id: "a",
        title: "Oldest",
        shaderId: "cosmicTrack",
        settings: settingsFor("cosmicTrack"),
        publishedAt: new Date("2026-01-01"),
      });
      render(<PresetsPane />);

      await waitFor(() => expect(getShaderPresets).toHaveBeenCalled());
      expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("a");
    });

    it("draws no strip at all when nothing has been published", async () => {
      const { container } = render(<PresetsPane />);

      await waitFor(() => expect(getShaderPresets).toHaveBeenCalled());
      expect(screen.queryByRole("group", { name: "Presets" })).toBeNull();
      expect(container.querySelector("[data-presets]")).toBeNull();
    });
  });
});
