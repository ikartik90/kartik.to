"use client";

import { useEffect } from "react";
import { useShaderPresetDraftStore } from "@/store/shader-preset-draft";

export const HISTORY_DEBOUNCE_MS = 500;

/** Whether a press belongs to a field with an undo stack of its own. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    // Compared: `isContentEditable` is absent in jsdom.
    target.isContentEditable === true
  );
}

export function useDraftHistory(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    // A store subscription, not a selector: re-renders would keep restarting the timer.
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
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() !== "z") return;
      // Left to the field's native undo; the press must reach the browser.
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
