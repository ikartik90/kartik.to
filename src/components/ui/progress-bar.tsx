import { css } from "../../../styled-system/css";

/** Hold after completion: the 100ms fill transition plus a linger, so the fill visibly finishes. */
export const PROGRESS_COMPLETE_HOLD_MS = 200;

export interface ProgressBarProps {
  /** 0–100. */
  value: number;
  label?: string;
}

const uploadProgressStyle = css({
  position: "relative",
  width: "token(sizes.imagePreviewMax)",
  maxWidth: "token(spacing.full)",
  height: "token(spacing.xxs)",
  borderRadius: "xs",
  backgroundColor: "border.divider",
  overflow: "hidden",
});

const progressBarFillStyle = css({
  position: "absolute",
  top: 0,
  left: 0,
  height: "token(spacing.full)",
  borderRadius: "xs",
  transition: "width linear 100ms",
  backgroundColor: { base: "brand.pink", _dark: "brand.orange" },
});

export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      className={uploadProgressStyle}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={progressBarFillStyle} style={{ width: `${clamped}%` }} />
    </div>
  );
}
