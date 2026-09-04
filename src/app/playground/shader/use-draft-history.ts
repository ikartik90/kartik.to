"use client";

import { useEffect } from "react";
import { useShaderPresetDraftStore } from "@/store/shader-preset-draft";
import { isTextEntry } from "@/utils/is-text-entry";

// ---------------------------------------------------------------------------
// ⌘Z / ⌘⇧Z on the shader playground.
//
// Two halves of one job: WHEN a step is recorded, and what the keys do with the
// stack. The stack itself is the store's (see `pushHistory` there) — this is
// the surface that drives it, and it is local to this route because it knows
// the playground's own answers to both questions.
//
// The recording is a DEBOUNCE over the picture rather than a call inside each
// action, and that is the whole design. A slider drag emits a value per frame;
// pushing per action would put a hundred steps between two meaningful ones and
// make ⌘Z useless exactly where it is most wanted. Watching the picture instead
// means every edit is covered — including ones added later — without each
// action having to remember to record itself.
//
// It is safe to fire freely because the store drops a push that changes
// nothing: the debounce landing after an undo records the restored state,
// finds it is already the step it stands on, and stops. That is what keeps the
// redo stack from being trimmed off by the very restore that made it.
// ---------------------------------------------------------------------------

/**
 * How long the picture must hold still before it counts as a step.
 *
 * The article editor's own figure, for the same reason it picked it: long
 * enough that a drag or a burst of typing is one entry, short enough that two
 * deliberate edits are never folded into one.
 */
export const HISTORY_DEBOUNCE_MS = 500;

export function useDraftHistory(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Subscribed to the STORE, not to the picture through a selector. Keyed on
    // React's render identity instead, the timer restarts on every render that
    // hands back a fresh `settings` object — and on a page with a shader
    // animating under it and a strip re-photographing itself after every edit,
    // that is a great many renders. The push then lands seconds late or not at
    // all, so ⌘Z pressed straight after an edit finds nothing to step back to.
    // A store subscription fires only when the state actually moves.
    const unsubscribe = useShaderPresetDraftStore.subscribe(
      (draft, previous) => {
        if (
          draft.settings === previous.settings &&
          draft.shaderId === previous.shaderId &&
          draft.editedAspects === previous.editedAspects
        ) {
          return;
        }
        if (timer) clearTimeout(timer);
        timer = setTimeout(
          () => useShaderPresetDraftStore.getState().pushHistory(),
          HISTORY_DEBOUNCE_MS,
        );
      },
    );

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // `metaKey || ctrlKey` rather than a platform test: the site is one
      // build, and a Windows keyboard reaching for ⌃Z means the same thing.
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() !== "z") return;
      // A field's own undo is the one the author means while the caret is in
      // it — the hex box, the title. Left alone, not merely unhandled: the
      // press has to reach the browser for the native stack to see it.
      if (isTextEntry(event.target)) return;

      event.preventDefault();
      const draft = useShaderPresetDraftStore.getState();
      if (event.shiftKey) draft.redo();
      else draft.undo();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
