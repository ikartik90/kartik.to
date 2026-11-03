import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type Ref } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DESIGN_SYSTEM } from "../copy";
import { CATEGORIES, DesignSystem, inView, type DesignSystemHandle } from "../design-system";
import { BACKGROUNDS, RADII, RAMPS_BY_USAGE, SYSTEM } from "../ds-tokens";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const FOUNDATIONS = ["Colors", DESIGN_SYSTEM.typesetting, DESIGN_SYSTEM.layout, DESIGN_SYSTEM.radius, DESIGN_SYSTEM.effects, "Icon"];
const PAGES = [
  "Primitives",
  "Maps",
  "Actions",
  "Form",
  "Card",
  "Data Table",
  "Overlay",
  "Filter",
  "Status",
  "Navigation",
  "Data Viz",
];

// Design's, then Design engineering's.
const GUIDELINES = [
  "Colours in OKLCH",
  "Sizes in rems, edges in pixels",
  "Readability",
  "Shared tokens",
  "Proven reusability",
  "Composition from owned parts",
  "Component contracts",
  "Separation of concerns",
];

// The Interface cards that sit three abreast; the rest take a row each.
const ABREAST = ["Readability", "Shared tokens", "Proven reusability"];

/** A page's name as the sidebar writes it: in sentence case, though its title keeps Figma's capitals. */
const inSidebar = (name: string) => name[0] + name.slice(1).toLowerCase();

const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

/** The window, opened at `at`, or at its own first page given null, sent to its pages through `ref`. */
function setup(at: string | null = "colors", ref?: Ref<DesignSystemHandle>) {
  const user = userEvent.setup();
  render(<DesignSystem ref={ref} width={1440} height={856} defaultPage={at ?? undefined} />);
  // The sidebar as it's drawn now: the overview draws none.
  const sidebar = () => screen.getByRole("navigation", { name: DESIGN_SYSTEM.nav });
  const items = () => within(sidebar()).getAllByRole("button");
  const current = () => items().filter((item) => item.getAttribute("aria-current") === "page").map((item) => item.textContent);
  const scroller = document.querySelector<HTMLElement>("[data-app-scroll]")!;
  const scrollTo = vi.fn();
  scroller.scrollTo = scrollTo;
  const open = (name: string) => user.click(within(sidebar()).getByRole("button", { name }));
  const titles = () => screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent);
  return { user, sidebar, items, current, scroller, scrollTo, open, titles };
}

/** Lays the matching parts out `step` apart from `start`, 25 between each, as the scroller would see them. */
function place(selector: string, start: number, step: number) {
  document.querySelectorAll(selector).forEach((part, i) => {
    const top = start + i * step;
    vi.spyOn(part, "getBoundingClientRect").mockReturnValue({ top, bottom: top + step - 25 } as DOMRect);
  });
}

/** As `place`, for the foundations' sections whenever they come to be drawn. */
function placeAny(start: number, step: number) {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const i = [...document.querySelectorAll("[data-ds-page]")].indexOf(this);
    if (i < 0) return original.call(this);
    const top = start + i * step;
    return { top, bottom: top + step - 25 } as DOMRect;
  });
}

