import { describe, expect, it } from "vitest";
import { browserZoom, fitWindow, midTurn, pageOf, roomAtActualSize, windowOf } from "../prototype-overlay";

describe("the browser window's site", () => {
  it("is the design system's own for the design system", () => {
    expect(windowOf("design-system")).toEqual({ url: "design-system.spotwork.co", site: "design-system" });
  });

  it("is the Spotwork dashboard for the projects the app plays", () => {
    for (const project of ["check-ins", "activation-and-retention"])
      expect(windowOf(project)).toEqual({ url: "dashboard.spotwork.co", site: "app" });
  });

  it("is nothing for a project without one", () => {
    expect(windowOf("onboarding")).toBeUndefined();
  });
});

describe("the browser window", () => {
  it("is laid out at 1440 × 900 whatever room the stage has", () => {
    for (const [width, height] of [
      [390, 700],
      [1200, 500],
      [2400, 1600],
    ])
      expect(fitWindow(width, height)).toMatchObject({ width: 1440, height: 900 });
  });

  it("scales to the stage's tighter side, keeping its proportions", () => {
    expect(fitWindow(720, 900).scale).toBe(0.5);
    expect(fitWindow(2000, 450).scale).toBe(0.5);
  });

  it("never grows past its own size, leaving the stage's spare room around it", () => {
    expect(fitWindow(2880, 1800).scale).toBe(1);
    expect(fitWindow(1440, 900).scale).toBe(1);
  });

  it("draws nothing on a stage with no room", () => {
    expect(fitWindow(-10, 600).scale).toBe(0);
  });
});

describe("the stage's room at Actual Size", () => {
  it("is the room it had at 100% when the browser's zoomed out, so the window shrinks with the page", () => {
    expect(roomAtActualSize(1811, 2258, 0.85)).toBeCloseTo(1472, 0);
    expect(roomAtActualSize(958, 1174, 0.85)).toBeCloseTo(782, 0);
  });

  it("is the room it has at 100% or zoomed in", () => {
    expect(roomAtActualSize(782, 998, 1)).toBe(782);
    expect(roomAtActualSize(582, 798, 1.25)).toBe(582);
  });
});

describe("the browser's zoom", () => {
  it("is the window's width on screen over the page's", () => {
    expect(browserZoom(1920, 1920, 2)).toBe(1);
    expect(browserZoom(1920, 2258, 1.7)).toBeCloseTo(0.85);
    expect(browserZoom(1920, 1280, 1.5)).toBeCloseTo(1.5);
  });

  it("is the zoom its pixel ratio allows, though a sidebar beside the page widens the window", () => {
    expect(browserZoom(1920, 1620, 2)).toBe(1);
    expect(browserZoom(1920, 1906, 1.7)).toBeCloseTo(0.85);
  });

  it("is none where the window's width is unknown", () => {
    expect(browserZoom(0, 1440, 2)).toBe(1);
  });
});

describe("a window mid-turn", () => {
  it("is one whose outer size still has the old orientation, as an iPad's has through its first resize", () => {
    expect(midTurn(820, 1180, 1180, 692)).toBe(true);
    expect(midTurn(1180, 820, 820, 1052)).toBe(true);
  });

  it("isn't one whose outer size has turned with the page, nor a desktop window", () => {
    expect(midTurn(1180, 820, 1180, 692)).toBe(false);
    expect(midTurn(820, 1180, 820, 1052)).toBe(false);
    expect(midTurn(1920, 1080, 2258, 1129)).toBe(false);
  });
});

describe("the app's page for a project", () => {
  it("is the company's Check-ins page or the admin's dashboard, by Check-ins' version", () => {
    expect(pageOf({ project: "check-ins", version: "company" })).toBe("check-ins");
    expect(pageOf({ project: "check-ins", version: "admin" })).toBe("dashboard");
  });

  it("is the Shifts page for every Shift scheduling version of Activation and retention", () => {
    for (const version of ["final", "recurrence", "old"])
      expect(pageOf({ project: "activation-and-retention", version })).toBe("shifts");
  });

  it("is the Activations page for its Activation version, and none for the design system", () => {
    expect(pageOf({ project: "activation-and-retention", version: "activation" })).toBe("activations");
    expect(pageOf({ project: "design-system" })).toBeUndefined();
  });
});
