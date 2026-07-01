// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { DemoFrame } from "../demo-frame";
import { DEMO_FRAME_LOGGER_SECTION_COLLAPSED_PX } from "@/utils/demo-frame-sizing";

describe("DemoFrame", () => {
  afterEach(() => cleanup());
  it("renders children in a single frame element", () => {
    const { container } = render(
      <DemoFrame>
        <p>Demo content</p>
      </DemoFrame>,
    );
    expect(container.querySelectorAll(".demo-frame")).toHaveLength(1);
    expect(container.querySelector(".demo-frame")?.children).toHaveLength(1);
    expect(container.querySelector(".demo-frame__demo-area")?.children).toHaveLength(
      1,
    );
  });

  it("applies the default sm aspect ratio variant on demo-area", () => {
    const { container } = render(
      <DemoFrame>
        <p>Demo content</p>
      </DemoFrame>,
    );
    expect(
      container.querySelector(".demo-frame__demo-area--aspectRatio_sm"),
    ).toBeDefined();
  });

  it("applies the requested aspect ratio variant on demo-area", () => {
    const { container } = render(
      <DemoFrame aspectRatio="lg">
        <p>Demo content</p>
      </DemoFrame>,
    );
    expect(
      container.querySelector(".demo-frame__demo-area--aspectRatio_lg"),
    ).toBeDefined();
  });

  it("renders the logger section when logger is enabled", () => {
    const { container } = render(
      <DemoFrame logger>
        <p>Demo content</p>
      </DemoFrame>,
    );

    expect(container.querySelector(".demo-frame--logger_true")).toBeDefined();
    expect(container.querySelector(".demo-logger-section")).toBeDefined();
    expect(container.querySelector(".demo-logger-header")).toBeDefined();
    expect(container.querySelector(".demo-frame")?.children).toHaveLength(2);
  });

  it("passes logger config props to DemoLogger", () => {
    render(
      <DemoFrame logger={{ emptyHint: "Custom hint text" }}>
        <p>Demo content</p>
      </DemoFrame>,
    );

    expect(screen.getByText("Custom hint text")).toBeDefined();
  });

  it("collapses the logger without inline frame min-height", () => {
    const { container } = render(
      <DemoFrame logger>
        <p>Demo content</p>
      </DemoFrame>,
    );

    const frame = container.querySelector(".demo-frame") as HTMLElement;
    expect(frame.style.minHeight).toBe("");

    fireEvent.click(
      container.querySelector(
        ".demo-logger-header button",
      ) as HTMLButtonElement,
    );

    const panel = container.querySelector(
      ".demo-logger-panel",
    ) as HTMLElement | null;
    expect(panel?.className).toContain("demo-logger-panel--expanded_false");
    expect(frame.style.minHeight).toBe("");
  });

  it("uses collapsed logger height constant for sizing", () => {
    expect(DEMO_FRAME_LOGGER_SECTION_COLLAPSED_PX).toBe(56);
  });
});
