// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HeadingNode } from "@/domain/nodes";
import { HeadingToolbar } from "../heading-toolbar";

function setup(block: Partial<HeadingNode> = {}) {
  const props = {
    rect: { left: 60, top: 240, width: 28, height: 28 },
    block: {
      type: "heading" as const,
      level: 2 as const,
      children: [{ type: "text" as const, text: "Section" }],
      ...block,
    },
    onChange: vi.fn(),
    onDismiss: vi.fn(),
  };
  const view = render(<HeadingToolbar {...props} />);
  return { ...props, ...view };
}

const button = (name: string) => screen.getByRole("button", { name });
const pressed = (name: string) => button(name).getAttribute("aria-pressed");

afterEach(() => cleanup());

describe("HeadingToolbar", () => {
  it("opens at the rect it is given", () => {
    const { container } = setup();
    expect(
      screen.getByRole("toolbar", { name: "Heading options" }),
    ).toBeTruthy();
    const anchor = container.querySelector<HTMLElement>(
      "[data-popover-anchor]",
    )!;
    expect([anchor.style.left, anchor.style.top]).toEqual(["60px", "240px"]);
  });

  it("offers the eyebrow, then a separator, then the two indents", () => {
    setup();
    const toolbar = screen.getByRole("toolbar", { name: "Heading options" });
    expect(
      [...toolbar.children].map(
        (item) => item.getAttribute("aria-label") ?? item.tagName,
      ),
    ).toEqual(["Eyebrow", "SPAN", "Indent left", "Indent right"]);
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

  describe("the eyebrow", () => {
    it("is off on a heading without one", () => {
      setup();
      expect(pressed("Eyebrow")).toBe("false");
    });

    it("is on while the heading has one, even an empty one", () => {
      setup({ caption: "" });
      expect(pressed("Eyebrow")).toBe("true");
    });

    it("turns on empty, ready to be written", () => {
      const { onChange } = setup();
      fireEvent.click(button("Eyebrow"));
      expect(onChange).toHaveBeenCalledWith({
        type: "heading",
        level: 2,
        children: [{ type: "text", text: "Section" }],
        caption: "",
      });
    });

    it("turns off, taking its words with it", () => {
      const { onChange } = setup({ caption: "Chapter one" });
      fireEvent.click(button("Eyebrow"));
      expect(onChange).toHaveBeenCalledWith({
        type: "heading",
        level: 2,
        children: [{ type: "text", text: "Section" }],
      });
    });

    it("keeps the toolbar open", () => {
      const { onDismiss } = setup();
      fireEvent.click(button("Eyebrow"));
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ["Indent left", "indentLeft"],
    ["Indent right", "indentRight"],
  ] as const)("%s", (label, field) => {
    it("is off by default", () => {
      setup();
      expect(pressed(label)).toBe("false");
    });

    it("turns on", () => {
      const { onChange } = setup();
      fireEvent.click(button(label));
      expect(onChange).toHaveBeenCalledWith({
        type: "heading",
        level: 2,
        children: [{ type: "text", text: "Section" }],
        [field]: true,
      });
    });

    it("turns off, leaving no flag behind", () => {
      const { onChange } = setup({ [field]: true });
      expect(pressed(label)).toBe("true");
      fireEvent.click(button(label));
      expect(onChange).toHaveBeenCalledWith({
        type: "heading",
        level: 2,
        children: [{ type: "text", text: "Section" }],
      });
    });
  });

  it("keeps one indent when the other is turned on", () => {
    const { onChange } = setup({ indentLeft: true });
    fireEvent.click(button("Indent right"));
    expect(onChange).toHaveBeenCalledWith({
      type: "heading",
      level: 2,
      children: [{ type: "text", text: "Section" }],
      indentLeft: true,
      indentRight: true,
    });
  });
});
