"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { useFirstFoldSettled } from "@/hooks/use-first-fold-settled";
import { useNearView } from "@/hooks/use-near-view";
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
export function DemoPreloader({ value, ref }: { value?: number; ref?: Ref<HTMLDivElement> }) {
  const trickle = useTrickleProgress(value === undefined);
  const shown = value ?? Math.min(99, trickle * 100);

  return (
    <div ref={ref} className={demoPreloaderStyle}>
      <ProgressBar value={shown} label="Loading component demo" />
    </div>
  );
}

/**
 * Renders a registry demo, showing the preloader while its module and assets load; it fetches them once it comes near
 * the screen, after the first fold.
 */
export function DemoComponent({
  entry,
  aspect,
}: { entry: DemoComponentEntry } & DemoProps) {
  const preloader = useRef<HTMLDivElement>(null);
  const near = useNearView(preloader);
  const { Component, ready, fraction } = useDemoLoader(entry, useFirstFoldSettled() && near);
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
    return <DemoPreloader ref={preloader} value={value} />;
  }

  return <Component aspect={aspect} />;
}
