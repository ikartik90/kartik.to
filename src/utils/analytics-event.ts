// ---------------------------------------------------------------------------
// What the analytics clients are allowed to report.
//
// Two things are never reported: the author's own browsing, and the hidden
// surface they browse it from. The first is `analytics-opt-out.ts` — a mark on
// this browser — and the second is the paths below.
//
// This site has exactly one author and a hidden surface to author on, and the
// two facts make the default wrong in two separate ways. The numbers are
// wrong because every visit to `/edit/*` is me, so the busiest "page" on the
// site would be the one nobody can reach — my own drafting sessions inflating
// my own counts, and spending the plan's event quota to do it. And the point
// of the surface is wrong because `/edit/*` is stealth: `AGENTS.md` says the
// route may not appear in navigation, sitemaps or metadata, and a pageview
// naming `/edit/some-unpublished-slug` is that route's name and an unreleased
// post's, leaving the browser on every keystroke-session I open.
//
// So the events never leave the page. `beforeSend` runs client-side, before
// the request, and returning `null` means nothing is sent at all — not a
// redaction applied at the far end, just no request.
//
// The direction of the doubt is deliberate: anything this cannot read is
// dropped. A pageview lost to a URL shape we did not anticipate costs one
// number in a dashboard; a stealth path sent because the string looked odd
// costs the reason the filter exists.
// ---------------------------------------------------------------------------

import { isAnalyticsOptedOut } from "./analytics-opt-out";

/**
 * The admin surface, as paths.
 *
 * `/edit/*` is the editor proper and `/admin/*` is the prefix `proxy.ts`
 * reserves for it. The two `/writing/*` entries are the editor's older doors
 * — today they only `redirect()` into `/edit/*`, so in practice the browser
 * lands on a path the first pattern already covers, but they are listed
 * because what belongs here is the admin surface, not the subset of it that
 * currently happens to render its own page.
 *
 * Each is anchored at both ends so a prefix alone is not a match: `/editorial`
 * is a public page, and only `/edit` and `/edit/...` are not.
 */
const STEALTH_PATHS = [
  /^\/edit(?:\/|$)/,
  /^\/admin(?:\/|$)/,
  /^\/writing\/new$/,
  /^\/writing\/[^/]+\/edit$/,
];

/**
 * The path part of whatever the vendor script put in `event.url`.
 *
 * Both packages hand `beforeSend` to a remote script and that script builds
 * the URL, so its shape is theirs — absolute today, and not promised. An
 * absolute URL parses; a bare path does not, and is taken as a path only when
 * it actually looks like one. `null` means "could not tell", which the caller
 * treats as stealth.
 */
function pathnameOf(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return url.startsWith("/") ? url.split(/[?#]/)[0] : null;
  }
}

/**
 * A `beforeSend` for both `@vercel/analytics` and `@vercel/speed-insights`:
 * returns the event for a visitor on a public page, and `null` for the admin
 * surface or for the author's own browser.
 *
 * The mark is read per event rather than closed over, because the vendor script
 * is handed this function once at mount and calls it for every pageview after
 * that — including the ones that follow the load on which the author's session
 * resolved and marked the browser.
 *
 * Generic over the event so it satisfies both packages' `BeforeSend` types,
 * which agree on `url` and differ everywhere else.
 */
export function dropPrivateEvents<T extends { url: string }>(
  event: T,
): T | null {
  if (isAnalyticsOptedOut()) return null;

  const pathname = pathnameOf(event.url);
  if (pathname === null) return null;

  // `/edit/` and `/edit` are one page; `/` is the homepage and keeps its slash.
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;

  return STEALTH_PATHS.some((stealth) => stealth.test(path)) ? null : event;
}
