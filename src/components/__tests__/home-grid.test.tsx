// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` is hoisted above the file, so anything its factory closes over has
// to be hoisted with it.
const { actions } = vi.hoisted(() => ({
  actions: {
    setPinned: vi.fn(),
    moveGridItem: vi.fn(),
    publishComponent: vi.fn(),
    saveGridLayout: vi.fn(),
    unpublishComponent: vi.fn(),
  },
}));
vi.mock("@/app/actions/grid", () => actions);

// The picker and the live demo frame are heavy and prove nothing here.
vi.mock("@/components/component-insert-dialog", () => ({
  ComponentInsertDialog: () => null,
}));
vi.mock("@/components/demo-frame", () => ({
  DemoFrame: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/demo-component", () => ({
  DemoComponent: () => <div data-testid="demo" />,
}));
vi.mock("@/components/demo/registry", () => ({
  // Only one of these demos logs, which is what the log control keys off —
  // "can this card log at all" is the registry's answer, not the row's.
  getDemoComponent: (id: string) => ({
    id,
    label: id,
    load: vi.fn(),
    logger: id === "calchemy-demo" ? true : undefined,
  }),
}));

import { HomeGrid } from "../home-grid";
import { useGridDraftStore } from "@/store/grid-draft";
import type { GridCard } from "@/lib/grid";

const post = (id: string, gridIndex: number | null = null): GridCard => ({
  kind: "post",
  key: `post:${id}`,
  id,
  title: id,
  href: `/work/${id}`,
  date: null,
  gridIndex,
  publishedAt: new Date("2026-01-01"),
  aspect: "16/9",
  span: 1,
});

const component = (id: string, gridIndex: number | null = null): GridCard => ({
  kind: "component",
  key: `component:${id}`,
  id,
  componentId: "cosmic-track",
  logger: false,
  gridIndex,
  publishedAt: new Date("2026-01-01"),
  aspect: "3/2",
  span: 1,
});

/** A card for the one demo in the mocked registry that logs. */
const logging = (id: string, logger = true): GridCard => ({
  ...(component(id) as Extract<GridCard, { kind: "component" }>),
  componentId: "calchemy-demo",
  logger,
});

