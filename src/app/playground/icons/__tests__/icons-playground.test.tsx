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

const { BOTTOM_SHEET_QUERY } = await import("@/data/media-queries");
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

// jsdom lacks `showModal`/`close`; the stubs mirror the platform, `close` event included.
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

/** Renders and waits for the listing and every file, so no test races a fetch. */
async function open() {
  render(<IconsPlayground />);
  await waitFor(() => expect(screen.getAllByRole("button", { pressed: false }).length)
    .toBeGreaterThan(0));
  await waitFor(() => {
    const tiles = document.querySelectorAll("[data-icon-tile]").length;
    expect(tiles).toBeGreaterThan(0);
    expect(document.querySelectorAll("[data-icon-drawing]").length).toBe(tiles);
  });
}

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

    // 1.25px at 20 is 1 unit on a 16 grid.
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

  it("re-weights the line without touching the box, once untied", async () => {
    await open();
    // Size and stroke start locked together.
    await userEvent.click(screen.getByRole("button", { name: "Unlink size and stroke" }));

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

  it("runs the stroke from a whole pixel to four, a quarter at a time", async () => {
    await open();

    const stroke = screen.getByRole("slider", { name: "Stroke" });
    expect(stroke.getAttribute("aria-valuemin")).toBe("1");
    expect(stroke.getAttribute("aria-valuemax")).toBe("4");

    stroke.focus();
    await userEvent.keyboard("{Home}");
    await waitFor(() => expect(stroke.getAttribute("aria-valuenow")).toBe("1"));
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(stroke.getAttribute("aria-valuenow")).toBe("1.25"));
  });

  it("magnifies the icon and its line together", async () => {
    await open();

    const zoom = screen.getByRole("slider", { name: "Zoom" });
    zoom.focus();
    await userEvent.keyboard("{ArrowRight}");

    await waitFor(() => expect(drawing("check.svg").getAttribute("width")).toBe("30"));
    expect(
      drawing("check.svg").querySelector("path")?.getAttribute("stroke-width"),
    ).toBe("1.25");
  });

  it("keeps the zoom apart from the icon's own two properties", async () => {
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
    await open();
    const tile = screen.getByRole("button", { name: /^check\.svg/ });

    await userEvent.click(tile);
    expect(screen.getByRole("button", { name: "Download 1" })).toBeTruthy();

    fireEvent.click(tile, { shiftKey: true });
    expect(screen.getByRole("button", { name: "Download all" })).toBeTruthy();
  });

  it("is emptied by pressing a taken icon again, with no Clear button to do it", async () => {
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

describe("on a phone", () => {
  /** Answer the sheet's own query truthfully, and every other query no. */
  const asPhone = () =>
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === BOTTOM_SHEET_QUERY,
        addEventListener() {},
        removeEventListener() {},
      })),
    );

  const panel = () => screen.queryByRole("dialog", { name: "Icon properties" });
  const dock = () => screen.queryByRole("button", { name: "Icon properties" });

  it("opens with the sheet down, and the way back up in the search box", async () => {
    asPhone();
    await open();

    expect(panel()).toBeNull();

    const box = screen.getByRole("searchbox", { name: "Search icons by name" });
    const row = box.parentElement as HTMLElement;
    expect(within(row).getByRole("button", { name: "Icon properties" })).toBeTruthy();
  });

  it("raises the sheet when it is pressed, and takes the press away with it", async () => {
    asPhone();
    await open();

    await userEvent.click(dock() as HTMLElement);

    expect(panel()).toBeTruthy();
    expect(dock()).toBeNull();
  });

  it("leaves the panel up on a desktop, where it takes nothing from the grid", async () => {
    await open();

    expect(panel()).toBeTruthy();
    expect(dock()).toBeNull();
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
    expect(search()).toBeTruthy();
  });

  it("says how to take more than one icon, above the box", async () => {
    render(<IconsPlayground />);
    const key = await screen.findByText("Shift");

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

    expect(screen.getByRole("button", { name: "Download 2" })).toBeTruthy();
  });
});

