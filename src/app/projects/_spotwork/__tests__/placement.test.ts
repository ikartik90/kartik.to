import { describe, expect, it } from "vitest";
import { placeBeside, placeOverlay } from "../placement";

// A view 1000 × 800, and a 475-wide overlay hung 4px from its call to action, 24px clear of the view's edges.
const view = { top: 0, bottom: 800, left: 0, right: 1000 };
const button = (top: number, left = 880) => ({ top, bottom: top + 30, left, right: left + 100 });

describe("where an inline overlay opens", () => {
  it("opens below its call to action when there's room, ending level with it", () => {
    expect(placeOverlay(button(100), view, { width: 475, height: 400 })).toEqual({ side: "below", top: 134, left: 505 });
  });

  it("opens above when there's room above but not below", () => {
    expect(placeOverlay(button(600), view, { width: 475, height: 400 })).toEqual({ side: "above", top: 196, left: 505 });
  });

  it("opens to the left when there's room neither below nor above, kept inside the view", () => {
    expect(placeOverlay(button(350), view, { width: 475, height: 600 })).toEqual({ side: "left", top: 176, left: 401 });
    expect(placeOverlay(button(150), view, { width: 475, height: 600 })).toEqual({ side: "left", top: 150, left: 401 });
  });

  it("counts the 24px it keeps clear of the view's edge as part of the room", () => {
    expect(placeOverlay(button(100), view, { width: 475, height: 642 }).side).toBe("below");
    expect(placeOverlay(button(100), view, { width: 475, height: 643 }).side).not.toBe("below");
  });

  it("stays inside the view's sides", () => {
    expect(placeOverlay(button(100, 50), view, { width: 475, height: 400 }).left).toBe(0);
  });

  it("keeps the side it opened on while that still fits", () => {
    expect(placeOverlay(button(600), view, { width: 475, height: 100 }, "above").side).toBe("above");
    expect(placeOverlay(button(100), view, { width: 475, height: 400 }, "above").side).toBe("below");
  });
});

// A 72px logo, and a 330 × 410 overlay beside it.
const logo = (top: number, left: number) => ({ top, bottom: top + 72, left, right: left + 72 });
const crop = { width: 330, height: 410 };

describe("where an overlay opens beside its picture", () => {
  it("opens to its right, 4px off, level with its top", () => {
    expect(placeBeside(logo(200, 300), view, crop)).toEqual({ side: "right", top: 200, left: 376 });
  });

  it("opens to its left where the view has no room on its right", () => {
    expect(placeBeside(logo(200, 700), view, crop)).toEqual({ side: "left", top: 200, left: 366 });
  });

  it("stays 24px clear of the view's top and foot", () => {
    expect(placeBeside(logo(500, 300), view, crop).top).toBe(366);
    expect(placeBeside(logo(10, 300), view, crop).top).toBe(24);
  });
});
