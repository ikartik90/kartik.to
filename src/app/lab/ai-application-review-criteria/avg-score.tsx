import { css, cva } from "../../../../styled-system/css";
import { scoreTone } from "./benchmark";

const centredStyle = css({ display: "flex", justifyContent: "center" });

const score = cva({
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  variants: {
    // Intro pictures; the top padding optically centres the figure.
    small: {
      false: {
        width: "32px",
        height: "32px",
        borderRadius: "16px",
        font: "var(--cashby-text-body-strong)",
      },
      true: {
        width: "28px",
        height: "28px",
        paddingBlockStart: "1.5px",
        borderRadius: "14px",
        font: "var(--cashby-text-label)",
        fontVariantNumeric: "lining-nums proportional-nums",
      },
    },
    tone: {
      good: {
        backgroundColor: "var(--cashby-positive)",
        color: "var(--cashby-surface)",
      },
      low: {
        backgroundColor: "var(--cashby-warning)",
        color: "var(--cashby-ink)",
      },
      none: {
        backgroundColor: "var(--cashby-fill-solid)",
        color: "var(--cashby-ink)",
      },
    },
  },
});

export function AvgScore({
  value,
  small = false,
}: {
  value: number | null;
  small?: boolean;
}) {
  return (
    <div className={centredStyle}>
      <span className={score({ tone: scoreTone(value), small })}>
        {value?.toFixed(1) ?? "-"}
      </span>
    </div>
  );
}
