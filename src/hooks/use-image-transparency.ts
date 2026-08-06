"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  formatCanCarryAlpha,
  hasTransparentPixels,
  sampleSize,
} from "@/utils/image-transparency";

// ---------------------------------------------------------------------------
// useImageTransparency — which of these pictures you can see through.
//
// A picture with an alpha channel and no background effect of its own is
// standing on whatever happens to be behind it, and in the editor that is the
// page: a transparent screenshot of dark UI simply disappears into a dark
// theme, and there is nothing on screen to say the emptiness is the PICTURE's
// rather than the slot's. Knowing which images those are is what lets the grid
// paint the checkerboard every image editor uses to mean exactly this.
//
// Takes the whole list rather than one src, so the grid can ask once at the top
// instead of turning each cell into a component to hold a hook.
// ---------------------------------------------------------------------------

/**
 * The long edge the picture is decoded down to before its alpha is scanned.
 * See `sampleSize` — this is a yes/no question, and a 256px thumbnail answers
 * it for 262KB instead of the 48MB a phone photo's full `ImageData` costs.
 */
const MAX_SAMPLE_EDGE = 256;

/**
 * Answers, keyed by src and kept for the life of the page.
 *
 * MODULE level, not per hook: the same picture appears in the grid, in a
 * remounted grid after an undo, and in any other consumer, and its alpha
 * channel is not going to change.
 */
const resolved = new Map<string, boolean>();

/** Inspections in flight, so two cells asking at once share the one decode. */
const pending = new Map<string, Promise<boolean>>();

/**
 * Every see-through picture found so far, as ONE immutable value that is
 * replaced rather than mutated — which is what `useSyncExternalStore` needs to
 * see a change, and what lets a consumer read the answer during render.
 *
 * A superset of what any one caller asked about, deliberately. The question a
 * consumer actually has is "is THIS picture see-through", and answering it out
 * of a shared store means a grid that remounts, or that gains a slot holding a
 * picture some other grid already inspected, paints the checkerboard on its
 * FIRST frame. Mirroring the cache into per-component state cannot do that
 * without a synchronous setState in an effect — a cascading render, and the one
 * the React compiler rejects.
 */
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
  // A string, because `srcs` is a fresh array on every render — including every
  // pointer move of a reorder. The list's CONTENTS are what the effect depends
  // on.
  const key = srcs.join("\n");

  // The server snapshot is the same empty set: nothing is decoded there, and a
  // checkerboard the client immediately agrees with is not worth a mismatch.
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

/**
 * Whether `src` has anything to see through, decided as cheaply as it can be.
 *
 * Three tiers, in increasing cost. A JPEG cannot carry alpha, so it never
 * touches the network. Anything that can is decoded a SECOND time with
 * `crossOrigin` — the cell's own <img> is loaded without it, and CORS mode is a
 * property of the request rather than of the response, so the picture on screen
 * is unreadable however permissive the bucket is. That copy comes off the HTTP
 * cache in the ordinary case.
 *
 * And if the CORS load fails, the two reasons it can are told apart by loading
 * the picture the way the cell does. Succeeding there means the bucket serves
 * the image but declines to say who may read it — the answer is unknowable, so
 * the checkerboard is ASSUMED, which is invisible if the picture turns out to
 * be opaque (it covers the ground it stands on). Failing there means the src is
 * simply broken, and there is nothing to stand a ground behind.
 */
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
    // BEFORE the src, which is what starts the fetch — setting it afterwards
    // would send the request in the wrong mode.
    if (crossOrigin) image.crossOrigin = crossOrigin;
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function scan(image: HTMLImageElement): boolean {
  const { naturalWidth, naturalHeight } = image;
  // An SVG with no width/height of its own decodes to nothing measurable.
  // Unreadable rather than opaque, and such a file is all but always drawn on
  // a transparent ground anyway.
  if (!naturalWidth || !naturalHeight) return true;

  const { width, height } = sampleSize(
    naturalWidth,
    naturalHeight,
    MAX_SAMPLE_EDGE,
  );
  const canvas = document.createElement("canvas");
  // Sized to the draw EXACTLY. A canvas is born fully transparent, so a single
  // row the picture did not reach would answer the question by itself.
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return true;

  context.drawImage(image, 0, 0, width, height);
  return hasTransparentPixels(context.getImageData(0, 0, width, height).data);
}
