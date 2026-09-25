export interface OptionItem {
  value: string;
  label: string;
  /** For an abbreviated label (S M T W T F S): what assistive tech reads instead. */
  ariaLabel?: string;
  disabled?: boolean;
}

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
