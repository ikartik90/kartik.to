/** An anchor click, not `window.open`, which pop-up blockers can drop; the anchor must be attached to fire. */
export function openInNewTab(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
