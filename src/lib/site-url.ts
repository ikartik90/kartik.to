// The absolute origin for og:url, og:image and canonical links. Precedence: the configured
// domain, then Vercel's production domain, then this deployment (a preview's URL goes stale).

export const DEV_SITE_URL = "http://localhost:3000";

/** Vercel reports bare hosts; a `metadataBase` needs a URL. */
function asUrl(value: string): string {
  const withScheme = /^https?:\/\//.test(value) ? value : `https://${value}`;
  // No trailing slash: callers append paths, and `//writing` differs from `/writing` to crawlers.
  return withScheme.replace(/\/+$/, "");
}

/** Takes the variables rather than reading `process.env`, so the precedence is testable. */
export function resolveSiteUrl(env: {
  NEXT_PUBLIC_SITE_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
}): string {
  const configured =
    env.NEXT_PUBLIC_SITE_URL ||
    env.VERCEL_PROJECT_PRODUCTION_URL ||
    env.VERCEL_URL;
  return configured ? asUrl(configured) : DEV_SITE_URL;
}

// Each variable written out in full: `NEXT_PUBLIC_` values are substituted at build time by literal match.
export const SITE_URL = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
});
