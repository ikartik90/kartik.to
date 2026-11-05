import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHECK_INS, DESIGN_SYSTEM as DESIGN_SYSTEM_SHEET, LIVE_HEADS, LIVE_INTRO } from "../sheet-words";
import { AboutSheet } from "../about-sheet";
import { DEMO, SIDEBAR } from "../copy";
import { TourProvider } from "../tour";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

/** A window `width` px wide, as `matchMedia` answers its `min-width` queries in rem. */
function viewport(width: number) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: width >= Number(/min-width:\s*([\d.]+)rem/.exec(query)?.[1] ?? Infinity) * 16,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  );
}

function Harness({
  onClose,
  dockable,
  onPlay,
  onGo,
  project,
}: {
  onClose?: () => void;
  dockable?: boolean;
  onPlay?: Parameters<typeof AboutSheet>[0]["onPlay"];
  onGo?: Parameters<typeof AboutSheet>[0]["onGo"];
  project?: Parameters<typeof AboutSheet>[0]["project"];
}) {
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div ref={root}>
      <TourProvider root={root}>
        <button ref={opener} type="button" onClick={() => setOpen(true)}>
          {SIDEBAR.open}
        </button>
        <AboutSheet
          open={open}
          project={project}
          dockable={dockable}
          onPlay={onPlay}
          onGo={onGo}
          opener={opener}
          onClose={() => {
            onClose?.();
            setOpen(false);
          }}
        />
      </TourProvider>
    </div>
  );
}

async function setup({ dockable, project }: { dockable?: boolean; project?: Parameters<typeof AboutSheet>[0]["project"] } = {}) {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<Harness onClose={onClose} dockable={dockable} project={project} />);
  const sheet = screen.getByRole("complementary", { name: "About the project", hidden: true });
  return { user, onClose, sheet, open: () => user.click(screen.getByRole("button", { name: SIDEBAR.open })) };
}

const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

/** The rows in `scope` that `action` describes, each one button named by its words. */
const actionRows = (scope: HTMLElement, action: string) => within(scope).queryAllByRole("button", { description: action });

// Check-ins' roles, which Activation and retention shares.
const CHECK_INS_ROLES = ["Product management", "Product design", "Prototyping"];

/** The sheet's last card: its project's roles, a list under their label, then its year. */
function lastCard(sheet: HTMLElement, { roles, year }: { roles: string[]; year: string }) {
  const card = [...sheet.querySelectorAll<HTMLElement>("[data-card]")].at(-1)!;
  expect(before(within(card).getByText(SIDEBAR.facts.role), within(card).getByText(SIDEBAR.facts.year))).toBe(true);
  const list = within(card).getByRole("list", { name: SIDEBAR.facts.role });
  expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual(roles);
  expect(within(card).getByText(year)).toBeTruthy();
  return card;
}

