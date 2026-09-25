"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  formatCanCarryAlpha,
  hasTransparentPixels,
  sampleSize,
} from "@/utils/image-transparency";

// Which images are see-through, so the grid can paint a checkerboard behind them.

const MAX_SAMPLE_EDGE = 256;

// Module-level: a picture's alpha never changes, and every consumer shares the answer.
const resolved = new Map<string, boolean>();

/** Inspections in flight, so two cells asking at once share the one decode. */
const pending = new Map<string, Promise<boolean>>();

// One immutable set, replaced on change as useSyncExternalStore needs, and shared so a
// remounted grid paints the checkerboard on its first frame.
let transparentSrcs: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

const getSnapshot = () => transparentSrcs;

export function useImageTransparency(srcs: string[]): ReadonlySet<string> {
  // A string key: `srcs` is a fresh array every render.
  const key = srcs.join("\n");

  const transparent = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    for (const src of key ? key.split("\n") : []) inspect(src);
  }, [key]);

  return transparent;
}

function inspect(src: string): Promise<boolean> {
  const answered = resolved.get(src);
  if (answered !== undefined) return Promise.resolve(answered);
  const existing = pending.get(src);
  if (existing) return existing;

  const run = detect(src).then((value) => {
    resolved.set(src, value);
    pending.delete(src);
    if (value) {
      transparentSrcs = new Set(transparentSrcs).add(src);
      listeners.forEach((notify) => notify());
    }
    return value;
  });
  pending.set(src, run);
  return run;
}

// JPEGs can't carry alpha. Others are re-decoded with CORS (the on-screen <img> isn't); if
// that fails but a plain load works, transparency is assumed, and a broken src is not.
async function detect(src: string): Promise<boolean> {
  if (!formatCanCarryAlpha(src)) return false;

  const readable = await load(src, "anonymous");
  if (readable) {
    try {
      return scan(readable);
    } catch {
      return true;
    }
  }
  return (await load(src)) !== null;
}

function load(
  src: string,
  crossOrigin?: string,
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    // Before src, which starts the fetch in the request's mode.
    if (crossOrigin) image.crossOrigin = crossOrigin;
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function scan(image: HTMLImageElement): boolean {
  const { naturalWidth, naturalHeight } = image;
  // An SVG with no intrinsic size can't be measured; assume transparent.
  if (!naturalWidth || !naturalHeight) return true;

  const { width, height } = sampleSize(
    naturalWidth,
    naturalHeight,
    MAX_SAMPLE_EDGE,
  );
  const canvas = document.createElement("canvas");
  // Sized exactly: any undrawn (transparent) row would read as see-through.
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return true;

  context.drawImage(image, 0, 0, width, height);
  return hasTransparentPixels(context.getImageData(0, 0, width, height).data);
}
