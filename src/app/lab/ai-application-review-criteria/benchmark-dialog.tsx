"use client";

import { useEffect, useId, useState } from "react";
import { css } from "../../../../styled-system/css";
import { BenchmarkResults, type CandidatesTab } from "./benchmark-results";
import type { BenchmarkRow } from "./benchmark";
import type { useModal } from "./modal";
import { overlayBase } from "./overlay";
import { ProgressBar } from "./progress-bar";

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
  rows: BenchmarkRow[];
  /** Run the pretend benchmark before showing results. */
  benchmarking: boolean;
  opensOn: CandidatesTab;
  /** Criteria or candidates changed since the results were benchmarked. */
  stale: boolean;
  /** Candidate ids taken out of the benchmark. */
  removed: ReadonlySet<string>;
  onRemoveCandidates: (ids: readonly string[]) => void;
  onAddCandidates: (ids: readonly string[]) => void;
  onReviewRewrites: () => void;
  /** Offered in place of the review when `stale`. */
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
