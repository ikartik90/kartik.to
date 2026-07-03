"use client";

import { useKeyboardFocus } from "@/hooks/use-keyboard-focus";

export function KeyboardFocusProvider() {
  useKeyboardFocus();
  return null;
}
