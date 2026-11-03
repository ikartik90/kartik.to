import { afterEach, describe, expect, it } from "vitest";
import { pointOf, spotAt } from "../comment-spot";

afterEach(() => {
  document.body.innerHTML = "";
});

function app() {
  document.body.innerHTML = `
    <div data-check-ins-app>
      <header><span>Spotwork</span></header>
      <div role="main">
        <div data-shift="Weekdays Afternoon Shift" role="group" aria-label="Weekdays Afternoon Shift">
          <div data-worker="Maria Franci">
            <span>Maria Franci</span>
            <div><span>Absent</span></div>
            <div><button type="button">Check In…</button></div>
          </div>
        </div>
      </div>
    </div>`;
  return document.querySelector("[data-check-ins-app]")!;
}

const place = (element: Element, left: number, top: number, width: number, height: number) =>
  (element.getBoundingClientRect = () => new DOMRect(left, top, width, height));

describe("spotAt", () => {
  it("anchors to the element under the point, as fractions of its box", () => {
    const root = app();
    const button = root.querySelector("button")!;
    place(button, 100, 200, 80, 20);
    const spot = spotAt(button, 120, 215, root)!;
    expect(spot.x).toBeCloseTo(0.25);
    expect(spot.y).toBeCloseTo(0.75);
    expect(spot.viewport).toEqual({ width: innerWidth, height: innerHeight });
  });

  it("keeps a path that finds the same element again", () => {
    const root = app();
    const button = root.querySelector("button")!;
    const absent = root.querySelectorAll("span")[2];
    const brand = root.querySelector("header span")!;
    for (const element of [button, absent, brand]) expect(root.querySelector(spotAt(element, 0, 0, root)!.path)).toBe(element);
  });

  it("names the element and the row and card it's in", () => {
    const root = app();
    expect(spotAt(root.querySelector("button")!, 0, 0, root)!.what).toBe(
      "button “Check In…” in Maria Franci's row, Weekdays Afternoon Shift",
    );
  });

  it("refuses a point outside the app", () => {
    const root = app();
    expect(spotAt(document.body, 0, 0, root)).toBeNull();
  });
});

describe("pointOf", () => {
  it("puts the spot back on its element wherever the layout has moved it", () => {
    const root = app();
    const button = root.querySelector("button")!;
    place(button, 100, 200, 80, 20);
    const spot = spotAt(button, 120, 215, root)!;
    place(button, 300, 50, 160, 40);
    expect(pointOf(spot, root)).toEqual({ x: 340, y: 80, target: button });
  });

  it("finds nothing when the element isn't on the page", () => {
    const root = app();
    const spot = spotAt(root.querySelector("button")!, 0, 0, root)!;
    root.querySelector("button")!.remove();
    expect(pointOf(spot, root)).toBeNull();
  });
});
