"use client";

import {
  Children,
  cloneElement,
  createContext,
  Fragment,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cx } from "../../../../styled-system/css";
import { optionList } from "../../../../styled-system/recipes";
import { filterOptions, type OptionItem } from "@/utils/option-filter";
import { Field, useField, type FieldSearchProps } from "./field";

// ---------------------------------------------------------------------------
// OptionList — the composable listbox behind a Combobox, and a stand-alone,
// always-open select on its own. The Calendar of the select family.
//
//   <OptionList value={value} onValueChange={setValue}>
//     <Field.Search placeholder="Search…" />          {/* optional filter row */}
//     <OptionList.Options>
//       {fruits.map((f) => (
//         <OptionList.Option key={f.value} value={f.value}>
//           {f.icon}
//           {f.label}
//         </OptionList.Option>
//       ))}
//     </OptionList.Options>
//   </OptionList>
//
// Options are AUTHORED as children — one `<OptionList.Option value=…>` each, like
// a native `<option>` or a Radix `Select.Item`, so a row can compose an icon +
// label (or anything) instead of squeezing into a data-shape prop. The root reads
// the tree to recover the ordered option DATA (value / label / disabled) it needs
// for filtering, selection and the roving highlight, and hands each part what it
// needs through context; `Options` renders just the options that survive the
// filter. Every option button surfaces its state — aria-selected, data-active
// (the keyboard/hover highlight), :disabled — as attributes, so the look is fully
// re-skinnable off selectors, exactly like the calendar's day cells.
//
// A dropped-in `Field.Search` (opt-in, like the calendar's) filters the list:
// the root reads its raw query and re-renders the survivors. With focus in the
// search, ArrowUp/Down move the highlight (announced via aria-activedescendant,
// focus stays put) and Enter commits it — the combobox interaction. With focus
// in the list itself (no search), the same keys rove real button focus instead.
// ---------------------------------------------------------------------------

type OptionListStyles = ReturnType<typeof optionList>;

type OptionListContextValue = {
  styles: OptionListStyles;
  /** Values that pass the current filter — what `Options` renders. */
  filteredValues: Set<string>;
  selected: string | null;
  /** The single highlighted option (query/hover/arrow ▸ selected ▸ first). */
  activeValue: string | null;
  select: (value: string) => void;
  /** Move the highlight by ±1 enabled option; `focus` roves real button focus. */
  moveActive: (delta: 1 | -1, focus: boolean) => void;
  optionId: (value: string) => string;
  listboxId: string;
  labelId: string;
  hasLabel: boolean;
  hintId: string;
  hasHint: boolean;
  emptyLabel: string;
};

const OptionListContext = createContext<OptionListContextValue | null>(null);

function useOptionList(component: string): OptionListContextValue {
  const ctx = useContext(OptionListContext);
  if (!ctx) throw new Error(`${component} must be used within <OptionList>.`);
  return ctx;
}

// --- Reading the option DATA back out of the authored children ------------

function isOption(
  node: ReactNode,
): node is ReactElement<OptionListOptionProps> {
  return isValidElement(node) && node.type === OptionListOption;
}

/**
 * The searchable + trigger-display text for an option. An explicit `label` prop
 * wins; otherwise a plain-string child IS the label (the common `<Option
 * value="a">Apple</Option>` case); for richer children (icon + text) the string
 * parts are joined, falling back to the value so search never sees `undefined`.
 */
function optionLabel(props: OptionListOptionProps): string {
  if (typeof props.label === "string") return props.label;
  if (typeof props.children === "string" || typeof props.children === "number") {
    return String(props.children);
  }
  const text = Children.toArray(props.children)
    .filter(
      (child): child is string | number =>
        typeof child === "string" || typeof child === "number",
    )
    .join("");
  return text.trim() || props.value;
}

/**
 * Recover the ordered option data from the tree — drilling through the
 * `OptionList.Options` wrapper and any fragments a `.map()` produces. Runs during
 * render (no mount/registration race), the way the calendar reads its own
 * structure. Later duplicate values are ignored so `getElementById(optionId)`
 * stays unambiguous.
 */
export function collectOptions(children: ReactNode): OptionItem[] {
  const out: OptionItem[] = [];
  const seen = new Set<string>();
  const visit = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === OptionListOption) {
        const props = child.props as OptionListOptionProps;
        if (seen.has(props.value)) return;
        seen.add(props.value);
        out.push({
          value: props.value,
          label: optionLabel(props),
          disabled: !!props.disabled,
        });
      } else if (
        child.type === OptionListOptions ||
        child.type === Fragment
      ) {
        visit((child.props as { children?: ReactNode }).children);
      }
    });
  };
  visit(children);
  return out;
}

