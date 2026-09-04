// @vitest-environment jsdom
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { CalchemyDemo, __resetCalchemyDemoCache } from "../calchemy-demo";
import { DemoFrame } from "@/components/demo-frame";

// No mocks: the demo runs the real parser now. It used to mock
// `@calchemy/date-react` — the package it was built on and which no longer
// exists — and mocking the engine as well left the cases asserting against a
// stub of the very thing the demo is a demo OF.

afterEach(() => {
  cleanup();
  // The engine is module-cached; drop it so each case exercises fresh init.
  __resetCalchemyDemoCache();
});

/** The months on screen, named the way the calendar labels its grids. */
function monthLabels(): string[] {
  return screen
    .queryAllByRole("grid")
    .map((grid) => grid.getAttribute("aria-label") ?? "");
}

function selectedLabels(): string[] {
  return screen
    .queryAllByRole("gridcell", { selected: true })
    .map((cell) => cell.getAttribute("aria-label") ?? "");
}

/** The demo, mounted and waited for. */
async function renderDemo() {
  render(<CalchemyDemo />);
  const field = await screen.findByRole("searchbox", {
    name: "Natural language date query",
  });
  return { field, user: userEvent.setup() };
}

/**
 * Mount the demo inside a frame of a stated width.
 *
 * The demo reads the width off the `.demo-frame` it is standing in, so the
 * frame is real (jsdom lays nothing out, hence the stubbed rect) and a real
 * ResizeObserver is stubbed to report once, as the browser's does on observe.
 */
function renderInFrameOfWidth(width: number) {
  const realObserver = global.ResizeObserver;
  global.ResizeObserver = class {
    constructor(private cb: () => void) {}
    observe() {
      this.cb();
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  const rect = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({
      width,
      height: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: 0,
    } as DOMRect);

  const result = render(
    <DemoFrame logger>
      <CalchemyDemo />
    </DemoFrame>,
  );

  return {
    ...result,
    restore: () => {
      rect.mockRestore();
      global.ResizeObserver = realObserver;
    },
  };
}

describe("CalchemyDemo", () => {
  it("offers the query field once the engine lands", async () => {
    await renderDemo();
    expect(
      screen.getByPlaceholderText('Try "Mondays and Fridays next month"'),
    ).toBeDefined();
  });

  it("selects the days a typed phrase means", async () => {
    const { field, user } = await renderDemo();

    await user.type(field, "tomorrow");
    await waitFor(() => expect(selectedLabels()).toHaveLength(1));
  });

  // The card cannot scroll a century the way the playground does, so it MOVES
  // instead: a phrase answered outside the months on screen brings its own
  // month into them.
  it("moves the run of months to where the answer falls", async () => {
    const { field, user } = await renderDemo();
    expect(monthLabels()).not.toContain("December 2028");

    await user.type(field, "25 december 2028");
    await waitFor(() => expect(monthLabels()).toContain("December 2028"));
    expect(selectedLabels()).toEqual(["December 25, 2028"]);
  });

  // The shared readings row, driven by the shared hook — a phrase with more
  // than one meaning previews one and offers the rest.
  it("offers the readings of an ambiguous phrase, and settles on one", async () => {
    const { field, user } = await renderDemo();

    await user.type(field, "03/04/25");
    const readings = await screen.findAllByRole("button", {
      name: /2025|2003/,
    });
    expect(readings.length).toBeGreaterThan(1);

    // The first is previewed, so the grid is already drawing it.
    expect(readings[0].getAttribute("aria-current")).toBe("true");
    expect(readings[0].getAttribute("aria-pressed")).toBe("false");

    // Enter settles on it, which is a different thing from previewing it.
    await user.type(field, "{Enter}");
    await waitFor(() =>
      expect(readings[0].getAttribute("aria-pressed")).toBe("true"),
    );
  });

  it("says nothing to the log about an empty box", async () => {
    const { restore } = renderInFrameOfWidth(900);
    try {
      await waitFor(() =>
        expect(screen.getByText("No output logs available")).toBeDefined(),
      );
    } finally {
      restore();
    }
  });

  it("logs the parse through the demo logger", async () => {
    const { restore } = renderInFrameOfWidth(900);
    try {
      const field = await screen.findByRole("searchbox", {
        name: "Natural language date query",
      });
      // The logger is collapsed by default; expand it so its body exposes
      // role="log" and its entries become visible.
      fireEvent.click(screen.getByRole("button", { name: "Expand output logs" }));

      const user = userEvent.setup();
      await user.type(field, "qwerty");
      await waitFor(() =>
        expect(screen.getByRole("log").textContent).toContain("✕ invalid"),
      );

      await user.clear(field);
      await user.type(field, "next monday");
      await waitFor(() => {
        const panel = screen.getByRole("log");
        expect(panel.textContent).toContain("✓ valid");
        expect(panel.textContent).toContain('"kind": "single"');
      });
      expect(screen.getByRole("log").textContent).not.toContain("✕ invalid");
    } finally {
      restore();
    }
  });

  // --- Layout tier ---------------------------------------------------------
  //
  // The demo shows as many months as the frame is wide enough for, and pages by
  // exactly that many — one number, so getting the tier wrong is not a cosmetic
  // mistake. It is a calendar that shows one month and jumps three when you
  // press Next, which is what the published grid card once did on a phone.
  //
  // The tier has to be settled on MOUNT. Waiting for a resize that never comes
  // (a card's width does not change after it lands) leaves the demo on its
  // initial guess, which is the widest tier.
  it("opens on one month inside a narrow frame", async () => {
    const { restore } = renderInFrameOfWidth(350);
    try {
      await waitFor(() => expect(monthLabels()).toHaveLength(1));
      expect(
        screen.getByPlaceholderText('Try "Mondays next month"'),
      ).toBeDefined();
    } finally {
      restore();
    }
  });

  it("opens on two months inside a medium frame", async () => {
    const { restore } = renderInFrameOfWidth(600);
    try {
      await waitFor(() => expect(monthLabels()).toHaveLength(2));
    } finally {
      restore();
    }
  });

  it("opens on three months inside a wide frame", async () => {
    const { restore } = renderInFrameOfWidth(900);
    try {
      await waitFor(() => expect(monthLabels()).toHaveLength(3));
    } finally {
      restore();
    }
  });
});
