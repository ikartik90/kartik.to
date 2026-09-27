// Slides sit in one row, `gap` apart; a slide's place is its index in the row.

function lefts(widths: readonly number[], gap: number, order: number[]) {
  const at: number[] = [];
  let left = 0;
  for (const index of order) {
    at[index] = left;
    left += widths[index] + gap;
  }
  return at;
}

function moved(count: number, from: number, to: number) {
  const order = Array.from({ length: count }, (_, index) => index);
  order.splice(from, 1);
  order.splice(to, 0, from);
  return order;
}

/** How far each slide travels, by its index in the row, when `from` is moved to `to`. */
export function reorderShifts(
  widths: readonly number[],
  gap: number,
  from: number,
  to: number,
): number[] {
  const count = widths.length;
  const before = lefts(widths, gap, moved(count, from, from));
  const after = lefts(widths, gap, moved(count, from, to));
  return widths.map((_, index) => after[index] - before[index]);
}

/**
 * Where a carried slide belongs: past each neighbour whose middle the pointer has crossed.
 * `x` is in the track, measured from the first slide's left edge at `origin`.
 */
export function reorderTarget({
  widths,
  gap,
  origin,
  from,
  to,
  x,
}: {
  widths: readonly number[];
  gap: number;
  origin: number;
  from: number;
  to: number;
  x: number;
}): number {
  const centre = (order: number[], place: number) =>
    origin +
    lefts(widths, gap, order)[order[place]] +
    widths[order[place]] / 2;

  let place = to;
  for (;;) {
    const order = moved(widths.length, from, place);
    if (place < widths.length - 1 && x > centre(order, place + 1)) place += 1;
    else if (place > 0 && x < centre(order, place - 1)) place -= 1;
    else return place;
  }
}

/** px/ms along one axis: negative towards the start edge, positive towards the end, ramping up across `zone`. */
export function edgeScrollSpeed({
  at,
  start,
  end,
  zone,
  max,
}: {
  at: number;
  start: number;
  end: number;
  zone: number;
  max: number;
}): number {
  const ramp = (distance: number) =>
    Math.min(Math.max((zone - distance) / zone, 0), 1) ** 2 * max;
  const back = ramp(at - start);
  const on = ramp(end - at);
  if (back > 0) return -back;
  return on > 0 ? on : 0;
}

/** The scroll that keeps the same share of a slide under the pointer, `pointer` px into the scroller. */
export function scrollToKeep({
  start,
  width,
  share,
  pointer,
  max,
}: {
  start: number;
  width: number;
  share: number;
  pointer: number;
  max: number;
}): number {
  return Math.max(Math.min(start + share * width - pointer, max), 0);
}

/** The rest offset nearest `anchored` that shows the slide at `start` whole, else the nearest. */
export function settleOffset({
  offsets,
  anchored,
  start,
  width,
  viewport,
}: {
  offsets: readonly number[];
  anchored: number;
  start: number;
  width: number;
  viewport: number;
}): number {
  const nearest = (candidates: readonly number[]) =>
    candidates.reduce((best, offset) =>
      Math.abs(offset - anchored) < Math.abs(best - anchored) ? offset : best,
    );
  const showing = offsets.filter(
    (offset) => offset <= start && start + width <= offset + viewport,
  );
  return nearest(showing.length > 0 ? showing : offsets);
}
