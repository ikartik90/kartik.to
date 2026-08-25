// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SCROLL_BOUNDARY_ATTR, useScrollHandoff } from "../use-scroll-handoff";

interface BoxOptions {
  /** Visible height. */
  height?: number;
  /** Scrollable content height. */
  content?: number;
  /** Where it is parked. */
  top?: number;
  /** `overscroll-behavior-y: contain` — a popover or a dialog. */
  sealed?: boolean;
}

/**
 * A scroll box jsdom will answer questions about. There is no layout here, so
 * the metrics are stated rather than measured; `scrollTop` is a plain writable
 * property so the hook's assignment lands the way it would in a browser.
 */
function scroller({
  height = 100,
  content = 300,
  top = 0,
  sealed = false,
}: BoxOptions = {}) {
  const el = document.createElement("div");
  el.style.overflowY = "auto";
  if (sealed) el.style.setProperty("overscroll-behavior-y", "contain");
  Object.defineProperty(el, "clientHeight", {
    value: height,
    configurable: true,
  });
  Object.defineProperty(el, "scrollHeight", {
    value: content,
    configurable: true,
  });
  Object.defineProperty(el, "scrollTop", {
    value: top,
    writable: true,
    configurable: true,
  });
  return el;
}

/** Nest boxes outermost-first and mount them; returns them as passed. */
function nest<T extends HTMLElement[]>(...boxes: T): T {
  boxes.reduce((parent, child) => (parent.append(child), child));
  document.body.append(boxes[0]);
  return boxes;
}

const wheel = (el: HTMLElement, init: WheelEventInit) => {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  el.dispatchEvent(event);
  return event;
};

const mount = (el: HTMLElement) =>
  renderHook(() => useScrollHandoff({ current: el }));

describe("useScrollHandoff", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("scrolls the container when the list has reached its end", () => {
    const [panel, list] = nest(scroller(), scroller({ top: 200 }));
    mount(list);

    const event = wheel(list, { deltaY: 40 });

    expect(panel.scrollTop).toBe(40);
    expect(event.defaultPrevented).toBe(true);
  });

  it("scrolls the container back up from the top of the list", () => {
    const [panel, list] = nest(scroller({ top: 100 }), scroller({ top: 0 }));
    mount(list);

    wheel(list, { deltaY: -40 });

    expect(panel.scrollTop).toBe(60);
  });

  it("leaves the wheel alone while the list can still scroll itself", () => {
    const [panel, list] = nest(scroller(), scroller({ top: 0 }));
    mount(list);

    const event = wheel(list, { deltaY: 40 });

    expect(panel.scrollTop).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it("hands off from a list too short to scroll at all", () => {
    const [panel, list] = nest(scroller(), scroller({ content: 100 }));
    mount(list);

    wheel(list, { deltaY: 40 });

    expect(panel.scrollTop).toBe(40);
  });

  it("keeps the page still under a sealed surface", () => {
    // A popover: its own scroller is spent, the popover is spent, and the page
    // behind must not start moving.
    const [page, popover, list] = nest(
      scroller(),
      scroller({ top: 200, sealed: true }),
      scroller({ top: 200 }),
    );
    mount(list);

    const event = wheel(list, { deltaY: 40 });

    expect(page.scrollTop).toBe(0);
    expect(popover.scrollTop).toBe(200);
    expect(event.defaultPrevented).toBe(false);
  });

  it("still scrolls a sealed surface that has room of its own", () => {
    const [page, popover, list] = nest(
      scroller(),
      scroller({ sealed: true }),
      scroller({ top: 200 }),
    );
    mount(list);

    wheel(list, { deltaY: 40 });

    expect(popover.scrollTop).toBe(40);
    expect(page.scrollTop).toBe(0);
  });

  it("passes over an ancestor that is spent to reach one that is not", () => {
    const [page, , list] = nest(
      scroller(),
      scroller({ top: 200 }),
      scroller({ top: 200 }),
    );
    mount(list);

    wheel(list, { deltaY: 40 });

    expect(page.scrollTop).toBe(40);
  });

  it("stops at a clipping shell that declares itself a boundary", () => {
    // A popover: it clips rather than scrolls, so `overscroll-behavior` has
    // nothing to apply to and the shell marks the edge with an attribute.
    const shell = document.createElement("div");
    shell.setAttribute(SCROLL_BOUNDARY_ATTR, "");
    const [page, , list] = nest(scroller(), shell, scroller({ top: 200 }));
    mount(list);

    const event = wheel(list, { deltaY: 40 });

    expect(page.scrollTop).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores a sideways gesture, which belongs to whatever scrolls across", () => {
    const [panel, list] = nest(scroller(), scroller({ top: 200 }));
    mount(list);

    const event = wheel(list, { deltaX: 60, deltaY: 4 });

    expect(panel.scrollTop).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it("reads a line-mode wheel in pixels", () => {
    const [panel, list] = nest(scroller(), scroller({ top: 200 }));
    mount(list);

    wheel(list, { deltaY: 3, deltaMode: 1 });

    expect(panel.scrollTop).toBe(48);
  });

  it("reads a page-mode wheel as one screen of the box it landed on", () => {
    const [panel, list] = nest(
      scroller({ height: 250, content: 600 }),
      scroller({ height: 100, top: 200 }),
    );
    mount(list);

    wheel(list, { deltaY: 1, deltaMode: 2 });

    expect(panel.scrollTop).toBe(100);
  });

  it("stops listening once unmounted", () => {
    const [panel, list] = nest(scroller(), scroller({ top: 200 }));
    const { unmount } = mount(list);

    unmount();
    wheel(list, { deltaY: 40 });

    expect(panel.scrollTop).toBe(0);
  });
});
