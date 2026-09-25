// A synchronous mark, since `beforeSend` can't wait for the session. Deliberately kept on sign-out.

/** Typed into the console by hand on browsers the author never signs in from. */
export const ANALYTICS_OPT_OUT_KEY = "analyticsOptOut";

/** Any stored value counts; unreadable storage reads as "not the author". */
export function isAnalyticsOptedOut(): boolean {
  try {
    return !!localStorage.getItem(ANALYTICS_OPT_OUT_KEY);
  } catch {
    return false;
  }
}

/** Off removes the key, since a stored "false" is truthy. */
export function setAnalyticsOptOut(optedOut: boolean): void {
  try {
    if (optedOut) localStorage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
    else localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
  } catch {
    // Storage unavailable.
  }
}
