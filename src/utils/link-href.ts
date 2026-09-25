/** Adds "https://" to a bare host (host:port included); schemes, paths, fragments and queries pass through. */
export function normalizeLinkHref(raw: string): string {
  const href = raw.trim();
  if (!href) return href;
  if (/^(\/|#|\?)/.test(href)) return href;
  const scheme = href.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !scheme[1].includes(".")) return href;
  return `https://${href}`;
}
