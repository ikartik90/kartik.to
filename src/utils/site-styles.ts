import { preinit } from "react-dom";

let loading: Promise<void> | undefined;

const added = (href: string) =>
  new Promise<void>((resolve) => {
    preinit(href, { as: "style", precedence: "site" });
    const link = document.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][href="${href}"]`);
    if (!link || link.sheet) return resolve();
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener("error", () => resolve(), { once: true });
  });

/**
 * Adds the whole site's stylesheet, which what a page loads later is styled from: each page's own holds only its first
 * load's. It goes after every page's own, so its order wins over any a past page's left behind. Resolves once it has
 * loaded or failed; at once where there is none, as in dev, where every page has it all.
 */
export function loadSiteStyles(href = process.env.SITE_STYLES_HREF): Promise<void> {
  if (!href) return Promise.resolve();
  // Downloaded first, then added from the cache: while a stylesheet is pending, WebKit applies no `<style>` added since.
  loading ??= fetch(href)
    .then((response) => response.blob())
    .catch(() => {})
    .then(() => added(href));
  return loading;
}
