// @vitest-environment jsdom
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DemoInvitation } from "../demo-invitation";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("DemoInvitation", () => {
  it("renders on the body, clear of anything the frame can clip", () => {
    const ref = createRef<HTMLElement>();
    const { container } = render(
      <DemoInvitation ref={ref} visible docked={false} offer={() => {}} />,
    );

    const tip = screen.getByText("Try it yourself").closest("div");

    expect(container.childElementCount).toBe(0);
    expect(tip?.parentElement).toBe(document.body);
  });

  it("hands the host ref and visibility through to the tooltip", () => {
    const ref = createRef<HTMLElement>();
    render(<DemoInvitation ref={ref} visible docked={false} offer={() => {}} />);

    const tip = screen.getByText("Try it yourself").closest("div");

    expect(ref.current).toBe(tip);
    expect(tip?.hasAttribute("data-visible")).toBe(true);
  });

  it("wears the brand tone", () => {
    const ref = createRef<HTMLElement>();
    render(<DemoInvitation ref={ref} visible docked={false} offer={() => {}} />);

    const tip = screen.getByText("Try it yourself").closest("div");

    expect(tip?.className).toContain("tooltip--tone_brand");
  });

  it("marks itself docked when it is offered without a cursor", () => {
    const ref = createRef<HTMLElement>();
    render(<DemoInvitation ref={ref} visible docked offer={() => {}} />);

    const tip = screen.getByText("Try it yourself").closest("div");

    expect(tip?.hasAttribute("data-docked")).toBe(true);
  });

  it("stays put until it is offered", () => {
    const ref = createRef<HTMLElement>();
    render(
      <DemoInvitation ref={ref} visible={false} docked={false} offer={() => {}} />,
    );

    const tip = screen.getByText("Try it yourself").closest("div");

    expect(tip?.hasAttribute("data-visible")).toBe(false);
  });
});
