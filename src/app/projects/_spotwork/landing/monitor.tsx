import { useId } from "react";
import { css, cx } from "../../../../../styled-system/css";

// The landing card's monitor and stand, traced from a photo, in a 1536×1099 frame with its screen 1181 wide at
// (179, 153) and 16:10. The stand takes its colour from whatever is painted under it, so it needs no isolating ancestor
// (no transform, opacity or filter) between it and the ground.

const STAND = "411.7,920 519.9,920 362,1110 240.3,1110";
// From the left edge to the groove, and from the groove to the right edge.
const BODY = "411.7,920 514.1,920 356.2,1110 240.3,1110";
const RIM = "514.1,920 519.9,920 362,1110 356.2,1110";
const GROOVE = { x1: 497.8, y1: 939.6, x2: 356.2, y2: 1110 };

// Black's opacity across the body, from its left edge to the groove: at the top of the arm, lit at the edge, darkest a
// few pixels in, a faint ridge, then brightening towards the groove; and how much more the foot takes.
const SHADE = [
  [0, 0.4],
  [0.043, 0.51],
  [0.086, 0.653],
  [0.129, 0.705],
  [0.172, 0.765],
  [0.215, 0.769],
  [0.258, 0.7],
  [0.301, 0.67],
  [0.344, 0.63],
  [0.387, 0.6],
  [0.43, 0.58],
  [0.473, 0.534],
  [0.516, 0.5],
  [0.559, 0.454],
  [0.602, 0.426],
  [0.645, 0.4],
  [0.688, 0.38],
  [0.731, 0.35],
  [0.774, 0.315],
  [0.817, 0.295],
  [0.86, 0.283],
  [0.903, 0.263],
  [1, 0.27],
];
const FOOT = [
  [0, 0.4],
  [0.05, 0.47],
  [0.15, 0.47],
  [0.22, 0.35],
  [0.3, 0.45],
  [0.39, 0.52],
  [0.5, 0.46],
  [0.6, 0.4],
  [0.69, 0.31],
  [0.77, 0.19],
  [0.86, 0.08],
  [0.95, 0],
];
const SHEEN = [
  [0, 11],
  [0.25, 9],
  [0.45, 6],
  [0.6, 3.5],
  [0.8, 2],
  [1, 1],
];
const ACROSS = { x1: 326.9, y1: 1014, x2: 390.3, y2: 1069 };

// Each on a layer of its own: Safari paints an SVG that isn't under the ground shader's canvas layer, and blends only a
// whole layer with the layers beneath it. Overlay, not color-burn: WebKit paints color-burn's faintest edge pixels black.
const svgStyle = css({ position: "absolute", inset: 0, width: "100%", height: "100%", willChange: "transform" });
const glowStyle = css({ mixBlendMode: "overlay" });

export function Monitor() {
  const id = useId().replace(/[^\w-]/g, "");
  return (
    <>
      <svg aria-hidden className={cx(svgStyle, glowStyle)} viewBox="0 0 1536 1099" preserveAspectRatio="none">
        <polygon points={STAND} fill="#262626" />
      </svg>
      <svg aria-hidden className={svgStyle} viewBox="0 0 1536 1099" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`${id}shade`} gradientUnits="userSpaceOnUse" {...ACROSS}>
            {SHADE.map(([offset, opacity]) => (
              <stop key={offset} offset={offset} stopColor="#000" stopOpacity={opacity} />
            ))}
          </linearGradient>
          <linearGradient id={`${id}foot`} gradientUnits="userSpaceOnUse" {...ACROSS}>
            {FOOT.map(([offset, opacity]) => (
              <stop key={offset} offset={offset} stopColor="#000" stopOpacity={opacity} />
            ))}
          </linearGradient>
          <linearGradient id={`${id}down`} gradientUnits="userSpaceOnUse" x1="445.4" y1="943.6" x2="324" y2="1083.6">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <mask id={`${id}lower`} maskUnits="userSpaceOnUse" x="200" y="900" width="340" height="230">
            <rect x="200" y="900" width="340" height="230" fill={`url(#${id}down)`} />
          </mask>
          <radialGradient id={`${id}sheen`} cx="0" cy="0" r="0.8">
            {SHEEN.map(([offset, level]) => (
              <stop key={offset} offset={offset} stopColor={`rgb(${level} ${level} ${level})`} />
            ))}
          </radialGradient>
        </defs>
        <polygon points={BODY} fill={`url(#${id}shade)`} />
        <polygon points={BODY} fill={`url(#${id}foot)`} mask={`url(#${id}lower)`} />
        <polygon points={RIM} fill="#000" fillOpacity={0.2} />
        <line {...GROOVE} stroke="#000" strokeOpacity={0.76} strokeWidth={1.5} />
        <rect x="166.5" y="139.5" width="1205.5" height="793.4" rx="5.5" fill="#000" />
        <rect x="179" y="153" width="1181" height="738.125" fill={`url(#${id}sheen)`} />
        <rect x="170" y="894.85" width="1198" height="1.5" fill="#0f0f0f" />
      </svg>
    </>
  );
}
