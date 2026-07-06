"use client";

import { useCustomCursor } from "@/hooks/use-custom-cursor";

export function CustomCursorProvider() {
  useCustomCursor();
  return null;
}
