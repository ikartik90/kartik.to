import { describe, expect, it } from "vitest";
import { GAP, createFlow, meets, paneCorners, type Box, type Placed, type Point, type Size } from "../montage-flow";

const square: Point[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];

const seed = (x: number, y: number, width: number, height: number, piece = 99): Placed => ({ x, y, width, height, piece, key: piece });

const at = ({ x, y, piece }: Placed) => ({ x, y, piece });

/** How far apart two boxes are across and down; negative where they overlap. */
const apart = (a: Box, b: Box) => ({
  across: Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width)),
  down: Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height)),
});

// A seeded generator, so the long runs below are the same each time.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sizes = (count: number, next = random(7)): Size[] =>
  Array.from({ length: count }, () => ({ width: 140 + Math.round(next() * 460), height: 60 + Math.round(next() * 420) }));

describe("the pane, in the montage's own pixels", () => {
  it("undoes the cover's 30° tilt and its offset", () => {
    const [topLeft, topRight, bottomRight, bottomLeft] = paneCorners({ width: 1239, height: 927 }, 1);
    // Its top edge climbs back 30° against the tilt, at the pane's length.
    expect(topRight.x - topLeft.x).toBeCloseTo(1239 * Math.cos(Math.PI / 6));
    expect(topRight.y - topLeft.y).toBeCloseTo(-1239 * Math.sin(Math.PI / 6));
    expect(bottomLeft.x - topLeft.x).toBeCloseTo(927 * Math.sin(Math.PI / 6));
    expect(bottomLeft.y - topLeft.y).toBeCloseTo(927 * Math.cos(Math.PI / 6));
    // Its centre is the cover's window's, where the offset puts it.
    expect((topLeft.x + bottomRight.x) / 2).toBeCloseTo(353 * Math.cos(Math.PI / 6) + 1084 * Math.sin(Math.PI / 6));
    expect((topLeft.y + bottomRight.y) / 2).toBeCloseTo(-353 * Math.sin(Math.PI / 6) + 1084 * Math.cos(Math.PI / 6));
  });

  it("spans more of the montage the smaller it's drawn", () => {
    const [a, b] = paneCorners({ width: 600, height: 400 }, 0.5);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(1200);
  });

  it("meets a box inside or across its edge, but not one clear of it inside its bounds", () => {
    const tilted = paneCorners({ width: 1239, height: 927 }, 1);
    const centre = { x: (tilted[0].x + tilted[2].x) / 2, y: (tilted[0].y + tilted[2].y) / 2 };
    expect(meets({ x: centre.x, y: centre.y, width: 10, height: 10 }, tilted)).toBe(true);
    expect(meets({ x: tilted[0].x - 5, y: tilted[0].y - 5, width: 10, height: 10 }, tilted)).toBe(true);
    // Above its leftmost corner: within the box round the pane, but clear of the pane itself.
    expect(meets({ x: tilted[0].x, y: tilted[0].y - 200, width: 10, height: 10 }, tilted)).toBe(false);
  });
});

