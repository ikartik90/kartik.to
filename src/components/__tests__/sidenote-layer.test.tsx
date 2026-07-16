// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidenoteLayer } from "../sidenote-layer";
import type { SidenoteEntry } from "@/utils/sidenotes";

afterEach(cleanup);

function entry(overrides: Partial<SidenoteEntry> = {}): SidenoteEntry {
  return {
    id: "n1",
    blockIndex: 0,
    number: 1,
    text: "the note",
    anchorName: "--sn-n1",
    ...overrides,
  };
}

// requestAnimationFrame runs the autofocus retry — flush it synchronously.
function flushFrames() {
  act(() => {
    vi.runOnlyPendingTimers();
  });
}

describe("SidenoteLayer — editor card", () => {
  it("renders the 'Esc to exit' hint only in editable mode", () => {
    const { rerender } = render(
      <SidenoteLayer entries={[entry()]} trigger="caret" editable />,
    );
    expect(screen.getByText("Esc")).toBeDefined();
    expect(screen.getByText("to exit")).toBeDefined();

    rerender(<SidenoteLayer entries={[entry()]} trigger="pointer" />);
    expect(screen.queryByText("Esc")).toBeNull();
  });

  it("autofocuses the note body when its id becomes the autoFocusId", () => {
    vi.useFakeTimers();
    const onAutoFocused = vi.fn();
    // Start inactive (no autoFocusId), then flip it on — mirrors clicking Edit
    // on an existing note whose card was hidden until now.
    const { rerender } = render(
      <SidenoteLayer
        entries={[entry()]}
        trigger="caret"
        editable
        activeId={null}
        autoFocusId={null}
        onAutoFocused={onAutoFocused}
      />,
    );
    const body = screen.getByRole("textbox", { name: "Sidenote 1" });
    expect(document.activeElement).not.toBe(body);

    rerender(
      <SidenoteLayer
        entries={[entry()]}
        trigger="caret"
        editable
        activeId="n1"
        autoFocusId="n1"
        onAutoFocused={onAutoFocused}
      />,
    );
    flushFrames();

    expect(document.activeElement).toBe(body);
    expect(onAutoFocused).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("calls onExitEdit with the entry when Escape is pressed in the body", () => {
    const onExitEdit = vi.fn();
    render(
      <SidenoteLayer
        entries={[entry()]}
        trigger="caret"
        editable
        activeId="n1"
        onExitEdit={onExitEdit}
      />,
    );
    const body = screen.getByRole("textbox", { name: "Sidenote 1" });
    fireEvent.keyDown(body, { key: "Escape" });
    expect(onExitEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "n1" }));
  });
});