describe("the design system's window", () => {
  it("lists the foundations, then each of Figma's component pages with its components, each under its head", () => {
    const { sidebar, items } = setup();
    expect([...sidebar().firstElementChild!.children].map((item) => item.textContent)).toEqual([
      DESIGN_SYSTEM.overview,
      DESIGN_SYSTEM.guidelines,
      DESIGN_SYSTEM.foundations,
      ...FOUNDATIONS.map(inSidebar),
      ...CATEGORIES.flatMap((category) => [category.label, ...category.stories.map((story) => story.id)].map(inSidebar)),
    ]);
    expect(items().map((item) => item.textContent)).toEqual(expect.arrayContaining(["Corner radius", "Label-value pair", "Popover menu"]));
    expect(sidebar().textContent).toContain("Data table");
    expect(CATEGORIES.map((category) => category.label)).toEqual(PAGES);
  });

  it("lists components under what they're for", () => {
    const groupOf = (id: string) => CATEGORIES.find((category) => category.stories.some((story) => story.id === id))?.label;
    expect(groupOf("Worker Hours Dialog")).toBe("Actions");
    expect(groupOf("Inline Table Record")).toBe("Data Table");
    expect(groupOf("Tab Group")).toBe("Navigation");
    for (const primitive of ["Typography", "Avatar", "Badge", "Chip", "Pill", "Spotscore", "Divider", "Label-value Pair", "List Item", "Hint Text", "Checkbox", "Switch", "Applicant Selector"])
      expect(groupOf(primitive), primitive).toBe("Primitives");
    expect(groupOf("Search")).toBe("Filter");
    expect(groupOf("Type-ahead")).toBe("Form");
    expect(groupOf("Side Sheet")).toBe("Overlay");
    expect(groupOf("Spider Chart")).toBe("Data Viz");
    expect(groupOf("Metadata")).toBe("Card");
    expect(groupOf("Form Navigation")).toBe("Navigation");
    expect(groupOf("Notifications")).toBe("Status");
    for (const map of ["Geofencing Polygon", "Location Tracking"]) expect(groupOf(map), map).toBe("Maps");
    for (const gone of [
      "Donut Chart",
      "Dot Matrix",
      "Message Group",
      "Contact Group",
      "Message Editor",
      "Chat Restored",
      "Inline Edit",
      "Tags",
      "View location",
    ])
      expect(groupOf(gone), gone).toBeUndefined();
  });

  it("lists each page's components alphabetically", () => {
    for (const { stories } of CATEGORIES) {
      const names = stories.map((story) => story.id);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    }
  });

  it("lists every component once", () => {
    const names = CATEGORIES.flatMap((category) => category.stories.map((story) => story.figma));
    expect(new Set(names).size).toBe(names.length);
  });

  it("lists its pages by name alone, with no icons", () => {
    const { items } = setup();
    for (const item of items()) expect(item.querySelector("svg:not([data-chevron])"), item.textContent!).toBeNull();
  });

  it("opens on its overview, a page across the window with no sidebar, under the Curie Design System banner", () => {
    const { titles } = setup(null);
    expect(screen.queryByRole("navigation", { name: DESIGN_SYSTEM.nav })).toBeNull();
    expect(titles()).toEqual(["Curie Design System"]);
  });

  it("counts the components on the overview's Components card, one for each component page in the sidebar", () => {
    setup(null);
    const card = screen.getByRole("heading", { level: 2, name: DESIGN_SYSTEM.components }).closest("[data-card]")!;
    const [, count] = card.textContent!.match(/Click through (\d+) design system components/)!;
    expect(Number(count)).toBe(CATEGORIES.flatMap((category) => category.stories).length);
  });

  it("lists the overview's cards as guidelines, foundations, then components", () => {
    const { scroller } = setup(null);
    const headings = [...scroller.querySelectorAll("[data-card] h2")].map((heading) => heading.textContent);
    expect(headings).toEqual([DESIGN_SYSTEM.guidelines, DESIGN_SYSTEM.foundations, DESIGN_SYSTEM.components]);
  });

  it("opens each of the overview's cards on its page, the Components card on the sidebar's first component", async () => {
    const { user, open, current, titles, scroller } = setup(null);
    const pick = async (card: string) => {
      if (screen.queryByRole("navigation", { name: DESIGN_SYSTEM.nav })) await open(DESIGN_SYSTEM.overview);
      const heading = within(scroller).getByRole("heading", { level: 2, name: card });
      // Its heading ends in a chevron, apart from its words, as the guidelines' sheet cards do.
      expect(heading.querySelector(":scope > button + svg:last-child")?.getAttribute("aria-hidden"), card).toBe("true");
      await user.click(within(heading).getByRole("button"));
    };
    await pick(DESIGN_SYSTEM.foundations);
    expect(current()).toEqual(["Colors"]);
    expect(titles()).toEqual(FOUNDATIONS);
    for (const [card, page] of [
      [DESIGN_SYSTEM.components, CATEGORIES[0].stories[0].id],
      [DESIGN_SYSTEM.guidelines, DESIGN_SYSTEM.guidelines],
    ]) {
      await pick(card);
      expect(current(), card).toEqual([inSidebar(page)]);
      expect(titles(), card).toEqual([page]);
    }
  });

  it("goes back and forward through the pages opened, as a browser does, with the bar it's given", async () => {
    const user = userEvent.setup();
    render(
      <DesignSystem
        width={1440}
        height={856}
        bar={({ back, forward }) => (
          <>
            <button type="button" disabled={!back} onClick={back}>
              Back
            </button>
            <button type="button" disabled={!forward} onClick={forward}>
              Forward
            </button>
          </>
        )}
      />,
    );
    const first = CATEGORIES[0].stories[0].id;
    const titles = () => screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent);
    const back = () => screen.getByRole("button", { name: "Back" });
    const forward = () => screen.getByRole("button", { name: "Forward" });
    const open = (name: string) =>
      user.click(within(screen.getByRole("navigation", { name: DESIGN_SYSTEM.nav })).getByRole("button", { name }));
    expect([back(), forward()].map((button) => button.hasAttribute("disabled"))).toEqual([true, true]);
    await user.click(within(screen.getByRole("heading", { level: 2, name: DESIGN_SYSTEM.components })).getByRole("button"));
    await open("Tooltip");
    await user.click(back());
    expect(titles()).toEqual([first]);
    await user.click(back());
    expect(titles()).toEqual(["Curie Design System"]);
    expect(back().hasAttribute("disabled")).toBe(true);
    await user.click(forward());
    expect(titles()).toEqual([first]);
    // A page opened partway back drops the ones ahead of it.
    await open(DESIGN_SYSTEM.guidelines);
    expect(forward().hasAttribute("disabled")).toBe(true);
    await user.click(back());
    expect(titles()).toEqual([first]);
  });

  it("sets a montage of live components beside the cards, as a picture that takes no presses", () => {
    setup(null);
    const montage = document.querySelector<HTMLElement>("[data-montage]")!;
    expect(montage.hasAttribute("inert")).toBe(true);
    expect(montage.querySelectorAll("[data-montage-piece]").length).toBeGreaterThan(4);
  });

  describe("the montage's motion", () => {
    /** Web Animations and IntersectionObserver, which jsdom lacks; answers whether the montage's track was moved. */
    function animating(phone: boolean) {
      const animate = vi.fn((_keyframes: Keyframe[] | PropertyIndexedKeyframes) => ({ play() {}, pause() {}, cancel() {}, currentTime: 0 }) as unknown as Animation);
      vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
      Object.defineProperty(Element.prototype, "animate", { value: animate, configurable: true, writable: true });
      vi.spyOn(window, "matchMedia").mockImplementation(
        (query) => ({ matches: phone && query.includes("coarse"), addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
      );
      setup(null);
      return animate.mock.calls.some(([keyframes]) => "transform" in keyframes);
    }

    afterEach(() => {
      delete (Element.prototype as { animate?: unknown }).animate;
      vi.unstubAllGlobals();
    });

    it("carries the components up its columns", () => {
      expect(animating(false)).toBe(true);
    });

    // Drawn small in its window there, a moving montage is drawn at full size and runs Safari out of memory.
    it("holds them still on a phone", () => {
      expect(animating(true)).toBe(false);
    });
  });

  it("opens on who we are and tone and voice, two cards abreast that each open a side sheet, then its interface, unheaded", async () => {
    const { user, open } = setup();
    await open(DESIGN_SYSTEM.guidelines);
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Who we are",
      "Tone and voice",
      "Design",
      "Design engineering",
    ]);
    // Each at the size of the heading it stands beside.
    expect(new Set(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.getAttribute("data-typography")))).toEqual(
      new Set(["heading"]),
    );
    const card = (title: string) => screen.getByRole("heading", { level: 2, name: title }).closest<HTMLElement>("[data-card]")!;
    expect(card("Who we are").parentElement).toBe(card("Tone and voice").parentElement);
    expect(card("Who we are").nextElementSibling).toBe(card("Tone and voice"));
    // Each heading ends in a chevron, apart from its words, as a record that opens a page of its own does.
    for (const title of ["Who we are", "Tone and voice"]) {
      const heading = screen.getByRole("heading", { level: 2, name: title });
      const chevron = heading.querySelector(":scope > button + svg");
      expect(chevron?.getAttribute("aria-hidden"), title).toBe("true");
      expect(heading.lastElementChild, title).toBe(chevron);
    }
    // A card holds its intro; its groups wait in its sheet.
    expect(within(card("Who we are")).getByText(/^Spotwork connects employers/)).toBeTruthy();
    expect(within(card("Tone and voice")).getByText(/^Our voice stays constant/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Speed" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Plainspoken" })).toBeNull();

    const headings = (within_: HTMLElement, level: number) =>
      within(within_).queryAllByRole("heading", { level }).map((heading) => heading.textContent);
    const toggle = (title: string) => within(card(title)).getByRole("button", { name: title });
    expect(toggle("Who we are").getAttribute("aria-haspopup")).toBe("dialog");
    await user.click(toggle("Who we are"));
    expect(toggle("Who we are").getAttribute("aria-expanded")).toBe("true");
    const who = screen.getByRole("dialog", { name: "Who we are" });
    expect(headings(who, 3)).toEqual(["Employers", "Workers"]);
    expect(headings(who, 4)).toEqual(["Speed", "Reliability", "Quality", "Flexibility", "Control", "Fast pay", "Steady work"]);

    // The other card fills the open sheet.
    await user.click(toggle("Tone and voice"));
    const tone = screen.getByRole("dialog", { name: "Tone and voice" });
    expect(tone).toBe(who);
    expect(headings(tone, 3)).toEqual(["Voice", "Tone"]);
    expect(headings(tone, 4)).toEqual(["Plainspoken", "Warm", "Direct", "Upbeat", "Calm", "Brisk"]);
    expect(within(tone).getAllByText(DESIGN_SYSTEM.example)).toHaveLength(6);
    await user.click(within(tone).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(toggle("Who we are"));
    await user.click(screen.getByRole("heading", { level: 2, name: "Design" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(toggle("Who we are"));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // In the overlay, its window takes Escape and passes it on to the sheet as its top layer.
    await user.click(toggle("Who we are"));
    const layer = screen.getByRole("dialog", { name: "Who we are" });
    expect(layer.hasAttribute("data-escape-layer")).toBe(true);
    fireEvent(layer, new Event("escape-layer"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const interface_ = screen.getByRole("region", { name: "Interface" });
    expect(headings(interface_, 2)).toEqual(["Design", "Design engineering"]);
    expect(headings(interface_, 3)).toEqual(GUIDELINES);
    const abreast = [...interface_.querySelectorAll("[data-card][data-abreast]")].map((card) => card.querySelector("h3")!.textContent);
    expect(abreast).toEqual(ABREAST);
    // A merged card keeps each card's words as a paragraph of its own.
    const paragraphs = (title: string) =>
      [...within(interface_).getByRole("heading", { name: title }).closest("[data-card]")!.querySelectorAll("p")].map((p) => p.textContent);
    expect(paragraphs("Sizes in rems, edges in pixels")).toEqual([
      expect.stringMatching(/^Set width, height, .* keep layouts in proportion\.$/),
      expect.stringMatching(/^Keep border, outline and box-shadow in px\. .* Shadows take up no layout room\.$/),
    ]);
    expect(paragraphs("Composition from owned parts")).toEqual([
      expect.stringMatching(/^Build declarative UI from compound components/),
      expect.stringMatching(/^Use each part only inside the component that owns it/),
    ]);
  });

  it("shows Composition from owned parts' example under its paragraphs, the Segmented Control's first: its code in full, then the component on its tab", async () => {
    const { user, open } = setup();
    await open(DESIGN_SYSTEM.guidelines);
    const card = screen.getByRole("heading", { name: "Composition from owned parts" }).closest<HTMLElement>("[data-card]")!;
    const tabs = within(card).getByRole("tablist", { name: DESIGN_SYSTEM.example });
    expect(before([...card.querySelectorAll("p")].at(-1)!, tabs)).toBe(true);
    expect(within(tabs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([DESIGN_SYSTEM.code, DESIGN_SYSTEM.component]);
    const selected = () => within(tabs).getByRole("tab", { selected: true });
    const panel = () => within(card).getByRole("tabpanel");

    expect(selected().textContent).toBe(DESIGN_SYSTEM.code);
    expect(panel().getAttribute("aria-labelledby")).toBe(selected().id);
    expect(panel().textContent).toContain("<Field.Label>Break Type</Field.Label>");
    expect(panel().textContent).toContain('<SegmentedControl.Segment value="paid">');
    expect(within(card).queryByRole("button", { name: DESIGN_SYSTEM.showCode })).toBeNull();
    expect(within(card).queryByRole("group", { name: "Break Type" })).toBeNull();

    await user.click(within(tabs).getByRole("tab", { name: DESIGN_SYSTEM.component }));
    expect(selected().textContent).toBe(DESIGN_SYSTEM.component);
    expect(panel().getAttribute("aria-labelledby")).toBe(selected().id);
    const control = within(panel()).getByRole("group", { name: "Break Type" });
    expect(within(control).getAllByRole("button").map((segment) => segment.textContent)).toEqual(["Paid", "Unpaid"]);
    expect(panel().textContent).not.toContain("<Field.Label>");
  });

  it("shows Component contracts' example under its paragraph, a Get started button in the banner's rings: its code passing them through UNSAFE_className, then the button on its tab", async () => {
    const { user, open } = setup();
    await open(DESIGN_SYSTEM.guidelines);
    const card = screen.getByRole("heading", { name: "Component contracts" }).closest<HTMLElement>("[data-card]")!;
    const tabs = within(card).getByRole("tablist", { name: DESIGN_SYSTEM.example });
    expect(before([...card.querySelectorAll("p")].at(-1)!, tabs)).toBe(true);
    const panel = () => within(card).getByRole("tabpanel");

    expect(within(tabs).getByRole("tab", { selected: true }).textContent).toBe(DESIGN_SYSTEM.code);
    expect(panel().textContent).toContain(
      'UNSAFE_className="bg-[radial-gradient(circle_at_0_0,var(--sw-colors-blue-ribbon-800)_33%,var(--sw-colors-blue-ribbon-700)_0_66%,var(--sw-colors-blue-ribbon-600)_0)]"',
    );
    expect(within(card).queryByRole("button", { name: "Get started" })).toBeNull();

    await user.click(within(tabs).getByRole("tab", { name: DESIGN_SYSTEM.component }));
    const button = within(panel()).getByRole("button", { name: "Get started" });
    expect(button.style.backgroundImage).toContain("radial-gradient");
    expect([...button.attributes].map((attribute) => attribute.name)).not.toContain("unsafe_classname");
  });

  it("wraps a guideline example's long lines under their own indentation", async () => {
    const { open } = setup();
    await open(DESIGN_SYSTEM.guidelines);
    const card = screen.getByRole("heading", { name: "Component contracts" }).closest<HTMLElement>("[data-card]")!;
    const indents = Object.fromEntries(
      [...card.querySelectorAll<HTMLElement>("[data-line]")].map((line) => [line.textContent?.trim().slice(0, 16), line.style.getPropertyValue("--indent")]),
    );
    expect(indents).toMatchObject({ "export function ": "0", "return (": "2", "<Button": "4", UNSAFE_className: "6", "Get started": "6" });
  });

  it("tables the states' colours under Colours in OKLCH: each state's palette and hue, then its Surface, Glyph and Outline tokens, swatched, with their chroma and lightness", async () => {
    const { open } = setup();
    await open(DESIGN_SYSTEM.guidelines);
    const card = screen.getByRole("heading", { name: "Colours in OKLCH" }).closest<HTMLElement>("[data-card]")!;
    const table = within(card).getByRole("table", { name: "Colours in OKLCH" });
    expect(before([...card.querySelectorAll("p")].at(-1)!, table)).toBe(true);
    expect(within(table).getAllByRole("columnheader").map((head) => head.textContent)).toEqual([
      "State",
      DESIGN_SYSTEM.palette,
      "Surface",
      "Glyph",
      "Outline",
    ]);
    // A cell's lines, each a part of its own on its row's lines; a swatch stands down them as an avatar does.
    const lines = (cell: Element) => [...cell.children].filter((part) => !part.hasAttribute("data-swatch")).map((part) => part.textContent);
    const rows = within(table).getAllByRole("row").slice(1);
    const tones = (step: string, chroma: string, lightness: string) => [step, `C ${chroma} · L ${lightness}`];
    const states = [
      ["Info", "Blue Ribbon", "263.14"],
      ["Success", "Apple", "147.79"],
      ["Warning", "Sun", "75.15"],
      ["Alert", "Cinnabar", "29.72"],
    ];
    expect(rows.map((row) => [...row.children].map(lines))).toEqual(
      states.map(([state, palette, hue]) => [
        [state],
        [palette, `H ${hue}`],
        tones("50", "0.0446", "97%"),
        tones("700", "0.216", "47.89%"),
        tones("200", "0.0841", "85.67%"),
      ]),
    );
    const swatches = rows.flatMap((row) => [...row.children].slice(2).map((cell) => cell.querySelector(":scope > [data-swatch]")));
    expect(swatches.every((swatch) => swatch?.hasAttribute("data-avatar"))).toBe(true);
    expect(rows.flatMap((row) => [...row.children].slice(0, 2)).some((cell) => cell.querySelector("[data-swatch]"))).toBe(false);
  });

  it("tables Sizes in rems, edges in pixels' examples, the rem sizes under their paragraph, then the px edges under theirs: each property's token, sampled, over its variable, and its value", async () => {
    const { open } = setup();
    await open(DESIGN_SYSTEM.guidelines);
    const card = screen.getByRole("heading", { name: "Sizes in rems, edges in pixels" }).closest<HTMLElement>("[data-card]")!;
    const rems = within(card).getByRole("table", { name: "Sizes in rems" });
    const pixels = within(card).getByRole("table", { name: "Edges in pixels" });
    const [remText, pxText] = card.querySelectorAll("p");
    expect([before(remText, rems), before(rems, pxText), before(pxText, pixels)]).toEqual([true, true, true]);
    for (const table of [rems, pixels])
      expect(within(table).getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Property", "Token", "Value"]);
    // A cell's lines, each a part of its own on its row's lines; a sample stands down them as an avatar does.
    const lines = (cell: Element) => [...cell.children].filter((part) => !part.hasAttribute("data-avatar")).map((part) => part.textContent);
    const rowsOf = (table: HTMLElement) => within(table).getAllByRole("row").slice(1);
    expect(rowsOf(rems).map((row) => [...row.children].map(lines))).toEqual([
      [["font"], ["Style 4", "--sw-text-style-4"], ["0.875rem/1.5rem", "14px/24px"]],
      [["padding"], ["md", "--sw-padding-md"], ["0.625rem", "10px"]],
      [["margin"], ["md", "--sw-margin-md"], ["0.625rem", "10px"]],
      [["gap"], ["md", "--sw-gap-md"], ["0.625rem", "10px"]],
      [["border-radius"], ["md", "--sw-radius-md"], ["0.625rem", "10px"]],
      [["width"], ["Overlay/Small", "--sw-width-overlay-small"], ["35rem", "560px"]],
    ]);
    expect(rowsOf(pixels).map((row) => [...row.children].map(lines))).toEqual([
      [["border"], ["Selected", "--sw-border-selected"], ["1.5px", "Blue Ribbon/700"]],
      [["outline"], ["Selected", "--sw-outline-selected"], ["2px", "Blue Ribbon/200"]],
      [["box-shadow"], ["Overlay", "--sw-overlay-shadow"], ["Blur 10px", "Woodsmoke/300"]],
    ]);
    const samples = [...rowsOf(rems), ...rowsOf(pixels)].map((row) => row.children[1].querySelector(":scope > [data-avatar]")!);
    expect(samples.every(Boolean)).toBe(true);
    expect([...rowsOf(rems), ...rowsOf(pixels)].some((row) => row.children[0].querySelector("[data-avatar]") || row.children[2].querySelector("[data-avatar]"))).toBe(false);
    expect(samples[0].querySelector("[data-typography=bodyStrong]")?.textContent).toBe("Ag");
    // Each other sample drawn with its own variable, but Overlay/Small's, scaled down.
    const drawn = [1, 2, 3, 4, 6, 7, 8].map((i) => [samples[i].innerHTML, lines(samples[i].closest("td, [role=cell]")!)[1]]);
    for (const [html, variable] of drawn) expect(html, variable).toContain(`var(${variable})`);
  });

  it("sets a principle's code names as code", async () => {
    const { open } = setup();
    await open(DESIGN_SYSTEM.guidelines);
    const card = screen.getByRole("heading", { name: "Component contracts" }).closest("[data-card]")!;
    expect([...card.querySelectorAll("p code")].map((code) => code.textContent)).toEqual(["no-restyle", "UNSAFE_className"]);
    expect(card.textContent).not.toContain("`");
    const codeIn = (title: string) =>
      [...screen.getByRole("heading", { name: title }).closest("[data-card]")!.querySelectorAll("p code")].map((code) => code.textContent);
    expect(codeIn("Sizes in rems, edges in pixels")).toEqual([
      ...["width", "height", "padding", "margin", "gap", "border-radius", "font", "letter-spacing"],
      ...["border", "outline", "box-shadow"],
    ]);
    expect(codeIn("Colours in OKLCH")).toEqual(["oklch(L% C H)"]);
  });

  it("opens on the foundations, alone on their page, at Colors, when asked to", () => {
    const { current, titles } = setup();
    expect(current()).toEqual(["Colors"]);
    expect(titles()).toEqual(FOUNDATIONS);
  });

  it("shows a component picked on a page of its own, at its top, with no Spotwork header", async () => {
    const { open, current, titles, scrollTo } = setup();
    await open("Text input");
    expect(current()).toEqual(["Text input"]);
    expect(titles()).toEqual(["Text Input"]);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "auto" });
    expect(screen.queryAllByRole("banner")).toEqual([]);

    await open("Text area");
    expect(titles()).toEqual(["Text Area"]);
  });

  it("shows a component as its examples, each over its code, with no properties to set", async () => {
    const { open } = setup();
    await open("Button");
    const story = screen.getByRole("region", { name: "Button" });
    expect(story.querySelectorAll("[data-example] [data-canvas] + [data-code]").length).toBeGreaterThan(1);
    expect(within(story).queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("jumps down the foundations to the one picked, marked as the current one", async () => {
    const { open, current, scrollTo } = setup();
    place("[data-ds-page]", 0, 1000);
    await open(DESIGN_SYSTEM.layout);
    expect(current()).toEqual([DESIGN_SYSTEM.layout]);
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 2000 }));
  });

  it("lands at once on a foundation picked from a component's page", async () => {
    const { open, current, scrollTo, titles } = setup();
    placeAny(0, 1000);
    await open("Text input");
    await open(inSidebar(DESIGN_SYSTEM.radius));
    expect(titles()).toEqual(FOUNDATIONS);
    expect(current()).toEqual([inSidebar(DESIGN_SYSTEM.radius)]);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 3000, behavior: "auto" });
  });

  it("lands on the foundation picked while the window is drawn at half size", async () => {
    const { open, scroller, scrollTo } = setup();
    Object.defineProperty(scroller, "offsetHeight", { value: 800 });
    vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue({ top: 100, height: 400 } as DOMRect);
    place("[data-ds-page]", 100, 500);
    await open("Icon");
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 5000 }));
  });

  it("marks the foundation in view as the page scrolls", () => {
    const { current, scroller } = setup();
    place("[data-ds-page]", -3500, 1000);
    fireEvent.scroll(scroller);
    expect(current()).toEqual([inSidebar(DESIGN_SYSTEM.radius)]);
  });

  it("folds Colors into one card, its palette, Surface, Glyph, and Border and outline each a tab with its own switch", async () => {
    const { user } = setup();
    const tablist = screen.getByRole("tablist", { name: "Colors" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([DESIGN_SYSTEM.palette, "Surface", "Glyph", "Border and outline"]);
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false", "false", "false"]);
    const card = tablist.closest("section")!;
    expect(within(card).getByRole("switch", { name: DESIGN_SYSTEM.showUnused })).toBeTruthy();
    expect(within(card).queryByRole("switch", { name: DESIGN_SYSTEM.showOklch })).toBeNull();
    await user.click(tabs[1]);
    within(screen.getByRole("tabpanel", { name: "Surface" })).getByRole("table", { name: "Surface" });
    expect(within(card).queryByRole("table", { name: "Glyph" })).toBeNull();
    expect(within(card).getByRole("switch", { name: DESIGN_SYSTEM.showOklch })).toBeTruthy();
    expect(within(card).queryByRole("switch", { name: DESIGN_SYSTEM.showUnused })).toBeNull();
    expect(screen.queryByRole("region", { name: "System tokens" })).toBeNull();
    expect(screen.queryByRole("region", { name: DESIGN_SYSTEM.palette })).toBeNull();
  });

  it("folds Layout into one card, Padding, Margin, Gap and Width each a tab, under one Show pixel values", async () => {
    const { user } = setup();
    const tablist = screen.getByRole("tablist", { name: DESIGN_SYSTEM.layout });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Padding", "Margin", "Gap", "Width"]);
    const card = tablist.closest("section")!;
    within(screen.getByRole("tabpanel", { name: "Padding" })).getByRole("table", { name: "Padding" });
    await user.click(tabs[3]);
    within(screen.getByRole("tabpanel", { name: DESIGN_SYSTEM.width })).getByRole("table", { name: DESIGN_SYSTEM.width });
    expect(within(card).getAllByRole("switch", { name: DESIGN_SYSTEM.showPixels })).toHaveLength(1);
  });

  it("lists the colour tokens in a table each for Surface, Glyph, and Border and outline, by palette colour, or by OKLCH value once Show OKLCH values is on", async () => {
    const { user } = setup();
    const colors = screen.getByRole("tablist", { name: "Colors" }).closest("section")!;
    const rowsOf = (name: string, colour = DESIGN_SYSTEM.palette) => {
      fireEvent.click(within(colors).getByRole("tab", { name }));
      const table = within(colors).getByRole("table", { name });
      expect(within(table).getAllByRole("columnheader").map((head) => head.textContent)).toEqual([
        DESIGN_SYSTEM.token,
        colour,
        DESIGN_SYSTEM.cssVariable,
      ]);
      within(table)
        .queryAllByRole("button")
        .forEach((folder) => fireEvent.click(folder));
      return within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => [...row.children].map((cell) => cell.textContent));
    };
    const surface = rowsOf("Surface");
    expect(surface[0]).toEqual(["Default", "Base", "--sw-surface-default"]);
    within(screen.getByRole("table", { name: "Surface" })).getByRole("rowheader", { name: "Inverted" });
    expect(surface).toContainEqual(["Subdued", "Woodsmoke/900", "--sw-surface-inverted-subdued"]);
    expect(surface.filter((row) => row.length > 1 && row[0]?.includes("/"))).toEqual([]);
    expect(rowsOf("Glyph")[0]).toEqual(["Default", "Woodsmoke/950", "--sw-glyph-default"]);
    const edges = rowsOf("Border and outline");
    expect(edges[0]).toEqual(["Default", "Woodsmoke/300", "--sw-border-default"]);
    within(within(colors).getByRole("table", { name: "Border and outline" })).getByRole("rowheader", { name: "Outline" });
    const first = (prefix: string) => edges.findIndex((row) => row.at(-1)?.startsWith(prefix));
    expect(first("--sw-outline-")).toBeLessThan(first("--sw-border-button-"));
    expect(edges.slice(first("--sw-outline-"), first("--sw-outline-") + 5)).toEqual([
      ["Focus", "Blue Ribbon/200", "--sw-outline-focus"],
      ["Selected", "Blue Ribbon/200", "--sw-outline-selected"],
      ["Success", "Apple/200", "--sw-outline-success"],
      ["Warning", "Sun/200", "--sw-outline-warning"],
      ["Alert", "Cinnabar/200", "--sw-outline-alert"],
    ]);
    expect(screen.queryByRole("table", { name: "System tokens" })).toBeNull();

    await user.click(screen.getByRole("switch", { name: DESIGN_SYSTEM.showOklch }));
    expect(rowsOf("Surface", DESIGN_SYSTEM.value)[0]).toEqual(["Default", "oklch(100% 0 0)", "--sw-surface-default"]);
    expect(rowsOf("Surface", DESIGN_SYSTEM.value)).toContainEqual(["Subdued", "oklch(32.78% 0 0)", "--sw-surface-inverted-subdued"]);
    expect(rowsOf("Glyph", DESIGN_SYSTEM.value)[0]).toEqual(["Default", "oklch(29% 0 0)", "--sw-glyph-default"]);
    expect(rowsOf("Border and outline", DESIGN_SYSTEM.value)[0]).toEqual(["Default", "oklch(78.11% 0 0)", "--sw-border-default"]);
    expect(rowsOf("Glyph", DESIGN_SYSTEM.value)).toContainEqual(["Selected", "oklch(47.89% 0.216 263.14)", "--sw-glyph-selected"]);
    expect(rowsOf("Surface", DESIGN_SYSTEM.value)).toContainEqual(["Hover", "oklch(97% 0 0)", "--sw-surface-hover"]);
  });

  it("shows sizes in rem until Show pixel values, on any section that has them, turns every one to px", async () => {
    const { user } = setup();
    const sized = ["Text styles", DESIGN_SYSTEM.layout, DESIGN_SYSTEM.radius];
    const switches = () => screen.getAllByRole("switch", { name: DESIGN_SYSTEM.showPixels });
    expect(switches().map((toggle) => toggle.closest("section")!.getAttribute("aria-label") ?? toggle.closest("[data-ds-page]")!.getAttribute("aria-label"))).toEqual(sized);
    const cells = (table: string, row: number) =>
      [...within(screen.getByRole("table", { name: table })).getAllByRole("row")[row].children].map((cell) => cell.textContent);
    await user.click(screen.getByRole("tab", { name: "Gap" }));
    expect(cells("Gap", 4)).toEqual(["xs", "", "0.25rem", "--sw-gap-xs"]);
    expect(cells(DESIGN_SYSTEM.radius, 3)).toEqual(["xs", "0.25rem", "--sw-radius-xs"]);
    expect(cells(DESIGN_SYSTEM.radius, 10)).toEqual(["full", "9999px", "--sw-radius-full"]);

    await user.click(switches()[1]);
    expect(switches().map((toggle) => toggle.getAttribute("aria-checked"))).toEqual(sized.map(() => "true"));
    expect(cells("Gap", 4)).toEqual(["xs", "", "4px", "--sw-gap-xs"]);
    expect(cells("Text styles", 10)).toEqual(["Style 10", "Manrope ExtraBold", "30px/44px", "−0.8px", "--sw-text-style-10"]);
    expect(cells(DESIGN_SYSTEM.radius, 3)).toEqual(["xs", "4px", "--sw-radius-xs"]);
    expect(cells(DESIGN_SYSTEM.radius, 10)).toEqual(["full", "9999px", "--sw-radius-full"]);
  });

  it("heads its sections in sentence case", () => {
    setup();
    expect(screen.getByRole("region", { name: "Text styles" })).toBeTruthy();
    expect(screen.getAllByRole("tab", { name: "Border and outline" })).toHaveLength(2);
  });

  it("folds each folder of colour tokens, closed, behind its name and a count of its tokens", () => {
    setup();
    fireEvent.click(screen.getByRole("tab", { name: "Surface" }));
    const table = screen.getByRole("table", { name: "Surface" });
    const inverted = within(table).getByRole("button", { name: "Inverted" });
    const held = SYSTEM[0].tokens.filter(({ name }) => name.startsWith("Surface/Inverted/"));
    expect(inverted.getAttribute("aria-expanded")).toBe("false");
    const badge = inverted.querySelector("[data-badge]");
    expect(badge?.textContent).toBe(String(held.length));
    // On the row's plain surface, the one badge there is, uninverted.
    expect([badge?.hasAttribute("data-inverted"), badge?.hasAttribute("data-size")]).toEqual([false, false]);
    expect(within(table).queryByText("--sw-surface-inverted-subdued")).toBeNull();
    fireEvent.click(inverted);
    expect(inverted.getAttribute("aria-expanded")).toBe("true");
    within(table).getByText("--sw-surface-inverted-subdued");
    fireEvent.click(inverted);
    expect(within(table).queryByText("--sw-surface-inverted-subdued")).toBeNull();
  });

  it("lists every text style with its font, sizes and tracking, then its variable", () => {
    setup();
    expect(screen.getByRole("heading", { name: DESIGN_SYSTEM.typesetting })).toBeTruthy();
    const table = screen.getByRole("table", { name: DESIGN_SYSTEM.textStyles });
    expect(table.closest("section")!.querySelector(":is(h2, h3)")!.textContent).toBe(DESIGN_SYSTEM.textStyles);
    expect(within(table).getAllByRole("columnheader").map((head) => head.textContent)).toEqual([
      DESIGN_SYSTEM.token,
      DESIGN_SYSTEM.font,
      DESIGN_SYSTEM.sizeLineHeight,
      DESIGN_SYSTEM.letterSpacing,
      DESIGN_SYSTEM.cssVariable,
    ]);
    const rows = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => [...row.children].map((cell) => cell.textContent));
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual(["Style 1", "Poppins Medium", "0.75rem/1.25rem", "0", "--sw-text-style-1"]);
    expect(rows.at(-1)).toEqual(["Style 10", "Manrope ExtraBold", "1.875rem/2.75rem", "−0.05rem", "--sw-text-style-10"]);
  });

  it("ends every table with its CSS variable", () => {
    setup();
    for (const table of screen.getAllByRole("table")) {
      const heads = within(table).getAllByRole("columnheader").map((head) => head.textContent);
      if (heads.includes(DESIGN_SYSTEM.cssVariable)) expect(heads.at(-1), table.getAttribute("aria-label")!).toBe(DESIGN_SYSTEM.cssVariable);
    }
  });

  it("sizes each layout token as its bar, its value, then its variable, under Padding, Gap and Width", () => {
    setup();
    for (const name of ["Padding", "Gap", DESIGN_SYSTEM.width]) {
      fireEvent.click(screen.getByRole("tab", { name }));
      const table = screen.getByRole("table", { name });
      expect(
        within(table)
          .getAllByRole("columnheader")
          .map((head) => head.textContent),
      ).toEqual([DESIGN_SYSTEM.token, "", DESIGN_SYSTEM.value, DESIGN_SYSTEM.cssVariable]);
    }
    const sidebar = within(screen.getByRole("table", { name: DESIGN_SYSTEM.width })).getByRole("row", {
      name: /^Nav Sidebar/,
    });
    expect(
      within(sidebar)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["Nav Sidebar", "", "16rem", "--sw-width-nav-sidebar"]);
    expect(screen.getByRole("table", { name: DESIGN_SYSTEM.width }).closest("section")!.querySelectorAll("figure")).toHaveLength(0);
    // Its section names a token once: no Padding/, Gap/ or Width/ ahead of it.
    const names = (table: string) =>
      within(screen.getByRole("table", { name: table }))
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.querySelector("[role=cell]")!.textContent);
    for (const name of ["Padding", "Gap"]) {
      fireEvent.click(screen.getByRole("tab", { name }));
      for (const token of names(name)) expect(token).not.toMatch(/\//);
    }
    fireEvent.click(screen.getByRole("tab", { name: DESIGN_SYSTEM.width }));
    expect(names(DESIGN_SYSTEM.width)).toEqual([
      "Side Sheet/Large",
      "Side Sheet/Small",
      "Overlay/Large",
      "Overlay/Small",
      "Card",
      "Dialog",
      "Nav Sidebar",
      "Nav Rail",
      "Calendar",
      "Dropdown",
      "Snackbar",
    ]);
  });

  it("draws each radius on one corner, the top right, so the largest steps still differ", () => {
    setup();
    const table = screen.getByRole("table", { name: DESIGN_SYSTEM.radius });
    const corners = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector<HTMLElement>("[data-corner]")!.style);
    expect(corners.map((corner) => corner.borderTopRightRadius)).toEqual(RADII.map((radius) => `var(${radius.variable})`));
    expect(corners.map((corner) => [corner.borderTopLeftRadius, corner.borderBottomRightRadius, corner.borderBottomLeftRadius].join(""))).toEqual(
      RADII.map(() => ""),
    );
  });

  it("tabulates each state's border and outline, Default's border alone", () => {
    setup();
    const table = within(screen.getByRole("tabpanel", { name: "Border and outline" })).getByRole("table", { name: "Border and outline" });
    const [head, ...rows] = within(table).getAllByRole("row");
    const cells = (row: HTMLElement) => [...row.children].map((cell) => cell.textContent);
    expect(cells(head)).toEqual(["Token", "Border", "Border CSS variable", "Outline", "Outline CSS variable"]);
    expect(rows.map((row) => cells(row)[0])).toEqual(["Default", "Focus", "Selected", "Target", "Success", "Alert", "Warning"]);
    expect(cells(rows[0])).toEqual(["Default", "Border · 1 · Woodsmoke/300", "--sw-border-default", "Outline · None", ""]);
    expect(cells(rows[1])).toEqual([
      "Focus",
      "Border · 1.5 · Blue Ribbon/700",
      "--sw-border-focus",
      "Outline · 2 · Blue Ribbon/200",
      "--sw-outline-focus",
    ]);
    expect(cells(rows[2])).toEqual([
      "Selected",
      "Border · 1.5 · Blue Ribbon/700",
      "--sw-border-selected",
      "Outline · 2 · Blue Ribbon/200",
      "--sw-outline-selected",
    ]);
    expect(cells(rows[3])).toEqual(["Target", "Border · 1.5 · Blue Ribbon/700", "--sw-border-target", "Outline · None", ""]);
    const specimen = (row: HTMLElement) => row.querySelector<HTMLElement>("[data-effect]")!.style;
    expect(specimen(rows[0]).boxShadow).toBe("inset 0 0 0 1px var(--sw-border-default)");
    expect(specimen(rows[0]).outline).toBe("");
    expect(specimen(rows[3]).outline).toBe("");
    expect(specimen(rows[6]).boxShadow).toBe("inset 0 0 0 1.5px var(--sw-border-warning)");
    expect(specimen(rows[6]).outline).toBe("2px solid var(--sw-outline-warning)");
  });

  it("tabs Effects' Border and outline and Shadow in one card, the shadow a table row, and heads no lone section with its page's title", () => {
    setup();
    const tabs = within(screen.getByRole("tablist", { name: DESIGN_SYSTEM.effects })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Border and outline", "Shadow", DESIGN_SYSTEM.background]);
    fireEvent.click(tabs[1]);
    const table = within(screen.getByRole("tabpanel", { name: "Shadow" })).getByRole("table", { name: "Shadow" });
    const [head, ...rows] = within(table).getAllByRole("row");
    const cells = (row: HTMLElement) => [...row.children].map((cell) => cell.textContent);
    expect(cells(head)).toEqual([DESIGN_SYSTEM.token, DESIGN_SYSTEM.value, DESIGN_SYSTEM.cssVariable]);
    expect(rows.map(cells)).toEqual([["Overlay", "Drop shadow · Blur 10 · Woodsmoke/300", "--sw-overlay-shadow"]]);
    expect(rows[0].querySelector<HTMLElement>("[data-effect]")!.style.boxShadow).toBe("var(--sw-overlay-shadow)");
    expect(table.closest("section")!.querySelectorAll("figure")).toHaveLength(0);
    for (const page of screen.getAllByRole("heading", { level: 1 }))
      expect(screen.queryByRole("heading", { level: 2, name: page.textContent! })).toBeNull();
  });

  it("tabs the hatched background under Effects, its gradient a token the hatched parts take", () => {
    setup();
    const tabs = within(screen.getByRole("tablist", { name: DESIGN_SYSTEM.effects })).getAllByRole("tab");
    fireEvent.click(tabs[2]);
    const table = within(screen.getByRole("tabpanel", { name: DESIGN_SYSTEM.background })).getByRole("table", { name: DESIGN_SYSTEM.background });
    const [head, ...rows] = within(table).getAllByRole("row");
    const cells = (row: HTMLElement) => [...row.children].map((cell) => cell.textContent);
    expect(cells(head)).toEqual([DESIGN_SYSTEM.token, DESIGN_SYSTEM.value, DESIGN_SYSTEM.cssVariable]);
    expect(rows.map(cells)).toEqual([[BACKGROUNDS[0].name, BACKGROUNDS[0].spec, "--sw-hatch-gradient"]]);
    expect(BACKGROUNDS[0].spec).toMatch(/^Repeating linear gradient · 135° · /);
    expect(rows[0].querySelector<HTMLElement>("[data-effect]")!.style.backgroundImage).toBe("var(--sw-hatch-gradient)");
  });

  it("shows the palette colours no system token takes only once Show unused colors is on", async () => {
    const { user } = setup();
    const palette = screen.getByRole("tabpanel", { name: "Palette" });
    const toggle = within(palette.closest("section")!).getByRole("switch", { name: DESIGN_SYSTEM.showUnused });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    const used = palette.querySelectorAll("figure").length;
    expect(used).toBeGreaterThan(0);
    await user.click(toggle);
    expect(palette.querySelectorAll("figure").length).toBeGreaterThan(used);
  });

  it("lists the ramps by role, Blue Ribbon as Primary, the accents by how much the app uses them, then Base and Woodsmoke as Neutral", () => {
    setup();
    const palette = screen.getByRole("tabpanel", { name: "Palette" });
    const headings = (level: number) => within(palette).getAllByRole("heading", { level }).map((heading) => heading.textContent);
    expect(headings(3)).toEqual(["Primary", "Accents", "Neutral"]);
    expect(headings(4)).toEqual(["Blue Ribbon", ...RAMPS_BY_USAGE.filter((ramp) => ramp !== "Blue Ribbon" && ramp !== "Woodsmoke"), "Base", "Woodsmoke"]);
  });

  it("hatches no colour, in the palette or a table's tokens", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("switch", { name: DESIGN_SYSTEM.showUnused }));
    expect(screen.getByRole("tabpanel", { name: "Palette" }).querySelector("[data-hatching], svg")).toBeNull();
    expect(document.querySelector("[role=table] [data-hatching]")).toBeNull();
  });

  it("labels each ramp's lightness, chroma and hue once, beside its colours' bare values", () => {
    setup();
    const palette = screen.getByRole("tabpanel", { name: "Palette" });
    expect(palette.textContent).not.toContain("oklch(");
    expect(within(palette).getAllByText("Lightness")).toHaveLength(within(palette).getAllByRole("heading", { level: 4 }).length);
    const ramp = within(palette).getByRole("heading", { level: 4, name: "Blue Ribbon" }).parentElement!.parentElement!;
    expect(within(ramp).getAllByText(/^(Lightness|Chroma|Hue)$/).map((label) => label.textContent)).toEqual(["Lightness", "Chroma", "Hue"]);
    expect([...ramp.querySelectorAll("figure")].map((figure) => figure.textContent)).toContain("5097%0.0446263.14");
  });

  it("shows white apart from Woodsmoke, as Base", () => {
    setup();
    const palette = screen.getByRole("tabpanel", { name: "Palette" });
    const figures = (name: string) =>
      [...within(palette).getByRole("heading", { level: 4, name }).parentElement!.parentElement!.querySelectorAll("figure")].map((figure) => figure.textContent);
    expect(figures("Base")).toEqual(["100%00"]);
    expect(figures("Woodsmoke")[0]).toBe("5097%00");
  });

  it("matches the Small, Medium and Large icons by name, a row each", () => {
    setup();
    const table = screen.getByRole("table", { name: DESIGN_SYSTEM.iconSizes });
    const row = (name: string) =>
      within(table).getAllByRole("row").find((each) => each.firstElementChild?.textContent === name)!;
    const drawn = (name: string) => [...row(name).children].slice(1).map((cell) => cell.querySelector("svg") !== null);
    expect(drawn("Warning")).toEqual([true, false, true]);
    expect(drawn("Chevron Down")).toEqual([true, true, false]);
    expect(drawn("Alert")).toEqual([true, false, false]);
    expect(drawn("Kebab Menu")).toEqual([false, true, false]);
    expect(drawn("Upload")).toEqual([true, false, true]);
    expect(within(table).getAllByRole("row").filter((each) => each.firstElementChild?.textContent === "Warning")).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Small" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Medium" })).toBeNull();
    expect(screen.getByRole("region", { name: "Flag" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Large" })).toBeNull();
  });

  it("lists only the icons the app uses, with no switch to show the rest", () => {
    setup();
    const page = screen.getByRole("heading", { level: 1, name: "Icon" }).closest("section, article, div")!;
    const table = screen.getByRole("table", { name: DESIGN_SYSTEM.iconSizes });
    const names = within(table)
      .getAllByRole("row")
      .map((row) => row.firstElementChild?.textContent);
    expect(names).toContain("Bell");
    expect(names).toContain("Bell Unread");
    expect(names).not.toContain("Attach");
    expect(document.querySelector("figure[data-unused]")).toBeNull();
    expect(within(page as HTMLElement).queryByRole("switch")).toBeNull();
  });

});

