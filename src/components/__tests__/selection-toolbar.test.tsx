// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectionToolbar } from "../selection-toolbar";
import type { Mark } from "@/domain/nodes";

afterEach(cleanup);

function noopHandlers() {
  return {
    onToggleMark: vi.fn(),
    onStartLink: vi.fn(),
    onApplyLink: vi.fn(),
    onRemoveLink: vi.fn(),
    onGotoLink: vi.fn(),
    onEditLink: vi.fn(),
    onDismiss: vi.fn(),
  };
}

const empty: ReadonlySet<Mark["type"]> = new Set();

describe("SelectionToolbar — format mode", () => {
  it("renders the formatting buttons", () => {
    render(
      <SelectionToolbar mode="format" activeMarks={empty} {...noopHandlers()} />,
    );
    expect(screen.getByRole("toolbar", { name: "Format selection" })).toBeDefined();
    for (const label of [
      "Add link",
      "Bold",
      "Italic",
      "Underline",
      "Wavy underline",
      "Strikethrough",
      "Code",
    ]) {
      expect(screen.getByLabelText(label)).toBeDefined();
    }
  });

  it("calls onToggleMark with the mark type when a button is clicked", () => {
    const h = noopHandlers();
    render(<SelectionToolbar mode="format" activeMarks={empty} {...h} />);
    fireEvent.click(screen.getByLabelText("Strikethrough"));
    expect(h.onToggleMark).toHaveBeenCalledWith("strikethrough");
  });

  it("marks active buttons via aria-pressed", () => {
    render(
      <SelectionToolbar
        mode="format"
        activeMarks={new Set<Mark["type"]>(["italic"])}
        {...noopHandlers()}
      />,
    );
    expect(screen.getByLabelText("Italic").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByLabelText("Bold").getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("starts link editing from the link button", () => {
    const h = noopHandlers();
    render(<SelectionToolbar mode="format" activeMarks={empty} {...h} />);
    fireEvent.click(screen.getByLabelText("Add link"));
    expect(h.onStartLink).toHaveBeenCalled();
  });

  it("dismisses on Escape", () => {
    const h = noopHandlers();
    render(<SelectionToolbar mode="format" activeMarks={empty} {...h} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(h.onDismiss).toHaveBeenCalled();
  });
});

describe("SelectionToolbar — link-edit mode", () => {
  it("prefills the href and applies on Enter", () => {
    const h = noopHandlers();
    render(
      <SelectionToolbar
        mode="link-edit"
        activeMarks={empty}
        linkHref="https://old.example"
        {...h}
      />,
    );
    const input = screen.getByLabelText("Link URL") as HTMLInputElement;
    expect(input.value).toBe("https://old.example");
    fireEvent.change(input, { target: { value: "https://new.example" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(h.onApplyLink).toHaveBeenCalledWith("https://new.example");
  });

  it("does not apply an empty href", () => {
    const h = noopHandlers();
    render(<SelectionToolbar mode="link-edit" activeMarks={empty} {...h} />);
    const input = screen.getByLabelText("Link URL");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(h.onApplyLink).not.toHaveBeenCalled();
  });

  it("dismisses on Escape from the input", () => {
    const h = noopHandlers();
    render(<SelectionToolbar mode="link-edit" activeMarks={empty} {...h} />);
    fireEvent.keyDown(screen.getByLabelText("Link URL"), { key: "Escape" });
    expect(h.onDismiss).toHaveBeenCalled();
  });
});

describe("SelectionToolbar — link-view mode", () => {
  it("renders edit / open / remove actions and wires them", () => {
    const h = noopHandlers();
    render(
      <SelectionToolbar
        mode="link-view"
        activeMarks={empty}
        linkHref="https://example.com"
        {...h}
      />,
    );
    expect(screen.getByRole("toolbar", { name: "Link actions" })).toBeDefined();
    fireEvent.click(screen.getByLabelText("Edit link"));
    fireEvent.click(screen.getByLabelText("Open link"));
    fireEvent.click(screen.getByLabelText("Remove link"));
    expect(h.onEditLink).toHaveBeenCalled();
    expect(h.onGotoLink).toHaveBeenCalled();
    expect(h.onRemoveLink).toHaveBeenCalled();
  });
});
