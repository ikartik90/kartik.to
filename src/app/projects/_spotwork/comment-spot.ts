import type { Spot } from "./comment-edits";

// A pin's spot on the app: the element under it, found again by a path from the app's root.

// Hooks that stay put while the app re-renders, so a path can start from the nearest one.
const KEYS = ["data-tour", "data-worker", "data-shift", "data-check-in-overlay"];

function key(element: Element) {
  const name = KEYS.find((attribute) => element.hasAttribute(attribute));
  if (!name) return null;
  const value = element.getAttribute(name);
  return value ? `[${name}="${value}"]` : `[${name}]`;
}

function pathTo(target: Element, root: Element) {
  const parts: string[] = [];
  for (let node: Element | null = target; node && node !== root; node = node.parentElement) {
    const hook = key(node);
    if (hook) return [hook, ...parts].join(" > ");
    const index = node.parentElement ? [...node.parentElement.children].indexOf(node) + 1 : 1;
    parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
  }
  return [":scope", ...parts].join(" > ");
}

const text = (element: Element) =>
  (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);

function describe(target: Element) {
  const tag = target.tagName.toLowerCase();
  const kind = tag === "textarea" || tag === "input" ? "field" : tag === "img" || tag === "svg" ? "icon" : tag;
  const named = text(target);
  const where = [
    target.closest("[data-check-in-overlay]")?.getAttribute("aria-label"),
    target.closest("[data-worker]") && `${target.closest("[data-worker]")!.getAttribute("data-worker")}'s row`,
    target.closest("[data-shift]")?.getAttribute("data-shift"),
  ].filter(Boolean);
  return `${kind}${named ? ` “${named}”` : ""}${where.length ? ` in ${where.join(", ")}` : ""}`;
}

/** The spot at (x, y) on `target`, or null when it isn't inside the app. */
export function spotAt(target: Element, x: number, y: number, root: Element): Spot | null {
  if (target === root || !root.contains(target)) return null;
  const box = target.getBoundingClientRect();
  const fraction = (offset: number, size: number) => (size ? Math.min(1, Math.max(0, offset / size)) : 0);
  return {
    path: pathTo(target, root),
    what: describe(target),
    x: fraction(x - box.left, box.width),
    y: fraction(y - box.top, box.height),
    viewport: { width: innerWidth, height: innerHeight },
  };
}

/** Where the spot is now, on its element, or null when its element isn't on the page. */
export function pointOf(spot: Spot, root: Element) {
  let element: Element | null = null;
  try {
    element = root.querySelector(spot.path);
  } catch {
    return null;
  }
  if (!element) return null;
  const box = element.getBoundingClientRect();
  return { x: box.left + spot.x * box.width, y: box.top + spot.y * box.height, target: element };
}

/** Whether a dialog or a modal's scrim `target` isn't in lies over (x, y), under the comments. */
export function covered(target: Element, x: number, y: number) {
  const top = document.elementsFromPoint?.(x, y).find((element) => !element.closest("[data-comment]"));
  // A modal's dialog sits in its scrim, so the dialog, nearer, answers for what's in it.
  const layer = top?.closest("[role=dialog], [data-scrim]");
  return !!layer && !layer.contains(target);
}
