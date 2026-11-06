"use client";

import { useSyncExternalStore } from "react";
import { useLoadedAndIdle } from "@/hooks/use-loaded-and-idle";
import { firstFoldHeld, subscribeFirstFold } from "@/utils/first-fold";

/** True once the page has loaded and gone idle and the first fold's own work is done: the time for what can wait. */
export function useFirstFoldSettled(): boolean {
  const free = useSyncExternalStore(subscribeFirstFold, () => !firstFoldHeld(), () => false);
  return useLoadedAndIdle() && free;
}
