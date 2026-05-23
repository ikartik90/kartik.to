// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { SlashMenu } from "../slash-menu";
import type { SlashMenuBlockType } from "../slash-menu";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnchor() {
  const el = document.createElement("p");
  el.style.top = "100px";
  el.style.left = "50px";
  document.body.appendChild(el);
  el.getBoundingClientRect = () => ({
    top: 100,
    left: 50,
    bottom: 120,
    right: 250,
    width: 200,
    height: 20,
    x: 50,
    y: 100,
    toJSON: () => ({}),
  });
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SlashMenu", () => {
  let onSelect: Mock<(type: SlashMenuBlockType) => void>;
  let onDismiss: Mock<() => void>;
  let anchor: HTMLElement;

  beforeEach(() => {
    onSelect = vi.fn<(type: SlashMenuBlockType) => void>();
    onDismiss = vi.fn<() => void>();
    anchor = makeAnchor();
  });

  afterEach(() => {
    cleanup();
    anchor.remove();
  });

  // -------------------------------------------------------------------------
  // Positioning
  // -------------------------------------------------------------------------

  it("opens below the anchor when there is enough space below", () => {
    // anchor: top=100, bottom=120; menu height=200; viewport=800 → 676px below, opens down.
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() { return 200; },
    });

    const menu = render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    ).getByRole("menu");

    // anchor.bottom (120) + gap (4) = 124px
    expect(menu.style.top).toBe("124px");

    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    }
    Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
  });

  it("stays below even when space is tight if there is not enough room above either", () => {
    // anchor: top=100, bottom=120; menu height=300; viewport=200
    // spaceBelow=76 (<300), spaceAbove=96 (<300) → both insufficient → open below.
    Object.defineProperty(window, "innerHeight", { value: 200, configurable: true });
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() { return 300; },
    });

    const menu = render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    ).getByRole("menu");

    // anchor.bottom (120) + gap (4) = 124px (stays below, no flip)
    expect(menu.style.top).toBe("124px");

    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    }
    Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
  });

  it("flips above the anchor when space below is insufficient but space above is adequate", () => {
    // anchor: top=600, bottom=620; menu height=200; viewport=700
    // spaceBelow=76 (<200), spaceAbove=596 (>=200) → flip upward.
    const anchorNearBottom = document.createElement("p");
    document.body.appendChild(anchorNearBottom);
    anchorNearBottom.getBoundingClientRect = () => ({
      top: 600, bottom: 620, left: 50, right: 250,
      width: 200, height: 20, x: 50, y: 600, toJSON: () => ({}),
    });

    Object.defineProperty(window, "innerHeight", { value: 700, configurable: true });
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() { return 200; },
    });

    const menu = render(
      <SlashMenu anchor={anchorNearBottom} onSelect={onSelect} onDismiss={onDismiss} />,
    ).getByRole("menu");

    // anchor.top (600) - gap (4) - menuHeight (200) = 396px
    expect(menu.style.top).toBe("396px");

    anchorNearBottom.remove();
    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    }
    Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it("renders all six menu items when query is empty", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    expect(screen.getByText("Sub-heading")).toBeDefined();
    expect(screen.getByText("Paragraph")).toBeDefined();
    expect(screen.getByText("Media")).toBeDefined();
    expect(screen.getByText("Quote")).toBeDefined();
    expect(screen.getByText("Code Block")).toBeDefined();
    expect(screen.getByText("Horizontal Rule")).toBeDefined();
  });

  it("highlights the first item by default", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    const items = screen.getAllByRole("menuitem");
    expect(items[0].getAttribute("aria-selected")).toBe("true");
    expect(items[1].getAttribute("aria-selected")).toBe("false");
  });

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  it("filters items by query (case-insensitive)", () => {
    render(
      <SlashMenu anchor={anchor} query="para" onSelect={onSelect} onDismiss={onDismiss} />,
    );
    expect(screen.getByText("Paragraph")).toBeDefined();
    expect(screen.queryByText("Sub-heading")).toBeNull();
    expect(screen.queryByText("Media")).toBeNull();
  });

  it("filters items by partial query match", () => {
    render(
      <SlashMenu anchor={anchor} query="co" onSelect={onSelect} onDismiss={onDismiss} />,
    );
    expect(screen.getByText("Code Block")).toBeDefined();
    expect(screen.queryByText("Paragraph")).toBeNull();
  });

  it("calls onDismiss when no items match the query", () => {
    render(
      <SlashMenu anchor={anchor} query="zzz" onSelect={onSelect} onDismiss={onDismiss} />,
    );
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Click selection
  // -------------------------------------------------------------------------

  it("calls onSelect with 'heading' when Sub-heading is clicked", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByText("Sub-heading"));
    expect(onSelect).toHaveBeenCalledWith("heading");
  });

  it("calls onSelect with 'paragraph' when Paragraph is clicked", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByText("Paragraph"));
    expect(onSelect).toHaveBeenCalledWith("paragraph");
  });

  it("calls onSelect with 'blockquote' when Quote is clicked", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByText("Quote"));
    expect(onSelect).toHaveBeenCalledWith("blockquote");
  });

  it("calls onSelect with 'code_block' when Code Block is clicked", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByText("Code Block"));
    expect(onSelect).toHaveBeenCalledWith("code_block");
  });

  it("calls onSelect with 'horizontal_rule' when Horizontal Rule is clicked", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByText("Horizontal Rule"));
    expect(onSelect).toHaveBeenCalledWith("horizontal_rule");
  });

  // -------------------------------------------------------------------------
  // Keyboard navigation
  // -------------------------------------------------------------------------

  it("moves active item down with ArrowDown", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    fireEvent.keyDown(document, { key: "ArrowDown" });
    const items = screen.getAllByRole("menuitem");
    expect(items[0].getAttribute("aria-selected")).toBe("false");
    expect(items[1].getAttribute("aria-selected")).toBe("true");
  });

  it("moves active item up with ArrowUp", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    // Move down twice, then up once → should land on index 1.
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "ArrowUp" });
    const items = screen.getAllByRole("menuitem");
    expect(items[1].getAttribute("aria-selected")).toBe("true");
  });

  it("wraps from last item to first when pressing ArrowDown", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    // Move down past the last item (6 items total → 6 presses wraps back to 0).
    for (let i = 0; i < 6; i++) fireEvent.keyDown(document, { key: "ArrowDown" });
    const items = screen.getAllByRole("menuitem");
    expect(items[0].getAttribute("aria-selected")).toBe("true");
    expect(items[items.length - 1].getAttribute("aria-selected")).toBe("false");
  });

  it("wraps from first item to last when pressing ArrowUp", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    // At index 0, pressing ArrowUp once wraps to the last item.
    fireEvent.keyDown(document, { key: "ArrowUp" });
    const items = screen.getAllByRole("menuitem");
    expect(items[items.length - 1].getAttribute("aria-selected")).toBe("true");
    expect(items[0].getAttribute("aria-selected")).toBe("false");
  });

  it("moves highlight to item under pointer (onPointerEnter)", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    // Simulate hovering over the third item (Media, index 2).
    fireEvent.pointerEnter(screen.getByText("Media"));
    const items = screen.getAllByRole("menuitem");
    expect(items[2].getAttribute("aria-selected")).toBe("true");
    expect(items[0].getAttribute("aria-selected")).toBe("false");
  });

  it("keyboard arrow navigation takes over from the pointer-entered position", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    // Hover index 2, then press ArrowDown → should land on index 3.
    fireEvent.pointerEnter(screen.getByText("Media"));
    fireEvent.keyDown(document, { key: "ArrowDown" });
    const items = screen.getAllByRole("menuitem");
    expect(items[3].getAttribute("aria-selected")).toBe("true");
  });

  it("selects the active item on Enter", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("paragraph");
  });

  it("selects the first item on Enter with no navigation", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("heading");
  });

  it("resets active index to 0 when query changes", () => {
    const { rerender } = render(
      <SlashMenu anchor={anchor} query="" onSelect={onSelect} onDismiss={onDismiss} />,
    );
    fireEvent.keyDown(document, { key: "ArrowDown" });
    // Change query so filtered list updates.
    act(() => {
      rerender(
        <SlashMenu anchor={anchor} query="p" onSelect={onSelect} onDismiss={onDismiss} />,
      );
    });
    const items = screen.getAllByRole("menuitem");
    expect(items[0].getAttribute("aria-selected")).toBe("true");
  });

  // -------------------------------------------------------------------------
  // Dismiss
  // -------------------------------------------------------------------------

  it("calls onDismiss when Escape is pressed", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("calls onDismiss on pointer down outside the menu", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    fireEvent.pointerDown(document.body);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does not call onDismiss on pointer down inside the menu", () => {
    render(
      <SlashMenu anchor={anchor} onSelect={onSelect} onDismiss={onDismiss} />,
    );
    const item = screen.getByText("Paragraph");
    fireEvent.pointerDown(item);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
