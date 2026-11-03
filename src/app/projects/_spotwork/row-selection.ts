/** A table's rows picked by their checkboxes, and the row whose side sheet is open, which is always picked. */
export type RowSelection = { picked: ReadonlySet<string>; sheet: string | null };

export const NO_ROWS: RowSelection = { picked: new Set(), sheet: null };

/** A press on a row picks it alone and opens its sheet; on the row whose sheet is open, it closes it and unpicks the row. */
export function pressRow({ picked, sheet }: RowSelection, id: string): RowSelection {
  if (sheet !== id) return { picked: new Set([id]), sheet: id };
  const next = new Set(picked);
  next.delete(id);
  return { picked: next, sheet: null };
}

/** A press on checkboxes picks or unpicks `ids`, and closes any open sheet; its row stays picked unless unpicked here. */
export function pressBox({ picked }: RowSelection, ids: string[], on: boolean): RowSelection {
  const next = new Set(picked);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return { picked: next, sheet: null };
}

/** The sheet closing on its own leaves every row picked. */
export function closeSheet({ picked }: RowSelection): RowSelection {
  return { picked, sheet: null };
}
