// A worker's no-show risk: a level per risk factor, none, low, medium or high, drawn on a spider chart.

export type Level = 0 | 1 | 2 | 3;

export interface RiskScale {
  title: string;
  levels: [string, string, string, string];
  factors: { id: string; label: string }[];
}

const R = 150;
const N_LEVELS = 3;
/** None at the centre, then low, medium and high a third of the way out each. */
export const radius = (level: number) => (R * level) / N_LEVELS;
/** Whether `id` is lit: `hot` is one factor, or every factor at none, space-separated, when the centre is pointed at. */
export const isHot = (hot: string | null | undefined, id: string) => !!hot && hot.split(" ").includes(id);

/** The overall risk, 1 low to 3 high: the share of the most a worker could score, in thirds. */
export function overall(levels: number[]) {
  const share = levels.reduce((a, b) => a + b, 0) / (levels.length * N_LEVELS);
  return (share >= 0.6 ? 3 : share >= 0.3 ? 2 : 1) as 1 | 2 | 3;
}
