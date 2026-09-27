// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { animate, animateBox, boxKeyframe } from "../lightbox-motion";
import type { Box } from "../lightbox-gesture";

const REST: Box = { left: 100, top: 100, width: 800, height: 500 };
const SLIDE: Box = { left: 620, top: 40, width: 400, height: 240 };

/** Where a keyframe puts a point of the resting frame, scaling about the frame's centre. */
function place(keyframe: ReturnType<typeof boxKeyframe>, x: number, y: number) {
  const [dx, dy] = keyframe.translate.split(" ").map(parseFloat);
  const [sx, sy] = keyframe.scale.split(" ").map(Number);
  const cx = REST.left + REST.width / 2;
  const cy = REST.top + REST.height / 2;
  return { x: cx + (x - cx) * sx + dx, y: cy + (y - cy) * sy + dy };
}

const corners = (box: Box) => [
  { x: box.left, y: box.top },
  { x: box.left + box.width, y: box.top },
  { x: box.left, y: box.top + box.height },
  { x: box.left + box.width, y: box.top + box.height },
];

describe("boxKeyframe", () => {
  it("lays each corner of the resting frame on the matching corner of the box", () => {
    const keyframe = boxKeyframe(SLIDE, REST, 16);
    corners(REST).forEach((corner, i) => {
      const placed = place(keyframe, corner.x, corner.y);
      expect(placed.x).toBeCloseTo(corners(SLIDE)[i].x);
      expect(placed.y).toBeCloseTo(corners(SLIDE)[i].y);
    });
  });

  it("moves nothing at rest", () => {
    const keyframe = boxKeyframe(REST, REST, 16);
    expect(keyframe.translate).toBe("0px 0px");
    expect(keyframe.scale).toBe("1 1");
    expect(keyframe.borderRadius).toBe("16px / 16px");
  });

  it("keeps the corner the size it names, however far the frame is scaled", () => {
    // Half the width and about half the height: the radius doubles to show 16px on screen.
    expect(boxKeyframe(SLIDE, REST, 16).borderRadius).toBe("32px / 33.333333333333336px");
  });

  it("changes no layout, so nothing inside reflows as it moves", () => {
    const keyframe = boxKeyframe(SLIDE, REST, 16);
    expect(Object.keys(keyframe).sort()).toEqual(["borderRadius", "scale", "translate"]);
  });
});

describe("animate", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  });

  const fakeAnimation = () => {
    let state: AnimationPlayState = "running";
    const animation = {
      get playState() {
        return state;
      },
      pause: vi.fn(() => (state = "paused")),
      play: vi.fn(() => (state = "running")),
      cancel: vi.fn(() => (state = "idle")),
      finished: new Promise(() => {}),
    };
    HTMLElement.prototype.animate = vi.fn(
      () => animation as unknown as Animation,
    );
    return animation;
  };

  it("holds the first keyframe until the frame it starts on has painted", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame"] });
    const animation = fakeAnimation();
    animate(document.createElement("div"), [{}, {}], { afterPaint: true });
    expect(animation.playState).toBe("paused");

    vi.advanceTimersToNextFrame();
    expect(animation.playState).toBe("paused");
    vi.advanceTimersToNextFrame();
    expect(animation.playState).toBe("running");
  });

  it("runs a box's corner apart from its motion, which the compositor can then take", () => {
    fakeAnimation();
    const element = document.createElement("div");
    animateBox(element, [boxKeyframe(SLIDE, REST, 16), boxKeyframe(REST, REST, 16)]);
    const calls = vi.mocked(HTMLElement.prototype.animate).mock.calls;
    const properties = calls.map(([keyframes]) =>
      Object.keys((keyframes as Keyframe[])[0]).sort(),
    );
    expect(properties).toEqual([["scale", "translate"], ["borderRadius"]]);
  });

  it("leaves a held animation cancelled if it is settled before it starts", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame"] });
    const animation = fakeAnimation();
    animate(document.createElement("div"), [{}, {}], { afterPaint: true });
    animation.cancel();
    vi.advanceTimersToNextFrame();
    vi.advanceTimersToNextFrame();
    expect(animation.play).not.toHaveBeenCalled();
  });
});