describe("what a visitor is shown", () => {
  it("is offered nothing that writes to the set", async () => {
    await open();
    expect(screen.queryByRole("button", { name: "Add icons" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Publish/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();

    expect(screen.getByRole("button", { name: "Download all" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));
    expect(screen.getByRole("button", { name: "Download 1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
  });

  it("is not told which icons the author is still reviewing", async () => {
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
    await open();

    const actions = screen
      .getByText("Actions")
      .closest("section") as HTMLElement;
    const chip = (name: string) =>
      within(actions).queryByRole("button", { name });

    expect(within(actions).getByText("2 icons · 1 held")).toBeTruthy();
    expect(chip("Add icons")).toBeTruthy();
    expect(chip("Download all")).toBeTruthy();
    expect(chip("Publish 1")).toBeNull();
    expect(chip("Delete 1")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));
    expect(within(actions).getByText("1 icon selected")).toBeTruthy();
    expect(chip("Download 1")).toBeTruthy();
    expect(chip("Delete 1")).toBeTruthy();
    expect(chip("Publish 1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^solid\.svg/ }), {
      shiftKey: true,
    });
    expect(within(actions).getByText("2 icons selected")).toBeTruthy();
    expect(chip("Publish 1")).toBeTruthy();
    expect(chip("Delete 2")).toBeTruthy();
  });

  it("offers a name for one icon only, though the aliases go on working", async () => {
    await open();
    expect(screen.queryByRole("textbox", { name: "Icon name" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));
    const name = screen.getByRole("textbox", { name: "Icon name" });
    expect((name as HTMLInputElement).value).toBe("Check");

    fireEvent.click(screen.getByRole("button", { name: /^solid\.svg/ }), {
      shiftKey: true,
    });
    expect(screen.queryByRole("textbox", { name: "Icon name" })).toBeNull();
  });

  it("opens a row for another alias, and stores it when the field is left", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));

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

    await userEvent.click(screen.getByRole("button", { name: "Add alias" }));
    expect(
      (screen.getByRole("textbox", { name: "Alias 1" }) as HTMLInputElement).value,
    ).toBe("Tick");
    expect(
      (screen.getByRole("textbox", { name: "Alias 2" }) as HTMLInputElement).value,
    ).toBe("");
  });

  it("shows only the words a whole selection has in common", async () => {
    mockListIcons.mockResolvedValue([
      asset("check.svg", 20, "approved", ["Tick", "Done", "Yes"]),
      asset("solid.svg", 20, "held", ["tick", "Filled", "yes"]),
    ]);
    await open();

    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));
    fireEvent.click(screen.getByRole("button", { name: /^solid\.svg/ }), {
      shiftKey: true,
    });

    expect(screen.queryByRole("textbox", { name: "Icon name" })).toBeNull();
    expect(
      screen.getAllByRole("textbox", { name: /^Alias / }).map((el) => (el as HTMLInputElement).value),
    ).toEqual(["Tick", "Yes"]);
  });

  it("is a heading and a way to add one when they share no words at all", async () => {
    mockListIcons.mockResolvedValue([
      asset("check.svg", 20, "approved", ["Tick"]),
      asset("solid.svg", 20, "held", ["Filled"]),
    ]);
    await open();

    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));
    fireEvent.click(screen.getByRole("button", { name: /^solid\.svg/ }), {
      shiftKey: true,
    });

    expect(screen.getByRole("button", { name: "Add alias" })).toBeTruthy();
    expect(screen.queryAllByRole("textbox", { name: /^Alias / })).toEqual([]);
    expect(screen.queryByRole("group", { name: "Aliases" })).toBeNull();
  });

  it("adds an alias to every icon in the selection, keeping what each had", async () => {
    mockListIcons.mockResolvedValue([
      asset("check.svg", 20, "approved", ["Tick", "Done"]),
      asset("solid.svg", 20, "held", ["Tick", "Filled"]),
    ]);
    await open();

    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));
    fireEvent.click(screen.getByRole("button", { name: /^solid\.svg/ }), {
      shiftKey: true,
    });

    await userEvent.click(screen.getByRole("button", { name: "Add alias" }));
    const added = screen.getByRole("textbox", { name: "Alias 2" });
    await userEvent.type(added, "Confirm");
    fireEvent.blur(added);

    await waitFor(() =>
      expect(mockSetIconLabels).toHaveBeenCalledWith({
        key: "icons/check.svg",
        title: "Check",
        aliases: ["Tick", "Done", "Confirm"],
      }),
    );
    expect(mockSetIconLabels).toHaveBeenCalledWith({
      key: "icons/solid.svg",
      title: "Solid",
      aliases: ["Tick", "Filled", "Confirm"],
    });
  });

  it("takes a common alias off all of them at once", async () => {
    mockListIcons.mockResolvedValue([
      asset("check.svg", 20, "approved", ["Tick", "Done"]),
      asset("solid.svg", 20, "held", ["Tick", "Filled"]),
    ]);
    await open();

    await userEvent.click(screen.getByRole("button", { name: /^check\.svg/ }));
    fireEvent.click(screen.getByRole("button", { name: /^solid\.svg/ }), {
      shiftKey: true,
    });
    await userEvent.click(screen.getByRole("button", { name: "Remove alias 1" }));

    await waitFor(() =>
      expect(mockSetIconLabels).toHaveBeenCalledWith({
        key: "icons/check.svg",
        title: "Check",
        aliases: ["Done"],
      }),
    );
    expect(mockSetIconLabels).toHaveBeenCalledWith({
      key: "icons/solid.svg",
      title: "Solid",
      aliases: ["Filled"],
    });
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

    await userEvent.click(within(dialog).getByRole("option", { name: "Delete" }));
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

    await waitFor(() =>
      expect(mockCreateIconUploadUrl).toHaveBeenCalledWith({
        filename: "solid-mark.svg",
        size: SOLID.length,
      }),
    );

    await waitFor(() =>
      expect(mockFinalizeIconUpload).toHaveBeenCalledWith({
        key: "icons/new.svg",
        native: 20,
        flattened: true,
      }),
    );
  });
});

