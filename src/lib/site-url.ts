// ---------------------------------------------------------------------------
// Where this site lives — the one absolute URL the rest of the app hangs off.
//
// Nothing on a page needs it: every link in the markup is a path, and a path is
// resolved by the browser against whatever it is being served from. What needs
// it is everything the page says about ITSELF to something that is not a
// browser — `og:url`, `og:image`, the canonical link. Those are read by a
// crawler that has no page to resolve a path against, so they must be absolute,
// which means somebody has to know the origin.
//
// Three answers in order, and the order is the point. The site's own domain
// wins outright where it is configured: a link shared out of a preview
// deployment should point at the real site, because the preview URL is a build
// artefact that will 404 in a week and the canonical URL is not. Failing that,
// the project's production domain, so a project nobody has configured still
// describes itself as its live self. Failing THAT, this deployment, so a
// preview at least describes itself rather than describing localhost.
// ---------------------------------------------------------------------------

/** Where the site is while it is being written. */
export const DEV_SITE_URL = "http://localhost:3000";

/** Vercel reports bare hosts; a `metadataBase` needs a URL. */
function asUrl(value: string): string {
  const withScheme = /^https?:\/\//.test(value) ? value : `https://${value}`;
  // No trailing slash: every caller appends a path to it, and `//writing/x` is
  // a different URL from `/writing/x` to anything that compares strings — which
  // is most of the crawlers this exists for.
  return withScheme.replace(/\/+$/, "");
}

/**
 * The site's origin, from the environment as the host reports it.
 *
 * Takes the variables rather than reading `process.env` so the precedence can
 * be tested; `SITE_URL` below is the one real call.
 */
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

/**
 * Read at module load, and written out in full rather than indexed, because
 * `NEXT_PUBLIC_` variables are substituted into the bundle by the compiler at
 * build time — it matches the literal `process.env.NEXT_PUBLIC_SITE_URL` in the
 * source, and a dynamic lookup is simply not there to substitute.
 */
export const SITE_URL = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
});
