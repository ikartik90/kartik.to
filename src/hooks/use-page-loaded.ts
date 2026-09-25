import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (document.readyState === "complete") return () => {};
  window.addEventListener("load", callback);
  return () => window.removeEventListener("load", callback);
}

function getSnapshot(): boolean {
  return document.readyState === "complete";
}

function getServerSnapshot(): boolean {
  return false;
}

/** Whether `load` has fired; `false` during SSR and hydration. */
export function usePageLoaded(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
