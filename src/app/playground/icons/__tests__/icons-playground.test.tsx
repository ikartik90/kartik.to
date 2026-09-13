// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { iconTitleFrom, type IconAsset } from "@/domain/icon";

// The set's server side, which reaches a bucket. What is under test is the
// page over it: what it draws, what it lets you choose, and what it hands
// back.
const mockListIcons = vi.fn();
const mockCreateIconUploadUrl = vi.fn();
const mockFinalizeIconUpload = vi.fn();
const mockSetIconReview = vi.fn();
const mockDeleteIcon = vi.fn();
const mockSetIconLabels = vi.fn();

vi.mock("@/app/actions/icon-set", () => ({
  listIcons: () => mockListIcons(),
  createIconUploadUrl: (...args: unknown[]) => mockCreateIconUploadUrl(...args),
  finalizeIconUpload: (...args: unknown[]) => mockFinalizeIconUpload(...args),
  setIconReview: (...args: unknown[]) => mockSetIconReview(...args),
  deleteIcon: (...args: unknown[]) => mockDeleteIcon(...args),
  setIconLabels: (...args: unknown[]) => mockSetIconLabels(...args),
}));

const mockUseSession = vi.fn().mockReturnValue({ data: null });
vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
});

const { IconsPlayground } = await import("../icons-playground");

const CHECK = `<svg viewBox="0 0 20 20" fill="none"><path d="M4 10L9 15L16 5" stroke="white" stroke-width="1.25"/></svg>`;
const CLOSE = `<svg viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12" stroke="#000" stroke-width="1"/></svg>`;
const SOLID = `<svg viewBox="0 0 20 20"><path d="M4 10L9 15L16 5L15 4Z" fill="#000"/></svg>`;

const SOURCES: Record<string, string> = {
  "https://cdn.example.com/icons/check.svg": CHECK,
  "https://cdn.example.com/icons/close.svg": CLOSE,
  "https://cdn.example.com/icons/solid.svg": SOLID,
  "https://cdn.example.com/icons/chevron-down.svg": CHECK,
};

function asset(
  name: string,
  native: number,
  review: IconAsset["review"] = "approved",
  aliases: string[] = [],
): IconAsset {
  return {
    key: `icons/${name}`,
    url: `https://cdn.example.com/icons/${name}`,
    name,
    native,
    flattened: review === "held",
    review,
    title: iconTitleFrom(name),
    aliases,
  };
}

const signedIn = () =>
  mockUseSession.mockReturnValue({ data: { user: { email: "a@b.c" } } });

// jsdom implements neither, and the delete question is a native <dialog>.
// The stubs mirror the platform: `close()` fires the `close` event `Dialog`
// maps `onClose` to, and `showModal()` throws on an already-open dialog.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    if (this.open) throw new DOMException("Already open", "InvalidStateError");
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });

  vi.clearAllMocks();
  mockUseSession.mockReturnValue({ data: null });
  mockListIcons.mockResolvedValue([asset("check.svg", 20), asset("close.svg", 16)]);

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(SOURCES[url] ?? ""),
      }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Render, and wait for the listing AND the files behind it to land — however
 * many the listing was mocked to hand back, since a test that set up three
 * icons would otherwise race the third one's fetch.
 */
async function open() {
  render(<IconsPlayground />);
  await waitFor(() => expect(screen.getAllByRole("button", { pressed: false }).length)
    .toBeGreaterThan(0));
  // Every tile carrying its drawing — however many the listing held. The
  // sheet is behind the preloader until the last file lands, so tiles at all
  // means files, and counting them beats hard-coding a number each fixture
  // would have to keep in step with.
  await waitFor(() => {
    const tiles = document.querySelectorAll("[data-icon-tile]").length;
    expect(tiles).toBeGreaterThan(0);
    expect(document.querySelectorAll("[data-icon-drawing]").length).toBe(tiles);
  });
}

/** The drawing inside one tile, by the icon's name. */
function drawing(name: string): SVGSVGElement {
  const tile = screen.getByRole("button", { name: new RegExp(`^${name}`) });
  const svg = tile.querySelector("[data-icon-drawing]");
  if (!svg) throw new Error(`${name} has no drawing`);
  return svg as unknown as SVGSVGElement;
}

