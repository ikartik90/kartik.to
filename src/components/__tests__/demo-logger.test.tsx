// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoLogger } from "../demo-logger";
import {
  DemoLoggerProvider,
  useDemoLogger,
} from "@/hooks/use-demo-logger";

function renderWithProvider(props: Partial<React.ComponentProps<typeof DemoLogger>> = {}) {
  const onExpandedChange = props.onExpandedChange ?? vi.fn();
  return {
    onExpandedChange,
    ...render(
      <DemoLoggerProvider>
        <DemoLogger
          expanded={props.expanded ?? true}
          onExpandedChange={onExpandedChange}
          {...props}
        />
      </DemoLoggerProvider>,
    ),
  };
}

function LoggerProbe() {
  const logger = useDemoLogger();

  useEffect(() => {
    logger.log("first line");
    logger.warn("second line");
  }, [logger]);

  return (
    <DemoLogger expanded onExpandedChange={vi.fn()} />
  );
}

describe("DemoLogger", () => {
  afterEach(() => cleanup());

  it("renders the header with Output label and collapse toggle when expanded", () => {
    renderWithProvider();

    expect(screen.getByText("Output")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Collapse output logs" }),
    ).toBeDefined();
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("renders the empty state when there are no entries", () => {
    renderWithProvider();

    expect(screen.getByText("No output logs available")).toBeDefined();
    expect(
      document.querySelector('img[src="/assets/terminal-dark.png"]'),
    ).toBeDefined();
    expect(
      document.querySelector('img[src="/assets/terminal-light.png"]'),
    ).toBeDefined();
  });

  it("renders custom empty copy from props", () => {
    renderWithProvider({
      emptyMessage: "Nothing here",
      emptyHint: "Try typing something",
    });

    expect(screen.getByText("Nothing here")).toBeDefined();
    expect(screen.getByText("Try typing something")).toBeDefined();
  });

  it("renders log entries in the scroll panel", () => {
    render(
      <DemoLoggerProvider>
        <LoggerProbe />
      </DemoLoggerProvider>,
    );

    expect(screen.getByRole("log")).toBeDefined();
    expect(screen.getByText("first line")).toBeDefined();
    expect(screen.getByText("second line")).toBeDefined();
  });

  it("highlights JSON payloads in log entries", () => {
    function JsonLoggerProbe() {
      const logger = useDemoLogger();

      useEffect(() => {
        logger.setStatus("log", '✓ valid\n{\n  "kind": "single"\n}');
      }, [logger]);

      return <DemoLogger expanded onExpandedChange={vi.fn()} />;
    }

    const { container } = render(
      <DemoLoggerProvider>
        <JsonLoggerProbe />
      </DemoLoggerProvider>,
    );

    expect(screen.getByText("✓ valid")).toBeDefined();
    expect(
      container.querySelector(
        '[data-syntax-role="primary"], [data-syntax-role="secondary"]',
      ),
    ).toBeDefined();
    expect(container.textContent).toContain('"kind": "single"');
  });

  it("collapses the log body and shows expand toggle", () => {
    const { onExpandedChange } = renderWithProvider();

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse output logs" }),
    );
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it("hides the log body when collapsed", () => {
    const { container } = renderWithProvider({ expanded: false });

    const panel = container.querySelector(
      ".demo-logger-panel",
    ) as HTMLElement | null;
    const body = container.querySelector(
      ".demo-logger-body",
    ) as HTMLElement | null;
    expect(panel?.className).toContain("demo-logger-panel--expanded_false");
    expect(body?.className).toContain("demo-logger-body--expanded_false");

    expect(screen.queryByRole("log")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Expand output logs" }),
    ).toBeDefined();
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("uses custom accessibility labels from props", () => {
    renderWithProvider({
      collapseLabel: "Hide logs",
      expandLabel: "Show logs",
    });

    expect(screen.getByRole("button", { name: "Hide logs" })).toBeDefined();
  });
});
