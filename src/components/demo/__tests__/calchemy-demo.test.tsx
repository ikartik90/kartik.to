// @vitest-environment jsdom
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { CalchemyDemo, __resetCalchemyDemoCache } from "../calchemy-demo";
import { DemoFrame } from "@/components/demo-frame";

const mockUseCalchemyContext = vi.fn();

vi.mock("@calchemy/date-core", () => ({
  createCalchemy: vi.fn(() =>
    Promise.resolve({
      parseDate: vi.fn(),
      getInlineCompletion: vi.fn(() => null),
      toJSON: vi.fn((value: unknown) => value),
    }),
  ),
}));

vi.mock("@calchemy/date-react/calendar-scroll", () => ({
  CalendarScroll: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="calchemy-scroll">{children}</div>
  ),
}));

vi.mock("@calchemy/date-react", () => ({
  useCalchemyCalendar: vi.fn(() => ({
    period: { count: 3, unit: "month" },
    isNavigating: false,
    canMove: () => true,
    move: vi.fn(),
  })),
  useCalchemyContext: () => mockUseCalchemyContext(),
  Calchemy: {
    Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Field: ({ placeholder }: { placeholder?: string }) => (
      <input placeholder={placeholder} />
    ),
    Candidates: () => null,
    Calendar: ({
      children,
      period,
    }: {
      children: React.ReactNode;
      period?: { months?: number };
    }) => (
      // The period is surfaced because it is not decoration: `period.count` is
      // exactly what `CalchemyCalendarNavPrevious`/`Next` step by, so a demo
      // showing one month and paging by three is a disagreement visible here.
      <div data-testid="calchemy-calendar" data-months={period?.months}>
        {children}
      </div>
    ),
    CalendarPeriodList: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    CalendarPeriod: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    CalendarPeriodHeading: () => <h3>June 2026</h3>,
    CalendarWeekdays: () => <div>weekdays</div>,
    CalendarGrid: () => <div>grid</div>,
  },
}));

