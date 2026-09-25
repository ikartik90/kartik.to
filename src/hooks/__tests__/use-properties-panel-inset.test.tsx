// @vitest-environment jsdom
import { render, renderHook } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PANEL_INSET_ATTR,
  PANEL_INSET_INSTANT_ATTR,
  usePropertiesPanelInset,
} from "../use-properties-panel-inset";

const marked = () => document.body.hasAttribute(PANEL_INSET_ATTR);
const instant = () => document.body.hasAttribute(PANEL_INSET_INSTANT_ATTR);

/** A fresh module: its last-input clock is module scope and would leak between tests. */
const freshHook = async () => {
  vi.resetModules();
  return (await import("../use-properties-panel-inset"))
    .usePropertiesPanelInset;
};

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

  // A sibling's layout effect runs after the claimant's: it sees a layout-effect claim, not a passive one.
  it("marks the page before the frame is painted", () => {
    let seen: boolean | null = null;

    function Claimant() {
      usePropertiesPanelInset(true);
      return null;
    }

    function Probe() {
      useLayoutEffect(() => {
        seen = marked();
      }, []);
      return null;
    }

    const { unmount } = render(
      <>
        <Claimant />
        <Probe />
      </>,
    );
    expect(seen).toBe(true);

    unmount();
  });

  it("lands an uninvited inset instantly when the caller gave up the slide", async () => {
    const hook = await freshHook();
    const { unmount } = renderHook(() => hook(true, { animate: false }));

    expect(marked()).toBe(true);
    expect(instant()).toBe(true);

    unmount();
  });

  it("slides by default, even uninvited", async () => {
    const hook = await freshHook();
    const { unmount } = renderHook(() => hook(true));

    expect(marked()).toBe(true);
    expect(instant()).toBe(false);

    unmount();
  });

  it("hands the transition back once the frame is out", async () => {
    const hook = await freshHook();
    const { unmount } = renderHook(() => hook(true, { animate: false }));
    expect(instant()).toBe(true);

    await new Promise(requestAnimationFrame);
    expect(instant()).toBe(false);
    expect(marked()).toBe(true);

    unmount();
  });

  it("slides an inset the reader opened, whatever the caller said", async () => {
    const hook = await freshHook();
    document.dispatchEvent(new Event("pointerdown", { bubbles: true }));

    const { unmount } = renderHook(() => hook(true, { animate: false }));
    expect(marked()).toBe(true);
    expect(instant()).toBe(false);

    unmount();
  });
});
