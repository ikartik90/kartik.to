// The design system's montage as an endless flow, in its own pixels before its tilt: x along its rows, y down its
// columns, which the pane travels down. After the cover's own pieces, the lowest open stretch is filled by whichever of
// the order's next few pieces fits it widest, or else a filler, GAP from every other, never inside the opening view;
// only those near the pane are kept.

export const GAP = 72;

const TILT = Math.PI / 6;
// The cover's translate, before its tilt (ds-overview.tsx's montageStyle).
const OFFSET = { x: -353, y: -1084 };

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Box = Point & Size;
/** A piece where it's packed; `key` is unique and rises as pieces are packed. */
export type Placed = Box & { piece: number; key: number };

/** The pane's corners, clockwise from its top left, in the montage's own pixels: `pane` is its size in them. */
export function paneCorners(pane: Size, scale: number): Point[] {
  const cos = Math.cos(TILT);
  const sin = Math.sin(TILT);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([across, down]) => {
    const x = (across * pane.width) / 2 / scale - OFFSET.x;
    const y = (down * pane.height) / 2 / scale - OFFSET.y;
    return { x: x * cos + y * sin, y: -x * sin + y * cos };
  });
}

const cornersOf = ({ x, y, width, height }: Box): Point[] => [
  { x, y },
  { x: x + width, y },
  { x: x + width, y: y + height },
  { x, y: y + height },
];

/** Whether `box` overlaps the convex polygon `corners`. */
export function meets(box: Box, corners: Point[]): boolean {
  const own = cornersOf(box);
  const axes = [{ x: 1, y: 0 }, { x: 0, y: 1 }, ...corners.map((a, i) => {
    const b = corners[(i + 1) % corners.length];
    return { x: b.y - a.y, y: a.x - b.x };
  })];
  return axes.every((axis) => {
    const span = (points: Point[]) => points.map((point) => point.x * axis.x + point.y * axis.y);
    const a = span(own);
    const b = span(corners);
    return Math.max(...a) > Math.min(...b) && Math.max(...b) > Math.min(...a);
  });
}

/** A stretch of the rows from `x` to `end` where a piece may start no higher than `y`. */
type Run = { x: number; end: number; y: number };

// The opening view's lower edge is laid down in steps this wide.
const STEP = 16;
// How many of the order's next pieces the lowest stretch picks from.
const QUEUE = 6;

/** The lowest the convex polygon `corners` reaches anywhere from `from` to `to`. */
function lowestOf(corners: Point[], from: number, to: number) {
  const xs = corners.map((corner) => corner.x);
  const [left, right] = [Math.min(...xs), Math.max(...xs)];
  const at = (x: number) =>
    Math.max(
      ...corners.flatMap((a, i) => {
        const b = corners[(i + 1) % corners.length];
        if (x < Math.min(a.x, b.x) || x > Math.max(a.x, b.x) || a.x === b.x) return [];
        return [a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y)];
      }),
    );
  const clamp = (x: number) => Math.min(Math.max(x, left), right);
  return Math.max(at(clamp(from)), at(clamp(to)), ...corners.filter((corner) => corner.x > from && corner.x < to).map((corner) => corner.y));
}

/** `runs` with no piece starting above `y` from `from` to `to`. */
function raise(runs: Run[], from: number, to: number, y: number): Run[] {
  const split = runs.flatMap((run) =>
    [run.x, Math.max(run.x, Math.min(from, run.end)), Math.max(run.x, Math.min(to, run.end)), run.end]
      .flatMap((x, i, xs) => (i < 3 && xs[i + 1] > x ? [{ x, end: xs[i + 1], y: run.y }] : []))
      .map((part) => (part.x >= from && part.end <= to ? { ...part, y: Math.max(part.y, y) } : part)),
  );
  return merged(split);
}

const merged = (runs: Run[]) =>
  runs.reduce<Run[]>((all, run) => {
    const last = all.at(-1);
    if (last && last.y === run.y) last.end = run.end;
    else all.push({ ...run });
    return all;
  }, []);

