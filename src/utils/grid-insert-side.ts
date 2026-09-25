export type GridInsertSide = "before" | "after";

export function nearerInsertSide(
  clientX: number,
  cell: { left: number; width: number },
): GridInsertSide {
  return clientX < cell.left + cell.width / 2 ? "before" : "after";
}
