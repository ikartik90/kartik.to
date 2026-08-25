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
import { SHADER_SPECS, defaultState } from "@/data/shader-specs";
import { DEFAULT_COVER_ASPECT } from "@/domain/cover";
import { useCoverDraftStore } from "@/store/cover-draft";

// The actions are `"use server"` files importing `@/lib/env`, which validates
// DATABASE_URL at import time and throws in a run with no `.env`.
vi.mock("@/app/actions/cover", () => ({
  getCovers: vi.fn().mockResolvedValue([]),
  getCover: vi.fn(),
  createCover: vi.fn(),
  saveCover: vi.fn(),
  deleteCover: vi.fn(),
}));

// The stage's whole job is a webgl2 context, which jsdom has none of. A canvas
// is what the thumbnailer goes looking for, so a canvas is what it gets — the
// capture path then runs for real, end to end, into the tile.
vi.mock("../shader-stage", () => ({
  MAX_PIXELS: 1,
  layerStyle: "",
  ShaderStage: ({ spec }: { spec: { id: string } }) => (
    <canvas data-shader={spec.id} width={160} height={160} />
  ),
}));

// The strip navigates nowhere — it puts a preset in the draft and corrects the
// URL in place. `next/navigation` is stubbed anyway, so a stray `useRouter`
// creeping back in fails loudly rather than being answered by a real router.
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

/** Where the URL bar says we are. */
const path = () => window.location.pathname;

const { PresetsPane } = await import("../presets-pane");
const { clearThumbnailCache } = await import("../cover-thumbnails");
const { getCovers, createCover } = await import("@/app/actions/cover");

const settingsFor = (shaderId: keyof typeof SHADER_SPECS) => ({
  ...defaultState(SHADER_SPECS[shaderId]),
  aspect: DEFAULT_COVER_ASPECT,
});

/** A saved cover as the action hands it over. */
const preset = (id: string, title: string | null, colors: string[]) => ({
  id,
  title,
  untitledIndex: title ? null : 1,
  shaderId: "cosmicTrack" as const,
  settings: { ...settingsFor("cosmicTrack"), colors },
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
});

