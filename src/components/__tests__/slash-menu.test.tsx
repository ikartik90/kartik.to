// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { SlashMenu } from "../slash-menu";
import type { SlashMenuBlockType } from "../slash-menu";

const mockDemoComponents = vi.hoisted(() =>
  [] as Array<{
    id: string;
    label: string;
    Component: () => null;
  }>,
);

vi.mock("@/assets/icons/subheading.svg", () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-subheading" {...props} />
  ),
}));
vi.mock("@/assets/icons/paragraph.svg", () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-paragraph" {...props} />
  ),
}));
vi.mock("@/assets/icons/media.svg", () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-media" {...props} />
  ),
}));
vi.mock("@/assets/icons/quote.svg", () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-quote" {...props} />
  ),
}));
vi.mock("@/assets/icons/code.svg", () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-code" {...props} />
  ),
}));
vi.mock("@/assets/icons/border.svg", () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-border" {...props} />
  ),
}));
vi.mock("@/assets/icons/component.svg", () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-component" {...props} />
  ),
}));
vi.mock("@/assets/icons/chevron-right.svg", () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-chevron-right" {...props} />
  ),
}));
vi.mock("@/components/demo/registry", () => ({
  get demoComponents() {
    return mockDemoComponents;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setSlashAnchorOnBody() {
  const el = document.createElement("p");
  el.setAttribute("data-slash-anchor", "");
  document.body.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SlashMenu", () => {
  let onSelect: Mock<(type: SlashMenuBlockType) => void>;
  let onSelectComponent: Mock<(componentId: string) => void>;
  let onDismiss: Mock<() => void>;
  let anchorEl: HTMLElement;

  beforeEach(() => {
    onSelect = vi.fn<(type: SlashMenuBlockType) => void>();
    onSelectComponent = vi.fn<(componentId: string) => void>();
    onDismiss = vi.fn<() => void>();
    mockDemoComponents.length = 0;
    anchorEl = setSlashAnchorOnBody();
  });

  afterEach(() => {
    cleanup();
    anchorEl.remove();
  });

  function renderMenu(props: Partial<React.ComponentProps<typeof SlashMenu>> = {}) {
    return render(
      <SlashMenu
        onSelect={onSelect}
        onSelectComponent={onSelectComponent}
        onDismiss={onDismiss}
        {...props}
      />,
    );
  }

  // -------------------------------------------------------------------------
  // Positioning
  // -------------------------------------------------------------------------

  it("positions via CSS anchor() — no inline top/left from JavaScript", () => {
    const menu = renderMenu().getByRole("menu", { name: "Insert block" });

    expect(menu.style.top).toBe("");
    expect(menu.style.left).toBe("");
    expect(menu.className).toContain("slash-menu-popover");
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it("renders all seven menu items when query is empty", () => {
    renderMenu();
    expect(screen.getByText("Sub-heading")).toBeDefined();
    expect(screen.getByText("Paragraph")).toBeDefined();
    expect(screen.getByText("Media")).toBeDefined();
    expect(screen.getByText("Component")).toBeDefined();
    expect(screen.getByText("Quote")).toBeDefined();
    expect(screen.getByText("Code Block")).toBeDefined();
    expect(screen.getByText("Horizontal Rule")).toBeDefined();
  });

  it("highlights the first item by default", () => {
    renderMenu();
    const items = screen.getAllByRole("menuitem");
    expect(items[0].getAttribute("aria-selected")).toBe("true");
    expect(items[1].getAttribute("aria-selected")).toBe("false");
  });

  it("opens the component submenu on hover and shows an empty state", () => {
    renderMenu();
    fireEvent.pointerEnter(screen.getByText("Component"));
    expect(screen.getByText("No components")).toBeDefined();
    expect(onSelectComponent).not.toHaveBeenCalled();
  });

  it("opens the component submenu when keyboard-navigated to the row", () => {
    renderMenu();
    for (let i = 0; i < 3; i++) fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(screen.getByText("No components")).toBeDefined();
  });

  it("selects a demo from the submenu when demos are available", () => {
    mockDemoComponents.push({
      id: "placeholder",
      label: "Placeholder",
      Component: () => null,
    });

    renderMenu();
    fireEvent.pointerEnter(screen.getByText("Component"));
    fireEvent.click(screen.getByText("Placeholder"));
    expect(onSelectComponent).toHaveBeenCalledWith("placeholder");
  });

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  it("filters items by query (case-insensitive)", () => {
    renderMenu({ query: "para" });
    expect(screen.getByText("Paragraph")).toBeDefined();
    expect(screen.queryByText("Sub-heading")).toBeNull();
    expect(screen.queryByText("Media")).toBeNull();
  });

  it("filters items by partial query match", () => {
    renderMenu({ query: "code" });
    expect(screen.getByText("Code Block")).toBeDefined();
    expect(screen.queryByText("Paragraph")).toBeNull();
  });

  it("renders no items when the query matches nothing", () => {
    renderMenu({ query: "zzz" });
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Click selection
  // -------------------------------------------------------------------------

  it("calls onSelect with 'heading' when Sub-heading is clicked", () => {
    renderMenu();
    fireEvent.click(screen.getByText("Sub-heading"));
    expect(onSelect).toHaveBeenCalledWith("heading");
  });

  it("calls onSelect with 'paragraph' when Paragraph is clicked", () => {
    renderMenu();
    fireEvent.click(screen.getByText("Paragraph"));
    expect(onSelect).toHaveBeenCalledWith("paragraph");
  });

  it("calls onSelect with 'blockquote' when Quote is clicked", () => {
    renderMenu();
    fireEvent.click(screen.getByText("Quote"));
    expect(onSelect).toHaveBeenCalledWith("blockquote");
  });

  it("calls onSelect with 'code_block' when Code Block is clicked", () => {
    renderMenu();
    fireEvent.click(screen.getByText("Code Block"));
    expect(onSelect).toHaveBeenCalledWith("code_block");
  });

  it("calls onSelect with 'horizontal_rule' when Horizontal Rule is clicked", () => {
    renderMenu();
    fireEvent.click(screen.getByText("Horizontal Rule"));
    expect(onSelect).toHaveBeenCalledWith("horizontal_rule");
  });

  // -------------------------------------------------------------------------
  // Keyboard navigation
  // -------------------------------------------------------------------------

  it("moves active item down with ArrowDown", () => {
    renderMenu();
    fireEvent.keyDown(document, { key: "ArrowDown" });
    const items = screen.getAllByRole("menuitem");
    expect(items[0].getAttribute("aria-selected")).toBe("false");
    expect(items[1].getAttribute("aria-selected")).toBe("true");
  });

  it("moves active item up with ArrowUp", () => {
    renderMenu();
    // Move down twice, then up once → should land on index 1.
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "ArrowUp" });
    const items = screen.getAllByRole("menuitem");
    expect(items[1].getAttribute("aria-selected")).toBe("true");
  });

  it("wraps from last item to first when pressing ArrowDown", () => {
    renderMenu();
    // Move down past the last item (7 items total → 7 presses wraps back to 0).
    for (let i = 0; i < 7; i++) fireEvent.keyDown(document, { key: "ArrowDown" });
    const items = screen.getAllByRole("menuitem");
    expect(items[0].getAttribute("aria-selected")).toBe("true");
    expect(items[items.length - 1].getAttribute("aria-selected")).toBe("false");
  });

  it("wraps from first item to last when pressing ArrowUp", () => {
    renderMenu();
    // At index 0, pressing ArrowUp once wraps to the last item.
    fireEvent.keyDown(document, { key: "ArrowUp" });
    const items = screen.getAllByRole("menuitem");
    expect(items[items.length - 1].getAttribute("aria-selected")).toBe("true");
    expect(items[0].getAttribute("aria-selected")).toBe("false");
  });

  it("moves highlight to item under pointer (onPointerEnter)", () => {
    renderMenu();
    // Simulate hovering over the third item (Media, index 2).
    fireEvent.pointerEnter(screen.getByText("Media"));
    const items = screen.getAllByRole("menuitem");
    expect(items[2].getAttribute("aria-selected")).toBe("true");
    expect(items[0].getAttribute("aria-selected")).toBe("false");
  });

  it("keyboard arrow navigation takes over from the pointer-entered position", () => {
    renderMenu();
    // Hover index 2 (Media), then press ArrowDown → should land on index 3 (Component).
    fireEvent.pointerEnter(screen.getByText("Media"));
    fireEvent.keyDown(document, { key: "ArrowDown" });
    const items = screen.getAllByRole("menuitem");
    expect(items[3].getAttribute("aria-selected")).toBe("true");
  });

  it("selects the active item on Enter", () => {
    renderMenu();
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("paragraph");
  });

  it("selects the first item on Enter with no navigation", () => {
    renderMenu();
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("heading");
  });

  it("resets active index to 0 when query changes", () => {
    const { rerender } = renderMenu();
    fireEvent.keyDown(document, { key: "ArrowDown" });
    // Change query so filtered list updates.
    act(() => {
      rerender(
        <SlashMenu
          query="p"
          onSelect={onSelect}
          onSelectComponent={onSelectComponent}
          onDismiss={onDismiss}
        />,
      );
    });
    const items = screen.getAllByRole("menuitem");
    expect(items[0].getAttribute("aria-selected")).toBe("true");
  });

  // -------------------------------------------------------------------------
  // Dismiss
  // -------------------------------------------------------------------------

  it("calls onDismiss when Escape is pressed", () => {
    renderMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("calls onDismiss on pointer down outside the menu", () => {
    renderMenu();
    fireEvent.pointerDown(document.body);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does not call onDismiss on pointer down inside the menu", () => {
    renderMenu();
    const item = screen.getByText("Paragraph");
    fireEvent.pointerDown(item);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
