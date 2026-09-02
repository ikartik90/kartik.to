// @vitest-environment jsdom
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DemoInvitation } from "../demo-invitation";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("DemoInvitation", () => {
  // The reason this component exists at all. A DemoFrame is `overflow: hidden`
  // over a `container-type`, and v0's form surface adds a `clip-path` on top —
  // a showcase frame's whole job is to crop what it holds. This tooltip is
  // anchored to the VISITOR'S CURSOR, which is routinely outside the frame, so
  // as a descendant of it the box is positioned perfectly and painted nowhere.
  // `position: fixed` buys coordinates, never the right to be seen.
  it("renders on the body, clear of anything the frame can clip", () => {
    const ref = createRef<HTMLElement>();
    const { container } = render(
      <DemoInvitation ref={ref} visible docked={false} offer={() => {}} />,
    );

    const tip = screen.getByText("Try it yourself").closest("div");

    // Nothing left behind inside the demo's own tree...
    expect(container.childElementCount).toBe(0);
    // ...because the whole box lives at the top of the document instead.
    expect(tip?.parentElement).toBe(document.body);
  });

  it("hands the host ref and visibility through to the tooltip", () => {
    const ref = createRef<HTMLElement>();
    render(<DemoInvitation ref={ref} visible docked={false} offer={() => {}} />);

    const tip = screen.getByText("Try it yourself").closest("div");

    expect(ref.current).toBe(tip);
    expect(tip?.hasAttribute("data-visible")).toBe(true);
  });

  // The invitation is an OFFER, not a label, so it wears the brand tone while
  // every other tooltip in the app stays neutral. The wiring is what's under
  // test — that the component opts in — not the hues, which are the recipe's.
  it("wears the brand tone", () => {
    const ref = createRef<HTMLElement>();
    render(<DemoInvitation ref={ref} visible docked={false} offer={() => {}} />);

    const tip = screen.getByText("Try it yourself").closest("div");

    expect(tip?.className).toContain("tooltip--tone_brand");
  });

  // With no cursor to hang from — a phone — the box gives its placement up to
  // the stylesheet, which puts it at the foot of the screen. The attribute is
  // the whole of the wiring; the 50px above the safe area is the recipe's.
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
