import { css, cva } from "../../../../styled-system/css";
import { scoreTone } from "./benchmark";

// ---------------------------------------------------------------------------
// A candidate's average score from the talent pool, as both candidate tables
// show it (Figma 73:2989): a 32px disc, green from 3 up, amber below it, grey
// with a dash where there is none. Not the benchmark's — it stands whether or
// not the candidate has been benchmarked.
// ---------------------------------------------------------------------------

const centredStyle = css({ display: "flex", justifyContent: "center" });

const score = cva({
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  variants: {
    // Drawn smaller in the intro's pictures, its figure set a little low to
    // sit in the middle of the disc (Figma 132:6204).
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