describe("the grid", () => {
  it("draws every icon the set came back with", async () => {
    await open();
    expect(screen.getByRole("button", { name: /^check\.svg/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^close\.svg/ })).toBeTruthy();
  });

  it("is a sheet of marks, not a list of files — no name is printed", async () => {
    await open();
    // The name is on the tile for anyone who cannot see the drawing, and
    // nowhere on screen: a caption under each icon spaced the grid by the
    // longest filename in it.
    expect(screen.queryByText("check.svg")).toBeNull();
    expect(screen.getByRole("button", { name: "check.svg, 20 grid" })).toBeTruthy();
  });

  it("says which grid each was drawn on, for a reader who cannot see it", async () => {
    await open();
    expect(
      screen.getByRole("button", { name: "close.svg, 16 grid" }),
    ).toBeTruthy();
  });

  it("shows both halves of the set in one box, at one weight", async () => {
    await open();

    // The default is 20 at 1.25. A 20-grid icon carries that in its own
    // units; a 16-grid icon carries 1, which is the SAME line once its
    // smaller box is drawn at 20.
    expect(drawing("check.svg").getAttribute("width")).toBe("20");
    expect(drawing("close.svg").getAttribute("width")).toBe("20");
    expect(drawing("check.svg").getAttribute("viewBox")).toBe("0 0 20 20");
    expect(drawing("close.svg").getAttribute("viewBox")).toBe("0 0 16 16");

    expect(
      drawing("check.svg").querySelector("path")?.getAttribute("stroke-width"),
    ).toBe("1.25");
    expect(
      drawing("close.svg").querySelector("path")?.getAttribute("stroke-width"),
    ).toBe("1");
  });

  it("hands the icons' colour to the page, so both themes can draw them", async () => {
    await open();
    expect(
      drawing("check.svg").querySelector("path")?.getAttribute("stroke"),
    ).toBe("currentColor");
  });
});

describe("the size and weight controls", () => {
  it("redraws the set in a bigger box", async () => {
    await open();

    const size = screen.getByRole("slider", { name: "Size" });
    size.focus();
    await userEvent.keyboard("{ArrowRight}");

    await waitFor(() => expect(drawing("check.svg").getAttribute("width")).toBe("24"));
    expect(drawing("close.svg").getAttribute("width")).toBe("24");
  });

  it("re-weights the line without touching the box", async () => {
    await open();

    const stroke = screen.getByRole("slider", { name: "Stroke" });
    stroke.focus();
    await userEvent.keyboard("{ArrowRight}");

    // 1.5px in a 20px box is 1.5 units on a 20 grid, and 1.2 on a 16 one.
    await waitFor(() =>
      expect(
        drawing("check.svg").querySelector("path")?.getAttribute("stroke-width"),
      ).toBe("1.5"),
    );
    expect(
      drawing("close.svg").querySelector("path")?.getAttribute("stroke-width"),
    ).toBe("1.2");
    expect(drawing("check.svg").getAttribute("width")).toBe("20");
  });

  it("magnifies the icon and its line together", async () => {
    await open();

    const zoom = screen.getByRole("slider", { name: "Zoom" });
    zoom.focus();
    await userEvent.keyboard("{ArrowRight}");

    // Half a multiple up, and the same units — which at 1.5x is a line half
    // again as thick. A magnifying glass, not a bigger icon.
    await waitFor(() => expect(drawing("check.svg").getAttribute("width")).toBe("30"));
    expect(
      drawing("check.svg").querySelector("path")?.getAttribute("stroke-width"),
    ).toBe("1.25");
  });

  it("keeps the zoom apart from the icon's own two properties", async () => {
    // The zoom is a magnifying glass: it multiplies what is drawn and changes
    // nothing a download would contain. Standing it among size and stroke
    // said the opposite, so it has a section that names what it acts on.
    await open();

    const preview = screen.getByRole("group", { name: "Preview" });
    expect(within(preview).getByRole("slider", { name: "Zoom" })).toBeTruthy();

    const icon = screen.getByRole("group", { name: "Icon" });
    expect(within(icon).getByRole("slider", { name: "Size" })).toBeTruthy();
    expect(within(icon).getByRole("slider", { name: "Stroke" })).toBeTruthy();
    expect(within(icon).queryByRole("slider", { name: "Zoom" })).toBeNull();
  });
});

