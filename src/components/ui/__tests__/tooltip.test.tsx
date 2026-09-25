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

const box = (label: string) =>
  screen.getByText(label).closest("div") as HTMLElement;

describe("Tooltip", () => {
  afterEach(() => cleanup());

  it("renders on the body, out of reach of any ancestor's clip", () => {
    const { container } = render(
      withHost(
        false,
        <Tooltip>
          <Tooltip.Text>Delete</Tooltip.Text>
        </Tooltip>,
      ),
    );

    expect(container.childElementCount).toBe(0);
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
