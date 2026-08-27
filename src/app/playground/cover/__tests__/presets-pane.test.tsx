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

// Who is asking. The strip is public now, so most of what follows is only true
// of one of the two — signed IN by default, because the author's is the strip
// with every control on it; the visitor's is its own block at the foot.
const mockUseSession = vi.fn();
vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

/** Signed in as the author, and signed out as anybody else. */
const signedIn = () =>
  mockUseSession.mockReturnValue({ data: { user: { email: "a@b.c" } } });
const signedOut = () => mockUseSession.mockReturnValue({ data: null });

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
  framing: {},
});

/**
 * A saved cover as the action hands it over.
 *
 * Published, because that is what a cover in a VISITOR's strip is — the action
 * hands them no other kind. It makes no difference to the author's strip, which
 * is shown both.
 */
const preset = (id: string, title: string | null, colors: string[]) => ({
  id,
  title,
  untitledIndex: title ? null : 1,
  shaderId: "cosmicTrack" as const,
  settings: { ...settingsFor("cosmicTrack"), colors },
  publishedAt: new Date("2026-01-01"),
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

    signedIn();
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

  // The author's blank draft is theirs to keep: they arrived to make a new
  // cover, and they have both a shader picker and an add tile to do it with.
  // Opening them on their newest cover instead would take that away.
  it("leaves the author's blank draft alone", async () => {
    (getCovers as Mock).mockResolvedValue([preset("c", "Newest", ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    await screen.findByRole("button", { name: "Newest" });
    expect(useCoverDraftStore.getState().coverId).toBeNull();
    expect(path()).toBe("/playground/cover");
  });

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
        publishedAt: null,
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
      publishedAt: null,
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
  // Opening one no longer asks, and that is the point of the strip: the draft
  // you were tuning is SET ASIDE rather than thrown away, so a preset can be
  // opened to look at while another is in progress. The question survives on
  // the way out of the editor, where work actually goes missing.
  it("opens a preset over unsaved work without asking", async () => {
    const user = userEvent.setup();
    (getCovers as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    useCoverDraftStore.getState().setParam("rampLength", 4);
    await user.click(await screen.findByRole("button", { name: "Dusk" }));

    expect(asking()).toBe(false);
    expect(useCoverDraftStore.getState().coverId).toBe("a");
    expect(path()).toBe("/playground/cover/a");
  });

  it("hands the work back when the draft is taken up again", async () => {
    const user = userEvent.setup();
    (getCovers as Mock).mockResolvedValue([
      preset("a", "Dusk", ["#FFFFFFFF"]),
      preset("b", "Dawn", ["#000000FF"]),
    ]);
    render(<PresetsPane />);

    await user.click(await screen.findByRole("button", { name: "Dusk" }));
    useCoverDraftStore.getState().setParam("rampLength", 4);
    await user.click(screen.getByRole("button", { name: "Dawn" }));
    await user.click(screen.getByRole("button", { name: "Dusk" }));

    expect(useCoverDraftStore.getState().settings.params.rampLength).toBe(4);
    expect(useCoverDraftStore.getState().isDirty).toBe(true);
  });

  // --- What the tiles mark --------------------------------------------------

  /** Whether a tile carries the unsaved mark. */
  const marked = (label: string) =>
    !!screen
      .getByRole("button", { name: label })
      .parentElement?.querySelector("[data-unsaved]");

  it("marks a preset holding work you cannot see", async () => {
    const user = userEvent.setup();
    (getCovers as Mock).mockResolvedValue([
      preset("a", "Dusk", ["#FFFFFFFF"]),
      preset("b", "Dawn", ["#000000FF"]),
    ]);
    render(<PresetsPane />);

    await user.click(await screen.findByRole("button", { name: "Dusk" }));
    useCoverDraftStore.getState().setParam("rampLength", 4);
    await user.click(screen.getByRole("button", { name: "Dawn" }));

    expect(marked("Dusk")).toBe(true);
    expect(marked("Dawn")).toBe(false);
  });

  it("marks the preset on screen once it is touched", async () => {
    const user = userEvent.setup();
    (getCovers as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    await user.click(await screen.findByRole("button", { name: "Dusk" }));
    expect(marked("Dusk")).toBe(false);

    await act(async () => {
      useCoverDraftStore.getState().setParam("rampLength", 4);
    });
    expect(marked("Dusk")).toBe(true);
  });

  // --- The never-saved draft ------------------------------------------------
  //
  // It has no row and so no id, but it is as openable as any preset — and
  // without a tile, work tuned before the first save would be the one thing the
  // strip could not give back.
  it("gives the unsaved new draft a tile of its own, marked", async () => {
    (getCovers as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);
    await screen.findByRole("button", { name: "Dusk" });

    expect(screen.queryByRole("button", { name: "Unsaved draft" })).toBeNull();

    await act(async () => {
      useCoverDraftStore.getState().setParam("rampLength", 4);
    });
    expect(marked("Unsaved draft")).toBe(true);
  });

  it("takes the new draft back up, with its work", async () => {
    const user = userEvent.setup();
    (getCovers as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);
    await screen.findByRole("button", { name: "Dusk" });

    await act(async () => {
      useCoverDraftStore.getState().setParam("rampLength", 4);
    });
    await user.click(screen.getByRole("button", { name: "Dusk" }));
    await user.click(screen.getByRole("button", { name: "Unsaved draft" }));

    expect(useCoverDraftStore.getState().coverId).toBeNull();
    expect(useCoverDraftStore.getState().settings.params.rampLength).toBe(4);
    expect(path()).toBe("/playground/cover");
  });

  // --- Signed out -----------------------------------------------------------
  //
  // The playground is public and so is the strip. What a visitor gets is the
  // PUBLISHED library — `getCovers` is the one that decides that, and is
  // already mocked here, so what these pin is the half this component owns: the
  // add tile is the author's, and a strip with nothing in it is no strip.
  describe("for a visitor", () => {
    beforeEach(signedOut);

    it("offers no way to add one", async () => {
      (getCovers as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
      render(<PresetsPane />);

      await screen.findByRole("button", { name: "Dusk" });
      expect(screen.queryByRole("button", { name: "New preset" })).toBeNull();
    });

    // Opening one is the same act it is for the author: the cover lands in the
    // draft and every control on the page is theirs to push around. What is
    // missing is only the writing.
    it("still opens a preset into the draft", async () => {
      const user = userEvent.setup();
      (getCovers as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
      render(<PresetsPane />);

      await user.click(await screen.findByRole("button", { name: "Dusk" }));

      expect(useCoverDraftStore.getState().coverId).toBe("a");
      expect(path()).toBe("/playground/cover/a");
    });

    // What a visitor ARRIVES on. They cannot pick a shader and cannot save one,
    // so a blank draft is not a starting point for them — it is a cover nobody
    // published, sitting above a strip whose one tile reads as unselected. The
    // newest published cover is the only honest thing to open on.
    it("opens on the newest published cover", async () => {
      (getCovers as Mock).mockResolvedValue([
        preset("c", "Newest", ["#FFFFFFFF"]),
        preset("a", "Oldest", ["#FF0000FF"]),
      ]);
      render(<PresetsPane />);

      await waitFor(() =>
        expect(useCoverDraftStore.getState().coverId).toBe("c"),
      );
      // The same act as pressing the tile, which is what makes the tile read as
      // the one open rather than leaving the strip looking untouched.
      expect(
        (await screen.findByRole("button", { name: "Newest" })).getAttribute(
          "aria-current",
        ),
      ).toBe("true");
      expect(path()).toBe("/playground/cover/c");
      expect(useCoverDraftStore.getState().isDirty).toBe(false);
    });

    // The route already handed the playground a cover, so there is nothing to
    // choose — arriving at `/playground/cover/<id>` must not be redirected to
    // whatever happens to be newest.
    it("leaves a cover the route was opened on alone", async () => {
      (getCovers as Mock).mockResolvedValue([preset("c", "Newest", ["#FFFFFFFF"])]);
      useCoverDraftStore.getState().load({
        id: "a",
        title: "Oldest",
        shaderId: "cosmicTrack",
        settings: settingsFor("cosmicTrack"),
        publishedAt: new Date("2026-01-01"),
      });
      render(<PresetsPane />);

      await waitFor(() => expect(getCovers).toHaveBeenCalled());
      expect(useCoverDraftStore.getState().coverId).toBe("a");
    });

    // No library, so no bar: the author always has the add tile and so always
    // has a strip, but a rounded strip holding nothing is chrome describing an
    // absence — and the page reserves its band off whether one was drawn.
    it("draws no strip at all when nothing has been published", async () => {
      const { container } = render(<PresetsPane />);

      await waitFor(() => expect(getCovers).toHaveBeenCalled());
      expect(screen.queryByRole("group", { name: "Presets" })).toBeNull();
      expect(container.querySelector("[data-presets]")).toBeNull();
    });
  });
});
