// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { focusIn, joinOpening, riseIn } from "../opening";

type Played = { el: Element; keyframes: Keyframe[]; options: KeyframeAnimationOptions; animation: Animation };

let played: Played[] = [];
let clock = 0;

function fakeAnimation(startTime: number | null = null): Animation {
  return { startTime, ready: Promise.resolve(), playState: "running" } as unknown as Animation;
}

beforeEach(() => {
  played = [];
  clock = 0;
  Object.defineProperty(document, "timeline", { configurable: true, get: () => ({ currentTime: clock }) });
  HTMLElement.prototype.animate = vi.fn(function (this: Element, keyframes, options) {
    const animation = fakeAnimation();
    played.push({ el: this, keyframes: keyframes as Keyframe[], options: options as KeyframeAnimationOptions, animation });
    return animation;
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const box = () => document.body.appendChild(document.createElement("div"));

/** The hero as the page renders it: its lines, the first playing the opening from `startTime`, and its steps. */
function hero({ startTime = 0, lines = 3, steps = 2 } = {}) {
  const lead = fakeAnimation(startTime);
  for (let i = 0; i < lines; i++) {
    const line = box();
    line.setAttribute("data-opening-line", "");
    line.getAnimations = () => (i === 0 ? [lead] : []);
  }
  for (let i = 0; i < steps; i++) box().setAttribute("data-opening-step", "");
  return lead;
}

const delays = () => played.map(({ options }) => options.delay);

describe("riseIn", () => {
  it("brings each element up in turn, held at its start until its turn", () => {
    const [a, b] = [box(), box()];
    riseIn([a, b]);
    expect(played.map(({ el }) => el)).toEqual([a, b]);
    expect(delays()).toEqual([0, 70]);
    expect(played[0].options.fill).toBe("backwards");
    expect(played[0].keyframes[0].opacity).toBe(0);
  });
});

describe("joinOpening", () => {
  it("lets nothing join when the page has no opening running", () => {
    expect(joinOpening([box()])).toBe(false);
    expect(played).toEqual([]);
  });

  it("gives joiners the opening's next steps, a page step apart, after every step the page drew", () => {
    hero({ steps: 3 });
    const [arrows, card] = [box(), box()];
    expect(joinOpening([arrows])).toBe(true);
    expect(joinOpening([card])).toBe(true);
    expect(delays()).toEqual([800, 950]);
  });

  it("times them off the opening's own start, not their own", async () => {
    const lead = hero({ startTime: 120 });
    joinOpening([box()]);
    await lead.ready;
    expect(played[0].animation.startTime).toBe(120);
  });

  it("lets nothing join once its step has passed", () => {
    hero({ startTime: 0, steps: 3 });
    clock = 900;
    expect(joinOpening([box()])).toBe(false);
    expect(played).toEqual([]);
  });
});

describe("focusIn", () => {
  it("brings the lines in a line apart, then the steps a line's step after the last", () => {
    const [title, word1, word2, step] = [box(), box(), box(), box()];
    focusIn([[title], [word1, word2]], [step]);
    expect(delays()).toEqual([0, 100, 100, 200]);
    expect(played[3].options.duration).toBe(750);
  });
});