describe("the montage's flow", () => {
  it("packs the order's pieces in turn into the lowest open spot, the leftmost first, 72px apart, below the opening view", () => {
    const flow = createFlow({ view: square, seeds: [], order: [0, 1, 2], sizes: Array(3).fill({ width: 200, height: 100 }), ahead: 1, behind: 0 });
    expect(GAP).toBe(72);
    expect(flow.step(0).map(at)).toEqual([
      { x: 0, y: 1000, piece: 0 },
      { x: 272, y: 1000, piece: 1 },
      { x: 544, y: 1000, piece: 2 },
    ]);
  });

  it("packs a piece 72px under the piece above it", () => {
    const flow = createFlow({ view: square, seeds: [seed(0, 900, 300, 200)], order: [0, 1], sizes: [{ width: 300, height: 50 }, { width: 300, height: 50 }], ahead: 200, behind: 0 });
    const [, first, second] = flow.step(0);
    expect(at(first)).toEqual({ x: 372, y: 1000, piece: 0 });
    expect(at(second)).toEqual({ x: 372, y: 1122, piece: 1 });
  });

  it("fills a pit between pieces a piece fits in before going lower", () => {
    const seeds = [seed(0, 900, 300, 400, 98), seed(600, 900, 300, 400, 99)];
    const flow = createFlow({ view: square, seeds, order: [0], sizes: [{ width: 150, height: 100 }], ahead: 1, behind: 0 });
    expect(flow.step(0).map(at)).toContainEqual({ x: 372, y: 1000, piece: 0 });
  });

  it("fills the lowest gap with a coming piece that fits it, not one laid across it", () => {
    const flow = createFlow({
      view: square,
      seeds: [seed(300, 900, 700, 128)],
      order: [0, 1],
      sizes: [{ width: 500, height: 100 }, { width: 200, height: 100 }],
      ahead: 101,
      behind: 0,
    });
    expect(flow.step(0).slice(1).map(at)).toEqual([
      { x: 0, y: 1000, piece: 1 },
      { x: 272, y: 1100, piece: 0 },
    ]);
  });

  it("fills a gap with the widest of the coming pieces that fits it", () => {
    const sizes = [{ width: 150, height: 100 }, { width: 250, height: 100 }, { width: 600, height: 100 }];
    const flow = createFlow({ view: square, seeds: [seed(400, 900, 600, 200)], order: [0, 1, 2], sizes, ahead: 1, behind: 0 });
    expect(flow.step(0).slice(1).map(at)).toEqual([{ x: 0, y: 1000, piece: 1 }]);
  });

  it("closes a pit no piece fits in, so its floor never holds the flow back", () => {
    const seeds = [seed(0, 900, 300, 400, 98), seed(400, 900, 600, 400, 99)];
    const flow = createFlow({ view: square, seeds, order: [0], sizes: [{ width: 200, height: 100 }], ahead: 1, behind: 0 });
    flow.step(0);
    expect(flow.frontier()).toBeGreaterThan(1300);
  });

  it("plugs a pit none of the coming pieces fits with the widest filler that does", () => {
    const seeds = [seed(0, 900, 300, 400, 98), seed(600, 900, 400, 400, 99)];
    const sizes = [{ width: 200, height: 100 }, { width: 150, height: 80 }, { width: 100, height: 80 }];
    const flow = createFlow({ view: square, seeds, order: [0], fillers: [2, 1], sizes, ahead: 1, behind: 0 });
    expect(flow.step(0).map(at)).toContainEqual({ x: 372, y: 1000, piece: 1 });
  });

  it("leaves a pit too shallow for a filler to sit 72px under both its sides, and closes it", () => {
    const seeds = [seed(0, 900, 300, 128, 98), seed(600, 900, 400, 128, 99)];
    const sizes = [{ width: 200, height: 100 }, { width: 150, height: 80 }];
    const flow = createFlow({ view: square, seeds, order: [0], fillers: [1], sizes, ahead: 1, behind: 0 });
    expect(flow.step(0).filter((piece) => piece.piece === 1)).toEqual([]);
    expect(flow.frontier()).toBeGreaterThanOrEqual(1100);
  });

  it("plugs pits with fillers in a long run, every piece still 72px from the others and its twin twice that", () => {
    const view = paneCorners({ width: 960, height: 860 }, 0.775);
    const all = sizes(8, random(5)).concat([{ width: 136, height: 70 }, { width: 176, height: 90 }]);
    const flow = createFlow({ view, seeds: [], order: [0, 1, 2, 3, 4, 5, 6, 7], fillers: [8, 9], sizes: all });
    const kept = new Map<number, Placed>();
    for (let travel = 0; travel < 8000; travel += 14) for (const piece of flow.step(travel)) kept.set(piece.key, piece);
    const pieces = [...kept.values()];
    const plugs = pieces.filter((piece) => piece.piece >= 8);
    expect(plugs.length).toBeGreaterThan(0);
    // They plug pits, never taking over from the order's pieces.
    expect(plugs.length).toBeLessThan(pieces.length / 4);
    for (const [i, a] of pieces.entries())
      for (const b of pieces.slice(i + 1)) {
        const { across, down } = apart(a, b);
        expect(Math.max(across, down), JSON.stringify([a, b])).toBeGreaterThanOrEqual(a.piece === b.piece ? 2 * GAP : GAP);
      }
  });

  it("closes a pit only a piece beside its twin would fit, rather than piling the rest up elsewhere", () => {
    const seeds = [seed(0, 900, 200, 100, 0), seed(500, 900, 500, 400, 98)];
    const flow = createFlow({ view: square, seeds, order: [0, 1], sizes: [{ width: 150, height: 100 }, { width: 400, height: 100 }], ahead: 1, behind: 0 });
    const near = flow.step(0);
    expect(flow.frontier()).toBeGreaterThanOrEqual(1072);
    expect(near.filter((piece) => piece.piece === 0)).toHaveLength(1);
  });

  it("keeps the opening view as the cover sets it, and every piece 72px from the others, in a long run", () => {
    const view = paneCorners({ width: 960, height: 860 }, 0.775);
    const seeds = [seed(300, 500, 400, 300, 0), seed(800, 700, 300, 200, 1)];
    const flow = createFlow({ view, seeds, order: [2, 3, 4, 5, 6, 7, 8, 9, 0, 1], sizes: sizes(10) });
    const all = new Map<number, Placed>();
    for (let travel = 0; travel < 6000; travel += 14) for (const piece of flow.step(travel)) all.set(piece.key, piece);
    const pieces = [...all.values()];
    expect(pieces.length).toBeGreaterThan(60);
    for (const piece of pieces.filter((piece) => !seeds.some((one) => one.key === piece.key)))
      expect(meets(piece, view), JSON.stringify(piece)).toBe(false);
    for (const [i, a] of pieces.entries())
      for (const b of pieces.slice(i + 1)) {
        const { across, down } = apart(a, b);
        expect(Math.max(across, down), JSON.stringify([a, b])).toBeGreaterThanOrEqual(GAP);
      }
  });

  it("comes back round to the order's first piece, never beside or under the same piece", () => {
    const view = paneCorners({ width: 960, height: 860 }, 0.775);
    const flow = createFlow({ view, seeds: [], order: [0, 1, 2, 3, 4], sizes: sizes(5, random(3)) });
    const all = new Map<number, Placed>();
    for (let travel = 0; travel < 8000; travel += 14) for (const piece of flow.step(travel)) all.set(piece.key, piece);
    const pieces = [...all.values()];
    expect(pieces.filter((piece) => piece.piece === 0).length).toBeGreaterThan(5);
    for (const [i, a] of pieces.entries())
      for (const b of pieces.slice(i + 1).filter((b) => b.piece === a.piece)) {
        const { across, down } = apart(a, b);
        expect(Math.max(across, down), JSON.stringify([a, b])).toBeGreaterThanOrEqual(2 * GAP);
      }
  });

  it("keeps only the pieces near the pane, each placed before it comes into view, however far it travels", () => {
    const view = paneCorners({ width: 960, height: 860 }, 0.775);
    const flow = createFlow({ view, seeds: [], order: [0, 1, 2, 3, 4, 5, 6, 7], sizes: sizes(8, random(11)) });
    const bottom = Math.max(...view.map((corner) => corner.y));
    let kept = new Set<number>();
    for (let travel = 0; travel < 40000; travel += 14) {
      const near = flow.step(travel);
      expect(near.length).toBeLessThan(40);
      expect(flow.frontier()).toBeGreaterThanOrEqual(travel + bottom);
      const moved = view.map(({ x, y }) => ({ x, y: y + travel }));
      for (const piece of near)
        if (!kept.has(piece.key) && travel > 0) expect(meets(piece, moved), `${piece.key} at ${travel}`).toBe(false);
      kept = new Set(near.map((piece) => piece.key));
    }
  });
});
