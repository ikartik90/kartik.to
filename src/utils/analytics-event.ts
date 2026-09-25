import { isAnalyticsOptedOut } from "./analytics-opt-out";

/** Anchored at both ends: `/editorial` is public. */
const STEALTH_PATHS = [
  /^\/edit(?:\/|$)/,
  /^\/admin(?:\/|$)/,
  /^\/writing\/new$/,
  /^\/writing\/[^/]+\/edit$/,
];

/** `null` when the URL can't be read, which the caller treats as stealth. */
function pathnameOf(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return url.startsWith("/") ? url.split(/[?#]/)[0] : null;
  }
}

/** `beforeSend` for both Vercel packages; the opt-out is read per event, not once at mount. */
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
