"use client";

import { useEffect } from "react";
import { guardIosFocusZoom } from "@/utils/ios-focus-zoom";

// After hydration: React would report the viewport tag's changed content as a mismatch.
export function IosFocusZoomGuard() {
  useEffect(() => guardIosFocusZoom(document, navigator), []);
  return null;
}
