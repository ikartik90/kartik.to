/** Two labels, so a registrable-domain lookup keeps it. */
export const UNKNOWN_REFERRER = "https://unknown.referrer/";

/** Apps that send no referrer, keyed by the `?ref=` tag on links shared in them. */
const TAGGED_SOURCES = new Map([
  ["discord", "https://discord.com/"],
  ["telegram", "https://telegram.org/"],
  ["whatsapp", "https://whatsapp.com/"],
]);

/** `null` keeps the browser's own referrer. */
export function fallbackReferrer(
  referrer: string,
  search: string,
): string | null {
  if (referrer) return null;
  const tag = new URLSearchParams(search).get("ref")?.toLowerCase() ?? "";
  return TAGGED_SOURCES.get(tag) ?? UNKNOWN_REFERRER;
}

/** Must run before Vercel's script reports its first pageview: it reads `document.referrer` ahead of `beforeSend`. */
export function fillMissingReferrer(): void {
  const referrer = fallbackReferrer(document.referrer, location.search);
  if (referrer) {
    Object.defineProperty(document, "referrer", {
      value: referrer,
      configurable: true,
    });
  }
}