describe("the selection", () => {
  it("takes the whole set when nothing is chosen", async () => {
    await open();
    expect(screen.getByRole("button", { name: "Download all" })).toBeTruthy();
  });

  it("names what it would take once something is", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));

    expect(screen.getByRole("button", { name: "Download 1" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^check\.svg/ }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("lets an icon go again, with the modifier that adds one", async () => {
    // A plain press means "this one", so pressing a taken icon leaves it
    // taken. Shift is the one that works both ways.
    await open();
    const tile = screen.getByRole("button", { name: /^check\.svg/ });

    await userEvent.click(tile);
    expect(screen.getByRole("button", { name: "Download 1" })).toBeTruthy();

    fireEvent.click(tile, { shiftKey: true });
    expect(screen.getByRole("button", { name: "Download all" })).toBeTruthy();
  });

  it("is emptied by pressing a taken icon again, with no Clear button to do it", async () => {
    // Pressing a mark to unmark it is what a hand tries first, so the panel
    // carries no Clear: a control that spends most of its life disabled is a
    // row of nothing. A plain press toggles the icon it lands on and lets go
    // of the rest, which empties the selection whatever it held.
    await open();
    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));
    fireEvent.click(screen.getByRole("button", { name: /^close\.svg/ }), {
      shiftKey: true,
    });
    expect(screen.getByRole("button", { name: "Download 2" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: /^close\.svg/ }));
    expect(screen.getByRole("button", { name: "Download all" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("counts the set beside the download", async () => {
    await open();
    expect(screen.getByText("2 icons")).toBeTruthy();
  });
});

describe("the search bar", () => {
  beforeEach(() => {
    mockListIcons.mockResolvedValue([
      asset("check.svg", 20),
      asset("close.svg", 16),
      asset("chevron-down.svg", 20),
    ]);
  });

  const search = () => screen.getByRole("searchbox", { name: "Search icons by name" });

  it("finds an icon by a word that is nowhere in its filename", async () => {
    // What an alias is FOR: nothing is called `caret`, and typing it should
    // still find the chevron. Two icons may answer to one word — that is the
    // whole point of a tag — so both come back.
    mockListIcons.mockResolvedValue([
      asset("check.svg", 20, "approved", ["Tick"]),
      asset("close.svg", 16, "approved", ["Dismiss", "Cross"]),
      asset("chevron-down.svg", 20, "approved", ["Caret", "Dismiss"]),
    ]);
    await open();

    await userEvent.type(search(), "caret");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^check\.svg/ })).toBeNull(),
    );
    expect(screen.getByRole("button", { name: /^chevron-down\.svg/ })).toBeTruthy();

    await userEvent.clear(search());
    await userEvent.type(search(), "dismiss");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^check\.svg/ })).toBeNull(),
    );
    expect(screen.getByRole("button", { name: /^close\.svg/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^chevron-down\.svg/ })).toBeTruthy();
  });

  it("narrows the grid to what was typed", async () => {
    render(<IconsPlayground />);
    await waitFor(() =>
      expect(document.querySelectorAll("[data-icon-drawing]").length).toBe(3),
    );

    await userEvent.type(search(), "chev");

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^check\.svg/ })).toBeNull(),
    );
    expect(screen.getByRole("button", { name: /^chevron-down\.svg/ })).toBeTruthy();
  });

  it("says how much of the set is left, and takes that much", async () => {
    render(<IconsPlayground />);
    await waitFor(() =>
      expect(document.querySelectorAll("[data-icon-drawing]").length).toBe(3),
    );

    await userEvent.type(search(), "ch");
    // check.svg and chevron-down.svg, not close.svg.
    await waitFor(() => expect(screen.getByText("2 of 3")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Download 2" })).toBeTruthy();
  });

  it("says which query found nothing, rather than that the set is empty", async () => {
    render(<IconsPlayground />);
    await waitFor(() =>
      expect(document.querySelectorAll("[data-icon-drawing]").length).toBe(3),
    );

    await userEvent.type(search(), "sprocket");

    expect(await screen.findByText(/Nothing matches .sprocket./)).toBeTruthy();
    // And the box survives, or there would be no way to undo the query.
    expect(search()).toBeTruthy();
  });

  it("says how to take more than one icon, above the box", async () => {
    // The two gestures are invisible until you know them, and a sheet of two
    // hundred marks is exactly where you want them. Standing in the bar's
    // own second row rather than floating over the grid, so it is part of
    // the instrument rather than something to dismiss.
    render(<IconsPlayground />);
    const key = await screen.findByText("Shift");

    // Drawn as the key itself — the chip the palette's `Esc` wears — rather
    // than as the word "Shift" in the middle of a sentence.
    expect(key.tagName).toBe("KBD");
    expect(key.parentElement?.textContent).toBe(
      "Hold Shift or drag to select multiple icons",
    );
  });

  it("keeps a selection gathered across two searches", async () => {
    render(<IconsPlayground />);
    await waitFor(() =>
      expect(document.querySelectorAll("[data-icon-drawing]").length).toBe(3),
    );

    await userEvent.type(search(), "chevron");
    await userEvent.click(await screen.findByRole("button", { name: /^chevron-down/ }));

    await userEvent.clear(search());
    await userEvent.type(search(), "close");
    fireEvent.click(await screen.findByRole("button", { name: /^close\.svg/ }), {
      shiftKey: true,
    });

    // Both, though neither search had the other in it.
    expect(screen.getByRole("button", { name: "Download 2" })).toBeTruthy();
  });
});