describe("HomeGrid", () => {
  beforeEach(() => {
    // jsdom implements neither, and the confirm dialog is a real `<dialog>`.
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute("open");
    });
    Object.values(actions).forEach((fn) => fn.mockReset());
    // The draft is global and outlives a render, exactly as it does in the app.
    useGridDraftStore.getState().reset();
  });
  afterEach(cleanup);

  // `/` renders this plain; only `/edit/home` passes `editable`, and that route
  // has already turned away anyone who is not the admin.
  it("shows no controls when not editable", () => {
    render(<HomeGrid cards={[post("a")]} />);
    expect(screen.queryByRole("button", { name: /pin/i })).toBeNull();
  });

  // The editing DIALOGS are markup, not just controls: a closed `<dialog>`
  // renders its contents into the document, so mounting them outside edit mode
  // ships "You are about to unpublish this component" to every visitor of the
  // public homepage. Invisible is not the same as absent, and an e2e check for
  // admin text on `/` is what found this.
  it("mounts no editing dialogs when not editable", () => {
    const { container } = render(
      <HomeGrid cards={[post("a"), component("c1")]} />,
    );
    expect(container.querySelector("dialog")).toBeNull();
    expect(container.textContent).not.toMatch(/unpublish/i);
  });

  it("mounts them once editing", () => {
    const { container } = render(
      <HomeGrid cards={[post("a"), component("c1")]} editable />,
    );
    expect(container.querySelector("dialog")).not.toBeNull();
  });

  // Clicking a card in edit mode would navigate away and take the unsaved
  // layout with it, and a component card is a live demo that would respond to
  // the click as well.
  it("makes cards unfollowable while editing", () => {
    const { container } = render(
      <HomeGrid cards={[post("a"), component("c1")]} editable />,
    );
    expect(container.querySelectorAll("[data-inert]")).toHaveLength(2);
    for (const a of container.querySelectorAll("a")) {
      expect(a.getAttribute("tabindex")).toBe("-1");
    }
  });

  it("leaves cards followable when not editing", () => {
    const { container } = render(<HomeGrid cards={[post("a")]} />);
    expect(container.querySelectorAll("[data-inert]")).toHaveLength(0);
    expect(
      container.querySelector("a")?.hasAttribute("tabindex"),
    ).toBe(false);
  });

  it("shows controls when editable", () => {
    render(<HomeGrid cards={[post("a")]} editable />);
    expect(screen.getAllByRole("button", { name: /pin/i })).toHaveLength(1);
  });

  // The seat a pin claims is the card's position in the RENDERED order, which
  // is the whole contract between the ordering and the toolbar.
  it("pins a card to the index it is currently rendered at", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[post("a"), post("b"), post("c")]} editable />);

    await user.click(screen.getAllByRole("button", { name: /pin/i })[2]);
    expect(useGridDraftStore.getState().pins).toEqual({ "post:c": 2 });
  });

  // Nothing is written as you click — that is what leaves "Discard and exit"
  // something to discard.
  it("writes nothing to the server while editing", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[post("a")]} editable />);

    await user.click(screen.getByRole("button", { name: /pin/i }));
    expect(actions.setPinned).not.toHaveBeenCalled();
    expect(actions.saveGridLayout).not.toHaveBeenCalled();
  });

  it("releases a pinned card back to chronology", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[post("a", 0)]} editable />);

    await user.click(screen.getByRole("button", { name: /pin/i }));
    expect(useGridDraftStore.getState().pins).toEqual({ "post:a": null });
  });

  it("moves a component by its key, not by its table", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[post("a", 0), component("c1", 1)]} editable />);

    await user.click(screen.getAllByRole("button", { name: /move back/i })[1]);
    expect(useGridDraftStore.getState().pins).toEqual({ "component:c1": 0 });
  });

  it("offers unpublish on components only", () => {
    render(<HomeGrid cards={[post("a"), component("c1")]} editable />);
    expect(screen.getAllByRole("button", { name: /unpublish/i })).toHaveLength(
      1,
    );
  });

  // Unpublishing is confirmed, not immediate — the press opens the question.
  it("asks before unpublishing a component", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[component("c1")]} editable />);

    await user.click(screen.getByRole("button", { name: /unpublish/i }));
    expect(useGridDraftStore.getState().removals).toEqual([]);
    expect(screen.getByText(/about to unpublish this component/i)).toBeTruthy();
  });

  it("stops the ends of the grid moving further out", () => {
    render(<HomeGrid cards={[post("a", 0), post("b", 1)]} editable />);
    const back = screen.getAllByRole("button", { name: /move back/i });
    const fwd = screen.getAllByRole("button", { name: /move forward/i });
    expect(back[0].hasAttribute("disabled")).toBe(true);
    expect(fwd[0].hasAttribute("disabled")).toBe(false);
    expect(fwd[1].hasAttribute("disabled")).toBe(true);
  });

  // A masonry of near-identical tiles gives no clue where a moved card landed,
  // so the one that moved is ringed.
  it("rings the card that was just moved, and only that one", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HomeGrid cards={[post("a", 0), post("b", 1)]} editable />,
    );
    expect(container.querySelectorAll("[data-moved]")).toHaveLength(0);

    await user.click(
      screen.getAllByRole("button", { name: /move forward/i })[0],
    );
    const ringed = container.querySelectorAll("[data-moved]");
    expect(ringed).toHaveLength(1);
    expect(ringed[0].textContent).toContain("a");
  });

  // Two cards, because a lone card cannot move forward — it is already the end
  // of the grid and the control is correctly disabled.
  it("drops the ring when the moved card is unpinned", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HomeGrid cards={[post("a", 0), post("b", 1)]} editable />,
    );

    await user.click(
      screen.getAllByRole("button", { name: /move forward/i })[0],
    );
    const ringed = container.querySelector("[data-moved]");
    expect(ringed).not.toBeNull();

    // Unpin the ringed card itself, not whichever is first — the move may have
    // reordered them.
    const pin = ringed!.querySelector<HTMLButtonElement>(
      'button[aria-label="Pin"]',
    );
    await user.click(pin!);
    expect(container.querySelectorAll("[data-moved]")).toHaveLength(0);
  });

  // --- Column span ---------------------------------------------------------

  const spanOf = (cell: Element) =>
    (cell as HTMLElement).style.getPropertyValue("--span");

  it("widens the card the control was pressed on, and only that one", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HomeGrid cards={[post("a"), post("b"), post("c")]} editable />,
    );

    await user.click(screen.getAllByRole("button", { name: /add column/i })[1]);

    expect(useGridDraftStore.getState().spans).toEqual({ "post:b": 2 });
    const cells = container.querySelectorAll("[data-grid-cell]");
    expect([...cells].map(spanOf)).toEqual(["1", "2", "1"]);
  });

  it("narrows a widened card back down", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HomeGrid cards={[post("a"), post("b"), post("c")]} editable />,
    );

    await user.click(screen.getAllByRole("button", { name: /add column/i })[0]);
    await user.click(
      screen.getAllByRole("button", { name: /remove column/i })[0],
    );

    expect(useGridDraftStore.getState().spans).toEqual({ "post:a": 1 });
    expect(spanOf(container.querySelectorAll("[data-grid-cell]")[0])).toBe("1");
  });

  // Nothing reaches the database until the palette's "Publish and exit" — a
  // width is a layout edit like any other and buffers with the rest.
  it("writes no width to the server while editing", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[post("a"), post("b"), post("c")]} editable />);

    await user.click(screen.getAllByRole("button", { name: /add column/i })[0]);
    expect(actions.saveGridLayout).not.toHaveBeenCalled();
  });

  it("will not narrow a card below the column it sits in", () => {
    render(<HomeGrid cards={[post("a"), post("b"), post("c")]} editable />);
    expect(
      screen
        .getAllByRole("button", { name: /remove column/i })[0]
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  // Three cards is a three-column grid, so the third press is the one that has
  // nowhere left to go.
  it("will not widen a card past the columns the grid has", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[post("a"), post("b"), post("c")]} editable />);
    const add = () => screen.getAllByRole("button", { name: /add column/i })[0];

    await user.click(add());
    await user.click(add());

    expect(useGridDraftStore.getState().spans).toEqual({ "post:a": 3 });
    expect(add().hasAttribute("disabled")).toBe(true);
  });

  // The ceiling is the grid's own column count, which a small listing lowers —
  // a two-card grid is two columns wide, so two is as wide as a card can get.
  it("takes its ceiling from the grid the cards are actually in", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[post("a"), post("b")]} editable />);
    const add = () => screen.getAllByRole("button", { name: /add column/i })[0];

    await user.click(add());

    expect(useGridDraftStore.getState().spans).toEqual({ "post:a": 2 });
    expect(add().hasAttribute("disabled")).toBe(true);
  });

  it("widens a component card by its own key", async () => {
    const user = userEvent.setup();
    render(
      <HomeGrid cards={[post("a"), component("c1"), post("b")]} editable />,
    );

    await user.click(screen.getAllByRole("button", { name: /add column/i })[1]);
    expect(useGridDraftStore.getState().spans).toEqual({ "component:c1": 2 });
  });

  // --- Aspect ratio --------------------------------------------------------

  it("reshapes the card the picker was opened from", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HomeGrid cards={[post("a"), post("b"), post("c")]} editable />,
    );

    await user.click(
      screen.getAllByRole("button", { name: /^aspect ratio$/i })[1],
    );
    await user.click(screen.getByRole("button", { name: "4:3" }));

    expect(useGridDraftStore.getState().aspects).toEqual({ "post:b": "4/3" });
    const cell = container.querySelectorAll("[data-grid-cell]")[1] as HTMLElement;
    expect(cell.style.getPropertyValue("--aspect-w")).toBe("4");
    expect(cell.style.getPropertyValue("--aspect-h")).toBe("3");
  });

  // One rail per card, and each is its own picker — opening one must not put
  // every other card into the same mode.
  it("opens the picker on one card at a time", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[post("a"), post("b")]} editable />);

    await user.click(
      screen.getAllByRole("button", { name: /^aspect ratio$/i })[0],
    );
    expect(screen.getAllByRole("button", { name: "16:9" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^pin$/i })).toHaveLength(1);
  });

  it("writes no shape to the server while editing", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[post("a"), post("b")]} editable />);

    await user.click(
      screen.getAllByRole("button", { name: /^aspect ratio$/i })[0],
    );
    await user.click(screen.getByRole("button", { name: "1:1" }));
    expect(actions.saveGridLayout).not.toHaveBeenCalled();
  });
});

