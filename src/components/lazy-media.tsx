"use client";

import { useCallback, useRef } from "react";
import { Media, type MediaProps } from "@/components/media";
import { useFirstFoldSettled } from "@/hooks/use-first-fold-settled";
import { useNearView } from "@/hooks/use-near-view";

/** `Media` whose clip holds still until it comes near the screen, after the first fold, and then plays. */
export function LazyMedia(props: Omit<MediaProps, "autoPlay" | "elementRef">) {
  const element = useRef<HTMLElement | null>(null);
  const hold = useCallback((node: HTMLElement | null) => void (element.current = node), []);
  const near = useNearView(element);
  const due = useFirstFoldSettled() && near;
  return <Media {...props} elementRef={hold} autoPlay={due} />;
}