describe("what a visitor is shown", () => {
  it("is offered nothing that writes to the set", async () => {
    await open();
    expect(screen.queryByRole("button", { name: "Add icons" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Publish/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();

    // Taking a copy is not writing, so that one stays — with or without a
    // selection, which is the only thing a visitor's presses change.
    expect(screen.getByRole("button", { name: "Download all" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));
    expect(screen.getByRole("button", { name: "Download 1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
  });

  it("is not told which icons the author is still reviewing", async () => {
    // The server does not send a visitor a held icon at all; nothing on the
    // page marks one either, so a held icon that slipped through would still
    // not be advertised as held.
    mockListIcons.mockResolvedValue([asset("check.svg", 20), asset("solid.svg", 20, "held")]);
    await open();

    expect(document.querySelector("[data-held]")).toBeNull();
  });
});

describe("what the author is shown", () => {
  beforeEach(() => {
    signedIn();
    mockListIcons.mockResolvedValue([
      asset("check.svg", 20),
      asset("solid.svg", 20, "held"),
    ]);
  });

  it("marks the icons that are waiting on them", async () => {
    await open();

    const tile = screen.getByRole("button", {
      name: "solid.svg, 20 grid, held for review",
    });
    expect(tile.hasAttribute("data-held")).toBe(true);
    expect(screen.getByText("2 icons · 1 held")).toBeTruthy();
  });

  it("shows only the actions that would do something", async () => {
    // No chip is ever drawn inert. Adding acts on the set, so it stands on
    // the heading strip whatever is selected; the rest act on the selection
    // and stand against the line that names it, appearing as that line comes
    // to mean something they could be pressed for.
    await open();

    const actions = screen
      .getByText("Actions")
      .closest("section") as HTMLElement;
    const chip = (name: string) =>
      within(actions).queryByRole("button", { name });

    // Nothing taken: the count of the set, and the one press that acts on it.
    expect(within(actions).getByText("2 icons · 1 held")).toBeTruthy();
    expect(chip("Add icons")).toBeTruthy();
    expect(chip("Download all")).toBeTruthy();
    expect(chip("Publish 1")).toBeNull();
    expect(chip("Delete 1")).toBeNull();

    // An approved icon: nothing to publish, something to delete.
    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));
    expect(within(actions).getByText("1 icon selected")).toBeTruthy();
    expect(chip("Download 1")).toBeTruthy();
    expect(chip("Delete 1")).toBeTruthy();
    expect(chip("Publish 1")).toBeNull();

    // A held one: publishing now has something to move.
    fireEvent.click(screen.getByRole("button", { name: /^solid\.svg/ }), {
      shiftKey: true,
    });
    expect(within(actions).getByText("2 icons selected")).toBeTruthy();
    expect(chip("Publish 1")).toBeTruthy();
    expect(chip("Delete 2")).toBeTruthy();
  });

  it("names one icon at a time, and only when exactly one is taken", async () => {
    // The name and the aliases are an ICON's, and the sidebar is the page's,
    // so the section is rendered only when there is exactly one icon for it
    // to be about — never disabled, never showing one icon's name over five.
    await open();
    expect(screen.queryByRole("textbox", { name: "Icon name" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));
    const name = screen.getByRole("textbox", { name: "Icon name" });
    // Filled from the filename until somebody types otherwise: no extension,
    // no hyphens, capitalised.
    expect((name as HTMLInputElement).value).toBe("Check");

    fireEvent.click(screen.getByRole("button", { name: /^solid\.svg/ }), {
      shiftKey: true,
    });
    expect(screen.queryByRole("textbox", { name: "Icon name" })).toBeNull();
  });

  it("opens a row for another alias, and stores it when the field is left", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));

    // Nothing is stored while it is being typed — a write a keystroke would
    // be two hundred writes for a word.
    await userEvent.click(screen.getByRole("button", { name: "Add alias" }));
    const alias = screen.getByRole("textbox", { name: "Alias 1" });
    await userEvent.type(alias, "Tick");
    expect(mockSetIconLabels).not.toHaveBeenCalled();

    fireEvent.blur(alias);
    await waitFor(() =>
      expect(mockSetIconLabels).toHaveBeenCalledWith({
        key: "icons/check.svg",
        title: "Check",
        aliases: ["Tick"],
      }),
    );

    // And a second press opens a second row, empty, beside the first.
    await userEvent.click(screen.getByRole("button", { name: "Add alias" }));
    expect(
      (screen.getByRole("textbox", { name: "Alias 1" }) as HTMLInputElement).value,
    ).toBe("Tick");
    expect(
      (screen.getByRole("textbox", { name: "Alias 2" }) as HTMLInputElement).value,
    ).toBe("");
  });

  it("takes an alias back out", async () => {
    mockListIcons.mockResolvedValue([
      asset("check.svg", 20, "approved", ["Tick", "Done"]),
      asset("solid.svg", 20, "held"),
    ]);
    await open();
    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));

    await userEvent.click(screen.getByRole("button", { name: "Remove alias 1" }));

    await waitFor(() =>
      expect(mockSetIconLabels).toHaveBeenCalledWith({
        key: "icons/check.svg",
        title: "Check",
        aliases: ["Done"],
      }),
    );
  });

  it("renames the icon, which is what the tooltip then says", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));

    const name = screen.getByRole("textbox", { name: "Icon name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Tick");
    fireEvent.blur(name);

    await waitFor(() =>
      expect(mockSetIconLabels).toHaveBeenCalledWith({
        key: "icons/check.svg",
        title: "Tick",
        aliases: [],
      }),
    );
  });

  it("publishes only the held ones in the selection", async () => {
    await open();

    // There is no Publish to press until something held is chosen — an
    // approved icon on its own leaves the chip away rather than greyed.
    expect(screen.queryByRole("button", { name: /^Publish/ })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));
    expect(screen.queryByRole("button", { name: /^Publish/ })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /^solid\.svg/ }));
    await userEvent.click(screen.getByRole("button", { name: "Publish 1" }));

    await waitFor(() =>
      expect(mockSetIconReview).toHaveBeenCalledWith({
        key: "icons/solid.svg",
        review: "approved",
      }),
    );
    expect(mockSetIconReview).toHaveBeenCalledTimes(1);
  });

  it("asks before deleting, and deletes the selection when answered", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete 1" }));

    const dialog = await screen.findByRole("dialog", { name: /Delete Icon/i });
    expect(within(dialog).getByText(/check\.svg/)).toBeTruthy();
    expect(mockDeleteIcon).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(mockDeleteIcon).toHaveBeenCalledWith({ key: "icons/check.svg" }),
    );
  });

  it("refuses a file that is not a square SVG, and says so", async () => {
    await open();

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    const notAnIcon = new File(["<html>nope</html>"], "poster.svg", {
      type: "image/svg+xml",
    });

    await userEvent.upload(input!, notAnIcon);

    expect(await screen.findByText(/poster\.svg is not a square SVG icon/)).toBeTruthy();
    expect(mockCreateIconUploadUrl).not.toHaveBeenCalled();
  });

  it("measures an upload and stamps it onto the stored object", async () => {
    mockCreateIconUploadUrl.mockResolvedValue({
      uploadUrl: "https://upload.example.com/put",
      publicUrl: "https://cdn.example.com/icons/new.svg",
      key: "icons/new.svg",
    });
    await open();

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    await userEvent.upload(
      input!,
      new File([SOLID], "solid-mark.svg", { type: "image/svg+xml" }),
    );

    // The signature carries the name and the size, because that is all a
    // presigned PUT can carry — R2 discards metadata hoisted into its query.
    await waitFor(() =>
      expect(mockCreateIconUploadUrl).toHaveBeenCalledWith({
        filename: "solid-mark.svg",
        size: SOLID.length,
      }),
    );

    // The measurements follow the bytes. Flattened, and so held — which the
    // server decides, but the client has to report honestly for it to decide.
    await waitFor(() =>
      expect(mockFinalizeIconUpload).toHaveBeenCalledWith({
        key: "icons/new.svg",
        native: 20,
        flattened: true,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// The label that names whichever icon you are pointing at.
//
// One tooltip for the whole grid, in two places: at the cursor for an icon you
// are merely looking at, and hung under an icon you have TAKEN — where the
// brand wash has already said which tile is meant, so a label chasing the
// pointer would be answering that question a second time and in the wrong
// place.
// ---------------------------------------------------------------------------

describe("the icon's label", () => {
  /** The tooltip box, found through the text it carries. */
  const box = (label: string) =>
    screen.getByText(label).parentElement as HTMLElement;

  const tile = (name: string) =>
    screen.getByRole("button", { name: new RegExp(`^${name}`) });

  /** jsdom measures nothing, so the tile has to say where it is. */
  function standAt(
    element: HTMLElement,
    rect: { left: number; width: number; bottom: number },
  ) {
    element.getBoundingClientRect = () =>
      ({
        ...rect,
        right: rect.left + rect.width,
        top: rect.bottom - 40,
        height: 40,
      }) as DOMRect;
  }

  it("names the icon under the pointer by what it is CALLED", async () => {
    await open();

    fireEvent.pointerEnter(tile("check.svg"), {
      pointerType: "mouse",
      clientX: 100,
      clientY: 200,
    });

    // The icon's name, which until somebody types another one is its filename
    // read as words: no extension, no hyphens, capitalised.
    expect(box("Check").hasAttribute("data-visible")).toBe(true);
    expect(screen.queryByText("check.svg")).toBeNull();
  });

  it("says the name the author gave it, once there is one", async () => {
    mockListIcons.mockResolvedValue([
      { ...asset("check.svg", 20), title: "Tick" },
    ]);
    await open();

    fireEvent.pointerEnter(tile("check.svg"), {
      pointerType: "mouse",
      clientX: 100,
      clientY: 200,
    });

    expect(box("Tick").hasAttribute("data-visible")).toBe(true);
  });

  it("puts it away when the pointer leaves", async () => {
    await open();
    const target = tile("check.svg");

    fireEvent.pointerEnter(target, {
      pointerType: "mouse",
      clientX: 100,
      clientY: 200,
    });
    fireEvent.pointerLeave(target, { pointerType: "mouse" });

    // The text stays while it fades — cleared, the box would empty and
    // collapse in front of you rather than dissolve.
    expect(box("Check").hasAttribute("data-visible")).toBe(false);
  });

  it("trails the cursor for an icon that is merely hovered", async () => {
    await open();

    fireEvent.pointerEnter(tile("check.svg"), {
      pointerType: "mouse",
      clientX: 100,
      clientY: 200,
    });

    // CURSOR_TOOLTIP_OFFSET = { x: 15, y: 17 }.
    expect(box("Check").style.left).toBe("115px");
    expect(box("Check").style.top).toBe("217px");
  });

  it("hangs it two pixels under an icon that is selected", async () => {
    await open();
    const target = tile("check.svg");
    standAt(target, { left: 100, width: 60, bottom: 300 });

    await userEvent.click(target);
    fireEvent.pointerEnter(target, {
      pointerType: "mouse",
      clientX: 100,
      clientY: 200,
    });

    // Centred on the tile, and clear of it by ANCHORED_TOOLTIP_GAP — nowhere
    // near the cursor's own 217px.
    expect(box("Check").style.top).toBe("302px");
    expect(box("Check").style.left).toBe("130px");
  });

  it("moves under the icon the moment it is taken, not on the next hover", async () => {
    await open();
    const target = tile("check.svg");
    standAt(target, { left: 100, width: 60, bottom: 300 });

    fireEvent.pointerEnter(target, {
      pointerType: "mouse",
      clientX: 100,
      clientY: 200,
    });
    expect(box("Check").style.top).toBe("217px");

    await userEvent.click(target);

    expect(box("Check").style.top).toBe("302px");
  });

  // A browser draws its OWN hint from `aria-label` on a control with no
  // visible text, which lands next to ours saying the same thing twice — and
  // there is no way to turn that off from CSS or from an attribute. So the
  // name is hidden TEXT instead: same accessible name, read from content
  // rather than an attribute, and nothing for the browser to volunteer.
  it("names itself in hidden text, not an attribute a browser will draw", async () => {
    await open();
    const target = tile("check.svg");

    expect(target.hasAttribute("aria-label")).toBe(false);
    expect(target.hasAttribute("title")).toBe(false);
    // Still the same name, which is what the queries above are matching on.
    expect(target.textContent).toBe("check.svg, 20 grid");
  });

  it("stays down for a finger, which has no cursor to label", async () => {
    await open();

    fireEvent.pointerEnter(tile("check.svg"), {
      pointerType: "touch",
      clientX: 100,
      clientY: 200,
    });

    expect(screen.queryByText("Check")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Taking icons.
//
// A press takes ONE and lets go of the rest — the sheet runs to a couple of
// hundred marks and the common thing is looking at a single one, so a
// selection that only ever grew meant emptying it by hand before every
// comparison. Shift adds, and a drag sweeps a band across as many as it
// touches.
// ---------------------------------------------------------------------------

describe("taking icons", () => {
  const tile = (name: string) =>
    screen.getByRole("button", { name: new RegExp(`^${name}`) });

  const taken = () =>
    screen
      .queryAllByRole("button", { pressed: true })
      .map((el) => el.textContent?.split(",")[0]);

  const sheet = () =>
    document.querySelector("[data-icon-sheet]") as HTMLElement;

  /**
   * Lay the two tiles out side by side, since jsdom measures everything as
   * zero and a band cannot touch a box with no size.
   */
  function layOut() {
    const boxes: Record<string, [number, number, number, number]> = {
      "check.svg": [0, 0, 100, 100],
      "close.svg": [110, 0, 210, 100],
    };
    sheet().getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 400, bottom: 300 }) as DOMRect;
    for (const [name, [left, top, right, bottom]] of Object.entries(boxes)) {
      tile(name).getBoundingClientRect = () =>
        ({
          left,
          top,
          right,
          bottom,
          width: right - left,
          height: bottom - top,
        }) as DOMRect;
    }
  }

  const sweep = (from: [number, number], to: [number, number], shiftKey = false) => {
    const target = sheet();
    fireEvent.pointerDown(target, {
      pointerType: "mouse",
      button: 0,
      isPrimary: true,
      clientX: from[0],
      clientY: from[1],
      shiftKey,
    });
    fireEvent.pointerMove(target, { clientX: to[0], clientY: to[1] });
    fireEvent.pointerUp(target, { clientX: to[0], clientY: to[1] });
  };

  it("takes one icon and lets go of the last", async () => {
    await open();

    await userEvent.click(tile("check.svg"));
    expect(taken()).toEqual(["check.svg"]);

    await userEvent.click(tile("close.svg"));
    expect(taken()).toEqual(["close.svg"]);
  });

  it("keeps both when the press is shifted", async () => {
    await open();

    await userEvent.click(tile("check.svg"));
    fireEvent.click(tile("close.svg"), { shiftKey: true });

    expect(taken()).toEqual(["check.svg", "close.svg"]);
  });

  it("puts a taken icon back with a shifted press", async () => {
    await open();

    await userEvent.click(tile("check.svg"));
    fireEvent.click(tile("check.svg"), { shiftKey: true });

    expect(taken()).toEqual([]);
  });

  it("sweeps a band across everything it touches", async () => {
    await open();
    layOut();

    sweep([5, 40], [150, 50]);

    expect(taken()).toEqual(["check.svg", "close.svg"]);
  });

  it("takes its sweep from the whole canvas, not the grid's column", async () => {
    // The band is drawn on the page's own canvas — everything under `main`
    // but the docked panel — rather than on the 960px column the icons lay
    // out in. A sweep therefore starts in the margin beside the grid, or in
    // the room above and below it, which is where a hand reaches to select
    // a set of marks it can see the edge of.
    await open();

    expect(sheet().parentElement?.tagName).toBe("MAIN");
    expect(sheet().querySelector("[data-icon-tile]")).toBeTruthy();
  });

  it("draws the band while the pointer is down, and not after", async () => {
    await open();
    layOut();

    fireEvent.pointerDown(sheet(), {
      pointerType: "mouse",
      button: 0,
      isPrimary: true,
      clientX: 5,
      clientY: 40,
    });
    fireEvent.pointerMove(sheet(), { clientX: 150, clientY: 50 });
    expect(document.querySelector("[data-icon-marquee]")).toBeTruthy();

    fireEvent.pointerUp(sheet(), { clientX: 150, clientY: 50 });
    expect(document.querySelector("[data-icon-marquee]")).toBeNull();
  });

  it("does not let the press that ended a sweep undo it", async () => {
    // The pointer comes up over a tile, and a click follows — which, being a
    // plain press, would take that one icon and drop the rest of the sweep.
    await open();
    layOut();

    sweep([5, 40], [150, 50]);
    fireEvent.click(tile("close.svg"));

    expect(taken()).toEqual(["check.svg", "close.svg"]);
  });

  it("a plain sweep replaces what was held, a shifted one adds to it", async () => {
    await open();
    layOut();

    await userEvent.click(tile("close.svg"));
    // A band over the first icon alone.
    sweep([0, 40], [50, 50]);
    expect(taken()).toEqual(["check.svg"]);

    await userEvent.click(tile("close.svg"));
    sweep([0, 40], [50, 50], true);
    expect(taken()).toEqual(["check.svg", "close.svg"]);
  });

  it("leaves a press that never moved as a press", async () => {
    await open();
    layOut();

    // Down and up on the sheet with a pixel of wobble: still a click, so the
    // tile's own handler decides and the band never appears.
    sweep([5, 40], [7, 41]);

    expect(document.querySelector("[data-icon-marquee]")).toBeNull();
    expect(taken()).toEqual([]);
  });

  it("leaves a finger alone, which is how the page is scrolled", async () => {
    await open();
    layOut();

    fireEvent.pointerDown(sheet(), {
      pointerType: "touch",
      isPrimary: true,
      clientX: 5,
      clientY: 40,
    });
    fireEvent.pointerMove(sheet(), { clientX: 150, clientY: 50 });

    expect(document.querySelector("[data-icon-marquee]")).toBeNull();
    expect(taken()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Waiting.
//
// Three states, and the middle one used to be drawn as the last: an icon whose
// file has not ARRIVED yet is not an icon whose file will not parse. Two
// hundred objects come down one request each, so for a couple of seconds the
// whole sheet was a wall of dashed "broken" boxes.
// ---------------------------------------------------------------------------

describe("while the set is still coming", () => {
  it("waits behind the site's own progress bar", async () => {
    // Held open: the listing never lands, which is the state under test.
    mockListIcons.mockReturnValue(new Promise(() => {}));
    render(<IconsPlayground />);

    // The bar the upload dialog fills and the demos wait behind — not a
    // sentence, and not the wireframe treatment, which is for a shape being
    // presented rather than a thing being fetched.
    const bar = await screen.findByRole("progressbar", { name: "Loading icons" });
    expect(bar).toBeTruthy();
    expect(screen.queryByRole("button", { pressed: false })).toBeNull();
  });

  it("never counts backwards when the listing hands over to the files", async () => {
    // The load is two phases — a listing of unknown length, then a counted
    // set of files — and the bar is ONE scale across both. Read off two, it
    // trickled up while the listing was in flight and then dropped to nothing
    // the moment the counting began, because the first count is zero of two
    // hundred. A progress bar is a promise about direction.
    let land: (icons: IconAsset[]) => void = () => {};
    mockListIcons.mockReturnValue(
      new Promise<IconAsset[]>((resolve) => {
        land = resolve;
      }),
    );
    // No file ever arrives, so the counting phase begins and stays at zero.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    render(<IconsPlayground />);
    const bar = await screen.findByRole("progressbar", { name: "Loading icons" });
    const value = () => Number(bar.getAttribute("aria-valuenow"));

    // Let the listing's trickle get somewhere worth falling from.
    await waitFor(() => expect(value()).toBeGreaterThan(5), { timeout: 3000 });
    const trickled = value();

    land([asset("check.svg", 20), asset("close.svg", 16)]);
    await waitFor(() => expect(mockListIcons).toHaveBeenCalled());
    await waitFor(() => expect(value()).toBeGreaterThanOrEqual(trickled));
  });

  it("counts the files in, rather than guessing at the wait", async () => {
    // The listing answers with two; only one file ever arrives.
    let landed: (value: unknown) => void = () => {};
    const held = new Promise((resolve) => {
      landed = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.endsWith("check.svg")
          ? Promise.resolve({ ok: true, text: () => Promise.resolve(CHECK) })
          : held,
      ),
    );
    render(<IconsPlayground />);

    const bar = await screen.findByRole("progressbar", { name: "Loading icons" });
    // Half the set in hand, on the files' own slice of the bar: the listing
    // has spent its 30, and half of what is left is 35 more.
    await waitFor(() => expect(bar.getAttribute("aria-valuenow")).toBe("65"));

    landed({ ok: true, text: () => Promise.resolve(CLOSE) });
    await waitFor(() =>
      expect(screen.queryByRole("progressbar")).toBeNull(),
    );
    expect(screen.getAllByRole("button", { pressed: false }).length).toBe(2);
  });

  it("marks a file that will not parse, once it has arrived", async () => {
    mockListIcons.mockResolvedValue([asset("nonsense.svg", 20)]);
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: true, text: () => Promise.resolve("<html>not an icon</html>") }),
      ),
    );
    render(<IconsPlayground />);

    const tile = await screen.findByRole("button", { name: /^nonsense\.svg/ });
    await waitFor(() => expect(tile.querySelector("[data-icon-broken]")).toBeTruthy());
  });
});
