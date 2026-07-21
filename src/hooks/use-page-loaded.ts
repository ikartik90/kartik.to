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

/**
 * Whether the browser has fired the `load` event (all initial page resources
 * fetched). Returns `false` during SSR and hydration — so it is hydration-safe —
 * then reflects the real load state on the client. Demo frames use it to defer
 * their own asset/code loading until the page itself is done.
 */
export function usePageLoaded(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
