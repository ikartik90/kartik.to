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
    // One demo in the mocked registry is a picture of somewhere else, which is
    // what the card's link keys off — see `link` on the real entry.
    link:
      id === "shader-preset-reel"
        ? { href: "/playground/shader", label: "Shader playground" }
        : undefined,
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

/** A card for the one demo in the mocked registry that points somewhere. */
const linked = (id: string): GridCard => ({
  ...(component(id) as Extract<GridCard, { kind: "component" }>),
  componentId: "shader-preset-reel",
  aspect: "1/1",
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
    expect(container.querySelector("a")?.hasAttribute("tabindex")).toBe(false);
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
    const cell = container.querySelectorAll(
      "[data-grid-cell]",
    )[1] as HTMLElement;
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
    await user.click(
      within(logControl()!).getByRole("option", { name: "Hide" }),
    );

    expect(useGridDraftStore.getState().loggers).toEqual({
      "component:c1": false,
    });
    expect(actions.saveGridLayout).not.toHaveBeenCalled();
  });

  it("shows the card's log panel again from the same control", async () => {
    const user = userEvent.setup();
    render(<HomeGrid cards={[logging("c1", false)]} editable />);

    await user.click(customize()[0]);
    await user.click(
      within(logControl()!).getByRole("option", { name: "Show" }),
    );

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
    await user.click(
      within(logControl()!).getByRole("option", { name: "Hide" }),
    );

    expect(
      within(logControl()!)
        .getByRole("option", { name: "Hide" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// The grid publishes its own width.
//
// The masonry fallback computes each card's row span with `tan(atan2(A, B))`,
// the only construction in CSS that divides one length by another. WebKit gets
// it wrong the moment a CONTAINER QUERY UNIT is one of the operands — measured
// in Safari 26.6.2, `tan(atan2(100cqw, 799px))` inside a 799px `inline-size`
// container resolves `100cqw` against the VIEWPORT, and routed through an
// unregistered custom property first it computes to 0 outright. So the grid
// hands the arithmetic a PLAIN PIXEL length instead, measured here.
//
// One observer, on the grid — not one per card. The card's own height is
// already measured by `GridItem`; the grid's width is one number for all of
// them, and measuring it per card would be a layout pass per card per resize.
// ---------------------------------------------------------------------------

/** A stand-in ResizeObserver that hands every observed element to the callback. */
class StubResizeObserver {
  static callbacks = new Set<ResizeObserverCallback>();

  constructor(private callback: ResizeObserverCallback) {
    StubResizeObserver.callbacks.add(callback);
  }

  observe() {}
  unobserve() {}

  disconnect() {
    StubResizeObserver.callbacks.delete(this.callback);
  }

  /** Re-run every live observer, as the browser would after a reflow. */
  static flush() {
    for (const callback of [...StubResizeObserver.callbacks]) {
      callback([], {} as ResizeObserver);
    }
  }
}

/** jsdom lays nothing out, so the grid's box is stated rather than measured. */
function stubWidth(width: number) {
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      width,
      height: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: 0,
    }),
  });
}

describe("HomeGrid width measurement", () => {
  const realObserver = global.ResizeObserver;
  const realRect = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "getBoundingClientRect",
  );

  beforeEach(() => {
    global.ResizeObserver =
      StubResizeObserver as unknown as typeof ResizeObserver;
    useGridDraftStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    global.ResizeObserver = realObserver;
    StubResizeObserver.callbacks.clear();
    if (realRect) {
      Object.defineProperty(
        HTMLElement.prototype,
        "getBoundingClientRect",
        realRect,
      );
    }
  });

  const grid = (container: HTMLElement) =>
    container.querySelector("[data-columns]") as HTMLElement;

  it("publishes its own width as a plain pixel length", () => {
    stubWidth(799);
    const { container } = render(<HomeGrid cards={[post("a")]} />);
    expect(grid(container).style.getPropertyValue("--grid-width")).toBe(
      "799px",
    );
  });

  // Up, never down, for the same reason `--card-height` rounds up: the span is
  // a whole number of 1px rows, and a width rounded down understates the
  // shape's height, which hands the next card a row this one is still using.
  it("rounds a fractional width up", () => {
    stubWidth(798.328125);
    const { container } = render(<HomeGrid cards={[post("a")]} />);
    expect(grid(container).style.getPropertyValue("--grid-width")).toBe(
      "799px",
    );
  });

  it("republishes the width when the grid is remeasured", () => {
    stubWidth(640);
    const { container } = render(<HomeGrid cards={[post("a")]} />);
    expect(grid(container).style.getPropertyValue("--grid-width")).toBe(
      "640px",
    );

    stubWidth(960);
    StubResizeObserver.flush();
    expect(grid(container).style.getPropertyValue("--grid-width")).toBe(
      "960px",
    );
  });

  // The flag and the width are ONE fact, and the stylesheet leans on that: the
  // 1px-row tier is gated on `data-measured`, and `--grid-width` falls back to
  // `100cqw` for everything outside it. A grid flagged measured with no width
  // published would put a `cqw` back inside the `atan2` — the exact WebKit
  // failure this arrangement exists to remove.
  it("does not mark itself measured until it has a width", () => {
    stubWidth(0);
    const { container } = render(<HomeGrid cards={[post("a")]} />);
    expect(grid(container).style.getPropertyValue("--grid-width")).toBe("");
    expect(grid(container).hasAttribute("data-measured")).toBe(false);

    stubWidth(799);
    StubResizeObserver.flush();
    expect(grid(container).style.getPropertyValue("--grid-width")).toBe(
      "799px",
    );
    expect(grid(container).hasAttribute("data-measured")).toBe(true);
  });

  // A ResizeObserver watches the CONTENT BOX, so it fires on height as well as
  // width — and height is exactly what this hook's own publication changes,
  // since `--grid-width` decides every card's row span. Writing the property
  // and the flag on every notification invalidates style for the grid and all
  // of its cards, which produces the next notification, and WebKit reports the
  // cycle as "ResizeObserver loop completed with undelivered notifications" —
  // a window `error` event, not a console line. Measured in Safari 26.6.2 over
  // five window resizes: 5 errors against 0 before the hook existed, and it
  // fires with `grid-lanes` on too, where the span arithmetic is not even
  // running. Publishing only on a CHANGED width is what breaks it.
  it("writes nothing when it is remeasured at the same width", () => {
    stubWidth(799);
    const { container } = render(<HomeGrid cards={[post("a")]} />);
    const node = grid(container);

    const setProperty = vi.spyOn(node.style, "setProperty");
    const setAttribute = vi.spyOn(node, "setAttribute");

    // A height-only notification: the box changed, the width did not.
    StubResizeObserver.flush();

    expect(setProperty).not.toHaveBeenCalled();
    expect(setAttribute).not.toHaveBeenCalled();
    // And what the first measurement published still stands.
    expect(node.style.getPropertyValue("--grid-width")).toBe("799px");
    expect(node.hasAttribute("data-measured")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Component cards: the link over a view-only demo, and the server-rendered
  // half that lets one paint before its chunk has loaded.
  // -------------------------------------------------------------------------

  // A demo that is a PICTURE of somewhere else is worth clicking, and clicking
  // it must not mean clicking the demo: the reel is a ground, not a control
  // panel, so the whole card is one link and nothing inside it takes a pointer.
  it("wraps a card whose demo points somewhere in a link to it", () => {
    render(<HomeGrid cards={[linked("a")]} />);

    expect(
      screen.getByRole("link", { name: /shader playground/i }),
    ).toHaveProperty("pathname", "/playground/shader");
  });

  // The demos that are played in place keep their pointer, and gain no link —
  // a card that navigated away from a scheduler you were using would be taking
  // the click you meant for the scheduler.
  it("leaves a card whose demo has no link unlinked", () => {
    render(<HomeGrid cards={[component("a")]} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTestId("demo")).toBeTruthy();
  });

  // The same rule `LinkCard` follows while the grid is being edited, and for
  // the same reason: `data-inert` stops the pointer, but the card is an
  // `<a href>` and Enter on a focused link navigates just as well.
  it("takes the card's link out of the tab order while editing", () => {
    render(<HomeGrid cards={[linked("a")]} editable />);

    expect(screen.getByRole("link").getAttribute("tabindex")).toBe("-1");
  });

  it("keeps the link followable when the grid is not being edited", () => {
    render(<HomeGrid cards={[linked("a")]} />);

    expect(screen.getByRole("link").hasAttribute("tabindex")).toBe(false);
  });

  // The server-rendered half. A demo whose data the page already fetched
  // arrives as a finished node, so the card paints it immediately instead of
  // mounting the browser's loader and waiting a chunk and a round trip.
  it("renders the server's node for a card that came with one", () => {
    render(
      <HomeGrid
        cards={[linked("a")]}
        demos={{ "component:a": <div data-testid="server-demo" /> }}
      />,
    );

    expect(screen.getByTestId("server-demo")).toBeTruthy();
    expect(screen.queryByTestId("demo")).toBeNull();
  });

  // Keyed by CARD, so the node built for one showing cannot be drawn in
  // another's seat — the two are published at different shapes.
  it("falls back to the browser for a card the server sent no node for", () => {
    render(
      <HomeGrid
        cards={[linked("a")]}
        demos={{ "component:b": <div data-testid="server-demo" /> }}
      />,
    );

    expect(screen.queryByTestId("server-demo")).toBeNull();
    expect(screen.getByTestId("demo")).toBeTruthy();
  });

  // A card inserted while editing has no server node and cannot have one: it
  // does not exist until the layout is saved. It must still draw.
  it("falls back to the browser when the page sent no nodes at all", () => {
    render(<HomeGrid cards={[linked("a")]} />);

    expect(screen.getByTestId("demo")).toBeTruthy();
  });
});
