// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { DemoFrame } from "../demo-frame";
import { DEMO_FRAME_LOGGER_SECTION_COLLAPSED_PX } from "@/utils/demo-frame-sizing";

describe("DemoFrame", () => {

  // A demo that lays itself out AGAINST the frame — the calchemy one puts its
  // query bar on the frame's own bottom inset — cannot be wrapped in the
  // intrinsic-size measure div, which hugs its content and so has no height to
  // fill. `fill` hands it the area directly, exactly as a logger frame does.
  it("wraps a measured demo but hands a filling one the area itself", () => {
    const { container, rerender } = render(
      <DemoFrame>
        <p>demo</p>
      </DemoFrame>,
    );
    expect(container.querySelector(".demo-frame__demo-measure")).toBeTruthy();

    rerender(
      <DemoFrame fill>
        <p>demo</p>
      </DemoFrame>,
    );
    expect(container.querySelector(".demo-frame__demo-measure")).toBeNull();
    expect(
      container.querySelector(".demo-frame__demo-area")?.firstElementChild
        ?.tagName,
    ).toBe("P");
  });

  // And it must not be MEASURED either. The area's floor is normally raised to
  // whatever the demo turned out to be; a demo that fills the area is as tall
  // as the area, so measuring it feeds its own height back in and the frame
  // runs away — 8,000px on the first pass. Its height is the aspect ratio's,
  // which the area already carries without asking anyone.
  it("leaves a filling frame's height to the aspect ratio", () => {
    const { container } = render(
      <DemoFrame fill>
        <p>demo</p>
      </DemoFrame>,
    );
    const area = container.querySelector<HTMLElement>(".demo-frame__demo-area");
    expect(area?.style.minHeight).toBe("");
  });
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

  it("applies the default 2/1 aspect ratio variant on demo-area", () => {
    const { container } = render(
      <DemoFrame>
        <p>Demo content</p>
      </DemoFrame>,
    );
    expect(
      container.querySelector(".demo-frame__demo-area--aspectRatio_2\\/1"),
    ).not.toBeNull();
  });

  it("applies the requested aspect ratio variant on demo-area", () => {
    const { container } = render(
      <DemoFrame aspectRatio="6/5">
        <p>Demo content</p>
      </DemoFrame>,
    );
    expect(
      container.querySelector(".demo-frame__demo-area--aspectRatio_6\\/5"),
    ).not.toBeNull();
  });

  it("renders the logger section when logger is enabled", () => {
    const { container } = render(
      <DemoFrame logger>
        <p>Demo content</p>
      </DemoFrame>,
    );

    expect(container.querySelector(".demo-frame--logger_true")).not.toBeNull();
    expect(container.querySelector(".demo-logger-section")).not.toBeNull();
    expect(container.querySelector(".demo-logger-header")).not.toBeNull();
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

  it("keeps logger controls inert when interactive is false", () => {
    const { container } = render(
      <DemoFrame logger interactive={false}>
        <p>Demo content</p>
      </DemoFrame>,
    );

    const inertLogger = container.querySelector(
      ".demo-logger-section",
    )?.parentElement;
    expect(inertLogger?.hasAttribute("inert")).toBe(true);
  });

  it("starts with logger collapsed and toggles expand state", () => {
    const { container } = render(
      <DemoFrame logger>
        <p>Demo content</p>
      </DemoFrame>,
    );

    const frame = container.querySelector(".demo-frame") as HTMLElement;
    const panel = container.querySelector(
      ".demo-logger-panel",
    ) as HTMLElement | null;

    expect(frame.style.minHeight).toBe("");
    expect(panel?.className).toContain("demo-logger-panel--expanded_false");

    fireEvent.click(
      container.querySelector(
        ".demo-logger-header button",
      ) as HTMLButtonElement,
    );

    expect(panel?.className).toContain("demo-logger-panel--expanded_true");
    expect(frame.style.minHeight).toBe("");
  });

  it("uses collapsed logger height constant for sizing", () => {
    expect(DEMO_FRAME_LOGGER_SECTION_COLLAPSED_PX).toBe(56);
  });
});