describe("PresetsPane", () => {
  beforeEach(() => {
    // jsdom ships no `<dialog>` behaviour. The same stub the palette's tests
    // use: `open` is what the confirm's own effect and every query key off.
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

    clearThumbnailCache();
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => "data:image/png;base64,PICTURE",
    );

    useCoverDraftStore.getState().reset();
    (getCovers as Mock).mockReset();
    (getCovers as Mock).mockResolvedValue([]);
    (createCover as Mock).mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    window.history.replaceState(null, "", "/playground/cover");
  });
  afterEach(cleanup);

  /**
   * Whether the question is up.
   *
   * Read off the `<dialog>`'s own `open`, NOT off the words in it: the confirm
   * is always mounted and only toggles that attribute, so its title is in the
   * document whether or not anything is being asked — a text query here passes
   * either way and proves nothing.
   */
  const asking = () => !!document.querySelector("dialog")?.hasAttribute("open");

  /** The strip read left to right — scoped to it, so a modal's buttons cannot join in. */
  const tiles = () =>
    within(screen.getByRole("group", { name: "Presets" }))
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));

  it("offers a way to add one even with nothing saved yet", async () => {
    render(<PresetsPane />);
    await waitFor(() => expect(getCovers).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: "New preset" })).toBeTruthy();
  });

  // The action hands them over newest-first and the strip shows them in that
  // order — it does not re-sort, because a second answer to "what order are
  // these in" is a second place for it to be wrong. See `getCovers`.
  it("shows the saved presets in the order it is given them", async () => {
    (getCovers as Mock).mockResolvedValue([
      preset("c", "Newest", ["#FFFFFFFF"]),
      preset("b", "Middle", ["#000000FF"]),
      preset("a", "Oldest", ["#FF0000FF"]),
    ]);
    render(<PresetsPane />);

    await screen.findByRole("button", { name: "Newest" });
    expect(tiles()).toEqual(["New preset", "Newest", "Middle", "Oldest"]);
  });

  it("names an untitled preset the way the palette names an untitled draft", async () => {
    (getCovers as Mock).mockResolvedValue([preset("a", null, ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    expect(await screen.findByRole("button", { name: "Untitled 1" })).toBeTruthy();
  });

  // The tile is painted from the cover's OWN ramp — see `coverSwatch` for why
  // it cannot be the cover itself. Two presets, so this pins "painted from this
  // one" rather than "painted"; the exact CSS is `coverSwatch`'s own test, and
  // asserting it here would only be asserting how jsdom serialises a colour.
  it("paints each tile from its preset's colours", async () => {
    (getCovers as Mock).mockResolvedValue([
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

  // The swatch is a stand-in. What the strip is FOR is seeing what each preset
  // actually looks like, which is a photograph of the cover taken off-screen —
  // see `cover-thumbnails` for why it cannot be a live one.
  it("replaces the ramp with a picture of the cover once one is drawn", async () => {
    (getCovers as Mock).mockResolvedValue([
      preset("a", "Dusk", ["#2E6BFFFF", "#FFD9A0FF"]),
    ]);
    render(<PresetsPane />);

    const tile = await screen.findByRole("button", { name: "Dusk" });
    expect(tile.style.background).toContain("linear-gradient");

    await waitFor(() =>
      expect(tile.style.backgroundImage).toContain("PICTURE"),
    );
  });

  // A save is the other thing that can change the library — the row you were
  // editing now looks different. Missing it would leave that tile showing the
  // picture the cover had before you touched it.
  it("re-reads the library when work is committed", async () => {
    (getCovers as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);
    await waitFor(() => expect(getCovers).toHaveBeenCalledOnce());

    // Mid-edit: nothing has been written, so nothing is re-read.
    await act(async () => {
      useCoverDraftStore.getState().setParam("scale", 2);
    });
    expect(getCovers).toHaveBeenCalledOnce();

    // Committed — the store goes clean, exactly as a save leaves it.
    await act(async () => {
      useCoverDraftStore.getState().load({
        id: "a",
        title: "Dusk",
        shaderId: "cosmicTrack",
        settings: settingsFor("cosmicTrack"),
      });
    });
    await waitFor(() => expect(getCovers).toHaveBeenCalledTimes(2));
  });

  // --- Adding ---------------------------------------------------------------

  it("saves the draft as a new preset, and takes up editing that one", async () => {
    const user = userEvent.setup();
    (createCover as Mock).mockResolvedValue({
      id: "new-1",
      title: null,
      shaderId: "swirl",
      settings: settingsFor("swirl"),
    });
    render(<PresetsPane />);

    useCoverDraftStore.getState().selectShader("swirl");
    await user.click(screen.getByRole("button", { name: "New preset" }));

    await waitFor(() =>
      expect(createCover).toHaveBeenCalledWith(
        expect.objectContaining({ shaderId: "swirl" }),
      ),
    );
    // Adopted: the draft is now that preset, its URL says so, and the work is
    // no longer unsaved. The URL is corrected in PLACE — asking the router for
    // the cover's route would fetch a cover the page is already holding and
    // remount the playground around the answer.
    expect(useCoverDraftStore.getState().coverId).toBe("new-1");
    expect(useCoverDraftStore.getState().isDirty).toBe(false);
    expect(path()).toBe("/playground/cover/new-1");
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("leaves the draft alone when the save fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    (createCover as Mock).mockRejectedValue(new Error("no"));
    render(<PresetsPane />);

    await user.click(screen.getByRole("button", { name: "New preset" }));

    await waitFor(() => expect(createCover).toHaveBeenCalled());
    expect(useCoverDraftStore.getState().coverId).toBeNull();
    expect(path()).toBe("/playground/cover");
  });

  // --- Opening --------------------------------------------------------------

  // Opening one is a change of what the page HOLDS, not a trip to another page:
  // the strip already has the whole cover, so it hands it to the draft and
  // corrects the URL. Going through the router would fetch what is already in
  // hand and remount the playground — the shader torn down and recompiled —
  // around an identical answer.
  it("opens a preset into the draft without navigating", async () => {
    const user = userEvent.setup();
    const dusk = preset("a", "Dusk", ["#FFFFFFFF"]);
    (getCovers as Mock).mockResolvedValue([dusk]);
    render(<PresetsPane />);

    await user.click(await screen.findByRole("button", { name: "Dusk" }));

    expect(useCoverDraftStore.getState().coverId).toBe("a");
    expect(useCoverDraftStore.getState().shaderId).toBe("cosmicTrack");
    // Opened clean: adopting a saved cover is not an edit to it.
    expect(useCoverDraftStore.getState().isDirty).toBe(false);
    expect(path()).toBe("/playground/cover/a");
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // The rule the palette already follows in withholding a destination you are
  // already on: the row would do nothing, and a control that does nothing reads
  // as a broken one.
  it("marks the open preset as current, and does not reopen it", async () => {
    const user = userEvent.setup();
    (getCovers as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    useCoverDraftStore.getState().load({
      id: "a",
      title: "Dusk",
      shaderId: "cosmicTrack",
      settings: settingsFor("cosmicTrack"),
    });
    render(<PresetsPane />);

    const tile = await screen.findByRole("button", { name: "Dusk" });
    expect(tile.getAttribute("aria-current")).toBe("true");

    await user.click(tile);
    expect(path()).toBe("/playground/cover");
  });

  // --- Unsaved work ---------------------------------------------------------

  // Opening a preset LEAVES what is being tuned. One stray press on a strip of
  // near-identical tiles would otherwise throw away an afternoon.
  it("asks before opening a preset over unsaved work", async () => {
    const user = userEvent.setup();
    (getCovers as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    useCoverDraftStore.getState().setParam("scale", 2);
    await user.click(await screen.findByRole("button", { name: "Dusk" }));

    expect(useCoverDraftStore.getState().coverId).toBeNull();
    expect(asking()).toBe(true);
  });

  it("opens it once the loss is accepted", async () => {
    const user = userEvent.setup();
    (getCovers as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    useCoverDraftStore.getState().setParam("scale", 2);
    await user.click(await screen.findByRole("button", { name: "Dusk" }));
    await user.click(
      screen.getByRole("button", { name: "Discard changes and open" }),
    );

    expect(useCoverDraftStore.getState().coverId).toBe("a");
    expect(path()).toBe("/playground/cover/a");
  });

  it("stays put when the question is declined", async () => {
    const user = userEvent.setup();
    (getCovers as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    useCoverDraftStore.getState().setParam("scale", 2);
    await user.click(await screen.findByRole("button", { name: "Dusk" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(useCoverDraftStore.getState().coverId).toBeNull();
    expect(path()).toBe("/playground/cover");
    expect(asking()).toBe(false);
  });
});