describe("the icon's label", () => {
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

    // Centred on the tile, ANCHORED_TOOLTIP_GAP below it.
    await waitFor(() => expect(box("Check").style.top).toBe("302px"));
    expect(box("Check").style.left).toBe("130px");
  });

  it("keeps naming a taken icon once the pointer has gone", async () => {
    await open();
    const target = tile("check.svg");
    standAt(target, { left: 100, width: 60, bottom: 300 });

    await userEvent.click(target);
    fireEvent.pointerLeave(target, { pointerType: "mouse" });

    await waitFor(() => expect(box("Check").hasAttribute("data-visible")).toBe(true));
    expect(box("Check").style.top).toBe("302px");
  });

  it("names every icon in the selection, not just the one under the pointer", async () => {
    await open();
    standAt(tile("check.svg"), { left: 100, width: 60, bottom: 300 });
    standAt(tile("close.svg"), { left: 200, width: 60, bottom: 300 });

    await userEvent.click(tile("check.svg"));
    fireEvent.click(tile("close.svg"), { shiftKey: true });
    fireEvent.pointerLeave(tile("close.svg"), { pointerType: "mouse" });

    await waitFor(() => expect(box("Check").hasAttribute("data-visible")).toBe(true));
    expect(box("Close").hasAttribute("data-visible")).toBe(true);
    expect(box("Check").style.left).toBe("130px");
    expect(box("Close").style.left).toBe("230px");
  });

  it("takes the label away when the icon is let go of", async () => {
    await open();
    const target = tile("check.svg");
    standAt(target, { left: 100, width: 60, bottom: 300 });

    fireEvent.click(target);
    fireEvent.pointerLeave(target, { pointerType: "mouse" });
    await waitFor(() => expect(box("Check").hasAttribute("data-visible")).toBe(true));

    fireEvent.click(target);
    fireEvent.pointerLeave(target, { pointerType: "mouse" });

    await waitFor(() => expect(screen.queryByText("Check")).toBeNull());
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

    await waitFor(() => expect(box("Check").style.top).toBe("302px"));
  });

  it("does not name a hovered icon twice once it is taken", async () => {
    await open();
    const target = tile("check.svg");
    standAt(target, { left: 100, width: 60, bottom: 300 });

    await userEvent.click(target);
    fireEvent.pointerEnter(target, {
      pointerType: "mouse",
      clientX: 100,
      clientY: 200,
    });

    await waitFor(() => expect(screen.getAllByText("Check")).toHaveLength(1));
    expect(box("Check").style.top).toBe("302px");
  });

  it("gives a hovered icon back its cursor label when it is let go of", async () => {
    await open();
    const target = tile("check.svg");
    standAt(target, { left: 100, width: 60, bottom: 300 });

    fireEvent.pointerEnter(target, {
      pointerType: "mouse",
      clientX: 100,
      clientY: 200,
    });
    // `fireEvent`, not `userEvent`: a simulated click moves the pointer to (0, 0).
    fireEvent.click(target);
    await waitFor(() => expect(box("Check").style.top).toBe("302px"));

    fireEvent.click(target);

    await waitFor(() => expect(box("Check").style.top).toBe("217px"));
  });

  it("names itself in hidden text, not an attribute a browser will draw", async () => {
    await open();
    const target = tile("check.svg");

    expect(target.hasAttribute("aria-label")).toBe(false);
    expect(target.hasAttribute("title")).toBe(false);
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

describe("taking icons", () => {
  const tile = (name: string) =>
    screen.getByRole("button", { name: new RegExp(`^${name}`) });

  // Scoped to the tiles: the panel's lock is `aria-pressed` too.
  const taken = () =>
    Array.from(
      document.querySelectorAll('[data-icon-tile][aria-pressed="true"]'),
    ).map((el) => el.textContent?.split(",")[0]);

  const sheet = () =>
    document.querySelector("[data-icon-sheet]") as HTMLElement;

  /** Lays the two tiles side by side: jsdom measures every box as zero. */
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
    sweep([0, 40], [50, 50]);
    expect(taken()).toEqual(["check.svg"]);

    await userEvent.click(tile("close.svg"));
    sweep([0, 40], [50, 50], true);
    expect(taken()).toEqual(["check.svg", "close.svg"]);
  });

  it("leaves a press that never moved as a press", async () => {
    await open();
    layOut();

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

describe("while the set is still coming", () => {
  it("waits behind the site's own progress bar", async () => {
    mockListIcons.mockReturnValue(new Promise(() => {}));
    render(<IconsPlayground />);

    const bar = await screen.findByRole("progressbar", { name: "Loading icons" });
    expect(bar).toBeTruthy();
    expect(screen.queryByRole("button", { pressed: false })).toBeNull();
  });

  it("never counts backwards when the listing hands over to the files", async () => {
    let land: (icons: IconAsset[]) => void = () => {};
    mockListIcons.mockReturnValue(
      new Promise<IconAsset[]>((resolve) => {
        land = resolve;
      }),
    );
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    render(<IconsPlayground />);
    const bar = await screen.findByRole("progressbar", { name: "Loading icons" });
    const value = () => Number(bar.getAttribute("aria-valuenow"));

    await waitFor(() => expect(value()).toBeGreaterThan(5), { timeout: 3000 });
    const trickled = value();

    land([asset("check.svg", 20), asset("close.svg", 16)]);
    await waitFor(() => expect(mockListIcons).toHaveBeenCalled());
    await waitFor(() => expect(value()).toBeGreaterThanOrEqual(trickled));
  });

  it("counts the files in, rather than guessing at the wait", async () => {
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
    // The listing's 30, plus half of the remaining 70.
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

describe("dropping icons onto the set", () => {
  const canvas = () =>
    document.querySelector("[data-icon-sheet]") as HTMLElement;

  const withFiles = (files: File[]) => ({
    dataTransfer: { files, items: files, types: ["Files"] },
  });

  const svg = (name: string) =>
    new File([CHECK], name, { type: "image/svg+xml" });

  beforeEach(() => {
    mockCreateIconUploadUrl.mockResolvedValue({
      uploadUrl: "https://upload.example/signed",
      publicUrl: "https://cdn.example.com/icons/chevron-down.svg",
      key: "icons/uuid-chevron-down.svg",
    });
    mockFinalizeIconUpload.mockResolvedValue(asset("chevron-down.svg", 20));
  });

  it("uploads what the author drops on it", async () => {
    signedIn();
    await open();

    fireEvent.drop(canvas(), withFiles([svg("chevron-down.svg")]));

    await waitFor(() =>
      expect(mockCreateIconUploadUrl).toHaveBeenCalledWith({
        filename: "chevron-down.svg",
        size: expect.any(Number),
      }),
    );
    await waitFor(() => expect(mockFinalizeIconUpload).toHaveBeenCalled());
  });

  it("says it will take them while they are held over the set", async () => {
    signedIn();
    await open();
    expect(screen.queryByText("Drop SVGs to add")).toBeNull();

    fireEvent.dragEnter(canvas(), withFiles([svg("chevron-down.svg")]));
    expect(screen.getByText("Drop SVGs to add")).toBeTruthy();

    fireEvent.dragLeave(canvas(), withFiles([svg("chevron-down.svg")]));
    expect(screen.queryByText("Drop SVGs to add")).toBeNull();
  });

  it("keeps saying so as the hand crosses the icons under it", async () => {
    signedIn();
    await open();

    const held = withFiles([svg("chevron-down.svg")]);
    fireEvent.dragEnter(canvas(), held);
    const tile = document.querySelector("[data-icon-tile]") as HTMLElement;

    fireEvent.dragEnter(tile, held);
    fireEvent.dragLeave(tile, held);
    expect(screen.getByText("Drop SVGs to add")).toBeTruthy();

    fireEvent.dragLeave(canvas(), held);
    expect(screen.queryByText("Drop SVGs to add")).toBeNull();
  });

  it("puts the offer away once the drop has been taken", async () => {
    signedIn();
    await open();

    const held = withFiles([svg("chevron-down.svg")]);
    fireEvent.dragEnter(canvas(), held);
    fireEvent.drop(canvas(), held);
    expect(screen.queryByText("Drop SVGs to add")).toBeNull();
  });

  it("ignores a drag that is not carrying files", async () => {
    signedIn();
    await open();

    fireEvent.dragEnter(canvas(), {
      dataTransfer: { files: [], items: [], types: ["text/plain"] },
    });
    expect(screen.queryByText("Drop SVGs to add")).toBeNull();
  });

  it("takes the icons out of a mixed drop and says what it left", async () => {
    signedIn();
    await open();

    fireEvent.drop(
      canvas(),
      withFiles([
        new File(["x"], "logo.png", { type: "image/png" }),
        svg("chevron-down.svg"),
      ]),
    );

    await waitFor(() => expect(mockCreateIconUploadUrl).toHaveBeenCalledTimes(1));
    expect(mockCreateIconUploadUrl).toHaveBeenCalledWith({
      filename: "chevron-down.svg",
      size: expect.any(Number),
    });
    expect(screen.getByText("logo.png is not an SVG")).toBeTruthy();
  });

  it("offers a visitor nothing, and uploads nothing they drop", async () => {
    await open();

    const held = withFiles([svg("chevron-down.svg")]);
    fireEvent.dragEnter(canvas(), held);
    expect(screen.queryByText("Drop SVGs to add")).toBeNull();

    fireEvent.drop(canvas(), held);
    await waitFor(() => expect(mockListIcons).toHaveBeenCalled());
    expect(mockCreateIconUploadUrl).not.toHaveBeenCalled();
  });
});

describe("size and stroke, locked together", () => {
  // Read off the controls: a drawing's `stroke-width` is in its own grid's units.
  const value = (name: string) =>
    screen.getByRole("slider", { name }).getAttribute("aria-valuenow");
  const box = () => value("Size");
  const weight = () => value("Stroke");

  const lock = () => screen.getByRole("button", { name: /link size and stroke/i });

  it("arrives locked, and says so", async () => {
    await open();

    const button = screen.getByRole("button", { name: "Unlink size and stroke" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("stands between the two rows, in neither of them", async () => {
    await open();

    const rows = ["Size", "Stroke"].map(
      (name) =>
        screen
          .getByRole("slider", { name })
          .closest("[data-property-control]") as HTMLElement,
    );
    for (const row of rows) expect(within(row).queryByRole("button")).toBeNull();

    const tie = screen
      .getByRole("button", { name: /link size and stroke/i })
      .closest("[data-property-tie]") as HTMLElement;
    expect(tie).toBeTruthy();
    for (const row of rows) expect(tie.contains(row)).toBe(true);
  });

  it("brings the stroke along when the size moves", async () => {
    await open();
    expect(box()).toBe("20");
    expect(weight()).toBe("1.25");

    screen.getByRole("slider", { name: "Size" }).focus();
    await userEvent.keyboard("{ArrowRight}");

    await waitFor(() => expect(box()).toBe("24"));
    expect(weight()).toBe("1.5");
  });

  it("brings the size along when the stroke moves", async () => {
    await open();

    screen.getByRole("slider", { name: "Stroke" }).focus();
    await userEvent.keyboard("{ArrowRight}");

    await waitFor(() => expect(weight()).toBe("1.5"));
    expect(box()).toBe("24");
  });

  it("holds at the end of the scales rather than dragging one past it", async () => {
    await open();

    const size = screen.getByRole("slider", { name: "Size" });
    size.focus();
    await userEvent.keyboard("{End}");

    await waitFor(() => expect(box()).toBe("64"));
    expect(weight()).toBe("4");
  });

  it("lets them apart when it is turned off, and leaves them where they were", async () => {
    await open();
    await userEvent.click(lock());

    expect(box()).toBe("20");
    expect(weight()).toBe("1.25");

    screen.getByRole("slider", { name: "Size" }).focus();
    await userEvent.keyboard("{ArrowRight}");

    await waitFor(() => expect(box()).toBe("24"));
    expect(weight()).toBe("1.25");
  });

  it("snaps the line back onto the box when it is tied again", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Unlink size and stroke" }));

    const size = screen.getByRole("slider", { name: "Size" });
    size.focus();
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(box()).toBe("64"));
    expect(weight()).toBe("1.25");

    await userEvent.click(screen.getByRole("button", { name: "Link size and stroke" }));

    await waitFor(() => expect(weight()).toBe("4"));
    expect(box()).toBe("64");
  });

  it("is the author's page and the visitor's alike", async () => {
    await open();
    expect(screen.getByRole("button", { name: /link size and stroke/i })).toBeTruthy();
  });
});