// --- Customize -------------------------------------------------------------
//
// One docked panel for the whole grid, opened from the card whose properties
// it is showing. It is a SIBLING of the grid rather than a child of a cell:
// the panel is fixed to the viewport and only one card can be inspected at a
// time, so a copy per cell would be a dozen dialogs for one surface.

describe("HomeGrid — card properties", () => {
  beforeEach(() => {
    useGridDraftStore.getState().reset();
  });
  afterEach(cleanup);

  const customize = () => screen.getAllByRole("button", { name: /customize/i });
  const panel = () => screen.queryByRole("dialog", { name: "Card properties" });
  const logControl = () => screen.queryByRole("group", { name: "Log output" });

  it("offers customize on every card while editing", () => {
    render(<HomeGrid cards={[post("a"), component("c1")]} editable />);
    expect(customize()).toHaveLength(2);
  });

  it("offers it on no card outside edit mode", () => {
    render(<HomeGrid cards={[post("a"), component("c1")]} />);
    expect(screen.queryByRole("button", { name: /customize/i })).toBeNull();
  });

  it("opens the panel on the card it was pressed from", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[post("a"), logging("c1")]} editable />);
    expect(panel()).toBeNull();

    await user.click(customize()[1]);
    expect(panel()).not.toBeNull();
    expect(logControl()).not.toBeNull();
  });

  // The panel opens on a post too — what it holds differs by card, that it
  // opens does not.
  it("opens on a card with nothing to customize yet", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[post("a")]} editable />);

    await user.click(customize()[0]);
    expect(panel()).not.toBeNull();
    expect(logControl()).toBeNull();
  });

  // The button is the way back out as well as in, which is what the trigger
  // exemption on it is for: without it the outside-press dismiss would close
  // the panel and the click would reopen it.
  it("closes the panel on a second press of the same control", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[post("a")]} editable />);

    await user.click(customize()[0]);
    await user.click(customize()[0]);
    await waitFor(() => expect(panel()).toBeNull());
  });

  it("moves the panel to the card pressed next", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[post("a"), logging("c1")]} editable />);

    await user.click(customize()[0]);
    expect(logControl()).toBeNull();

    await user.click(customize()[1]);
    expect(logControl()).not.toBeNull();
  });

  // Whether a demo CAN log is the registry's answer; whether it currently
  // shows the panel is the row's. A demo the registry does not log has nothing
  // to show or hide.
  it("offers no log control for a demo that does not log", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[component("c1")]} editable />);

    await user.click(customize()[0]);
    expect(logControl()).toBeNull();
  });

  it("reads the log control off the card's own state", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[logging("c1", false)]} editable />);

    await user.click(customize()[0]);
    expect(
      within(logControl()!)
        .getByRole("option", { name: "Hide" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  // Buffered like every other edit the rail makes: nothing reaches the server
  // until "Publish and exit", so a discard still has something to discard.
  it("records a hidden log panel in the draft rather than writing it", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[logging("c1")]} editable />);

    await user.click(customize()[0]);
    await user.click(within(logControl()!).getByRole("option", { name: "Hide" }));

    expect(useGridDraftStore.getState().loggers).toEqual({
      "component:c1": false,
    });
    expect(actions.saveGridLayout).not.toHaveBeenCalled();
  });

  it("shows the card's log panel again from the same control", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[logging("c1", false)]} editable />);

    await user.click(customize()[0]);
    await user.click(within(logControl()!).getByRole("option", { name: "Show" }));

    expect(useGridDraftStore.getState().loggers).toEqual({
      "component:c1": true,
    });
  });

  // The control edits the DRAFT, so the panel has to read back through it —
  // otherwise the segment you just pressed springs back to the row's value.
  it("keeps the control on what the draft says", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[logging("c1")]} editable />);

    await user.click(customize()[0]);
    await user.click(within(logControl()!).getByRole("option", { name: "Hide" }));

    expect(
      within(logControl()!)
        .getByRole("option", { name: "Hide" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });
});
