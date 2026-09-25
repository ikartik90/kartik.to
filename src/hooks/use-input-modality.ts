"use client";

import { useSyncExternalStore } from "react";
import { isSyntheticPointer } from "@/utils/synthetic-pointer";

// The latest input device. Pointer events count only when coordinates change, since the
// engine fires them at a still cursor when content moves under it.

export type InputModality = "pointer" | "keyboard";

const ATTR = "data-input-modality";

let modality: InputModality = "pointer";
let pointerPosition: { x: number; y: number } | null = null;
// Apart from the position, so a return trip still reads as movement.
let pointerInWindow = true;

const listeners = new Set<() => void>();

function setModality(next: InputModality) {
  if (modality === next) return;
  modality = next;
  document.documentElement.setAttribute(ATTR, next);
  for (const listener of listeners) listener();
}

// A lone modifier belongs to a pointer gesture (shift-click), not keyboard intent.
const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta"]);

function handleKeyDown(event: KeyboardEvent) {
  if (MODIFIERS.has(event.key)) return;
  setModality("keyboard");
}

function handlePointerMotion(event: PointerEvent) {
  if (isSyntheticPointer(event)) return;
  pointerInWindow = true;
  const next = { x: event.clientX, y: event.clientY };
  // A first sighting is a position, not a movement.
  const seen = pointerPosition;
  pointerPosition = next;
  if (!seen) return;
  if (seen.x === next.x && seen.y === next.y) return;
  setModality("pointer");
}

function handlePointerDown(event: PointerEvent) {
  if (isSyntheticPointer(event)) return;
  pointerInWindow = true;
  pointerPosition = { x: event.clientX, y: event.clientY };
  setModality("pointer");
}

// `pointerleave` on the root, not `pointerout`, which also fires when a demo removes the hovered element.
function handlePointerLeave() {
  pointerInWindow = false;
}

if (typeof document !== "undefined") {
  const options = { capture: true, passive: true } as const;
  document.addEventListener("keydown", handleKeyDown, options);
  document.addEventListener("pointerover", handlePointerMotion, options);
  document.addEventListener("pointermove", handlePointerMotion, options);
  document.addEventListener("pointerdown", handlePointerDown, options);
  // Bubble phase, not capture: capture would deliver every descendant's leave.
  document.documentElement.addEventListener("pointerleave", handlePointerLeave, {
    passive: true,
  });
}

export function getInputModality(): InputModality {
  return modality;
}

/** Last client position; null when the pointer is off the page or not yet seen. */
export function getPointerPosition(): { x: number; y: number } | null {
  return pointerInWindow ? pointerPosition : null;
}

/** Test-only: forget the tracked modality and pointer position. */
export function resetInputModality(): void {
  modality = "pointer";
  pointerPosition = null;
  pointerInWindow = true;
  if (typeof document !== "undefined") {
    document.documentElement.removeAttribute(ATTR);
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useInputModality(): InputModality {
  return useSyncExternalStore(subscribe, getInputModality, () => "pointer");
}
