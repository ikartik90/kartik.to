"use client";

import { useEffect } from "react";

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

    function onPointerDown() {
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
