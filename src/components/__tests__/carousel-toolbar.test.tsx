// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CarouselToolbar } from "../carousel-toolbar";

function setup() {
  const props = {
    rect: { left: 60, top: 240, width: 28, height: 28 },
    onOpenProperties: vi.fn(),
    onDelete: vi.fn(),
    onDismiss: vi.fn(),
  };
  const view = render(<CarouselToolbar {...props} />);
  return { ...props, ...view };
}

const button = (name: string) => screen.getByRole("button", { name });

afterEach(() => cleanup());

describe("CarouselToolbar", () => {
  it("opens at the rect it is given", () => {
    const { container } = setup();
    const anchor = container.querySelector<HTMLElement>(
      "[data-popover-anchor]",
    )!;
    expect([anchor.style.left, anchor.style.top]).toEqual(["60px", "240px"]);
  });

  it("offers the carousel's properties, then its deletion", () => {
    setup();
    const toolbar = screen.getByRole("toolbar", { name: "Carousel options" });
    expect(
      [...toolbar.children].map((item) => item.getAttribute("aria-label")),
    ).toEqual(["Carousel properties", "Delete carousel"]);
  });

  it("opens the properties", () => {
    const { onOpenProperties, onDelete } = setup();
    fireEvent.click(button("Carousel properties"));
    expect(onOpenProperties).toHaveBeenCalledOnce();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deletes the carousel", () => {
    const { onDelete, onOpenProperties } = setup();
    fireEvent.click(button("Delete carousel"));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onOpenProperties).not.toHaveBeenCalled();
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
});
