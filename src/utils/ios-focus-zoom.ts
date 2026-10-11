const IOS = /iPhone|iPad|iPod/;
const MAX_SCALE = /\s*,?\s*maximum-scale=[^,]*/;

/**
 * iOS Safari zooms into a focused field set below 16px; `maximum-scale=1` stops that and still lets a finger
 * pinch-zoom there. Android honours the cap as a pinch-zoom limit and never zooms on focus, so it is left alone.
 */
export function guardIosFocusZoom(doc: Document, nav: Pick<Navigator, "userAgent" | "maxTouchPoints">) {
  const ios = IOS.test(nav.userAgent) || (nav.userAgent.includes("Macintosh") && nav.maxTouchPoints > 1);
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!ios || !meta) return;
  meta.content = `${meta.content.replace(MAX_SCALE, "")}, maximum-scale=1`;
}
