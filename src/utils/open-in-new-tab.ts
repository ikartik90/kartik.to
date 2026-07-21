/**
 * Open `url` in a new browser tab, reliably.
 *
 * `window.open(url, "_blank")` is silently pop-up-blocked by some browsers even
 * when called from a genuine user gesture — e.g. when the site's "Pop-ups and
 * redirects" permission is set to Block, the call just returns `null` and
 * nothing opens. A *user-activated anchor navigation* is not treated as a
 * pop-up, so we create a transient `<a target="_blank">`, click it, and remove
 * it. `rel="noopener noreferrer"` severs the opener reference (security + perf).
 *
 * The anchor must be attached to the document when clicked for the navigation
 * to fire in some engines, hence the append/remove around `click()`.
 */
export function openInNewTab(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
