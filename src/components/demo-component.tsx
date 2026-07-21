"use client";

import { useEffect, useState } from "react";
import {
  ProgressBar,
  PROGRESS_COMPLETE_HOLD_MS,
} from "@/components/ui/progress-bar";
import { useDemoLoader, useTrickleProgress } from "@/hooks/use-demo-loader";
import type { DemoComponentEntry } from "@/components/demo/registry";
import { demoPreloader } from "../../styled-system/recipes";

/**
 * The component-demo preloader — the same progress bar the upload-media dialog
 * uses, centered in the demo frame. Pass `value` (0–100) for real progress, or
 * omit it for an indeterminate trickle (used during a demo's own async init).
 */
export function DemoPreloader({ value }: { value?: number }) {
  const trickle = useTrickleProgress(value === undefined);
  const shown = value ?? Math.min(99, trickle * 100);

  return (
    <div className={demoPreloader()}>
      <ProgressBar value={shown} label="Loading component demo" />
    </div>
  );
}

/**
 * Renders a registry demo: shows the preloader while the demo's module and
 * assets load (deferred until the page has loaded), then swaps in the demo.
 * Every demo call site goes through this so the loading behaviour lives once.
 */
export function DemoComponent({ entry }: { entry: DemoComponentEntry }) {
  const { Component, ready, fraction } = useDemoLoader(entry);
  const trickle = useTrickleProgress(!ready);

  // If the demo is ready on the very first render it was already loaded — no
  // loader was shown, so reveal immediately (no completion hold). Otherwise a
  // loader is shown while it loads, then held briefly at 100% so the fill
  // visibly finishes before the demo swaps in.
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

  return <Component />;
}
