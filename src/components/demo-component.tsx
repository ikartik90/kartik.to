"use client";

import { useEffect, useState } from "react";
import {
  ProgressBar,
  PROGRESS_COMPLETE_HOLD_MS,
} from "@/components/ui/progress-bar";
import { useDemoLoader, useTrickleProgress } from "@/hooks/use-demo-loader";
import type { DemoComponentEntry, DemoProps } from "@/components/demo/registry";
import { css } from "../../styled-system/css";

const demoPreloaderStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "md",
  width: "token(sizes.imagePreviewMax)",
  maxWidth: "token(spacing.full)",
  minHeight: "token(spacing.5xl)",
  paddingInline: "lg",
});

/** Pass `value` (0–100) for real progress, or omit it for an indeterminate trickle. */
export function DemoPreloader({ value }: { value?: number }) {
  const trickle = useTrickleProgress(value === undefined);
  const shown = value ?? Math.min(99, trickle * 100);

  return (
    <div className={demoPreloaderStyle}>
      <ProgressBar value={shown} label="Loading component demo" />
    </div>
  );
}

/** Renders a registry demo, showing the preloader while its module and assets load. */
export function DemoComponent({
  entry,
  aspect,
}: { entry: DemoComponentEntry } & DemoProps) {
  const { Component, ready, fraction } = useDemoLoader(entry);
  const trickle = useTrickleProgress(!ready);

  const [revealed, setRevealed] = useState(ready);
  const [loadedEntry, setLoadedEntry] = useState(entry);
  if (loadedEntry !== entry) {
    setLoadedEntry(entry);
    setRevealed(ready);
  }

  useEffect(() => {
    if (!ready || revealed) return;
    const timer = setTimeout(() => setRevealed(true), PROGRESS_COMPLETE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [ready, revealed]);

  if (!revealed || !Component) {
    const value = ready ? 100 : Math.min(99, Math.max(fraction, trickle) * 100);
    return <DemoPreloader value={value} />;
  }

  return <Component aspect={aspect} />;
}
