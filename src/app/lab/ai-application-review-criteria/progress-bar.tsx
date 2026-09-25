import { css } from "../../../../styled-system/css";

// A pretend progress bar: fills from empty over `ms`, tracking no real work.

const trackStyle = css({
  width: "320px",
  maxWidth: "100%",
  height: "5px",
  overflow: "hidden",
  borderRadius: "2.5px",
  backgroundColor: "var(--cashby-fill)",
});

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
