import { Children, isValidElement, use, type Context, type ReactElement, type ReactNode } from "react";

// A compound component's root finds its parts among its children by type, so they must be its direct children
// (arrays and conditionals are fine; a fragment hides them).

/** The children that are `part` elements. */
export const partsOf = (children: ReactNode, part: unknown) =>
  Children.toArray(children).filter((child): child is ReactElement => isValidElement(child) && child.type === part);

/** The children that are none of `parts`. */
export const restOf = (children: ReactNode, ...parts: unknown[]) =>
  Children.toArray(children).filter((child) => !(isValidElement(child) && parts.includes(child.type)));

type Part = { displayName?: string };

// Each own part and the component it must sit in, so every other component refuses it.
const OWNERS = new WeakMap<Part, string>();

/** Marks `part` as `owner`'s own: `Dropdown.Item` is `Dropdown`'s unless told otherwise. */
export function ownPart<T extends Part>(part: T, owner = part.displayName!.split(".")[0]) {
  OWNERS.set(part, owner);
  return part;
}

/** The error for `part` outside the component it must sit in. */
export const misplaced = (part: Part) => new Error(`${part.displayName} must be used inside ${OWNERS.get(part)}`);

/** `context`'s value; `part` throws without it, being outside the component that provides it. */
export function useOwner<T>(context: Context<T | null>, part: Part): T {
  const value = use(context);
  if (value === null) throw misplaced(part);
  return value;
}

/** Throws for any of `children` that's another component's own part, shown or not. */
export function refuseOthers(children: ReactNode, ...own: Part[]) {
  Children.forEach(children, (child) => {
    const type = isValidElement(child) ? (child.type as Part) : undefined;
    if (type && !own.includes(type) && OWNERS.has(type)) throw misplaced(type);
  });
}

/** The element `children` lead with (an icon), if they lead with one, and the rest. */
export function leadOf(children: ReactNode): [lead: ReactElement | null, rest: ReactNode[]] {
  const all = Children.toArray(children);
  return isValidElement(all[0]) ? [all[0], all.slice(1)] : [null, all];
}

/** The words in `node`, as a label reads them. */
export function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}
