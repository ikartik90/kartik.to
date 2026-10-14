// Where a CSS cube's faces land on screen, so a face's icon can be drawn flat over it. Axes as CSS has them: x right,
// y down, z toward the viewer; the cube turns about its centre, half a face behind its front.

export type Vec3 = [number, number, number];
export type CubeFace = "F" | "T" | "B" | "L" | "R";

export const CUBE_FACES: CubeFace[] = ["F", "T", "B", "L", "R"];

/** Each face's placement on the cube, which way it faces, and where its own x and y run from there. */
export const CUBE_FACE_PLACE: Record<CubeFace, { transform: string; normal: Vec3; axes: [Vec3, Vec3] }> = {
  F: { transform: "none", normal: [0, 0, 1], axes: [[1, 0, 0], [0, 1, 0]] },
  T: { transform: "rotateX(90deg)", normal: [0, -1, 0], axes: [[1, 0, 0], [0, 0, 1]] },
  B: { transform: "rotateX(-90deg)", normal: [0, 1, 0], axes: [[1, 0, 0], [0, 0, -1]] },
  L: { transform: "rotateY(-90deg)", normal: [-1, 0, 0], axes: [[0, 0, 1], [0, 1, 0]] },
  R: { transform: "rotateY(90deg)", normal: [1, 0, 0], axes: [[0, 0, -1], [0, 1, 0]] },
};

/** The perspective the cube is seen through, in cube widths from its front. */
export const CUBE_PERSPECTIVE = 4;

/** A cube's turn as CSS's `rotate3d(kx, ky, 0, angle)`: `ax` about x (+ turns its front up), `ay` about y (+ right). */
export interface CubeTurn {
  kx: number;
  ky: number;
  angle: number;
  cos: number;
  sin: number;
}

export function cubeTurn(ax: number, ay: number): CubeTurn {
  const angle = Math.hypot(ax, ay);
  const [kx, ky] = angle > 1e-9 ? [ax / angle, ay / angle] : [1, 0];
  return { kx, ky, angle, cos: Math.cos(angle), sin: Math.sin(angle) };
}

/**
 * Where a point on a face lands, from its cell's top left: `u`, `v` px from the face's middle along its own x and y,
 * on a cube `half` px from its centre to a face.
 */
export function onScreen(face: CubeFace, u: number, v: number, half: number, turn: CubeTurn): [number, number] {
  const { normal, axes } = CUBE_FACE_PLACE[face];
  const [qx, qy, qz] = [0, 1, 2].map((k) => axes[0][k] * u + axes[1][k] * v + normal[k] * half);
  const { kx, ky, cos, sin } = turn;
  const along = kx * qx + ky * qy;
  const x = qx * cos + ky * qz * sin + kx * along * (1 - cos);
  const y = qy * cos - kx * qz * sin + ky * along * (1 - cos);
  const z = qz * cos + (kx * qy - ky * qx) * sin;
  const distance = CUBE_PERSPECTIVE * 2 * half;
  const scale = distance / (distance + half - z);
  return [half + x * scale, half + y * scale];
}

/**
 * A `size` px square laid flat over a face's middle, as the six numbers of a CSS `matrix()` from the cell's top left:
 * the face's own x and y as they run on screen there. A 2D matrix has no perspective, so it fits the face exactly only
 * at its middle, and near enough across an icon.
 */
export function flatMatrix(face: CubeFace, size: number, half: number, turn: CubeTurn) {
  const r = size / 2;
  const at = (u: number, v: number) => onScreen(face, u, v, half, turn);
  const [[x0, y0], [xr, yr], [xl, yl], [xd, yd], [xu, yu]] = [at(0, 0), at(r, 0), at(-r, 0), at(0, r), at(0, -r)];
  const [a, b, c, d] = [(xr - xl) / (2 * r), (yr - yl) / (2 * r), (xd - xu) / (2 * r), (yd - yu) / (2 * r)];
  return [a, b, c, d, x0 - (a + c) * r, y0 - (b + d) * r] as const;
}
