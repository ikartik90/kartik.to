// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { CalchemyDemo } from "../calchemy-demo";
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
    Calendar: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="calchemy-calendar">{children}</div>
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
});

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
});
