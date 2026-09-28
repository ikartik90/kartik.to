// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ButtonLinkNode } from "@/domain/nodes";
import { ButtonLinkToolbar } from "../button-link-toolbar";

function setup(block: Partial<ButtonLinkNode> = {}) {
  const props = {
    rect: { left: 60, top: 240, width: 28, height: 28 },
    block: {
      type: "button_link" as const,
      text: "Book a call",
      href: "/about",
      ...block,
    },
    onChange: vi.fn(),
    onDelete: vi.fn(),
    onEditEnd: vi.fn(),
    onDismiss: vi.fn(),
  };
  const view = render(<ButtonLinkToolbar {...props} />);
  return { ...props, ...view };
}

const actions = () => screen.queryByRole("toolbar", { name: "Link actions" });

afterEach(() => cleanup());

describe("ButtonLinkToolbar", () => {
  it("opens on the button's actions, at the rect it is given", () => {
    const { container } = setup();
    expect(actions()).not.toBeNull();
    const anchor = container.querySelector<HTMLElement>(
      "[data-popover-anchor]",
    )!;
    expect([anchor.style.left, anchor.style.top]).toEqual(["60px", "240px"]);
  });

  it("goes on Escape", () => {
    const { onDismiss } = setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("goes on a press anywhere else", () => {
    const { onDismiss } = setup();
    fireEvent.pointerDown(document.body);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("opens the link in a new tab", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    setup({ href: "https://cal.com/kartik" });
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
    expect(
      (screen.getByRole("button", { name: "Open link" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("deletes the button altogether", () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete button link" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  describe("staying in view", () => {
    it("turns sticky on", () => {
      const { onChange } = setup();
      const toggle = screen.getByRole("button", { name: "Sticky" });
      expect(toggle.getAttribute("aria-pressed")).toBe("false");
      fireEvent.click(toggle);
      expect(onChange).toHaveBeenCalledWith({
        type: "button_link",
        text: "Book a call",
        href: "/about",
        sticky: true,
      });
    });

    it("turns sticky off, leaving no flag behind", () => {
      const { onChange } = setup({ sticky: true });
      const toggle = screen.getByRole("button", { name: "Sticky" });
      expect(toggle.getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(toggle);
      expect(onChange).toHaveBeenCalledWith({
        type: "button_link",
        text: "Book a call",
        href: "/about",
      });
    });
  });

  describe("its colour", () => {
    const swatch = (name: string) => screen.getByRole("radio", { name });

    it("offers neutral and accent, neutral when never chosen", () => {
      setup();
      expect(
        screen.getByRole("radiogroup", { name: "Button colour" }),
      ).toBeTruthy();
      expect(swatch("Neutral").getAttribute("aria-checked")).toBe("true");
      expect(swatch("Accent").getAttribute("aria-checked")).toBe("false");
    });

    it("turns the button accent", () => {
      const { onChange } = setup();
      fireEvent.click(swatch("Accent"));
      expect(onChange).toHaveBeenCalledWith({
        type: "button_link",
        text: "Book a call",
        href: "/about",
        color: "accent",
      });
    });

    it("turns it back to neutral, leaving no colour behind", () => {
      const { onChange } = setup({ color: "accent" });
      expect(swatch("Accent").getAttribute("aria-checked")).toBe("true");
      fireEvent.click(swatch("Neutral"));
      expect(onChange).toHaveBeenCalledWith({
        type: "button_link",
        text: "Book a call",
        href: "/about",
      });
    });
  });

  describe("editing the link", () => {
    function startEditing() {
      fireEvent.click(screen.getByRole("button", { name: "Edit link" }));
      return screen.getByLabelText("Link URL") as HTMLInputElement;
    }

    it("opens on the button's address", () => {
      setup();
      const input = startEditing();
      expect(input.value).toBe("/about");
      expect(document.activeElement).toBe(input);
    });

    it("takes a new address on Enter and steps back to the actions", () => {
      const { onChange, onEditEnd } = setup();
      const input = startEditing();
      fireEvent.change(input, { target: { value: "cal.com/kartik" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith({
        type: "button_link",
        text: "Book a call",
        href: "https://cal.com/kartik",
      });
      expect(screen.queryByLabelText("Link URL")).toBeNull();
      expect(actions()).not.toBeNull();
      expect(onEditEnd).toHaveBeenCalledOnce();
    });

    it("takes the new-tab setting with the address", () => {
      const { onChange } = setup();
      const input = startEditing();
      fireEvent.click(screen.getByRole("button", { name: "Open in new tab" }));
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith({
        type: "button_link",
        text: "Book a call",
        href: "/about",
        newTab: true,
      });
    });

    it("drops the new-tab setting when it is turned off", () => {
      const { onChange } = setup({ newTab: true });
      const input = startEditing();
      fireEvent.click(screen.getByRole("button", { name: "Open in new tab" }));
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith({
        type: "button_link",
        text: "Book a call",
        href: "/about",
      });
    });

    it("refuses an address that runs rather than goes", () => {
      const { onChange } = setup();
      const input = startEditing();
      fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onChange).not.toHaveBeenCalled();
      expect(
        screen.getByLabelText("Link URL").getAttribute("aria-invalid"),
      ).toBe("true");
    });

    it("steps back to the actions on Escape, keeping the address", () => {
      const { onChange, onEditEnd, onDismiss } = setup();
      const input = startEditing();
      fireEvent.change(input, { target: { value: "/elsewhere" } });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByLabelText("Link URL")).toBeNull();
      expect(actions()).not.toBeNull();
      expect(onEditEnd).toHaveBeenCalledOnce();
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it("stays open while the address is being typed, wherever the press is", () => {
      const { onDismiss } = setup();
      startEditing();
      fireEvent.pointerDown(document.body);
      expect(screen.getByLabelText("Link URL")).toBeDefined();
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });
});
