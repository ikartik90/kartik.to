import type { CSSProperties } from "react";
import { ASPECT_RATIOS, type DemoFrameAspectRatio } from "./demo-frame-sizing";

export interface GridItemVars extends CSSProperties {
  "--span": number;
  "--aspect-w": number;
  "--aspect-h": number;
}

/** The ratio stays an integer pair (6:5 has no exact decimal); `span` is clamped in CSS, not here. */
export function gridItemVars(
  aspect: DemoFrameAspectRatio,
  span = 1,
): GridItemVars {
  const [w, h] = ASPECT_RATIOS[aspect];
  return { "--span": span, "--aspect-w": w, "--aspect-h": h };
}
