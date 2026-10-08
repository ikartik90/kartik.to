// A control floats over content when it, or a container it rides in, is taken out of the flow
// (sticky, fixed, absolute) with nothing painted between them: whatever passes under it then
// shows through its translucent fill.

const OUT_OF_FLOW = new Set(["sticky", "fixed", "absolute"]);

/** No fill: unset, `transparent`, or an alpha of 0. */
function clear(color: string) {
  return !color || color === "transparent" || /[,/]\s*0(?:\.0+)?\s*\)$/.test(color);
}

function paints(style: CSSStyleDeclaration) {
  return !clear(style.backgroundColor) || (!!style.backgroundImage && style.backgroundImage !== "none");
}

export function floatsOverContent(element: Element): boolean {
  for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    // A surface that moves with it is what shows under it, not the content it passes over.
    if (node !== element && paints(style)) return false;
    if (OUT_OF_FLOW.has(style.position)) return true;
  }
  return false;
}
