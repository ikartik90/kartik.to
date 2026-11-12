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

  it("holds the overlay out with data-held until its opening starts, not by its paused animations alone", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((frame) => frames.push(frame));
    Object.defineProperty(document, "timeline", { value: { currentTime: 0 }, configurable: true });
    const { root } = overlay({ upright: true });
    openOverlay(root);
    expect(root.hasAttribute("data-held")).toBe(true);
    frames.shift()!(0);
    expect(root.hasAttribute("data-held")).toBe(true);
    frames.shift()!(0);
    expect(root.hasAttribute("data-held")).toBe(false);
  });

  describe("its clock", () => {
    let frames: FrameRequestCallback[];
    let clock: { currentTime: number };
    let animations: { startTime: number | null; playState: string }[];
    beforeEach(() => {
      frames = [];
      animations = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((frame) => frames.push(frame));
      clock = { currentTime: 0 };
      Object.defineProperty(document, "timeline", { value: clock, configurable: true });
      Element.prototype.animate = vi.fn(() => {
        let startTime: number | null = null;
        const animation = {
          pause: () => {},
          get playState() {
            return startTime === null ? "paused" : "running";
          },
          get startTime() {
            return startTime;
          },
          set startTime(time) {
            startTime = time;
          },
        };
        animations.push(animation);
        return animation as unknown as Animation;
      });
    });
    const drawFrameAt = (time: number) => {
      clock.currentTime = time;
      frames.splice(0).forEach((frame) => frame(time));
    };

    it("starts again from the next frame when the frame showing the overlay takes long to draw, so it never opens part way in", () => {
      const { root } = overlay({ upright: false });
      openOverlay(root);
      drawFrameAt(0);
      drawFrameAt(16);
      expect(animations.every((a) => a.startTime === 16)).toBe(true);
      drawFrameAt(90);
      expect(animations.every((a) => a.startTime === 90)).toBe(true);
      drawFrameAt(106);
      expect(animations.every((a) => a.startTime === 90)).toBe(true);
    });

    it("keeps its start when that frame is drawn in time", () => {
      const { root } = overlay({ upright: false });
      openOverlay(root);
      drawFrameAt(0);
      drawFrameAt(16);
      drawFrameAt(32);
      expect(animations.every((a) => a.startTime === 16)).toBe(true);
    });
  });
});
