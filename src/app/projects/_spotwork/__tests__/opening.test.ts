// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { focusIn, riseIn } from "../opening";

type Played = { el: Element; keyframes: Keyframe[]; options: KeyframeAnimationOptions; animation: Animation };

let played: Played[] = [];

function fakeAnimation(): Animation {
  return { startTime: null, ready: Promise.resolve(), playState: "running" } as unknown as Animation;
}

beforeEach(() => {
  played = [];
  Object.defineProperty(document, "timeline", { configurable: true, get: () => ({ currentTime: 0 }) });
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

describe("focusIn", () => {
  it("brings the lines in a line apart, then the steps a line's step after the last", () => {
    const [title, word1, word2, step] = [box(), box(), box(), box()];
    focusIn([[title], [word1, word2]], [step]);
    expect(delays()).toEqual([0, 100, 100, 200]);
    expect(played[3].options.duration).toBe(750);
  });
});
