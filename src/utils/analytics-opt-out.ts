// ---------------------------------------------------------------------------
// Whether this browser is the author's.
//
// Vercel has nothing to offer here: no IP filter, no dashboard toggle, and the
// intake script honours no opt-out flag of its own — "excluding your own
// visits" is not a feature of Web Analytics, so the site has to answer the
// question itself. `beforeSend` is the only lever, and returning `null` there
// is the only way an event goes unsent (see `analytics-event.ts`).
//
// That constrains the signal to something readable SYNCHRONOUSLY, inside a
// callback the vendor script invokes as it fires. The session is not that:
// `authClient.useSession()` resolves through a fetch, so anything waiting on it
// would let the first pageview of every cold load through — and that pageview
// is, for most visits, the whole visit. A mark in `localStorage` is available
// before the script has run.
//
// So the mark is written once per browser, the first time the author is seen
// signed in, and then left alone. It is deliberately NOT cleared on sign-out: a
// browser that has ever authored this site is the author's browser, and signing
// out to look at the public pages is exactly the visit that should not be
// counted. `analyticsOptIn()` is the way back, for a shared machine.
// ---------------------------------------------------------------------------

/**
 * Where the mark lives.
 *
 * Exported because it is the contract, not a detail: on a phone, or any browser
 * the author never signs in from, the mark is typed straight into the console
 * — so this string is documentation and has to be findable from the code that
 * reads it.
 */
export const ANALYTICS_OPT_OUT_KEY = "analyticsOptOut";

/**
 * Is this browser excluded from the numbers?
 *
 * Any stored value counts, because a hand-typed mark is as likely to say `true`
 * or `yes` as the `1` the helper writes; only nothing (or an empty string) is
 * the off state. Unreadable storage — Safari's private browsing and anything
 * set to block site data throw on access rather than returning `null` — reads
 * as "not the author", because a visitor whose storage we cannot see is still a
 * visitor and still worth counting.
 */
export function isAnalyticsOptedOut(): boolean {
  try {
    return !!localStorage.getItem(ANALYTICS_OPT_OUT_KEY);
  } catch {
    return false;
  }
}

/**
 * Mark this browser as the author's, or hand it back to the count.
 *
 * Off is the absence of the key rather than a stored `"false"`, which is a
 * truthy string and a trap for the next reader. Never throws: it is called from
 * an effect on every load once the author is signed in, and a full storage is
 * not worth a blank page.
 */
export function setAnalyticsOptOut(optedOut: boolean): void {
  try {
    if (optedOut) localStorage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
    else localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
  } catch {
    // Storage unavailable. Nothing to fall back to, and nothing worth saying.
  }
}