export interface OptionListProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** Controlled selection (an option `value`). */
  value?: string | null;
  /** Initial selection when uncontrolled. */
  defaultValue?: string | null;
  /** Fired with the picked option's `value`. */
  onValueChange?: (value: string) => void;
  /**
   * How a dropped-in `Field.Search`'s query narrows the options. Defaults to a
   * case-insensitive label substring match ({@link filterOptions}); pass your
   * own for fuzzy / value / multi-field matching. Ignored without a Field.Search.
   */
  filter?: (options: OptionItem[], query: string) => OptionItem[];
  /** Row shown when the filter leaves nothing. */
  emptyLabel?: string;
  /**
   * Retint for the surface it sits on. `default` = standalone self-framed
   * surface; `onBrand` = the Combobox popover's brand-tinted surface (palette
   * inverts).
   */
  tone?: "default" | "onBrand";
  /** `OptionList.Options` (wrapping `OptionList.Option`s) and an optional Field.Search. */
  children: ReactNode;
}

function OptionListRoot({
  value,
  defaultValue,
  onValueChange,
  filter = filterOptions,
  emptyLabel = "No results",
  tone = "default",
  className,
  children,
  ...rest
}: OptionListProps) {
  // Like the interactive Calendar, this is always a field control, so it
  // hard-consumes the field wiring; as a compound group it associates via
  // aria-labelledby/-describedby (a listbox is labelled, not `htmlFor`-linked).
  const { labelId, hasLabel, hintId, hasHint } = useField("OptionList");
  const styles = optionList({ tone });
  const uid = useId();

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string | null>(defaultValue ?? null);
  const selected = isControlled ? (value ?? null) : internal;

  const [query, setQuery] = useState("");
  // What the last arrow/hover moved to — outranks the selection as the highlight
  // (it's what Enter would commit), but only while it survives the filter.
  const [active, setActive] = useState<string | null>(null);

  // The authored options, read back from the child tree.
  const options = useMemo(() => collectOptions(children), [children]);
  const filtered = useMemo(
    () => filter(options, query),
    [filter, options, query],
  );
  const filteredValues = useMemo(
    () => new Set(filtered.map((option) => option.value)),
    [filtered],
  );
  const enabled = useMemo(
    () => filtered.filter((option) => !option.disabled),
    [filtered],
  );

  const isEnabled = (value: string | null) =>
    value != null && enabled.some((option) => option.value === value);
  // Highlight precedence — a live arrow/hover, then the selection, then the
  // first selectable row — always resolving to an ENABLED option (or nothing).
  const activeValue = isEnabled(active)
    ? active
    : isEnabled(selected)
      ? selected
      : (enabled[0]?.value ?? null);

  const optionId = (value: string) =>
    `${uid}-opt-${value.replace(/[^\w-]/g, "_")}`;

  const select = (value: string) => {
    const option = filtered.find((option) => option.value === value);
    if (!option || option.disabled) return;
    if (!isControlled) setInternal(value);
    onValueChange?.(value);
  };

  const moveActive = (delta: 1 | -1, focus: boolean) => {
    if (enabled.length === 0) return;
    const from = enabled.findIndex((option) => option.value === activeValue);
    const next = Math.min(Math.max(from + delta, 0), enabled.length - 1);
    const value = enabled[next].value;
    setActive(value);
    // Rove real focus onto the newly-active option by its stable id (each
    // OptionList's uid keeps these unique across instances) — the option is
    // already in the DOM, so this needs no ref and stays render-safe.
    if (focus) document.getElementById(optionId(value))?.focus();
  };

  const ctx: OptionListContextValue = {
    styles,
    filteredValues,
    selected,
    activeValue,
    select,
    moveActive,
    optionId,
    listboxId: `${uid}-listbox`,
    labelId,
    hasLabel,
    hintId,
    hasHint,
    emptyLabel,
  };

  // Enter commits the current highlight; arrows move it. The search KEEPS focus
  // (the highlight is virtual, carried by aria-activedescendant) so type-ahead
  // and navigation compose — you never have to leave the input to pick a row.
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1, false);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1, false);
    } else if (event.key === "Enter" && activeValue) {
      event.preventDefault();
      select(activeValue);
    }
  };

  // Dress a Field.Search dropped directly under <OptionList>: give it the
  // `search` slot, turn it into the listbox's combobox input (aria-*), and route
  // its raw query into the filter. A fresh query resets the arrow highlight so it
  // re-resolves to the first survivor. Everything else is passed through.
  const dressed = Children.map(children, (child) => {
    if (isValidElement(child) && child.type === Field.Search) {
      const el = child as ReactElement<FieldSearchProps<string>>;
      return cloneElement(el, {
        className: cx(styles.search, el.props.className),
        role: "combobox",
        "aria-controls": ctx.listboxId,
        "aria-expanded": true,
        "aria-autocomplete": "list",
        "aria-activedescendant": activeValue ? optionId(activeValue) : undefined,
        autoComplete: "off",
        onValueChange: (raw: string) => {
          el.props.onValueChange?.(raw);
          setQuery(raw);
          setActive(null);
        },
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
          el.props.onKeyDown?.(event);
          if (event.defaultPrevented) return;
          onSearchKeyDown(event);
        },
      } as Partial<FieldSearchProps<string>>);
    }
    return child;
  });

  return (
    <OptionListContext.Provider value={ctx}>
      <div className={cx(styles.root, className)} {...rest}>
        {dressed}
      </div>
    </OptionListContext.Provider>
  );
}

