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

// Collapse the caret inside `el` at absolute text offset `at` (paragraph breaks
// count as one character), mirroring where the user would be typing.
function placeCaret(el: HTMLElement, at: number) {
  const paragraphs = Array.from(el.children);
  let index = 0;
  let column = at;
  while (index < paragraphs.length - 1 && column > (paragraphs[index].textContent ?? "").length) {
    column -= (paragraphs[index].textContent ?? "").length + 1;
    index++;
  }
  const host = paragraphs[index] ?? el;
  const textNode = host.firstChild;
  const range = document.createRange();
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    range.setStart(textNode, column);
  } else {
    range.setStart(host, 0);
  }
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

describe("SidenoteLayer — note paragraphs", () => {
  function renderEditable(text: string, handlers: Record<string, unknown> = {}) {
    render(
      <SidenoteLayer
        entries={[entry({ text })]}
        trigger="caret"
        editable
        activeId="n1"
        {...handlers}
      />,
    );
    return screen.getByRole("textbox", { name: "Sidenote 1" });
  }

  it("renders a stored multi-paragraph note as one element per paragraph", () => {
    const body = renderEditable("first\nsecond");
    expect(Array.from(body.children).map((c) => c.textContent)).toEqual([
      "first",
      "second",
    ]);
  });

  it("splits the note at the caret on Shift+Enter", () => {
    const onChangeText = vi.fn();
    const onExitEdit = vi.fn();
    const body = renderEditable("onetwo", { onChangeText, onExitEdit });
    placeCaret(body, 3);

    fireEvent.keyDown(body, { key: "Enter", shiftKey: true });

    expect(onChangeText).toHaveBeenCalledWith(
      expect.objectContaining({ id: "n1" }),
      "one\ntwo",
    );
    expect(Array.from(body.children).map((c) => c.textContent)).toEqual([
      "one",
      "two",
    ]);
    expect(onExitEdit).not.toHaveBeenCalled();
  });

  it("appends an empty paragraph when Shift+Enter lands at the end", () => {
    const onChangeText = vi.fn();
    const body = renderEditable("note", { onChangeText });
    placeCaret(body, 4);

    fireEvent.keyDown(body, { key: "Enter", shiftKey: true });

    expect(onChangeText).toHaveBeenCalledWith(expect.anything(), "note\n");
    expect(body.children).toHaveLength(2);
  });

  it("exits on a plain Enter without adding a paragraph", () => {
    const onChangeText = vi.fn();
    const onExitEdit = vi.fn();
    const body = renderEditable("note", { onChangeText, onExitEdit });
    placeCaret(body, 4);

    fireEvent.keyDown(body, { key: "Enter" });

    expect(onExitEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "n1" }));
    expect(onChangeText).not.toHaveBeenCalled();
    expect(body.children).toHaveLength(1);
  });

  it("reports typed text with paragraph breaks preserved", () => {
    const onChangeText = vi.fn();
    const body = renderEditable("first\nsecond", { onChangeText });
    body.children[1].textContent = "second edited";

    fireEvent.input(body);

    expect(onChangeText).toHaveBeenCalledWith(
      expect.anything(),
      "first\nsecond edited",
    );
  });

  it("renders each paragraph in the read-only card", () => {
    render(<SidenoteLayer entries={[entry({ text: "first\nsecond" })]} />);
    expect(screen.getByText("first")).toBeDefined();
    expect(screen.getByText("second")).toBeDefined();
  });
});