const near = (a: Box, b: Box, reach: number) =>
  a.x < b.x + b.width + reach && b.x < a.x + a.width + reach && a.y < b.y + b.height + reach && b.y < a.y + a.height + reach;

/**
 * The flow from the pane's opening `view`: the cover's own `seeds` as they stand, then `order`'s pieces in turn, over
 * and over, each `sizes` gives, a pit none of them fits plugged with the widest of `fillers` that does. A piece is kept
 * from `ahead` before it comes into view to `behind` after it leaves.
 */
export function createFlow({
  view,
  seeds,
  order,
  fillers = [],
  sizes,
  ahead = 400,
  behind = GAP,
}: {
  view: Point[];
  seeds: Placed[];
  order: number[];
  fillers?: number[];
  sizes: Size[];
  ahead?: number;
  behind?: number;
}) {
  const xs = view.map((corner) => corner.x);
  const left = Math.min(...xs);
  const right = Math.max(...xs) + GAP;
  const top = Math.min(...view.map((corner) => corner.y));
  const bottom = Math.max(...view.map((corner) => corner.y));

  let runs: Run[] = [];
  for (let x = left; x < right; x += STEP) runs.push({ x, end: Math.min(x + STEP, right), y: Math.ceil(lowestOf(view, x, x + STEP)) });
  for (const one of seeds) runs = raise(runs, one.x, one.x + one.width + GAP, one.y + one.height + GAP);
  runs = merged(runs);

  let placed = [...seeds];
  let next = 0;
  let key = Math.max(-1, ...seeds.map((one) => one.key)) + 1;

  // The order's next pieces, which the lowest stretch picks from.
  const queue: number[] = [];

  const besideTwin = (piece: number, box: Box) => placed.some((one) => one.piece === piece && near(one, box, 2 * GAP));

  const frontier = () => Math.min(...runs.map((run) => run.y));

  return {
    /** The lowest any piece yet to be packed could start. */
    frontier,
    /** The pieces to keep with the pane `travel` down the columns, packing those yet to come into view. */
    step(travel: number): Placed[] {
      for (let tries = 0; frontier() < travel + bottom + ahead && tries < 1000; tries++) {
        while (queue.length < QUEUE) queue.push(order[next++ % order.length]);
        const i = runs.findIndex((run) => run.y === frontier());
        const run = runs[i];
        const widest = (pieces: number[]) =>
          pieces
            .map((piece, at) => ({ piece, at, box: { x: run.x, y: run.y, ...sizes[piece] } }))
            .filter(({ piece, box }) => box.width + GAP <= run.end - run.x && !besideTwin(piece, box))
            .reduce<{ piece: number; at: number; box: Box } | undefined>((best, one) => (!best || one.box.width > best.box.width ? one : best), undefined);
        const side = Math.min(runs[i - 1]?.y ?? Infinity, runs[i + 1]?.y ?? Infinity);
        const coming = widest(queue);
        // A filler sits inside its pit, no lower than either side, or the pits it leaves narrow until only fillers fit.
        const best = coming ?? widest(fillers.filter((piece) => run.y + sizes[piece].height + GAP <= side));
        if (best) {
          if (coming) queue.splice(coming.at, 1);
          placed.push({ ...best.box, piece: best.piece, key: key++ });
          runs = raise(runs, run.x, run.x + best.box.width + GAP, run.y + best.box.height + GAP);
        } else if (runs.length > 1) {
          // Filled to its lower side, since none of them fits it.
          runs = merged(runs.with(i, { ...run, y: side }));
        }
      }
      placed = placed.filter((one) => one.y + one.height + behind > travel + top);
      const moved = view.map(({ x, y }) => ({ x, y: y + travel }));
      return placed.filter((one) => meets({ ...one, y: one.y - ahead, height: one.height + ahead + behind }, moved));
    },
  };
}
