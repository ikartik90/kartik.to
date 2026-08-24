// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  PANEL_INSET_ATTR,
  usePropertiesPanelInset,
} from "../use-properties-panel-inset";

const marked = () => document.body.hasAttribute(PANEL_INSET_ATTR);

describe("usePropertiesPanelInset", () => {
  afterEach(() => document.body.removeAttribute(PANEL_INSET_ATTR));

  it("leaves the page alone while inactive", () => {
    renderHook(() => usePropertiesPanelInset(false));
    expect(marked()).toBe(false);
  });

  it("marks the page while a panel is up, and clears it after", () => {
    const { unmount } = renderHook(() => usePropertiesPanelInset(true));
    expect(marked()).toBe(true);

    unmount();
    expect(marked()).toBe(false);
  });

  it("clears the mark when the panel goes inactive without unmounting", () => {
    const { rerender } = renderHook(
      ({ active }) => usePropertiesPanelInset(active),
      { initialProps: { active: true } },
    );
    expect(marked()).toBe(true);

    // What a dismissal does: the panel is still mounted, sliding out, and the
    // page should already be reclaiming the width.
    rerender({ active: false });
    expect(marked()).toBe(false);
  });

  it("holds the mark until the LAST panel has gone", () => {
    const first = renderHook(() => usePropertiesPanelInset(true));
    const second = renderHook(() => usePropertiesPanelInset(true));

    first.unmount();
    expect(marked()).toBe(true);

    second.unmount();
    expect(marked()).toBe(false);
  });
});
