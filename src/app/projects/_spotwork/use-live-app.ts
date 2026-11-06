"use client";

import { useEffect, useState } from "react";

export type LiveApp = typeof import("./live-app");

let loaded: LiveApp | undefined;
let loading: Promise<LiveApp> | undefined;

/** Fetches the prototype's code once; a failed fetch is tried again by the next caller. */
export function loadLiveApp() {
  loading ??= import("./live-app").then(
    (app) => (loaded = app),
    (error) => {
      loading = undefined;
      throw error;
    },
  );
  return loading;
}

/**
 * The prototype's code once it has arrived, fetched in the background from when it's `wanted`; at once, if it's here
 * already.
 */
export function useLiveApp(wanted = true) {
  const [app, setApp] = useState(() => loaded);
  useEffect(() => {
    if (app || !wanted) return;
    let mounted = true;
    loadLiveApp().then(
      (next) => mounted && setApp(next),
      () => {},
    );
    return () => {
      mounted = false;
    };
  }, [app, wanted]);
  return app;
}
