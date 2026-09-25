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

afterEach(() => {
  cleanup();
  __resetCalchemyDemoCache();
});

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

async function renderDemo() {
  render(<CalchemyDemo />);
  const field = await screen.findByRole("searchbox", {
    name: "Natural language date query",
  });
  return { field, user: userEvent.setup() };
}

// jsdom lays nothing out, so the frame's rect and ResizeObserver are stubbed.
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

  it("moves the run of months to where the answer falls", async () => {
    const { field, user } = await renderDemo();
    expect(monthLabels()).not.toContain("December 2028");

    await user.type(field, "25 december 2028");
    await waitFor(() => expect(monthLabels()).toContain("December 2028"));
    expect(selectedLabels()).toEqual(["December 25, 2028"]);
  });

  it("offers the readings of an ambiguous phrase, and settles on one", async () => {
    const { field, user } = await renderDemo();

    await user.type(field, "03/04/25");
    const readings = await screen.findAllByRole("button", {
      name: /2025|2003/,
    });
    expect(readings.length).toBeGreaterThan(1);

    expect(readings[0].getAttribute("aria-current")).toBe("true");
    expect(readings[0].getAttribute("aria-pressed")).toBe("false");

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
