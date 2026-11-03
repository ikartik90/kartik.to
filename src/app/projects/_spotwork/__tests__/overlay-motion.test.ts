// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openOverlay } from "../overlay-motion";

type Played = { el: Element; keyframes: Keyframe[] };

let played: Played[] = [];

beforeEach(() => {
  played = [];
  Element.prototype.animate = vi.fn(function (this: Element, keyframes) {
    played.push({ el: this, keyframes: keyframes as Keyframe[] });
    return { pause: vi.fn(), playState: "paused" } as unknown as Animation;
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

/** The overlay with the About sheet's cards, beside the window or, on a touch screen upright, under it. */
function overlay({ upright }: { upright: boolean }) {
  const root = document.body.appendChild(document.createElement("dialog"));
  const sheet = root.appendChild(document.createElement("div"));
  if (upright) sheet.setAttribute("data-upright", "");
  const column = sheet.appendChild(document.createElement("div"));
  column.setAttribute("data-overlay-motion", "cards");
  const cards = [0, 1].map(() => {
    const card = column.appendChild(document.createElement("div"));
    card.style.setProperty("--spacing-3xl", "40px");
    return card;
  });
  return { root, cards };
}

const startOf = (el: Element) => played.find((p) => p.el === el)?.keyframes[0];

describe("openOverlay", () => {
  it("brings the About sheet's cards in from the right beside the window", () => {
    const { root, cards } = overlay({ upright: false });
    openOverlay(root);
    expect(cards.map((card) => startOf(card)?.translate)).toEqual(["40px 0px", "40px 0px"]);
  });

  it("brings them up from below when the sheet lies under the window", () => {
    const { root, cards } = overlay({ upright: true });
    openOverlay(root);
    expect(cards.map((card) => startOf(card)?.translate)).toEqual(["0px 40px", "0px 40px"]);
  });
});