afterEach(() => {
  cleanup();
  mockUseCalchemyContext.mockReset();
  // The engine is module-cached; drop it so each case exercises fresh init.
  __resetCalchemyDemoCache();
});

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
    .mockReturnValue({ width, height: 0, top: 0, left: 0, right: width, bottom: 0 } as DOMRect);

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
  it("renders the field placeholder after Calchemy initializes", async () => {
    mockUseCalchemyContext.mockReturnValue({
      result: { status: "invalid", input: "", errors: [], corrections: [], warnings: [] },
      calchemy: { toJSON: (value: unknown) => value },
    });

    const { getByPlaceholderText } = render(<CalchemyDemo />);

    await waitFor(() => {
      expect(
        getByPlaceholderText('Try "Mondays and Fridays next month"'),
      ).toBeDefined();
    });
  });

  it("renders the horizontally scrollable calendar with navigation", async () => {
    mockUseCalchemyContext.mockReturnValue({
      result: { status: "invalid", input: "", errors: [], corrections: [], warnings: [] },
      calchemy: { toJSON: (value: unknown) => value },
    });

    const { getByTestId, getByRole } = render(<CalchemyDemo />);

    await waitFor(() => {
      expect(getByTestId("calchemy-calendar")).toBeDefined();
      expect(getByTestId("calchemy-scroll")).toBeDefined();
      expect(getByRole("button", { name: "Previous months" })).toBeDefined();
      expect(getByRole("button", { name: "Next months" })).toBeDefined();
    });
  });

  it("does not log empty-input placeholder errors", async () => {
    mockUseCalchemyContext.mockReturnValue({
      result: {
        status: "invalid",
        input: "",
        errors: [{ code: "empty-input", message: "Enter a date phrase." }],
        corrections: [],
        warnings: [],
      },
      calchemy: { toJSON: () => ({}) },
    });

    render(
      <DemoFrame logger>
        <CalchemyDemo />
      </DemoFrame>,
    );

    await waitFor(() => {
      expect(screen.getByText("No output logs available")).toBeDefined();
    });
    expect(screen.queryByText("Enter a date phrase.")).toBeNull();
  });

  it("logs parse status, value, and errors through the demo logger", async () => {
    let parseResult: {
      status: string;
      input: string;
      errors?: Array<{ code: string; message: string }>;
      corrections: unknown[];
      warnings: unknown[];
      value?: unknown;
      candidates?: unknown[];
    } = {
      status: "invalid",
      input: "bad",
      errors: [{ code: "invalid-date", message: "Could not parse input" }],
      corrections: [],
      warnings: [],
    };

    mockUseCalchemyContext.mockImplementation(() => ({
      result: parseResult,
      calchemy: {
        toJSON: () => ({ kind: "single", date: "2026-06-29" }),
      },
    }));

    const { rerender } = render(
      <DemoFrame logger>
        <CalchemyDemo />
      </DemoFrame>,
    );

    // The logger is collapsed by default; expand it so its body exposes
    // role="log" (and its entries become visible). State persists across the
    // rerender below, so this is only needed once.
    fireEvent.click(
      screen.getByRole("button", { name: "Expand output logs" }),
    );

    await waitFor(() => {
      const panel = screen.getByRole("log");
      expect(panel.textContent).toContain("✕ invalid");
      expect(panel.textContent).toContain("Could not parse input");
    });

    parseResult = {
      status: "valid",
      input: "next monday",
      value: { kind: "single", date: "2026-06-29" },
      candidates: [],
      corrections: [],
      warnings: [],
    };

    rerender(
      <DemoFrame logger>
        <CalchemyDemo />
      </DemoFrame>,
    );

    await waitFor(() => {
      const panel = screen.getByRole("log");
      expect(panel.textContent).toContain("✓ valid");
      expect(panel.textContent).toContain('"kind": "single"');
      expect(panel.textContent).toContain('"date": "2026-06-29"');
    });
    expect(screen.getByRole("log").textContent).not.toContain("✕ invalid");
    expect(screen.getByRole("log").textContent).not.toContain(
      "Could not parse input",
    );
  });
  // --- Layout tier ---------------------------------------------------------
  //
  // The demo shows as many months as the frame is wide enough for, and pages
  // by exactly that many: `period.count` is what the nav buttons step. The two
  // are one number, so getting the tier wrong is not a cosmetic mistake — it
  // is a calendar that shows one month and jumps three when you press Next,
  // which is what the published grid card did on a phone.
  //
  // The tier has to be settled on MOUNT. Waiting for a resize that never comes
  // (a card's width does not change after it lands) leaves the demo on its
  // initial guess, which is the widest tier.
  it("opens on the compact tier inside a narrow frame", async () => {
    mockUseCalchemyContext.mockReturnValue({
      result: { status: "invalid", input: "", errors: [], corrections: [], warnings: [] },
      calchemy: { toJSON: (value: unknown) => value },
    });

    const { getByTestId, getByPlaceholderText, restore } =
      renderInFrameOfWidth(350);

    try {
      await waitFor(() => {
        expect(getByTestId("calchemy-calendar").dataset.months).toBe("1");
      });
      expect(getByPlaceholderText('Try "Mondays next month"')).toBeDefined();
    } finally {
      restore();
    }
  });

  it("opens on the middle tier inside a medium frame", async () => {
    mockUseCalchemyContext.mockReturnValue({
      result: { status: "invalid", input: "", errors: [], corrections: [], warnings: [] },
      calchemy: { toJSON: (value: unknown) => value },
    });

    const { getByTestId, restore } = renderInFrameOfWidth(600);

    try {
      await waitFor(() => {
        expect(getByTestId("calchemy-calendar").dataset.months).toBe("2");
      });
    } finally {
      restore();
    }
  });

  it("opens on the wide tier inside a wide frame", async () => {
    mockUseCalchemyContext.mockReturnValue({
      result: { status: "invalid", input: "", errors: [], corrections: [], warnings: [] },
      calchemy: { toJSON: (value: unknown) => value },
    });

    const { getByTestId, restore } = renderInFrameOfWidth(900);

    try {
      await waitFor(() => {
        expect(getByTestId("calchemy-calendar").dataset.months).toBe("3");
      });
    } finally {
      restore();
    }
  });
});
