// @vitest-environment jsdom
import { createRef } from "react";
import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Tooltip, TooltipHostContext } from "../tooltip";

function withHost(visible: boolean, node: React.ReactNode) {
  return (
    <TooltipHostContext.Provider value={{ ref: createRef<HTMLElement>(), visible }}>
      {node}
    </TooltipHostContext.Provider>
  );
}

describe("Tooltip", () => {
  afterEach(() => cleanup());

  it("renders the label and is decorative (aria-hidden)", () => {
    const { container, getByText } = render(
      withHost(
        false,
        <Tooltip>
          <Tooltip.Text>Delete</Tooltip.Text>
        </Tooltip>,
      ),
    );
    expect(getByText("Delete")).toBeDefined();
    expect((container.firstChild as HTMLElement).getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("inserts a divider between the label and trailing content", () => {
    const { container } = render(
      withHost(
        false,
        <Tooltip>
          <Tooltip.Text>Delete</Tooltip.Text>
          <svg data-icon />
        </Tooltip>,
      ),
    );
    // [label, divider, icon]
    expect((container.firstChild as HTMLElement).children.length).toBe(3);
  });

  it("omits the divider when there is only a label", () => {
    const { container } = render(
      withHost(
        false,
        <Tooltip>
          <Tooltip.Text>Delete</Tooltip.Text>
        </Tooltip>,
      ),
    );
    expect((container.firstChild as HTMLElement).children.length).toBe(1);
  });

  it("reflects host visibility via data-visible", () => {
    const { container, rerender } = render(
      withHost(
        true,
        <Tooltip>
          <Tooltip.Text>Delete</Tooltip.Text>
        </Tooltip>,
      ),
    );
    expect(
      (container.firstChild as HTMLElement).hasAttribute("data-visible"),
    ).toBe(true);

    rerender(
      withHost(
        false,
        <Tooltip>
          <Tooltip.Text>Delete</Tooltip.Text>
        </Tooltip>,
      ),
    );
    expect(
      (container.firstChild as HTMLElement).hasAttribute("data-visible"),
    ).toBe(false);
  });
});
