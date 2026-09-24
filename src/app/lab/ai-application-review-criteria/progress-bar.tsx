import { css } from "../../../../styled-system/css";

// ---------------------------------------------------------------------------
// A pretend progress bar — the benchmark's and the validation's: it fills
// from nothing as it appears, over `ms`, while nothing is computed. Drawn like
// the benchmark's own outcome bar, a 5px rounded stroke; named by the heading
// of what it is progress on.
// ---------------------------------------------------------------------------

const trackStyle = css({
  width: "320px",
  maxWidth: "100%",
  height: "5px",
  overflow: "hidden",
  borderRadius: "2.5px",
  backgroundColor: "var(--cashby-fill)",
});

// `@starting-style` is where it fills from.
const barStyle = css({
  height: "100%",
  borderRadius: "inherit",
  backgroundColor: "var(--cashby-accent)",
  transformOrigin: "left",
  transitionProperty: "transform",
  transitionTimingFunction: "linear",
  _starting: { transform: "scaleX(0)" },
});

export function ProgressBar({
  labelledBy,
  ms,
}: {
  labelledBy: string;
  ms: number;
}) {
  return (
    <div role="progressbar" aria-labelledby={labelledBy} className={trackStyle}>
      <div className={barStyle} style={{ transitionDuration: `${ms}ms` }} />
    </div>
  );
}
