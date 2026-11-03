// Which toolbar items fold into the overflow menu at a given bar width. Widths and gaps are SW Curie 25726:30182's.

export type ItemId = "sidebar" | "back" | "forward" | "favorites" | "history" | "share" | "newTab" | "tabs";
export type Cluster = "start" | "middle" | "end";

/** In toolbar order. `gap` is the space before an item that follows another in its cluster. */
export const ITEMS: { id: ItemId; cluster: Cluster; width: number; height: number; gap: number }[] = [
  { id: "sidebar", cluster: "start", width: 33, height: 17, gap: 29 },
  { id: "back", cluster: "start", width: 11, height: 17, gap: 24 },
  { id: "forward", cluster: "start", width: 11, height: 17, gap: 12 },
  { id: "favorites", cluster: "middle", width: 19, height: 17, gap: 12 },
  { id: "history", cluster: "middle", width: 17, height: 17, gap: 12 },
  { id: "share", cluster: "end", width: 16, height: 17, gap: 12 },
  { id: "newTab", cluster: "end", width: 15, height: 17, gap: 12 },
  { id: "tabs", cluster: "end", width: 17, height: 17, gap: 12 },
];

/** First folded first: from the menu's end of the bar inward. */
export const HIDE_ORDER: ItemId[] = ["tabs", "newTab", "share", "history", "favorites", "forward", "back", "sidebar"];

export const PADDING = 10;
export const WINDOW_CONTROLS = 47.5;
/** The least space either side of the middle cluster: the sidebar button's gap to Back. */
export const MIN_GAP = 24;
/** Between the middle cluster's icons and the address field. */
export const FIELD_GAP = 8;
export const FIELD_MAX = 600;
export const MENU = { width: 15, gap: 12 };

function clusterWidth(items: typeof ITEMS, lead = 0) {
  return items.reduce((sum, item, i) => sum + (i > 0 || lead > 0 ? item.gap : 0) + item.width, lead);
}

function needed(hidden: ItemId[], fieldMin: number) {
  const shown = (cluster: Cluster) => ITEMS.filter((item) => item.cluster === cluster && !hidden.includes(item.id));
  const middle = shown("middle");
  const end = clusterWidth(shown("end"));
  const menu = hidden.length ? (end ? MENU.gap : 0) + MENU.width : 0;
  return (
    PADDING * 2 +
    clusterWidth(shown("start"), WINDOW_CONTROLS) +
    MIN_GAP +
    clusterWidth(middle) +
    (middle.length ? FIELD_GAP : 0) +
    fieldMin +
    MIN_GAP +
    end +
    menu
  );
}

/** The fewest items to fold so the bar fits `width`, the address field at least `fieldMin` wide. */
export function hiddenItems(width: number, fieldMin: number): ItemId[] {
  for (let count = 0; count < HIDE_ORDER.length; count++) {
    const hidden = HIDE_ORDER.slice(0, count);
    if (needed(hidden, fieldMin) <= width) return hidden;
  }
  return HIDE_ORDER;
}