describe("the About sheet", () => {
  it("tells Check-ins' story from its sheet: its sections as cards, in its order, then the metric, with no takeaway", async () => {
    const { sheet, open } = await setup();
    await open();
    const region = (name: string) => within(sheet).getByRole("region", { name });
    const cards = [
      SIDEBAR.headings.checkIns,
      SIDEBAR.headings.flexibility,
      SIDEBAR.headings.traceability,
      SIDEBAR.headings.invoice,
    ].map(region);
    const metric = within(sheet).getByRole("group", { name: CHECK_INS.outcome.label });
    expect([...cards, metric].every((card, i, all) => i === 0 || before(all[i - 1], card))).toBe(true);
    // The overlay sheet's role and year close the sheet in a card of their own, after the metric.
    const facts = lastCard(sheet, { roles: CHECK_INS_ROLES, year: LIVE_INTRO.year.value });
    expect(metric.closest("[data-card]")?.nextElementSibling).toBe(facts);
    // The metric sits on the card's plain ground, without the project cards' dots.
    expect(metric.querySelector(":scope > [aria-hidden]")).toBeNull();
    expect(within(cards[0]).queryByText(SIDEBAR.facts.role)).toBeNull();
    expect(within(sheet).queryByText("Responsibilities")).toBeNull();
    // Nothing comes before the sheet's own opening.
    expect(sheet.querySelector("[data-card]")).toBe(cards[0]);
    // A head's eyebrow labels its card; its paragraphs are the sheet's.
    expect(within(region(SIDEBAR.headings.flexibility)).getByText(LIVE_HEADS.checkIns.eyebrow)).toBeTruthy();
    expect(within(region(SIDEBAR.headings.invoice)).getByText(LIVE_HEADS.timesheet.eyebrow)).toBeTruthy();
    expect(within(region(SIDEBAR.headings.traceability)).getByText(CHECK_INS.traceability.eyebrow)).toBeTruthy();
    expect([...region(SIDEBAR.headings.checkIns).querySelectorAll("p")].map((p) => p.textContent)).toEqual(
      SIDEBAR.bodies.checkIns.replaceAll("*", "").split("\n\n"),
    );
    expect([...region(SIDEBAR.headings.flexibility).querySelectorAll("p")].map((p) => p.textContent)).toEqual(
      SIDEBAR.bodies.flexibility.replaceAll("*", "").split("\n\n"),
    );
    expect([...region(SIDEBAR.headings.traceability).querySelectorAll("p")].map((p) => p.textContent)).toEqual(
      SIDEBAR.bodies.traceability.replaceAll("*", "").split("\n\n"),
    );
  });

  it("tells the design system's story from its sheet, with no takeaway", async () => {
    const { sheet, open } = await setup({ project: "design-system" });
    await open();
    const { heads, outcome } = DESIGN_SYSTEM_SHEET;
    const region = (name: string) => within(sheet).getByRole("region", { name });
    const cards = [SIDEBAR.headings.designSystem, heads.tokens.heading, SIDEBAR.headings.components].map(region);
    expect(within(sheet).queryByRole("region", { name: heads.components.heading })).toBeNull();
    expect(within(cards[1]).getByText(heads.tokens.eyebrow)).toBeTruthy();
    expect(within(cards[2]).getByText(heads.components.eyebrow)).toBeTruthy();
    const metric = within(sheet).getByRole("group", { name: outcome.label });
    expect([...cards, metric].every((card, i, all) => i === 0 || before(all[i - 1], card))).toBe(true);
    expect(metric.closest("[data-card]")?.nextElementSibling).toBe(lastCard(sheet, { roles: ["Product design", "Design engineering", "Design system management"], year: "2024–25" }));
    expect(within(cards[0]).queryByText(SIDEBAR.facts.year)).toBeNull();
    expect(sheet.querySelector("[data-card]")).toBe(cards[0]);
  });

  it("tells Activation and retention's story: its lead, then Onboarding's and Shift scheduling's cards", async () => {
    viewport(1440);
    const onPlay = vi.fn();
    const user = userEvent.setup();
    render(<Harness dockable project="activation-and-retention" onPlay={onPlay} />);
    const sheet = screen.getByRole("complementary", { name: "About the project" });
    const cards = [
      SIDEBAR.headings.activationAndRetention,
      SIDEBAR.headings.onboarding,
      SIDEBAR.headings.shiftScheduling,
    ].map((name) => within(sheet).getByRole("region", { name }));
    const [lead, onboarding, shifts] = cards;
    expect(sheet.querySelector("[data-card]")).toBe(lead);
    expect(cards.every((card, i) => i === 0 || before(cards[i - 1], card))).toBe(true);
    expect(sheet.querySelectorAll("[data-card]")).toHaveLength(4);
    expect(within(onboarding).getByText(SIDEBAR.eyebrows.onboarding)).toBeTruthy();
    expect(within(shifts).getByText(SIDEBAR.eyebrows.shiftScheduling)).toBeTruthy();
    // Check-ins' role and 2024 close the sheet in a card of their own.
    expect(before(shifts, lastCard(sheet, { roles: CHECK_INS_ROLES, year: "2024" }))).toBe(true);
    expect(within(lead).queryByText(SIDEBAR.facts.role)).toBeNull();
    const plays = (card: HTMLElement) => actionRows(card, DEMO.play).map((row) => row.textContent);
    expect(plays(lead)).toEqual([]);
    expect(plays(onboarding)).toEqual([SIDEBAR.demos.onboarding]);
    expect(plays(shifts)).toEqual([SIDEBAR.demos.final, SIDEBAR.demos.recurrence, SIDEBAR.demos.old]);
    await user.click(within(shifts).getByText(SIDEBAR.demos.recurrence));
    expect(onPlay).toHaveBeenLastCalledWith({ label: SIDEBAR.demos.recurrence, version: "recurrence" });
    await user.click(within(onboarding).getByRole("button", { name: SIDEBAR.demos.onboarding }).querySelector("svg")!);
    expect(onPlay).toHaveBeenLastCalledWith({ label: SIDEBAR.demos.onboarding, version: "activation" });
  });

  it("is inert and no escape layer while closed", async () => {
    const { sheet, open } = await setup();
    expect(sheet.hasAttribute("inert")).toBe(true);
    expect(sheet.hasAttribute("data-escape-layer")).toBe(false);
    await open();
    expect(sheet.hasAttribute("inert")).toBe(false);
    expect(sheet.hasAttribute("data-escape-layer")).toBe(true);
  });

  it("takes focus to its Close on opening, and gives it back to its opener on closing", async () => {
    const { user, sheet, open } = await setup();
    await open();
    const close = within(sheet).getByRole("button", { name: "Close" });
    expect(document.activeElement).toBe(close);
    await user.click(close);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: SIDEBAR.open }));
  });

  it("fades the bar round its Close in as far as a card is scrolled up under it", async () => {
    const { sheet, open } = await setup();
    await open();
    const bar = within(sheet).getByRole("button", { name: "Close" }).parentElement!;
    const column = sheet.querySelector("[data-overlay-motion=cards]")!;
    const card = sheet.querySelector("[data-card]")!;
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({ top: 32, bottom: 88, height: 56 } as DOMRect);
    const shown = (top: number) => {
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({ top, bottom: top + 400 } as DOMRect);
      fireEvent.scroll(column);
      return Number(bar.style.getPropertyValue("--bar-shown"));
    };
    expect(shown(100)).toBe(0);
    expect(shown(60)).toBe(0.5);
    expect(shown(20)).toBe(1);
    expect(shown(-200)).toBe(1);
    expect(shown(88)).toBe(0);
  });

  it("closes on the Escape its layer is sent", async () => {
    const { onClose, sheet, open } = await setup();
    await open();
    act(() => void sheet.dispatchEvent(new Event("escape-layer")));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on a press on the blur beside its cards, not on a card", async () => {
    const { user, onClose, sheet, open } = await setup();
    await open();
    await user.click(within(sheet).getByText(SIDEBAR.facts.role));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(sheet);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("offers no properties to tune its look", async () => {
    const { sheet, open } = await setup();
    await open();
    expect(within(sheet).queryByRole("button", { name: "About sheet properties" })).toBeNull();
  });

  it("swaps its cards for the comment editor while editing comments, in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { user, sheet, open } = await setup();
    await open();
    await user.click(within(sheet).getByRole("button", { name: "Edit comments" }));
    expect(within(sheet).queryByRole("region", { name: SIDEBAR.headings.checkIns })).toBeNull();
    expect(within(sheet).getByRole("heading", { name: "Comments" })).toBeTruthy();
    vi.unstubAllEnvs();
  });

  it("offers no comment editor on the live site", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { sheet, open } = await setup();
    await open();
    expect(within(sheet).queryByRole("button", { name: "Edit comments" })).toBeNull();
    vi.unstubAllEnvs();
  });
});

