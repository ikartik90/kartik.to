/**
 * Normalise a user-typed link target. A bare host ("google.com") gets an
 * implicit "https://" so it isn't treated as a page-relative path. An explicit
 * scheme ("http://", "https://", "mailto:", "tel:", any "scheme://…"), a
 * root-relative path ("/writing/x"), a fragment ("#foo"), a query ("?q"), or a
 * protocol-relative URL ("//host") is left untouched. A "host:port" like
 * "google.com:8080" still gets "https://" — its dotted prefix marks it as a
 * host, not a scheme.
 */
export function normalizeLinkHref(raw: string): string {
  const href = raw.trim();
  if (!href) return href;
  if (/^(\/|#|\?)/.test(href)) return href;
  const scheme = href.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !scheme[1].includes(".")) return href;
  return `https://${href}`;
}
