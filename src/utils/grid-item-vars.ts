import type { CSSProperties } from "react";
import { ASPECT_RATIOS, type DemoFrameAspectRatio } from "./demo-frame-sizing";

/**
 * The three custom properties `masonryGrid` reads off each of its children.
 *
 * Set from OUTSIDE the child rather than by the child itself, because the grid
 * is meant to take anything — a link card, a live component, a pull quote — and
 * a node that has to know how to place itself in a grid is a node that can only
 * live in one. The child's only obligation is to let a `style` through to its
 * root element.
 */
export interface GridItemVars extends CSSProperties {
  "--span": number;
  "--aspect-w": number;
  "--aspect-h": number;
}

/**
 * Turn a shape and a column count into the variables the grid places by.
 *
 * The ratio stays a PAIR of integers rather than arriving pre-divided. The
 * recipe multiplies the cell width by `--aspect-h` and divides by `--aspect-w`,
 * so 3:2 resolves exactly; handing it `1.5` would push a rounding error through
 * a row count that is already measured in single pixels, and 6:5 and 16:9 do
 * not even have a terminating decimal to round to.
 *
 * `span` is passed through UNCLAMPED. What it should be cut down to is the
 * number of columns the grid currently has, which is a function of the space
 * available and settled in CSS long after this runs — see the `min()` in the
 * recipe. Clamping here against a guess at the column count would be the wrong
 * answer held more confidently.
 */
export function gridItemVars(
  aspect: DemoFrameAspectRatio,
  span = 1,
): GridItemVars {
  const [w, h] = ASPECT_RATIOS[aspect];
  return { "--span": span, "--aspect-w": w, "--aspect-h": h };
}
