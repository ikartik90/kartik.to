"use client";

import { useEffect, useId, useState } from "react";
import { css } from "../../../../styled-system/css";
import { BenchmarkResults, type CandidatesTab } from "./benchmark-results";
import type { BenchmarkRow } from "./benchmark";
import type { useModal } from "./modal";
import { overlayBase } from "./overlay";
import { ProgressBar } from "./progress-bar";

// ---------------------------------------------------------------------------
// Retesting the criteria: an overlay in the middle of the window, 50px clear
// of its top and bottom, that benchmarks the draft against the candidate set
// and then shows how each candidate came out (Figma 73:2989).
//
// The benchmarking is pretend — a bar that fills while nothing is computed —
// and every retest runs it again: the overlay's contents are keyed on the
// modal's session, so they remount from the start. Viewing the last results
// shows them at once; changing the candidates does too, on the suggested list.
//
// Opened from inside the drawer and written inside it, so it inherits the
// product's look; as a modal it is in the top layer all the same, over a scrim
// that dims the drawer and the page behind it. It fades and settles in, the
// scrim with it, and both fade out while `data-closing`.
//
// Review suggested rewrites closes it, and the drawer takes it from there.
// ---------------------------------------------------------------------------

/** How long the pretend benchmarking takes. */
export const BENCHMARKING_MS = 300;

const overlayStyle = css(overlayBase, {
  marginBlock: "50px",
  marginInline: "auto",
  width: "960px",
  maxWidth: "calc(100% - 40px)",
  height: "auto",
  maxHeight: "none",
  borderRadius: "12px",
  filter: "drop-shadow(0 0 10px var(--cashby-border))",
});

const benchmarkingStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
  flex: 1,
  padding: "24px",
});

const benchmarkingLabelStyle = css({ font: "var(--cashby-text-body-strong)" });

export interface BenchmarkDialogProps {
  modal: ReturnType<typeof useModal>;
  /** The results to show. */
  rows: BenchmarkRow[];
  /** Benchmark first — a retest — rather than show the results at once. */
  benchmarking: boolean;
  /** The tab it opens on. */
  opensOn: CandidatesTab;
  /** The results no longer answer for the benchmark: the criteria have changed since, or a candidate added back has not been benchmarked. */
  stale: boolean;
  /** The candidates taken out of the benchmark from the suggested list. */
  removed: ReadonlySet<string>;
  /** Take candidates out of the benchmark. */
  onRemoveCandidates: (ids: readonly string[]) => void;
  /** Put candidates back in the benchmark. */
  onAddCandidates: (ids: readonly string[]) => void;
  /** Review suggested rewrites. */
  onReviewRewrites: () => void;
  /** Retest the criteria as they are now — offered in place of the review when the results are stale. */
  onRetest: () => void;
}

export function BenchmarkDialog({ modal, ...benchmark }: BenchmarkDialogProps) {
  const titleId = useId();
  return (
    <dialog
      {...modal.dialogProps}
      className={overlayStyle}
      aria-labelledby={titleId}
    >
      {modal.session > 0 && (
        <Benchmark
          key={modal.session}
          titleId={titleId}
          onClose={() => void modal.close()}
          {...benchmark}
        />
      )}
    </dialog>
  );
}

function Benchmark({
  titleId,
  benchmarking,
  ...results
}: Omit<BenchmarkDialogProps, "modal"> & {
  titleId: string;
  onClose: () => void;
}) {
  const [done, setDone] = useState(!benchmarking);

  useEffect(() => {
    if (!benchmarking) return;
    const timer = window.setTimeout(() => setDone(true), BENCHMARKING_MS);
    return () => window.clearTimeout(timer);
  }, [benchmarking]);

  if (done) return <BenchmarkResults titleId={titleId} {...results} />;
  return (
    <div className={benchmarkingStyle}>
      <p id={titleId} className={benchmarkingLabelStyle}>
        Benchmarking criteria
      </p>
      <ProgressBar labelledBy={titleId} ms={BENCHMARKING_MS} />
    </div>
  );
}
