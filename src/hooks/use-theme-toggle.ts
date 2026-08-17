"use client";

import { useEffect, useState } from "react";
import { resolveTheme, useThemeStore } from "@/store/theme";

/**
 * Which theme is actually in force, and the switch to the other one.
 *
 * `mounted` is the hydration guard the command palette already runs on the same
 * question: the server has no way to know the visitor's theme — `resolveTheme`
 * answers "light" without a `window` — so a first client render that consulted
 * `matchMedia` would disagree with the HTML it is hydrating. Held to `false`
 * for one commit, both sides render the same thing and the truth lands right
 * after. Anything that must be correct in the FIRST painted frame therefore
 * cannot come from here; that is what the `_dark` condition is for.
 */
export function useThemeToggle() {
  const { mode, setMode } = useThemeStore();

  const [mounted, setMounted] = useState(false);
  // Deliberate mount-flag flip — the one-commit-later render IS the guard.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolveTheme(mode) === "dark";

  return {
    isDark,
    toggle: () => setMode(isDark ? "light" : "dark"),
  };
}
