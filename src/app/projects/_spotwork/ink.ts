"use client";

import { useLayoutEffect, useRef } from "react";

/** Where a glyph's ink reaches from its origin: along the line, and above and below the baseline. */
export type Ink = { left: number; right: number; top: number; bottom: number };

/** How far to move a letter starting at `origin` so its ink, not its line, sits in the middle of `box`. */
export function centringOf(box: { width: number; height: number }, origin: { left: number; baseline: number }, ink: Ink) {
  return {
    x: box.width / 2 - (origin.left + (ink.left + ink.right) / 2),
    y: box.height / 2 - (origin.baseline + (ink.bottom - ink.top) / 2),
  };
}

const SCALE = 8;
let canvas: CanvasRenderingContext2D | null | undefined;

/** `text`'s ink in `font`, read from its pixels: browsers' own measures give the advance, not the ink. */
function inkOf(font: string, text: string): Ink | null {
  canvas ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!canvas || !text) return null;
  canvas.font = font;
  const metrics = canvas.measureText(text);
  const ascent = metrics.fontBoundingBoxAscent;
  const pad = 4;
  const width = Math.ceil((metrics.width + 2 * pad) * SCALE);
  const height = Math.ceil((ascent + metrics.fontBoundingBoxDescent + 2 * pad) * SCALE);
  canvas.canvas.width = width;
  canvas.canvas.height = height;
  canvas.font = font;
  canvas.scale(SCALE, SCALE);
  canvas.fillText(text, pad, pad + ascent);
  const { data } = canvas.getImageData(0, 0, width, height);
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] >= 128) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < 0) return null;
  return {
    left: left / SCALE - pad,
    right: (right + 1) / SCALE - pad,
    top: pad + ascent - top / SCALE,
    bottom: (bottom + 1) / SCALE - pad - ascent,
  };
}

/**
 * A ref for a box whose only child is a letter (`text`): moves the letter so its ink sits in the middle of the box,
 * once its font has loaded too.
 */
export function useCentredInk<T extends HTMLElement>(text: unknown) {
  const box = useRef<T>(null);
  useLayoutEffect(() => {
    const centre = () => {
      const outer = box.current;
      const letter = outer?.firstElementChild as HTMLElement | null | undefined;
      if (!outer || !letter || !outer.offsetWidth) return;
      letter.style.translate = "";
      const style = getComputedStyle(outer);
      const ink = inkOf(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, letter.textContent ?? "");
      if (!ink) return;
      // The line's start, and its baseline: an empty box sits on it, but WebKit draws the letter a whole pixel of ascent
      // under the line's top.
      const range = document.createRange();
      range.selectNodeContents(letter);
      const line = range.getBoundingClientRect();
      const start = line.left;
      const marker = document.createElement("span");
      marker.style.cssText = "display: inline-block; width: 0; height: 0";
      letter.append(marker);
      const baseline = line.top + Math.round(marker.getBoundingClientRect().bottom - line.top);
      marker.remove();
      // In the box's own pixels, unrounded, whatever scale it's drawn at.
      const width = parseFloat(style.width);
      const height = parseFloat(style.height);
      const drawn = outer.getBoundingClientRect();
      const scale = drawn.width / width;
      const { x, y } = centringOf(
        { width, height },
        { left: (start - drawn.left) / scale, baseline: (baseline - drawn.top) / scale },
        ink,
      );
      // WebKit draws a letter on whole device pixels down and half ones across, and drops any part of a move short of
      // one, so it moves by whole steps from where it's drawn to the step nearest the middle.
      const dpr = window.devicePixelRatio || 1;
      const steps = (from: number, by: number, perPx: number) => {
        const move = Math.round((from + by) * perPx) - Math.round(from * perPx);
        return (move + Math.sign(move) * 0.01) / perPx / scale;
      };
      letter.style.translate = `${steps(start, x * scale, dpr * 2)}px ${steps(baseline, y * scale, dpr)}px`;
    };
    centre();
    document.fonts?.ready.then(centre);
  }, [text]);
  return box;
}
