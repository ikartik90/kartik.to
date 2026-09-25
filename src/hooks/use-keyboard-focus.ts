"use client";

import { useEffect } from "react";
import { isSyntheticPointer } from "@/utils/synthetic-pointer";

const KEYBOARD_FOCUS_ATTR = "data-keyboard-focus";

function enableKeyboardFocus() {
  document.documentElement.setAttribute(KEYBOARD_FOCUS_ATTR, "");
}

function disableKeyboardFocus() {
  document.documentElement.removeAttribute(KEYBOARD_FOCUS_ATTR);
}

/** Enables focus rings only after the user presses Tab; clears on pointer use. */
export function useKeyboardFocus() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Tab") {
        enableKeyboardFocus();
      }
    }

    // A demo's synthetic presses must not clear the visitor's focus ring.
    function onPointerDown(event: Event) {
      if (isSyntheticPointer(event)) return;
      disableKeyboardFocus();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);
}
