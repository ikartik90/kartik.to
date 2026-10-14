// A grid of cubes on springs: each leans toward a tilt it's given, and flips a quarter turn to bring round another
// face. Angles in radians: x turns a cube's front up, y turns it right.

import type { CubeFace } from "@/utils/cube-projection";
import type { CubeDir } from "@/utils/cube-path";

/** Which of a cube's five face elements is at each place on it. */
export type CubeFaceElements = Record<CubeFace, number>;

// React Bits' "Cubes" springs: stiffness 160, and its bounce of 0.82 at 0.4 strength.
const STIFFNESS = 160;
const DAMPING = 2 * (1 - 0.82 * 0.4) * Math.sqrt(STIFFNESS);
const QUARTER = Math.PI / 2;

// The quarter turn each flip adds, about x and y.
const SPIN: Record<CubeDir, [number, number]> = { right: [0, 1], left: [0, -1], up: [1, 0], down: [-1, 0] };

export class CubeTurns {
  readonly faces: CubeFaceElements[];
  // Two springs per cube: the lean toward its tilt (r, w) and the flip (f, v) toward its goal (g), shown summed.
  private readonly rx: Float64Array;
  private readonly ry: Float64Array;
  private readonly wx: Float64Array;
  private readonly wy: Float64Array;
  private readonly fx: Float64Array;
  private readonly fy: Float64Array;
  private readonly vx: Float64Array;
  private readonly vy: Float64Array;
  private readonly gx: Float64Array;
  private readonly gy: Float64Array;

  constructor(count: number) {
    this.faces = Array.from({ length: count }, () => ({ F: 0, T: 1, B: 2, L: 3, R: 4 }));
    [this.rx, this.ry, this.wx, this.wy, this.fx, this.fy, this.vx, this.vy, this.gx, this.gy] = Array.from(
      { length: 10 },
      () => new Float64Array(count),
    );
  }

  /** Starts a flip; false while the cube's last one hasn't yet brought its new face to the front. */
  flip(cube: number, dir: CubeDir) {
    if (this.gx[cube] || this.gy[cube]) return false;
    [this.gx[cube], this.gy[cube]] = SPIN[dir].map((sign) => sign * QUARTER);
    return true;
  }

  /** Sets a cube's lean swinging, at `x` and `y` radians a second. */
  kick(cube: number, x: number, y: number) {
    this.wx[cube] += x;
    this.wy[cube] += y;
  }

  /**
   * Moves every cube on by `dt` seconds, leaning toward `tilt(cube)`. Returns the face elements turned out of sight by
   * a flip, each to be given a fresh icon before it next comes round.
   */
  step(dt: number, tilt: (cube: number) => [number, number]) {
    const fresh: { cube: number; element: number }[] = [];
    for (let i = 0; i < this.faces.length; i++) {
      const [tx, ty] = tilt(i);
      this.wx[i] += (STIFFNESS * (tx - this.rx[i]) - DAMPING * this.wx[i]) * dt;
      this.wy[i] += (STIFFNESS * (ty - this.ry[i]) - DAMPING * this.wy[i]) * dt;
      this.rx[i] += this.wx[i] * dt;
      this.ry[i] += this.wy[i] * dt;
      this.vx[i] += (STIFFNESS * (this.gx[i] - this.fx[i]) - DAMPING * this.vx[i]) * dt;
      this.vy[i] += (STIFFNESS * (this.gy[i] - this.fy[i]) - DAMPING * this.vy[i]) * dt;
      this.fx[i] += this.vx[i] * dt;
      this.fy[i] += this.vy[i] * dt;

      // Past halfway the face coming round is the front: relabel, and keep turning on toward it from a quarter back.
      const r = this.faces[i];
      const half = QUARTER / 2;
      if (this.gx[i] > 0 && this.fx[i] > half) {
        [r.F, r.T, r.B] = [r.B, r.F, r.T];
        [this.fx[i], this.gx[i]] = [this.fx[i] - QUARTER, 0];
        fresh.push({ cube: i, element: r.B });
      } else if (this.gx[i] < 0 && this.fx[i] < -half) {
        [r.F, r.B, r.T] = [r.T, r.F, r.B];
        [this.fx[i], this.gx[i]] = [this.fx[i] + QUARTER, 0];
        fresh.push({ cube: i, element: r.T });
      } else if (this.gy[i] > 0 && this.fy[i] > half) {
        [r.F, r.R, r.L] = [r.L, r.F, r.R];
        [this.fy[i], this.gy[i]] = [this.fy[i] - QUARTER, 0];
        fresh.push({ cube: i, element: r.L });
      } else if (this.gy[i] < 0 && this.fy[i] < -half) {
        [r.F, r.L, r.R] = [r.R, r.F, r.L];
        [this.fy[i], this.gy[i]] = [this.fy[i] + QUARTER, 0];
        fresh.push({ cube: i, element: r.R });
      }
    }
    return fresh;
  }

  /** How far a cube is turned, its lean and its flip together. */
  turn(cube: number) {
    return { ax: this.rx[cube] + this.fx[cube], ay: this.ry[cube] + this.fy[cube] };
  }

  /** Whether a face can be seen: the front always, a side only while the cube is turned its way. */
  showing(cube: number, face: CubeFace) {
    const { ax, ay } = this.turn(cube);
    return (
      face === "F" ||
      (face === "T" && ax < -0.001) ||
      (face === "B" && ax > 0.001) ||
      (face === "L" && ay > 0.001) ||
      (face === "R" && ay < -0.001)
    );
  }
}