export type OptionListOptionsProps = HTMLAttributes<HTMLDivElement>;

/**
 * The scrollable `role="listbox"` — renders just the `OptionList.Option`s that
 * pass the current filter (in authored order), or the empty row when none do.
 * Owns list-level roving: with focus inside it (a search-less list), ArrowUp/Down
 * move real button focus between options.
 */
function OptionListOptions({
  className,
  children,
  onKeyDown,
  ...rest
}: OptionListOptionsProps) {
  const {
    styles,
    filteredValues,
    moveActive,
    activeValue,
    listboxId,
    hasLabel,
    labelId,
    hasHint,
    hintId,
    emptyLabel,
  } = useOptionList("OptionList.Options");
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the highlighted row in view AS IT MOVES — but scroll only THIS list's
  // own scroll box, never an ancestor. `Element.scrollIntoView` bubbles up every
  // scrollable ancestor (including the page's scroll container), so on mount it
  // would yank the whole page down to a preselected row that sits in a lower
  // list. Nudging `scrollTop` directly keeps the scroll contained. No-op when the
  // row is already visible, and in jsdom (where rects are zeroed).
  useEffect(() => {
    if (!activeValue) return;
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>("[data-active]");
    if (!list || !el) return;
    const listBox = list.getBoundingClientRect();
    const elBox = el.getBoundingClientRect();
    if (elBox.top < listBox.top) {
      list.scrollTop -= listBox.top - elBox.top;
    } else if (elBox.bottom > listBox.bottom) {
      list.scrollTop += elBox.bottom - listBox.bottom;
    }
  }, [activeValue]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1, true);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1, true);
    }
  };

  // Render the authored options that survive the filter, in order. Filtered-out
  // options simply aren't rendered (dropping out of the a11y + tab order with
  // their DOM); non-Option children (should be none) pass through untouched.
  const visible = Children.toArray(children).filter(
    (child) => !isOption(child) || filteredValues.has(child.props.value),
  );
  const hasOptions = visible.some(isOption);

  return (
    <div
      ref={listRef}
      role="listbox"
      id={listboxId}
      aria-labelledby={hasLabel ? labelId : undefined}
      aria-describedby={hasHint ? hintId : undefined}
      className={cx(styles.list, className)}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {hasOptions ? visible : <div className={styles.empty}>{emptyLabel}</div>}
    </div>
  );
}

export interface OptionListOptionProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  /** Stable identity — what `onValueChange` reports and selection compares on. */
  value: string;
  /**
   * The searchable + trigger-display text. Optional when the children are a plain
   * string (the string is then the label); set it for rich children (icon +
   * text) so the search and the Combobox trigger have text to work with.
   */
  label?: string;
  children?: ReactNode;
}

/**
 * One option — a real `<button role="option">`. The "you have the button" leaf:
 * your `className` lands on it while the component sets the state attributes
 * (aria-selected, data-active, :disabled) the styling keys off. Children are the
 * visible content (text, or an icon + text); they fall back to `label` then
 * `value` so a bare `<OptionList.Option value="a" label="Apple" />` still renders.
 */
function OptionListOption({
  value,
  label,
  className,
  children,
  ...rest
}: OptionListOptionProps) {
  const { styles, selected, activeValue, select, optionId } =
    useOptionList("OptionList.Option");

  const isSelected = value === selected;
  const isActive = value === activeValue;

  return (
    <button
      {...rest}
      type="button"
      role="option"
      id={optionId(value)}
      aria-selected={isSelected}
      data-active={isActive ? "" : undefined}
      data-value={value}
      tabIndex={isActive ? 0 : -1}
      className={cx(styles.option, className)}
      onClick={() => select(value)}
    >
      {children ?? label ?? value}
    </button>
  );
}

/**
 * Compound option list. `OptionList` is the root/context; the parts read it and
 * stay dumb. Options are authored as `OptionList.Option` children; `Field.Search`
 * (from field.tsx) composes in as the filter row. Surface it as the Combobox's
 * popover body (onBrand), or use it stand-alone as an always-open select
 * (default).
 */
export const OptionList = Object.assign(OptionListRoot, {
  Options: OptionListOptions,
  Option: OptionListOption,
});

export type { OptionItem };
