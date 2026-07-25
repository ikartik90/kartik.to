// ---------------------------------------------------------------------------
// The data + filtering edge of the option list. An option is the smallest unit
// a Combobox / OptionList renders: a stable `value` (what selection reports and
// compares on) and a human `label` (what shows, and what the search matches).
//
// `filterOptions` is the DEFAULT search behaviour — a case-insensitive substring
// match on the label, order-preserving — the counterpart to the calendar's
// `parseCalendarDate`. It's opt-in the same way: a bare OptionList shows every
// option; a Field.Search dropped in front routes its query through this (or a
// consumer-supplied replacement), and the component re-renders the survivors.
// ---------------------------------------------------------------------------

export interface OptionItem {
  /** Stable identity — what `onValueChange` reports and selection compares on. */
  value: string;
  /** The visible text, and what the search filters against. */
  label: string;
  /** Rendered but unselectable (dimmed, skipped by keyboard navigation). */
  disabled?: boolean;
}

/**
 * Keep the options whose label contains `query` (case-insensitive, matched
 * anywhere, whitespace trimmed). An empty/whitespace query keeps them all. The
 * input order is preserved, so the list never reshuffles as you type.
 */
export function filterOptions(
  options: OptionItem[],
  query: string,
): OptionItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;
  return options.filter((option) =>
    option.label.toLowerCase().includes(needle),
  );
}
