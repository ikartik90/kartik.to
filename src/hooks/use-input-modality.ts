"use client";

import { useSyncExternalStore } from "react";
import { isSyntheticPointer } from "@/utils/synthetic-pointer";

// ---------------------------------------------------------------------------
// Which device the user is driving the UI with RIGHT NOW — the "latest mode of
// interaction". A menu opened by typing `/` belongs to the keyboard, and must
// keep belonging to it until the user actually reaches for the mouse; a menu
// opened by clicking belongs to the pointer. Components read this to decide
// whether hover may move a roving highlight, so a cursor that merely happens to
// be parked over the menu can't trap the selection under it.
//
// The subtlety this exists for: a pointer event is NOT proof the pointer moved.
// The engine synthesises `pointerover`/`pointermove` at the unchanged position
// whenever content mounts or scrolls under a stationary cursor — precisely what
// a menu opening under the cursor, or arrow-keying a row into view, does. So a
// pointer event only counts when its coordinates actually CHANGED.
//
// Pointer (not mouse) events, listened for on the document in the CAPTURE
// phase, so the flip is already settled by the time React dispatches the
// `onPointerEnter` it derives from the same `pointerover`. Mouse events are the
// compatibility events that follow the pointer ones — too late to be useful
// here.
// ---------------------------------------------------------------------------

export type InputModality = "pointer" | "keyboard";

const ATTR = "data-input-modality";

/**
 * Pointer by default: before any input there is no keyboard intent to protect,
 * and hover should behave normally. CSS gates on `:not([…="keyboard"])` so the
 * pre-input state, where the attribute is absent, hovers too.
 */
let modality: InputModality = "pointer";
/** Null until the pointer has been seen at all — see {@link handlePointerMotion}. */
let pointerPosition: { x: number; y: number } | null = null;
/**
 * Is the pointer still over the page? Held APART from the position rather than
 * clearing it, because the two answer different questions: anything drawing at
 * the cursor needs "is there a cursor on screen", while {@link
 * handlePointerMotion} needs the last coordinates whether or not the pointer
 * went away, so that a return trip reads as the movement it is rather than as a
 * cold first sighting.
 */
let pointerInWindow = true;

const listeners = new Set<() => void>();

function setModality(next: InputModality) {
  if (modality === next) return;
  modality = next;
  document.documentElement.setAttribute(ATTR, next);
  for (const listener of listeners) listener();
}

/**
 * A modifier on its own is part of whatever gesture is already running —
 * shift-click to extend a range, cmd-click to toggle. Letting it claim the
 * keyboard would kill the hover the user is aiming with.
 */
const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta"]);

function handleKeyDown(event: KeyboardEvent) {
  if (MODIFIERS.has(event.key)) return;
  setModality("keyboard");
}

/** Only a genuine change of position counts — see the note at the top. */
function handlePointerMotion(event: PointerEvent) {
  // A self-playing demo drives a stand-in cursor by dispatching these. It is a
  // performance, not a hand reaching for the mouse, and it does not tell us
  // where the visitor's own pointer is either.
  if (isSyntheticPointer(event)) return;
  pointerInWindow = true;
  const next = { x: event.clientX, y: event.clientY };
  // The FIRST sighting tells us where the pointer is, not that it moved. It
  // typically arrives because a menu opened under a cursor that has been parked
  // there since the page loaded — reading that as "the user reached for the
  // mouse" is the very hijack this module prevents.
  const seen = pointerPosition;
  pointerPosition = next;
  if (!seen) return;
  if (seen.x === next.x && seen.y === next.y) return;
  setModality("pointer");
}

/** A press is unambiguous pointer intent, movement or not — if it is a person's. */
function handlePointerDown(event: PointerEvent) {
  if (isSyntheticPointer(event)) return;
  pointerInWindow = true;
  pointerPosition = { x: event.clientX, y: event.clientY };
  setModality("pointer");
}

/**
 * The pointer left the window — for another window, the browser chrome, a
 * second monitor. There is no cursor on the page to draw beside any more, so
 * {@link getPointerPosition} stops answering until one comes back.
 *
 * `pointerleave` on the ROOT, not `pointerout` with a null `relatedTarget`:
 * leave is subtree-scoped, so it fires for the window boundary and for nothing
 * inside it. `pointerout` also fires when the element under the cursor is
 * removed, which a self-playing demo does constantly.
 *
 * The modality is left alone. Taking the mouse to another window is not the
 * visitor reaching for the keyboard.
 */
function handlePointerLeave() {
  pointerInWindow = false;
}

if (typeof document !== "undefined") {
  const options = { capture: true, passive: true } as const;
  document.addEventListener("keydown", handleKeyDown, options);
  document.addEventListener("pointerover", handlePointerMotion, options);
  document.addEventListener("pointermove", handlePointerMotion, options);
  document.addEventListener("pointerdown", handlePointerDown, options);
  // NOT in the capture phase, unlike the four above. Capture is what makes an
  // ancestor see its descendants' events, which would hand this every leave in
  // the page and undo the subtree scoping it is chosen for. In the bubble phase
  // a `pointerleave` — which does not bubble — reaches the root only when the
  // root is what was left.
  document.documentElement.addEventListener("pointerleave", handlePointerLeave, {
    passive: true,
  });
}

/** The live modality, for event handlers that need it without re-rendering. */
export function getInputModality(): InputModality {
  return modality;
}

/**
 * Where the pointer last was, in client coordinates — lets a menu opening under
 * the cursor find the row it landed on without waiting for a move. Null until
 * the pointer has been seen at all.
 */
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

/** The live modality as reactive state, for components that re-render on it. */
export function useInputModality(): InputModality {
  return useSyncExternalStore(subscribe, getInputModality, () => "pointer");
}
