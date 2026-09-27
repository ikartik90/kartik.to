// @vitest-environment jsdom
import { createRef } from "react";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Button } from "../button";
import { Link } from "../link";
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

  describe("for a trigger inside a dialog", () => {
    // jsdom has no top layer or popover API; this stands in, topmost last.
    let topLayer: Element[] = [];
    const { showPopover: nativeShow, hidePopover: nativeHide } =
      HTMLElement.prototype;
    beforeEach(() => {
      topLayer = [];
      HTMLElement.prototype.showPopover = function (this: HTMLElement) {
        if (!topLayer.includes(this)) topLayer.push(this);
      };
      HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
        topLayer = topLayer.filter((el) => el !== this);
      };
    });
    afterEach(() => {
      HTMLElement.prototype.showPopover = nativeShow;
      HTMLElement.prototype.hidePopover = nativeHide;
    });

    const hover = (el: HTMLElement) =>
      fireEvent.pointerEnter(el, { pointerType: "mouse", clientX: 10, clientY: 10 });
    const leave = (el: HTMLElement) =>
      fireEvent.pointerLeave(el, { pointerType: "mouse" });

    function renderInDialog(trigger: React.ReactNode) {
      render(<dialog open>{trigger}</dialog>);
      return document.querySelector("dialog") as HTMLDialogElement;
    }

    const nextButton = (
      <Button aria-label="Next">
        <svg />
        <Button.Tooltip>
          <Tooltip.Text>Next</Tooltip.Text>
        </Button.Tooltip>
      </Button>
    );

    it("renders in the dialog as a popover, above the modal, once hovered", () => {
      const dialog = renderInDialog(nextButton);
      topLayer.push(dialog);

      hover(screen.getByRole("button", { name: "Next" }));

      expect(box("Next").parentElement).toBe(dialog);
      expect(box("Next").getAttribute("popover")).toBe("manual");
      expect(box("Next").hasAttribute("data-visible")).toBe(true);
      expect(topLayer.at(-1)).toBe(box("Next"));
    });

    it("comes back above anything opened since it last showed", () => {
      const dialog = renderInDialog(nextButton);
      topLayer.push(dialog);
      const button = screen.getByRole("button", { name: "Next" });

      hover(button);
      leave(button);
      const reopened = document.createElement("div");
      topLayer.push(reopened);
      hover(button);

      expect(topLayer.at(-1)).toBe(box("Next"));
    });

    it("still shows, in the dialog, where there is no popover API", () => {
      HTMLElement.prototype.showPopover = nativeShow;
      HTMLElement.prototype.hidePopover = nativeHide;
      const dialog = renderInDialog(nextButton);

      hover(screen.getByRole("button", { name: "Next" }));

      expect(box("Next").parentElement).toBe(dialog);
      expect(box("Next").hasAttribute("data-visible")).toBe(true);
    });

    it("does the same for a Link", () => {
      const dialog = renderInDialog(
        <Link href="/next" aria-label="Next">
          <svg />
          <Link.Tooltip>
            <Tooltip.Text>Next</Tooltip.Text>
          </Link.Tooltip>
        </Link>,
      );

      hover(screen.getByRole("link", { name: "Next" }));

      expect(box("Next").parentElement).toBe(dialog);
      expect(topLayer.at(-1)).toBe(box("Next"));
    });

    it("stays on the body, and out of the top layer, for a trigger outside any dialog", () => {
      render(nextButton);

      hover(screen.getByRole("button", { name: "Next" }));

      expect(box("Next").parentElement).toBe(document.body);
      expect(box("Next").hasAttribute("popover")).toBe(false);
      expect(box("Next").hasAttribute("data-visible")).toBe(true);
      expect(topLayer).toEqual([]);
    });
  });
});
