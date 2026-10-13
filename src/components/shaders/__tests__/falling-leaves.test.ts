// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAPLE_LEAF_OUTLINE,
  MAX_LEAVES,
  MAX_WORD_LINES,
  leafFrameUniforms,
  leafRows,
  narrowScale,
  nearScale,
  newLeaf,
  populate,
  stepLeaves,
  wordLineRects,
  type Leaf,
  type LeafSettings,
} from "../falling-leaves";

const SETTINGS: LeafSettings = {
  count: 14,
  size: 100,
  depth: 0.5,
  fall: 56,
  sway: 36,
  tumble: 1,
  tumblePace: 0.56,
  wind: 100,
  density: 0.8,
  veins: 0.45,
  inks: ["--colors-brand-orange", "--colors-brand-pink"],
  inkStrength: 1,
  behindWords: { density: 0.32, ink: 0.6, margin: 40 },
};

const still = { ...SETTINGS, sway: 0, wind: 0, tumble: 0 };

// A seeded stand-in for Math.random, so a leaf's draw is the same every run.
function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const leafAt = (overrides: Partial<Leaf> = {}): Leaf => ({ ...newLeaf(1440, 0, seeded()), ...overrides });

describe("narrowScale", () => {
  it("keeps leaves whole on a wide screen and shrinks them on a narrow one, to no less than .55", () => {
    expect(narrowScale(1440)).toBe(1);
    expect(narrowScale(2560)).toBe(1);
    expect(narrowScale(1080)).toBeCloseTo(0.75);
    expect(narrowScale(390)).toBe(0.55);
  });
});

describe("nearScale", () => {
  it("leaves the nearest leaf whole and takes up to 60% of depth off the farthest", () => {
    expect(nearScale(1, 0.5)).toBe(1);
    expect(nearScale(0, 0.5)).toBeCloseTo(0.7);
    expect(nearScale(0, 1)).toBeCloseTo(0.4);
    expect(nearScale(0, 0)).toBe(1);
  });
});

describe("populate", () => {
  it("adds leaves anywhere from just above the top to the foot, nearest last", () => {
    const leaves = populate([], 14, 1440, 800, seeded());
    expect(leaves).toHaveLength(14);
    for (const leaf of leaves) {
      expect(leaf.y).toBeGreaterThanOrEqual(-80);
      expect(leaf.y).toBeLessThanOrEqual(800);
      expect(leaf.x).toBeGreaterThanOrEqual(0);
      expect(leaf.x).toBeLessThanOrEqual(1440);
    }
    const nears = leaves.map(({ near }) => near);
    expect(nears).toEqual([...nears].sort((a, b) => a - b));
  });

  it("drops the extra leaves when the count falls, and keeps the rest where they are", () => {
    const leaves = populate([], 14, 1440, 800, seeded());
    const kept = populate(leaves, 6, 1440, 800, seeded());
    expect(kept).toHaveLength(6);
    for (const leaf of kept) expect(leaves).toContain(leaf);
  });

  it("never holds more leaves than the shader draws", () => {
    expect(populate([], 99, 1440, 800, seeded())).toHaveLength(MAX_LEAVES);
  });
});

describe("stepLeaves", () => {
  it("lets a leaf fall, and no further sideways than it drifts", () => {
    const leaf = leafAt({ x: 700, y: 100, near: 1, swing: 0 });
    stepLeaves([leaf], still, 0.1, 1440, 800, 1, seeded());
    expect(leaf.x).toBe(700);
    expect(leaf.y).toBeGreaterThan(100);
  });

  it("falls fastest through the bottom of its swing", () => {
    const low = leafAt({ y: 0, near: 1, swing: 0, swingRate: 0 });
    const high = leafAt({ y: 0, near: 1, swing: Math.PI / 2, swingRate: 0 });
    stepLeaves([low, high], still, 0.1, 1440, 800, 1, seeded());
    expect(low.y).toBeGreaterThan(high.y);
  });

  it("carries a leaf the way the wind blows, a far one less", () => {
    const near = leafAt({ x: 700, near: 1 });
    const far = leafAt({ x: 700, near: 0 });
    stepLeaves([near, far], { ...still, wind: 100 }, 0.1, 1440, 800, 1, seeded());
    expect(near.x).toBeCloseTo(710);
    expect(far.x).toBeCloseTo(707);
  });

  it("brings a leaf that has fallen past the foot back above the top, as near as it was", () => {
    const leaf = leafAt({ y: 900, near: 0.3 });
    stepLeaves([leaf], still, 0.016, 1440, 800, 1, seeded());
    expect(leaf.y).toBeLessThan(0);
    expect(leaf.near).toBe(0.3);
  });

  it("brings a leaf blown out at one side back in at the other, still out of sight", () => {
    // Its square is 100 across, so it's out of sight once 75 past the edge.
    const leaf = leafAt({ x: 1520, y: 100, near: 1 });
    stepLeaves([leaf], still, 0.016, 1440, 800, 1, seeded());
    expect(leaf.x).toBeLessThan(0);
  });
});

