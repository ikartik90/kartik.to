// Which cubes a cursor's path across a grid of cubes flips: each one it comes over, the way it's going, and each one
// beside its path once, away from it, less often the further off it is. Positions are in cells (a cube and its gap),
// from the grid's middle.

export type CubeDir = "left" | "right" | "up" | "down";
export interface CubeFlip {
  cube: number;
  dir: CubeDir;
  /** When, on the clock `move` is given. */
  at: number;
}
interface Point {
  x: number;
  y: number;
}

/** How far beside the path a cube can still flip, and how sharply its chance falls on the way. */
const REACH = 2.5;
const FALLOFF = 1.5;
/** Cells a second the flips spread out from the path at. */
const TRAVEL = 8;
/** How much nearer another cube the cursor must be before that cube counts as the one it's over. */
const HYSTERESIS = 0.1;
/** Steps along a stretch of path, in cells, so a quick move flips every cube it crosses. */
const SAMPLE = 0.1;

/** The way a move of (x, y) goes, along whichever axis it goes further. */
export const toward = (x: number, y: number): CubeDir =>
  Math.abs(x) >= Math.abs(y) ? (x >= 0 ? "right" : "left") : y >= 0 ? "down" : "up";

/** The chance a cube `distance` cells from the path flips: certain at a cube's edge, none past `REACH`. */
export function flipChance(distance: number) {
  if (distance >= REACH) return 0;
  return Math.min(1, (REACH - distance) / (REACH - 0.5)) ** FALLOFF;
}

export class CubePath {
  private readonly columns: number;
  private readonly rows: number;
  private readonly random: () => number;
  private last: Point | null = null;
  private cell = -1;
  private clock = 0;
  // The cursor's nearest pass by each cube so far, the way from there to the cube, and whether the pass has had its
  // chance to flip it.
  private readonly pass: number[];
  private readonly away: Point[];
  private readonly rolled: boolean[];
  private queued: CubeFlip[] = [];

  constructor({ columns, rows, random = Math.random }: { columns: number; rows: number; random?: () => number }) {
    this.columns = columns;
    this.rows = rows;
    this.random = random;
    const count = columns * rows;
    this.pass = Array.from({ length: count }, () => Infinity);
    this.away = Array.from({ length: count }, () => ({ x: 0, y: 0 }));
    this.rolled = Array.from({ length: count }, () => false);
  }

  private centre(cube: number): Point {
    return { x: (cube % this.columns) - (this.columns - 1) / 2, y: Math.floor(cube / this.columns) - (this.rows - 1) / 2 };
  }

  /** The cube at `p`, kept as `current` until `p` is clearly nearer another; -1 off the grid. */
  private cellAt(p: Point, current: number) {
    const [halfX, halfY] = [this.columns / 2, this.rows / 2];
    if (Math.abs(p.x) > halfX || Math.abs(p.y) > halfY) return -1;
    const index = (n: number, size: number) => Math.max(0, Math.min(size - 1, Math.round(n + (size - 1) / 2)));
    const nearest = index(p.y, this.rows) * this.columns + index(p.x, this.columns);
    if (current < 0 || nearest === current) return nearest;
    const away = (cube: number) => Math.hypot(p.x - this.centre(cube).x, p.y - this.centre(cube).y);
    return away(nearest) + HYSTERESIS < away(current) ? nearest : current;
  }

  /** The cursor at `to`, `clock` seconds in: the cubes it has just come over, to flip now. */
  move(to: Point, clock: number): CubeFlip[] {
    this.clock = clock;
    const from = this.last;
    this.last = to;
    const flips: CubeFlip[] = [];
    if (!from) {
      this.cell = this.cellAt(to, -1);
      if (this.cell >= 0) flips.push(this.over(this.cell, toward(-to.x, -to.y)));
      return flips;
    }
    const [mx, my] = [to.x - from.x, to.y - from.y];
    const length = Math.hypot(mx, my);
    if (length < 1e-6) return flips;
    const samples = Math.ceil(length / SAMPLE);
    for (let s = 1; s <= samples; s++) {
      const cell = this.cellAt({ x: from.x + (mx * s) / samples, y: from.y + (my * s) / samples }, this.cell);
      if (cell !== this.cell && cell >= 0) flips.push(this.over(cell, toward(mx, my)));
      this.cell = cell;
    }
    for (let cube = 0; cube < this.pass.length; cube++) {
      const c = this.centre(cube);
      const t = Math.max(0, Math.min(1, ((c.x - from.x) * mx + (c.y - from.y) * my) / (length * length)));
      const away = { x: c.x - from.x - mx * t, y: c.y - from.y - my * t };
      const distance = Math.hypot(away.x, away.y);
      if (distance < this.pass[cube]) [this.pass[cube], this.away[cube]] = [distance, away];
      // Past its nearest point on this stretch: the cursor is moving off.
      if (t < 1) this.roll(cube);
      if (Math.hypot(c.x - to.x, c.y - to.y) > REACH) [this.pass[cube], this.rolled[cube]] = [Infinity, false];
    }
    return flips;
  }

  /** The cursor gone: the cubes it was still nearing have their chance, and its next move starts afresh. */
  leave() {
    for (let cube = 0; cube < this.pass.length; cube++) this.roll(cube);
    this.pass.fill(Infinity);
    this.rolled.fill(false);
    this.last = null;
    this.cell = -1;
  }

  /** The flips beside the path whose time has come by `clock`. */
  due(clock: number): CubeFlip[] {
    const now = this.queued.filter((flip) => flip.at <= clock);
    this.queued = this.queued.filter((flip) => flip.at > clock);
    return now;
  }

  private over(cube: number, dir: CubeDir): CubeFlip {
    this.queued = this.queued.filter((flip) => flip.cube !== cube);
    this.rolled[cube] = true;
    return { cube, dir, at: this.clock };
  }

  private roll(cube: number) {
    if (this.rolled[cube] || this.pass[cube] >= REACH) return;
    this.rolled[cube] = true;
    if (this.random() >= flipChance(this.pass[cube])) return;
    const { x, y } = this.away[cube];
    this.queued.push({ cube, dir: toward(x, y), at: this.clock + Math.max(0, this.pass[cube] - 0.5) / TRAVEL });
  }
}
