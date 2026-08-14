// @vitest-environment jsdom
import { createRef } from "react";
import { render, cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Tooltip, TooltipHostContext } from "../tooltip";

function withHost(visible: boolean, node: React.ReactNode) {
  return (
    <TooltipHostContext.Provider value={{ ref: createRef<HTMLElement>(), visible }}>
      {node}
    </TooltipHostContext.Provider>
  );
}

/** The box itself — the portalled surface the label sits in. */
const box = (label: string) =>
  screen.getByText(label).closest("div") as HTMLElement;

describe("Tooltip", () => {
  afterEach(() => cleanup());

  // The box is drawn at the VISITOR'S CURSOR, which is routinely outside
  // whatever element it labels — the demo frame's replay/reset rail sits in a
  // corner of a frame that is `overflow: hidden` over a `container-type`, and
  // that containment makes the frame the containing block for a fixed child.
  // Rendered in place the tooltip is then positioned perfectly and painted
  // nowhere. So the escape belongs to the library, once, rather than to every
  // host that might one day sit inside something that crops.
  it("renders on the body, out of reach of any ancestor's clip", () => {
    const { container } = render(
      withHost(
        false,
        <Tooltip>
          <Tooltip.Text>Delete</Tooltip.Text>
        </Tooltip>,
      ),
    );

    // Nothing left behind where the host rendered it...
    expect(container.childElementCount).toBe(0);
    // ...because the whole box lives at the top of the document instead.
    expect(box("Delete").parentElement).toBe(document.body);
  });

  it("renders the label and is decorative (aria-hidden)", () => {
    render(
      withHost(
        false,
        <Tooltip>
          <Tooltip.Text>Delete</Tooltip.Text>
        </Tooltip>,
      ),
    );
    expect(screen.getByText("Delete")).toBeDefined();
    expect(box("Delete").getAttribute("aria-hidden")).toBe("true");
  });

  it("inserts a divider between the label and trailing content", () => {
    render(
      withHost(
        false,
        <Tooltip>
          <Tooltip.Text>Delete</Tooltip.Text>
          <svg data-icon />
        </Tooltip>,
      ),
    );
    // [label, divider, icon]
    expect(box("Delete").children.length).toBe(3);
  });

  it("omits the divider when there is only a label", () => {
    render(
      withHost(
        false,
        <Tooltip>
          <Tooltip.Text>Delete</Tooltip.Text>
        </Tooltip>,
      ),
    );
    expect(box("Delete").children.length).toBe(1);
  });

  it("reflects host visibility via data-visible", () => {
    const { rerender } = render(
      withHost(
        true,
        <Tooltip>
          <Tooltip.Text>Delete</Tooltip.Text>
        </Tooltip>,
      ),
    );
    expect(box("Delete").hasAttribute("data-visible")).toBe(true);

    rerender(
      withHost(
        false,
        <Tooltip>
          <Tooltip.Text>Delete</Tooltip.Text>
        </Tooltip>,
      ),
    );
    expect(box("Delete").hasAttribute("data-visible")).toBe(false);
  });
});
