import { uploadProgress, progressBarFill } from "../../../styled-system/recipes";

/**
 * How long to hold the bar once a load completes, before the loader is
 * dismissed — the ~100ms fill transition plus a ~100ms linger so the brand fill
 * visibly finishes rather than flashes. Only applies when a loader was actually
 * shown (a genuine load); an already-loaded demo skips it entirely. Shared by
 * the demo preloader and the upload-media dialog.
 */
export const PROGRESS_COMPLETE_HOLD_MS = 200;

export interface ProgressBarProps {
  /** Completion percentage, 0–100. */
  value: number;
  /** Accessible label describing what is loading. */
  label?: string;
}

/**
 * The shared determinate progress bar used by the upload-media dialog and the
 * component-demo preloader. Track = `uploadProgress`, fill = `progressBarFill`.
 */
export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      className={uploadProgress()}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={progressBarFill()} style={{ width: `${clamped}%` }} />
    </div>
  );
}