describe("the About sheet, beside the window", () => {
  it("docks from 1440px wide: shown unopened, leaving focus, Escape and presses beside its cards to the overlay", async () => {
    viewport(1440);
    const { user, onClose, sheet } = await setup({ dockable: true });
    expect(sheet.hasAttribute("inert")).toBe(false);
    expect(sheet.hasAttribute("data-escape-layer")).toBe(false);
    expect(sheet.contains(document.activeElement)).toBe(false);
    fireEvent.click(sheet);
    expect(onClose).not.toHaveBeenCalled();
    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("floats over the window below 1440px, opened by its button", async () => {
    viewport(1439);
    const { sheet, open } = await setup({ dockable: true });
    expect(sheet.hasAttribute("inert")).toBe(true);
    await open();
    expect(sheet.hasAttribute("data-escape-layer")).toBe(true);
    expect(document.activeElement).toBe(within(sheet).getByRole("button", { name: "Close" }));
  });

  it("floats at every width for a project it can't dock beside", async () => {
    viewport(1920);
    const { sheet } = await setup();
    expect(sheet.hasAttribute("inert")).toBe(true);
  });
});

function setupPlay() {
  viewport(1440);
  const user = userEvent.setup();
  const onPlay = vi.fn();
  render(<Harness dockable onPlay={onPlay} />);
  const sheet = screen.getByRole("complementary", { name: "About the project" });
  const card = (name: string) => within(sheet).getByRole("region", { name });
  return { user, onPlay, sheet, card };
}

describe("the About sheet's cards", () => {
  // A card's words fold away under its head: inert, and out of the accessibility tree.
  const folded = (card: HTMLElement) => [...card.querySelectorAll("p")].every((p) => p.closest("[inert]"));
  const chevron = (card: HTMLElement) => card.querySelector("[data-chevron]");

  it("opens the first in full, and folds the words of the rest under a chevron on their eyebrow's line", () => {
    const { card } = setupPlay();
    const lead = card(SIDEBAR.headings.checkIns);
    expect(chevron(lead)).toBeNull();
    expect(within(lead).queryByRole("button")).toBeNull();
    expect(folded(lead)).toBe(false);
    for (const heading of [SIDEBAR.headings.flexibility, SIDEBAR.headings.invoice, SIDEBAR.headings.traceability]) {
      const head = within(card(heading)).getByRole("heading");
      expect(chevron(card(heading))?.tagName).toBe("svg");
      expect(chevron(card(heading))?.closest("button")).toBeNull();
      expect(chevron(card(heading))?.parentElement).toBe(head.parentElement);
      // For the keyboard, the heading's words are the card's toggle.
      const toggle = within(head).getByRole("button", { name: heading, expanded: false });
      expect(toggle.getAttribute("aria-controls")).toBe(card(heading).querySelector("p")!.closest("[inert]")!.id);
      expect(folded(card(heading))).toBe(true);
    }
  });

  it("unfolds and folds again from a press anywhere on it but its demo rows", async () => {
    const { user, onPlay, card } = setupPlay();
    const invoice = card(SIDEBAR.headings.invoice);
    const toggle = within(invoice).getByRole("button", { name: SIDEBAR.headings.invoice });
    await user.click(within(invoice).getByText(SIDEBAR.demos.invoice));
    expect(onPlay).toHaveBeenCalledOnce();
    expect(folded(invoice)).toBe(true);
    await user.click(chevron(invoice)!);
    expect(folded(invoice)).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    await user.click(invoice.querySelector("p")!);
    expect(folded(invoice)).toBe(true);
    await user.click(within(invoice).getByText(LIVE_HEADS.timesheet.eyebrow));
    expect(folded(invoice)).toBe(false);
    await user.click(toggle);
    expect(folded(invoice)).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("unfolds and folds from its heading's toggle by keyboard", async () => {
    const { user, card } = setupPlay();
    const flexibility = card(SIDEBAR.headings.flexibility);
    within(flexibility).getByRole("button", { name: SIDEBAR.headings.flexibility }).focus();
    await user.keyboard("{Enter}");
    expect(folded(flexibility)).toBe(false);
    await user.keyboard(" ");
    expect(folded(flexibility)).toBe(true);
  });
});

describe("the About sheet's Play", () => {
  it("sits under the words of the Check-ins page's card, the Timesheet's and the dashboard's: a row for each demo, one button named by what it plays", () => {
    const { sheet, card } = setupPlay();
    for (const [heading, ...labels] of [
      [SIDEBAR.headings.flexibility, SIDEBAR.demos.flexibility, SIDEBAR.demos.geofence],
      [SIDEBAR.headings.invoice, SIDEBAR.demos.invoice],
      [SIDEBAR.headings.traceability, SIDEBAR.demos.traceability, SIDEBAR.demos.riskSignals],
    ]) {
      const plays = actionRows(card(heading), DEMO.play);
      expect(plays.map((row) => row.textContent)).toEqual(labels);
      for (const row of plays) {
        expect(before([...card(heading).querySelectorAll("p")].at(-1)!, row)).toBe(true);
        // Its Play is drawn in the row, not a button of its own.
        expect(row.querySelector("svg")).not.toBeNull();
        expect(within(row).queryByRole("button")).toBeNull();
      }
    }
    expect(actionRows(sheet, DEMO.play)).toHaveLength(5);
  });

  it("plays each demo from a press anywhere on its row, its words or its Play", async () => {
    const { user, onPlay, card } = setupPlay();
    const demos = [
      [SIDEBAR.headings.flexibility, { label: SIDEBAR.demos.flexibility, version: "company" }],
      [SIDEBAR.headings.flexibility, { label: SIDEBAR.demos.geofence, version: "company", name: "geofence" }],
      [SIDEBAR.headings.invoice, { label: SIDEBAR.demos.invoice, version: "company", name: "timesheet" }],
      [SIDEBAR.headings.traceability, { label: SIDEBAR.demos.traceability, version: "admin" }],
      [SIDEBAR.headings.traceability, { label: SIDEBAR.demos.riskSignals, version: "admin", name: "risk" }],
    ] as const;
    for (const [heading, demo] of demos) {
      const row = within(card(heading)).getByRole("button", { name: demo.label });
      await user.click(within(row).getByText(demo.label));
      expect(onPlay).toHaveBeenLastCalledWith(demo);
      await user.click(row.querySelector("svg")!);
      expect(onPlay).toHaveBeenLastCalledWith(demo);
    }
    expect(onPlay).toHaveBeenCalledTimes(demos.length * 2);
  });

  it("lights its Play and shows the Play demo tooltip from anywhere on its row", () => {
    const { card } = setupPlay();
    const row = within(card(SIDEBAR.headings.traceability)).getByRole("button", {
      name: SIDEBAR.demos.traceability,
      description: DEMO.play,
    });
    expect(row.querySelector("[data-hover]")).toBeNull();
    fireEvent.pointerEnter(row, { pointerType: "mouse", clientX: 5, clientY: 5 });
    expect(row.querySelector("svg")?.closest("[data-hover]")).not.toBeNull();
    const tip = screen.getAllByText(DEMO.play).map((label) => label.closest("[data-visible]")).find(Boolean);
    expect(tip?.textContent).toBe(DEMO.play);
    expect(tip?.querySelector("svg")).toBeNull();
    fireEvent.pointerLeave(row, { pointerType: "mouse" });
    expect(row.querySelector("[data-hover]")).toBeNull();
  });

  it("isn't there without a demo to play, as the default variant has it", async () => {
    const { sheet, open } = await setup();
    await open();
    expect(actionRows(sheet, DEMO.play)).toEqual([]);
    expect(sheet.querySelector("[data-row]")).toBeNull();
  });
});

describe("the About sheet's pages of the design system", () => {
  const { heads } = DESIGN_SYSTEM_SHEET;
  const { links } = SIDEBAR;

  function setupGo() {
    viewport(1440);
    const user = userEvent.setup();
    const onGo = vi.fn();
    render(<Harness dockable project="design-system" onGo={onGo} />);
    const sheet = screen.getByRole("complementary", { name: "About the project" });
    const card = (name: string) => within(sheet).getByRole("region", { name });
    const opens = (name: string) => actionRows(card(name), links.open);
    return { user, onGo, sheet, card, opens };
  }

  it("ends the Tokens and Components cards on rows past their words, each one button named by the page it opens", () => {
    const { sheet, card, opens } = setupGo();
    const labels = (name: string) => opens(name).map((row) => row.textContent);
    expect(labels(heads.tokens.heading)).toEqual([links.guideline, links.tokens]);
    expect(labels(SIDEBAR.headings.components)).toEqual([links.engineering, links.components]);
    expect(actionRows(sheet, links.open)).toHaveLength(4);
    const tokens = card(heads.tokens.heading);
    expect(before([...tokens.querySelectorAll("p")].at(-1)!, opens(heads.tokens.heading)[0])).toBe(true);
    expect(within(opens(heads.tokens.heading)[0]).queryByRole("button")).toBeNull();
  });

  it("opens the Guidelines at Design or Design engineering, Colors and the first primitive from anywhere on their rows, described by a tooltip, leaving its card folded", async () => {
    const { user, onGo, card, opens } = setupGo();
    const [guideline, tokens] = opens(heads.tokens.heading);
    fireEvent.pointerEnter(guideline, { pointerType: "mouse", clientX: 5, clientY: 5 });
    const tip = screen.getAllByText(links.open).map((label) => label.closest("[data-visible]")).find(Boolean);
    expect(tip?.textContent).toBe(links.open);
    expect(tip?.querySelector("svg")).toBeNull();
    await user.click(within(guideline).getByText(links.guideline));
    expect(onGo).toHaveBeenLastCalledWith({ label: links.guideline, page: "guidelines", target: "Design" });
    await user.click(tokens.querySelector("svg")!);
    expect(onGo).toHaveBeenLastCalledWith({ label: links.tokens, page: "colors" });
    const [engineering, components] = opens(SIDEBAR.headings.components);
    await user.click(engineering);
    expect(onGo).toHaveBeenLastCalledWith({ label: links.engineering, page: "guidelines", target: "Design engineering" });
    await user.click(within(components).getByText(links.components));
    expect(onGo).toHaveBeenLastCalledWith({ label: links.components, page: "Primitives" });
    expect(card(heads.tokens.heading).hasAttribute("data-folded")).toBe(true);
    expect(card(SIDEBAR.headings.components).hasAttribute("data-folded")).toBe(true);
  });

  it("isn't there without a page to open, as the default variant has it", async () => {
    const { sheet, open } = await setup({ project: "design-system" });
    await open();
    expect(actionRows(sheet, links.open)).toEqual([]);
    expect(sheet.querySelector("[data-row]")).toBeNull();
  });
});

