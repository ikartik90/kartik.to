"use client";

import { useEffect } from "react";
import { useThemeStore, resolveTheme } from "@/store/theme";

export function ThemeProvider() {
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(mode);
      document.documentElement.setAttribute("data-theme", resolved);
    };

    apply();

    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [mode]);

  return null;
}
