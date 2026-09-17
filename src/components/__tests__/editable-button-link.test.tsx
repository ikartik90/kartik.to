// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ButtonLinkNode } from "@/domain/nodes";
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

/** Put the caret at `offset` inside the label. */
function caretAt(offset: number) {
  const node = label().firstChild ?? label();
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

beforeEach(() => vi.useRealTimers());
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

    // Undo writes the label from outside, and the box must follow — but never
    // under a caret, where rewriting the text would throw the caret away.
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

    it("gives the editor its block element", () => {
      const { elRef, container } = setup();
      expect(elRef).toHaveBeenCalledWith(
        container.querySelector("[data-button-link-block]"),
      );
    });
  });

  describe("the link toolbar", () => {
    it("is not shown at rest", () => {
      setup();
      expect(toolbar()).toBeNull();
    });

    it("comes up while the pointer is on the button", () => {
      setup();
      hover(label());
      expect(toolbar()).not.toBeNull();
    });

    // A finger has no hover: the toolbar arrives with the focus a tap gives.
    it("does not come up for a touch passing over", () => {
      setup();
      hover(label(), "touch");
      expect(toolbar()).toBeNull();
    });

    // The gap between the button and its toolbar is crossed on the way to a
    // control, so leaving the button does not take the toolbar straight away.
    it("waits a moment after the pointer leaves, and stays if it arrives on the toolbar", () => {
      vi.useFakeTimers();
      setup();
      hover(label());
      fireEvent.pointerLeave(label(), { pointerType: "mouse" });
      expect(toolbar()).not.toBeNull();

      hover(toolbar()!);
      act(() => vi.advanceTimersByTime(1000));
      expect(toolbar()).not.toBeNull();

      fireEvent.pointerLeave(toolbar()!, { pointerType: "mouse" });
      act(() => vi.advanceTimersByTime(1000));
      expect(toolbar()).toBeNull();
    });

    it("comes up while the label is being typed in, and goes with the focus", () => {
      setup();
      act(() => label().focus());
      expect(toolbar()).not.toBeNull();
      act(() => label().blur());
      expect(toolbar()).toBeNull();
    });

    it("opens the link in a new tab", () => {
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      setup({ href: "https://cal.com/kartik" });
      hover(label());
      fireEvent.click(screen.getByRole("button", { name: "Open link" }));
      expect(open).toHaveBeenCalledWith(
        "https://cal.com/kartik",
        "_blank",
        "noopener,noreferrer",
      );
      open.mockRestore();
    });

    it("has nowhere to open before the button is linked", () => {
      setup({ href: "" });
      hover(label());
      expect(
        (screen.getByRole("button", { name: "Open link" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });

    it("deletes the button altogether", () => {
      const { onDelete } = setup();
      hover(label());
      fireEvent.click(
        screen.getByRole("button", { name: "Delete button link" }),
      );
      expect(onDelete).toHaveBeenCalledOnce();
    });

    describe("editing the link", () => {
      function startEditing() {
        hover(label());
        fireEvent.click(screen.getByRole("button", { name: "Edit link" }));
        return screen.getByLabelText("Link URL") as HTMLInputElement;
      }

      it("opens on the button's address", () => {
        setup();
        const input = startEditing();
        expect(input.value).toBe("/about");
        expect(document.activeElement).toBe(input);
      });

      it("takes a new address on Enter, as a link would", () => {
        const { onChange } = setup();
        const input = startEditing();
        fireEvent.change(input, { target: { value: "cal.com/kartik" } });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(onChange).toHaveBeenCalledWith({
          type: "button_link",
          text: "Book a call",
          href: "https://cal.com/kartik",
        });
        // Back to the actions, with the caret back in the label.
        expect(screen.queryByLabelText("Link URL")).toBeNull();
        expect(document.activeElement).toBe(label());
      });

      // The address is written into the public page's `href`.
      it("refuses an address that runs rather than goes", () => {
        const { onChange } = setup();
        const input = startEditing();
        fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByLabelText("Link URL")).toBeDefined();
        expect(
          screen.getByLabelText("Link URL").getAttribute("aria-invalid"),
        ).toBe("true");
      });

      it("steps back to the actions on Escape, keeping the address", () => {
        const { onChange } = setup();
        const input = startEditing();
        fireEvent.change(input, { target: { value: "/elsewhere" } });
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.queryByLabelText("Link URL")).toBeNull();
        expect(document.activeElement).toBe(label());
      });

      // The pointer wandering off must not take a half-typed address with it.
      it("stays open while the address is being typed, wherever the pointer is", () => {
        vi.useFakeTimers();
        setup();
        startEditing();
        fireEvent.pointerLeave(label(), { pointerType: "mouse" });
        act(() => vi.advanceTimersByTime(1000));
        expect(screen.getByLabelText("Link URL")).toBeDefined();
      });
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
