// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ButtonLinkNode } from "@/domain/nodes";
import { buttonLinkClass } from "../button-link";
import { EditableButtonLink } from "../editable-button-link";

function setup(block: Partial<ButtonLinkNode> = {}) {
  const props = {
    block: {
      type: "button_link" as const,
      text: "Book a call",
      href: "/about",
      ...block,
    },
    blockIndex: 2,
    onChange: vi.fn(),
    onDelete: vi.fn(),
    onArrowUp: vi.fn(),
    onArrowDown: vi.fn(),
    onArrowLeft: vi.fn(),
    onArrowRight: vi.fn(),
    onInsertParagraphAfter: vi.fn(),
    elRef: vi.fn(),
  };
  const view = render(<EditableButtonLink {...props} />);
  return { ...props, ...view };
}

const label = () => screen.getByRole("textbox", { name: "Button text" });
const toolbar = () => screen.queryByRole("toolbar", { name: "Link actions" });
const hover = (el: Element, pointerType = "mouse") =>
  fireEvent.pointerEnter(el, { pointerType });

function caretAt(offset: number) {
  const node = label().firstChild ?? label();
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

afterEach(() => cleanup());

describe("EditableButtonLink", () => {
  describe("the button", () => {
    it("draws its label as a field to type into, not a link", () => {
      setup();
      expect(label().textContent).toBe("Book a call");
      expect(label().getAttribute("contenteditable")).toBe("plaintext-only");
      expect(screen.queryByRole("link")).toBeNull();
    });

    it("names what it is waiting for while it has no label", () => {
      setup({ text: "" });
      expect(label().getAttribute("data-placeholder")).toBe("Button text");
    });

    it("hands back what is typed into it", () => {
      const { onChange } = setup();
      label().textContent = "Book a demo";
      fireEvent.input(label());
      expect(onChange).toHaveBeenCalledWith({
        type: "button_link",
        text: "Book a demo",
        href: "/about",
      });
    });

    it("follows a label changed from outside while it is not being typed in", () => {
      const view = setup();
      view.rerender(
        <EditableButtonLink
          {...view}
          block={{ type: "button_link", text: "Undone", href: "/about" }}
        />,
      );
      expect(label().textContent).toBe("Undone");
    });

    it("hands the focus to its label when the block itself is focused", () => {
      const { container } = setup();
      const block = container.querySelector(
        "[data-button-link-block]",
      ) as HTMLElement;
      act(() => block.focus());
      expect(document.activeElement).toBe(label());
    });

    it("draws the label in the chosen colour", () => {
      setup({ color: "accent" });
      for (const name of buttonLinkClass("accent").split(" ")) {
        expect(label().classList.contains(name)).toBe(true);
      }
    });

    it("pins its row only while sticky", () => {
      const { container, rerender, block, ...props } = setup();
      const row = () => container.querySelector("[data-button-link-block]")!;
      expect(row().hasAttribute("data-sticky")).toBe(false);
      rerender(
        <EditableButtonLink {...props} block={{ ...block, sticky: true }} />,
      );
      expect(row().hasAttribute("data-sticky")).toBe(true);
    });

    it("gives the editor its block element", () => {
      const { elRef, container } = setup();
      expect(elRef).toHaveBeenCalledWith(
        container.querySelector("[data-button-link-block]"),
      );
    });
  });

  describe("its toolbar", () => {
    it("is not its own to show, on hover or focus", () => {
      setup();
      hover(label());
      act(() => label().focus());
      expect(toolbar()).toBeNull();
    });
  });

  describe("keys in the label", () => {
    it("moves on to a new paragraph on Enter", () => {
      const { onInsertParagraphAfter } = setup();
      fireEvent.keyDown(label(), { key: "Enter" });
      expect(onInsertParagraphAfter).toHaveBeenCalledOnce();
    });

    it("deletes an empty button on Backspace or Delete", () => {
      const { onDelete } = setup({ text: "" });
      fireEvent.keyDown(label(), { key: "Backspace" });
      fireEvent.keyDown(label(), { key: "Delete" });
      expect(onDelete).toHaveBeenCalledTimes(2);
    });

    it("lets Backspace edit a label that has text", () => {
      const { onDelete } = setup();
      const event = fireEvent.keyDown(label(), { key: "Backspace" });
      expect(event).toBe(true);
      expect(onDelete).not.toHaveBeenCalled();
    });

    it("leaves for the blocks around it on the up and down arrows", () => {
      const { onArrowUp, onArrowDown } = setup();
      fireEvent.keyDown(label(), { key: "ArrowUp" });
      fireEvent.keyDown(label(), { key: "ArrowDown" });
      expect(onArrowUp).toHaveBeenCalledOnce();
      expect(onArrowDown).toHaveBeenCalledOnce();
    });

    it("leaves sideways only from the ends of the label", () => {
      const { onArrowLeft, onArrowRight } = setup();
      act(() => label().focus());

      caretAt(3);
      fireEvent.keyDown(label(), { key: "ArrowLeft" });
      fireEvent.keyDown(label(), { key: "ArrowRight" });
      expect(onArrowLeft).not.toHaveBeenCalled();
      expect(onArrowRight).not.toHaveBeenCalled();

      caretAt(0);
      fireEvent.keyDown(label(), { key: "ArrowLeft" });
      expect(onArrowLeft).toHaveBeenCalledOnce();

      caretAt("Book a call".length);
      fireEvent.keyDown(label(), { key: "ArrowRight" });
      expect(onArrowRight).toHaveBeenCalledOnce();
    });
  });
});
