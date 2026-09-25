import type { BlockNode } from "@/domain/nodes";

// A run's first item sets `marker` ("alpha" = a, b, c…) and `continued` (one past the
// previous numbered list); `start` sets an item's own ordinal and the run counts on.

export type ListMarkerStyle = "decimal" | "alpha";

export interface ListItemNumbering {
  ordinal: number;
  label: string;
  marker: ListMarkerStyle;
}

/** 1 → "a", 26 → "z", 27 → "aa" (bijective base-26). */
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

/** `marker` is loosened to `string` so any `BlockNode` satisfies it. */
type NumberableBlock = Pick<BlockNode, "type"> & {
  marker?: string;
  continued?: boolean;
  start?: number;
};

export function computeListNumbering(
  blocks: NumberableBlock[],
): Array<ListItemNumbering | null> {
  const result: Array<ListItemNumbering | null> = new Array(blocks.length).fill(
    null,
  );
  let prevListEnd: number | null = null;

  let i = 0;
  while (i < blocks.length) {
    if (blocks[i].type !== "list_item") {
      i++;
      continue;
    }

    let j = i;
    while (j < blocks.length && blocks[j].type === "list_item") j++;

    const first = blocks[i];
    const marker: ListMarkerStyle = first.marker === "alpha" ? "alpha" : "decimal";
    const continued = first.continued === true && prevListEnd !== null;

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
