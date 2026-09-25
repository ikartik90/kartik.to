"use client";

import { useEffect, useState } from "react";
import { resolveTheme, useThemeStore } from "@/store/theme";

/**
 * The theme in force, and a toggle. `isDark` stays false until mounted to match the
 * server HTML; anything needed in the first frame belongs to the `_dark` condition.
 */
export function useThemeToggle() {
  const { mode, setMode } = useThemeStore();

  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolveTheme(mode) === "dark";

  return {
    isDark,
    toggle: () => setMode(isDark ? "light" : "dark"),
  };
}
