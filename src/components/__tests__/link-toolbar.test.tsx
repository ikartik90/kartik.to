// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LinkActions, LinkEditRow } from "../link-toolbar";

afterEach(() => cleanup());

describe("LinkActions", () => {
  const handlers = () => ({
    onEdit: vi.fn(),
    onOpen: vi.fn(),
    onRemove: vi.fn(),
  });

  it("edits, opens and removes", () => {
    const h = handlers();
    render(<LinkActions {...h} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit link" }));
    fireEvent.click(screen.getByRole("button", { name: "Open link" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
    expect(h.onEdit).toHaveBeenCalledOnce();
    expect(h.onOpen).toHaveBeenCalledOnce();
    expect(h.onRemove).toHaveBeenCalledOnce();
  });

  it("names what removing takes away", () => {
    render(<LinkActions {...handlers()} removeLabel="Delete button link" />);
    expect(
      screen.getByRole("button", { name: "Delete button link" }),
    ).toBeDefined();
  });

  it("offers the sticky toggle only to a host that takes it", () => {
    render(<LinkActions {...handlers()} />);
    expect(screen.queryByRole("button", { name: "Sticky" })).toBeNull();
  });

  it("toggles sticky, showing whether it is on", () => {
    const onToggleSticky = vi.fn();
    render(
      <LinkActions {...handlers()} sticky onToggleSticky={onToggleSticky} />,
    );
    const toggle = screen.getByRole("button", { name: "Sticky" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(toggle);
    expect(onToggleSticky).toHaveBeenCalledOnce();
  });

  it("will not open a link that goes nowhere", () => {
    const h = handlers();
    render(<LinkActions {...h} canOpen={false} />);
    const open = screen.getByRole("button", { name: "Open link" });
    expect((open as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(open);
    expect(h.onOpen).not.toHaveBeenCalled();
  });
});

describe("LinkEditRow", () => {
  it("opens on the address, focused and selected", () => {
    render(<LinkEditRow href="https://old.example" onApply={vi.fn()} />);
    const input = screen.getByLabelText("Link URL") as HTMLInputElement;
    expect(input.value).toBe("https://old.example");
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it("applies what was typed on Enter, trimmed", () => {
    const onApply = vi.fn();
    render(<LinkEditRow onApply={onApply} />);
    const input = screen.getByLabelText("Link URL");
    fireEvent.change(input, { target: { value: "  kartik.to  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onApply).toHaveBeenCalledWith("kartik.to", false);
  });

  it("toggles opening in a new tab, and applies it with the address", () => {
    const onApply = vi.fn();
    render(<LinkEditRow onApply={onApply} />);
    const toggle = screen.getByRole("button", { name: "Open in new tab" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    const input = screen.getByLabelText("Link URL");
    fireEvent.change(input, { target: { value: "kartik.to" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onApply).toHaveBeenCalledWith("kartik.to", true);
  });

  it("opens on the link's own new-tab setting", () => {
    render(<LinkEditRow href="https://x.io" newTab onApply={vi.fn()} />);
    expect(
      screen
        .getByRole("button", { name: "Open in new tab" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("applies nothing from an empty box", () => {
    const onApply = vi.fn();
    render(<LinkEditRow onApply={onApply} />);
    fireEvent.keyDown(screen.getByLabelText("Link URL"), { key: "Enter" });
    expect(onApply).not.toHaveBeenCalled();
  });

  it("says when the host refused the address, until it is changed", () => {
    const onInput = vi.fn();
    render(<LinkEditRow onApply={vi.fn()} invalid onInput={onInput} />);
    const input = screen.getByLabelText("Link URL");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(input, { target: { value: "x" } });
    expect(onInput).toHaveBeenCalledOnce();
  });
});
