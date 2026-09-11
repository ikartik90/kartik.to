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

/**
 * The module with its input clock wound back.
 *
 * `lastInput` is module scope — it is the DOCUMENT's last press, not any one
 * tree's — so a test that presses something would otherwise leave every test
 * after it looking input-driven.
 */
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

  // The whole point of the mark: it is a LAYOUT change (globals.css turns it
  // into 360px of page padding), so a panel that claims it after the browser
  // has painted slides the page out from under the reader — a layout shift,
  // and on the calchemy playground the page's worst one. Claimed in a layout
  // effect, the inset is already there in the frame the panel first appears in.
  //
  // Read from a SIBLING's layout effect, which is the one observer that can
  // tell the two apart: layout effects run in mount order, so a probe mounted
  // after the claimant sees a layout-effect claim and misses a passive one.
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

  // A panel that is simply THERE when the page arrives has nothing to slide
  // open, and animating its 360px drags the whole page sideways across frames
  // the reader never asked for — which is precisely what CLS counts. So the
  // inset lands instantly unless the reader opened it, which is the same
  // distinction the metric itself draws with `hadRecentInput`.
  it("lands an uninvited inset instantly when the caller gave up the slide", async () => {
    const hook = await freshHook();
    const { unmount } = renderHook(() => hook(true, { animate: false }));

    expect(marked()).toBe(true);
    expect(instant()).toBe(true);

    unmount();
  });

  // The default, and the behaviour every panel the reader opens keeps: a page
  // that is already on screen slides into the width rather than jumping into
  // it. Measured both ways on the icons playground, whose panel IS in the
  // server's HTML — 0.085 walked against 0.112 snapped — so this is not only
  // the nicer of the two, it is the cheaper one.
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
    // The padding is already where it was going; dropping the mark now costs
    // nothing and leaves the next open free to slide.
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