describe("leafRows", () => {
  it("places each leaf at its centre, its square shrunk for depth and a narrow screen", () => {
    const leaf = leafAt({ x: 300, y: 200, near: 0 });
    const { place } = leafRows([leaf], SETTINGS, 0.75);
    expect(place[0][0]).toBe(300);
    expect(place[0][1]).toBe(200);
    expect(place[0][2]).toBeCloseTo(100 * 0.7 * 0.75);
  });

  it("holds a leaf at its resting angle, facing you, when it doesn't tumble", () => {
    const leaf = leafAt({ spin: 1.2, swing: 0.7, yaw: 0.9, pitch: 0.4 });
    const { place, look } = leafRows([leaf], still, 1);
    expect(place[0][3]).toBeCloseTo(1.2);
    expect(look[0][0]).toBe(1);
    expect(look[0][1]).toBe(1);
  });

  it("turns a leaf fully tumbling edge on at the end of its flutter", () => {
    const leaf = leafAt({ yaw: Math.PI / 2 });
    const { look } = leafRows([leaf], SETTINGS, 1);
    expect(look[0][0]).toBeCloseTo(0);
  });

  it("dithers the nearest leaf facing you at the full density, and a far one sparser", () => {
    const { look } = leafRows([leafAt({ near: 1 }), leafAt({ near: 0 })], still, 1);
    expect(look[0][2]).toBeCloseTo(0.8);
    expect(look[1][2]).toBeCloseTo(0.8 * (1 - 0.45 * 0.5));
  });

  it("inks each leaf in its own one of the two inks", () => {
    const { look } = leafRows([leafAt({ ink: 0 }), leafAt({ ink: 1 })], SETTINGS, 1);
    expect(look.map((row) => row[3])).toEqual([0, 1]);
  });
});

describe("leafFrameUniforms", () => {
  it("pads the leaves and the words' lines to the arrays the shader declares", () => {
    const uniforms = leafFrameUniforms({ place: [[1, 2, 3, 4]], look: [[1, 1, 0.8, 0]] }, [[5, 6, 7, 8]]);
    expect(uniforms.u_leafCount).toBe(1);
    expect(uniforms.u_leaf).toHaveLength(MAX_LEAVES);
    expect(uniforms.u_leaf[0]).toEqual([1, 2, 3, 4]);
    expect(uniforms.u_leafLook).toHaveLength(MAX_LEAVES);
    expect(uniforms.u_wordCount).toBe(1);
    expect(uniforms.u_words).toHaveLength(MAX_WORD_LINES);
    expect(uniforms.u_words[0]).toEqual([5, 6, 7, 8]);
  });
});

describe("MAPLE_LEAF_OUTLINE", () => {
  it("is one leaf, mirrored about its midrib, inside its 100-unit box", () => {
    for (const [x, y] of MAPLE_LEAF_OUTLINE) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
      expect(MAPLE_LEAF_OUTLINE.some(([mx, my]) => Math.abs(mx - (100 - x)) < 1e-9 && my === y)).toBe(true);
    }
  });
});

describe("wordLineRects", () => {
  const realRects = Range.prototype.getClientRects;
  afterEach(() => {
    Range.prototype.getClientRects = realRects;
  });

  it("measures the heading's and lede's lines from the ground's corner, and none of the pills, buttons or hidden text", () => {
    document.body.innerHTML = `
      <section>
        <div><span>Available for work</span></div>
        <h1><span>Design generalist</span> <span>who ships</span></h1>
        <div aria-hidden="true">x</div>
        <p>I'm Kartik Iyer.</p>
        <a href="#work">See my work</a>
      </section>`;
    const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });
    const lines: Record<string, ReturnType<typeof rect>[]> = {
      "Design generalist": [rect(110, 220, 300, 40)],
      "who ships": [rect(110, 260, 200, 40)],
      "I'm Kartik Iyer.": [rect(700, 220, 400, 24), rect(700, 248, 120, 24)],
    };
    Range.prototype.getClientRects = vi.fn(function (this: Range) {
      return (lines[this.startContainer.textContent ?? ""] ?? [rect(0, 0, 50, 20)]) as unknown as DOMRectList;
    });

    const rects = wordLineRects(document.querySelector("section")!, { left: 10, top: 20 });

    expect(rects).toEqual([
      [100, 200, 300, 40],
      [100, 240, 200, 40],
      [690, 200, 400, 24],
      [690, 228, 120, 24],
    ]);
  });
});