describe("the part of the page in view", () => {
  it("is the last whose top has reached the line, or else the first", () => {
    expect(inView([0, 500, 900], 600)).toBe(1);
    expect(inView([0, 500, 900], 900)).toBe(2);
    expect(inView([100, 500], 50)).toBe(0);
  });
});

describe("the design system's window, sent to a page", () => {
  const sent = (at: string | null = null) => {
    const ref = createRef<DesignSystemHandle>();
    const window = setup(at, ref);
    return { ...window, go: (page: string, target?: string) => act(() => ref.current!.go(page, target)) };
  };
  const group = (name: string) => screen.getByRole("heading", { level: 2, name }).parentElement!;
  const targets = () => [...document.querySelectorAll("[data-target]")];

  it("opens the Guidelines with the group asked for marked as the target, landed on", () => {
    const original = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return this.hasAttribute("data-target") ? ({ top: 1200, bottom: 1600 } as DOMRect) : original.call(this);
    });
    const { go, current, titles, scrollTo } = sent();
    go("guidelines", "Design");
    expect(current()).toEqual([DESIGN_SYSTEM.guidelines]);
    expect(titles()).toEqual([DESIGN_SYSTEM.guidelines]);
    expect(targets()).toEqual([group("Design")]);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1200, behavior: "auto" });
  });

  it("moves the target to the group asked for next, and drops it once another page is opened", async () => {
    const { go, open } = sent();
    go("guidelines", "Design");
    go("guidelines", "Design engineering");
    expect(targets()).toEqual([group("Design engineering")]);
    await open("Colors");
    await open(DESIGN_SYSTEM.guidelines);
    expect(targets()).toEqual([]);
  });

  it("opens the foundations at Colors on its palette, whichever tab Colors was left on", async () => {
    const { user, go, current, titles } = sent("colors");
    await user.click(screen.getByRole("tab", { name: "Surface" }));
    go("colors");
    expect(current()).toEqual(["Colors"]);
    expect(titles()).toEqual(FOUNDATIONS);
    expect(screen.getByRole("tab", { name: DESIGN_SYSTEM.palette }).getAttribute("aria-selected")).toBe("true");
  });

  it("opens a group of components at its first, as the overview's Components card does", () => {
    const { go, current, titles } = sent();
    go("Primitives");
    expect(current()).toEqual([inSidebar(CATEGORIES[0].stories[0].id)]);
    expect(titles()).toEqual([CATEGORIES[0].stories[0].id]);
  });
});
