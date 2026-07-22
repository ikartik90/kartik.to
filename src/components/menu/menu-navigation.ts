// ---------------------------------------------------------------------------
// menu-navigation — pure navigation math for the Menu registry.
//
// No React, no DOM. Ordering and visibility are resolved by the caller (the
// registry reads DOM order and item data); these helpers only decide what a
// query matches and where the cursor lands next. Kept pure so the fiddly
// wrap/skip/edge logic is unit-testable in isolation.
// ---------------------------------------------------------------------------

export interface NavItem {
  id: string;
  disabled?: boolean;
}

/**
 * Case-insensitive substring match of `query` against an item's value and
 * keywords. An empty/whitespace query matches everything. Substring — not
 * fuzzy — to preserve the slash menu's existing filter behaviour.
 */
export function matchesQuery(
  value: string,
  keywords: string[] | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  if (value.toLowerCase().includes(q)) return true;
  return (keywords ?? []).some((keyword) => keyword.toLowerCase().includes(q));
}

/**
 * The id the cursor should move to from `currentId` in `direction` over an
 * ordered, already-visible list, skipping disabled items.
 *
 * - From `null`: forward starts at the first enabled item, backward at the last.
 * - At an edge: wraps when `loop`, otherwise stays on the current enabled item.
 * - `currentId` missing from the list (e.g. filtered out) is treated as `null`.
 * - No enabled items: `null`.
 */
export function nextActiveId(
  items: NavItem[],
  currentId: string | null,
  direction: 1 | -1,
  loop: boolean,
): string | null {
  const enabled = items.filter((item) => !item.disabled);
  if (enabled.length === 0) return null;

  const pos = enabled.findIndex((item) => item.id === currentId);
  if (pos === -1) {
    return direction === 1 ? enabled[0].id : enabled[enabled.length - 1].id;
  }

  let next = pos + direction;
  if (next < 0) next = loop ? enabled.length - 1 : 0;
  else if (next >= enabled.length) next = loop ? 0 : enabled.length - 1;
  return enabled[next].id;
}
