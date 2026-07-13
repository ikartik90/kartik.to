import type { BlockNode } from "@/domain/nodes";

// ---------------------------------------------------------------------------
// List numbering — the single source of truth for ordered-list ordinals.
//
// Numbered lists are runs of consecutive `list_item` blocks. Three optional
// per-item fields shape the count (all resolved here, never stored statically,
// so the numbers stay live as the document is edited):
//
//   • `marker`   — the run's display style, read from its first item.
//                  "alpha" renders a,b,c… (bijective base-26); default is a
//                  zero-padded decimal.
//   • `continued`— on a run's first item: start one past the PREVIOUS numbered
//                  list's final ordinal rather than at 1. Ignored when no
//                  numbered list precedes this one.
//   • `start`    — an explicit ordinal for THIS item; the run counts on from it.
//                  "reset numbering" writes `start: 1` to restart mid-document.
//
// Both the editor and the read-only renderer consume this so their numbering
// always agrees.
// ---------------------------------------------------------------------------

export type ListMarkerStyle = "decimal" | "alpha";

export interface ListItemNumbering {
  /** Numeric counter value for this item (drives `<li value>` + continuation). */
  ordinal: number;
  /** Rendered marker text — zero-padded decimal or a lowercase letter. */
  label: string;
  /** The run's display style. */
  marker: ListMarkerStyle;
}

/** 1 → "a", 26 → "z", 27 → "aa", 28 → "ab" … (bijective base-26). */
export function toAlpha(n: number): string {
  let out = "";
  let value = n;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    out = String.fromCharCode(97 + remainder) + out;
    value = Math.floor((value - 1) / 26);
  }
  return out || "a";
}

/** Only the fields the numbering algorithm reads — keeps callers flexible.
 *  `marker` is loosened to `string` so any BlockNode (whose marker union also
 *  includes the bullet "check"/"cross" glyphs) satisfies it; only "alpha" is
 *  meaningful here. */
type NumberableBlock = Pick<BlockNode, "type"> & {
  marker?: string;
  continued?: boolean;
  start?: number;
};

/**
 * Compute numbering for every block. Non-`list_item` blocks map to `null`;
 * each `list_item` maps to its resolved ordinal, display label, and run style.
 *
 * The previous numbered run's final ordinal persists across intervening
 * non-list blocks, so "continue numbering" picks up the nearest earlier list.
 */
export function computeListNumbering(
  blocks: NumberableBlock[],
): Array<ListItemNumbering | null> {
  const result: Array<ListItemNumbering | null> = new Array(blocks.length).fill(
    null,
  );
  // Final ordinal of the most recent numbered-list run, or null if none yet.
  let prevListEnd: number | null = null;

  let i = 0;
  while (i < blocks.length) {
    if (blocks[i].type !== "list_item") {
      i++;
      continue;
    }

    // Extent of this contiguous run of list items.
    let j = i;
    while (j < blocks.length && blocks[j].type === "list_item") j++;

    const first = blocks[i];
    const marker: ListMarkerStyle = first.marker === "alpha" ? "alpha" : "decimal";
    const continued = first.continued === true && prevListEnd !== null;

    // First pass: resolve each item's numeric ordinal.
    const ordinals: number[] = [];
    let current = 0;
    for (let k = i; k < j; k++) {
      const item = blocks[k];
      if (item.start != null) {
        current = item.start;
      } else if (k === i) {
        current = continued ? (prevListEnd as number) + 1 : 1;
      } else {
        current += 1;
      }
      ordinals.push(current);
    }

    // Zero-pad decimals to the digit width of the run's largest ordinal.
    const width = String(Math.max(...ordinals)).length;
    for (let idx = 0; idx < ordinals.length; idx++) {
      const ordinal = ordinals[idx];
      const label =
        marker === "alpha"
          ? toAlpha(ordinal)
          : String(ordinal).padStart(width, "0");
      result[i + idx] = { ordinal, label, marker };
    }

    prevListEnd = ordinals[ordinals.length - 1];
    i = j;
  }

  return result;
}
