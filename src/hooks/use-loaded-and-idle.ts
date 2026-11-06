"use client";

import { useEffect, useState } from "react";
import { usePageLoaded } from "@/hooks/use-page-loaded";
import { whenIdle } from "@/utils/when-idle";

const IDLE_TIMEOUT_MS = 2000;

/** True from when the browser first goes idle after the page's `load`: the time for work the first paint doesn't need. */
export function useLoadedAndIdle(): boolean {
  const pageLoaded = usePageLoaded();
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (pageLoaded && !idle) return whenIdle(() => setIdle(true), IDLE_TIMEOUT_MS);
  }, [pageLoaded, idle]);
  return idle;
}
