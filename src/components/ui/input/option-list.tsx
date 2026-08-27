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
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cx } from "../../../../styled-system/css";
import { optionList } from "../../../../styled-system/recipes";
import {
  getInputModality,
  getPointerPosition,
  useInputModality,
} from "@/hooks/use-input-modality";
import { useScrollHandoff } from "@/hooks/use-scroll-handoff";
import { filterOptions, type OptionItem } from "@/utils/option-filter";
import { Field, useOptionalField, type FieldSearchProps } from "./field";
import { WireframeContent } from "../wireframe";

// ---------------------------------------------------------------------------
// OptionList — the composable listbox behind a Combobox, and a stand-alone,
// always-open select on its own. The Calendar of the select family.
//
//   <OptionList value={value} onValueChange={setValue}>
//     <Field.Search placeholder="Search…" />          {/* optional filter row */}
//     <OptionList.Listbox>
//       {fruits.map((f) => (
//         <OptionList.Option key={f.value} value={f.value}>
//           {f.icon}
//           {f.label}
//         </OptionList.Option>
//       ))}
//     </OptionList.Listbox>
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

/**
 * Whatever picked an option: a click on the row, Enter from the search or the
 * list, or the document-level keydown `externalKeys` captures. The union exists
 * so `shiftKey`/`metaKey`/`ctrlKey` are readable on EVERY path — a multi-select
 * policy that only worked for the mouse would be a keyboard-accessibility hole.
 */
export type OptionSelectEvent =
  | ReactMouseEvent
  | KeyboardEvent<Element>
  | globalThis.KeyboardEvent;

type OptionListContextValue = {
  styles: OptionListStyles;
  /** Values that pass the current filter — what `Options` renders. */
  filteredValues: Set<string>;
  selected: string | null;
  /**
   * Presentational multi-selection. When present it, not `selected`, decides
   * which rows paint as picked — see {@link OptionListProps.selectedValues}.
   */
  selectedSet: ReadonlySet<string> | null;
  /** The single highlighted option (query/hover/arrow ▸ selected ▸ first). */
  activeValue: string | null;
  /**
   * Commit an option. The originating event rides along so a consumer can read
   * its modifier keys — that is how a multi-select list tells "toggle this one"
   * from "make this the whole selection".
   */
  select: (value: string, event?: OptionSelectEvent) => void;
  /**
   * Move the highlight by ±1 enabled option; `focus` roves real button focus,
   * `loop` wraps around the ends (the slash menu's externalKeys navigation).
   */
  moveActive: (delta: 1 | -1, focus: boolean, loop?: boolean) => void;
  /**
   * Which way the options run — the LAYOUT axis, and therefore the key pair
   * that walks them. A vertical list is arrowed with Up/Down and a horizontal
   * one with Left/Right; a row that answered to Up/Down would be a row you
   * cannot drive with the arrows that point along it.
   */
  direction: "block" | "inline";
  /** Park the highlight on a specific value — pointer-preselect on open. */
  setActiveValue: (value: string | null) => void;
  /**
   * Release the highlight as the pointer leaves `value`'s row. No-op unless that
   * row currently owns the highlight, so a keyboard move elsewhere survives the
   * pointer wandering off some other row.
   */
  clearActive: (value: string) => void;
  /**
   * How the highlight last moved. `key` persists (it's what Enter commits) and
   * scrolls into view; `pointer` is released on pointer-leave and never scrolls
   * — the row is already under the cursor, so scrolling would fight the user.
   */
  activeSource: "pointer" | "key" | null;
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

// Which behavior container an OptionList.Option sits in — set by Listbox vs
// Toolbar, read by the shared Option leaf to pick its semantics: a listbox
// option (role=option, aria-selected, click selects a value) or a toolbar button
// (aria-pressed when toggled, click acts, mousedown preserves the editor
// selection). Defaults to `listbox` so a bare Option behaves as it always did.
type ContainerMode = "listbox" | "toolbar";
const OptionListContainerContext = createContext<ContainerMode>("listbox");
const useContainerMode = () => useContext(OptionListContainerContext);

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
  return text.trim() || props.value || "";
}

/**
 * Recover the ordered option data from the tree — drilling through the
 * `OptionList.Listbox` wrapper and any fragments a `.map()` produces. Runs during
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
        // A valueless Option is a toolbar action button, not a selectable row.
        if (props.value == null || seen.has(props.value)) return;
        seen.add(props.value);
        out.push({
          value: props.value,
          label: optionLabel(props),
          disabled: !!props.disabled,
        });
      } else if (
        child.type === OptionListListbox ||
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
  /**
   * Every value to paint as selected — the multi-selection form. Presentational
   * only: the list reports which rows are picked and announces itself as
   * multi-selectable, but the POLICY (does a click toggle, replace, or refuse
   * past a cap?) stays with the consumer, which reads the modifier keys off the
   * event `onValueChange` hands it.
   *
   * With this set, `value` degrades from "the selection" to "the ANCHOR": the
   * row the keyboard highlight resolves to, and the one a single-target side
   * panel should follow. Leave it undefined for ordinary single-select.
   */
  selectedValues?: ReadonlyArray<string> | ReadonlySet<string>;
  /**
   * Fired with the picked option's `value`, plus the click/keypress that picked
   * it — read `shiftKey`/`metaKey` off it to branch a multi-select policy.
   */
  onValueChange?: (value: string, event?: OptionSelectEvent) => void;
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
  tone?: "default" | "onBrand" | "plain";
  /**
   * Layout axis. `block` (default) is the vertical list — a slash menu / combobox
   * body. `inline` is a horizontal row — a toolbar or a segmented single-select;
   * the root collapses so its behavior container sits in the consumer's frame.
   */
  direction?: "block" | "inline";
  /**
   * How tall the list may grow. `scroll` (default) caps it at 7 rows and a
   * half-row peek — right for a long list you browse. `content` lets it hug its
   * rows so a menu that fits shows itself whole, bounded only by the viewport.
   */
  fit?: "scroll" | "content";
  /**
   * Row pitch. `md` (default) is the 32px row — 24px of line box on a 4px
   * inset. `sm` is the dense list (Figma 1027:2276): the row IS its 24px line
   * box, separated by a 2px gap, under a 28px search strip.
   */
  size?: "md" | "sm";
  /** A behavior container (`OptionList.Listbox` / `OptionList.Toolbar`) and an optional Field.Search. */
  children: ReactNode;
}

function OptionListRoot({
  value,
  defaultValue,
  selectedValues,
  onValueChange,
  filter = filterOptions,
  emptyLabel = "No results",
  direction = "block",
  tone = "default",
  fit,
  size,
  className,
  children,
  ...rest
}: OptionListProps) {
  // Optional Field: composed INTO a <Field> (the Combobox) it borrows the
  // label/hint ids to associate as a group (aria-labelledby/-describedby — a
  // listbox is labelled, not `htmlFor`-linked). Standing alone (a toolbar, the
  // slash menu) there's no Field and nothing to label, so the aria-* simply drop.
  const field = useOptionalField();
  const labelId = field?.labelId ?? "";
  const hasLabel = field?.hasLabel ?? false;
  const hintId = field?.hintId ?? "";
  const hasHint = field?.hasHint ?? false;
  const styles = optionList({ tone, direction, fit, size });
  const uid = useId();

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string | null>(defaultValue ?? null);
  const selected = isControlled ? (value ?? null) : internal;

  // Accept either form so a consumer holding an ORDERED array (insertion order
  // is meaningful when the selection becomes a list) needn't build a Set itself.
  const selectedSet = useMemo(() => {
    if (!selectedValues) return null;
    return selectedValues instanceof Set
      ? (selectedValues as ReadonlySet<string>)
      : new Set(selectedValues as ReadonlyArray<string>);
  }, [selectedValues]);

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

  const select = (value: string, event?: OptionSelectEvent) => {
    const option = filtered.find((option) => option.value === value);
    if (!option || option.disabled) return;
    if (!isControlled) setInternal(value);
    onValueChange?.(value, event);
  };

  // Pointer highlights are transient (released on leave); keyboard ones stick.
  // Tracked as state, not a ref: it always changes together with `active`, so
  // the two land in one render and the scroll effect can depend on it.
  const [activeSource, setActiveSource] = useState<"pointer" | "key" | null>(
    null,
  );

  const setActiveFromPointer = (value: string | null) => {
    // Whoever the user last actually used owns the highlight. A pointer event
    // fired while the keyboard is live did not come from the user reaching for
    // the mouse — the engine synthesises enter/leave whenever the list scrolls
    // or opens under a stationary cursor — so it must not move the cursor the
    // keyboard is driving. See {@link getInputModality}.
    if (getInputModality() !== "pointer") return;
    setActiveSource(value == null ? null : "pointer");
    setActive(value);
  };

  const clearActive = (value: string) => {
    // Same rule in reverse: a synthesized leave must not blank a keyboard
    // highlight. A leave the user really performed comes with pointer motion,
    // which makes the pointer live before it arrives.
    if (getInputModality() !== "pointer") return;
    // Only the row that currently shows the highlight may release it.
    if (activeValue !== value) return;
    setActiveSource(null);
    setActive(null);
  };

  const moveActive = (delta: 1 | -1, focus: boolean, loop = false) => {
    if (enabled.length === 0) return;
    setActiveSource("key");
    const from = enabled.findIndex((option) => option.value === activeValue);
    const raw = from + delta;
    const next = loop
      ? (raw + enabled.length) % enabled.length
      : Math.min(Math.max(raw, 0), enabled.length - 1);
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
    selectedSet,
    activeValue,
    select,
    moveActive,
    direction,
    setActiveValue: setActiveFromPointer,
    clearActive,
    activeSource,
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
      select(activeValue, event);
    }
  };

  // Dress a Field.Search dropped directly under <OptionList>: give it the
  // `search` slot, turn it into the listbox's combobox input (aria-*), and route
  // its raw query into the filter. A fresh query resets the arrow highlight so it
  // re-resolves to the first survivor. Everything else is passed through.
  const dressed = Children.map(children, (child) => {
    if (isValidElement(child) && child.type === Field.Search) {
      const el = child as ReactElement<FieldSearchProps>;
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
      } as Partial<FieldSearchProps>);
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

export interface OptionListListboxProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Drive the highlight from a document-level captured keydown while focus stays
   * OUTSIDE the list — for a menu floating over a still-focused editor (the slash
   * menu). ArrowUp/Down move the highlight and Enter commits, without the editor
   * ever losing focus, and the option under the pointer is preselected on open.
   * Off (default) is the in-list model: roving real button focus, or the combobox
   * search driving aria-activedescendant.
   */
  externalKeys?: boolean;
  /** Wrap the highlight around the ends when navigating. */
  loop?: boolean;
  /**
   * Put real focus on the highlighted row as soon as the list mounts — the
   * search-less select's answer to "where does the keyboard land?". With a
   * search present the input holds focus and drives the highlight through
   * aria-activedescendant, so this is for the list that has no input to land
   * in (see `Combobox`'s `search={false}`). Falls back to the first enabled
   * row when nothing is selected.
   */
  autoFocus?: boolean;
}

/**
 * The scrollable `role="listbox"` — renders just the `OptionList.Option`s that
 * pass the current filter (in authored order), or the empty row when none do.
 * Keyboard has three sources, one active at a time: the combobox search (root)
 * drives aria-activedescendant while focus stays in the input; focus INSIDE this
 * list roves real button focus (a search-less select); or `externalKeys` captures
 * ArrowUp/Down/Enter at the document while focus stays in an editor (slash menu).
 */
function OptionListListbox({
  className,
  children,
  onKeyDown,
  externalKeys = false,
  loop = false,
  autoFocus = false,
  ...rest
}: OptionListListboxProps) {
  const {
    styles,
    filteredValues,
    moveActive,
    direction,
    activeValue,
    select,
    selectedSet,
    setActiveValue,
    activeSource,
    listboxId,
    hasLabel,
    labelId,
    hasHint,
    hintId,
    emptyLabel,
  } = useOptionList("OptionList.Listbox");
  const listRef = useRef<HTMLDivElement>(null);

  // A list that has run out is not the end of scrolling: the wheel carries on
  // to whatever this list sits in — the docked panel, the page — rather than
  // dying against the last row. Stops at a popover, which seals itself.
  useScrollHandoff(listRef);

  // Keep the highlighted row in view AS IT MOVES — but scroll only THIS list's
  // own scroll box, never an ancestor. `Element.scrollIntoView` bubbles up every
  // scrollable ancestor (including the page's scroll container), so on mount it
  // would yank the whole page down to a preselected row that sits in a lower
  // list. Nudging `scrollTop` directly keeps the scroll contained. No-op when the
  // row is already visible, and in jsdom (where rects are zeroed).
  useEffect(() => {
    // Only the keyboard cursor scrolls itself into view. A pointer highlight is
    // already under the cursor, and releasing one (pointer-leave) falls back to
    // the selected row — scrolling there would yank the list out from under a
    // user who had simply moved the mouse away.
    if (!activeValue || activeSource !== "key") return;
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
  }, [activeValue, activeSource]);

  // The search-less list takes focus itself. Once, on mount: re-running it as
  // the highlight moves would fight the roving focus it hands over to, and
  // yank focus back into a list the user has since tabbed out of.
  useEffect(() => {
    if (!autoFocus) return;
    const list = listRef.current;
    // The highlighted row if there is one (the selected value seeds it), else
    // the first that can take focus — the roving tabindex marks whichever it
    // is, so one query covers both.
    list?.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus();
  }, [autoFocus]);

  // externalKeys: arrow/enter arrive at the document (focus is in the editor).
  // Capture them so they drive the highlight and commit before the editor reacts.
  // Escape is owned by the Popover shell (useDismiss), so it isn't handled here.
  useEffect(() => {
    if (!externalKeys) return;
    function handle(event: globalThis.KeyboardEvent) {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          moveActive(1, false, loop);
          break;
        case "ArrowUp":
          event.preventDefault();
          moveActive(-1, false, loop);
          break;
        case "Enter":
          if (activeValue) {
            event.preventDefault();
            event.stopPropagation();
            select(activeValue, event);
          }
          break;
      }
    }
    document.addEventListener("keydown", handle, { capture: true });
    return () =>
      document.removeEventListener("keydown", handle, { capture: true });
  }, [externalKeys, loop, moveActive, activeValue, select]);

  // The context is rebuilt every render, so `setActiveValue` cannot be a
  // dependency below — depending on it re-ran the preselect on EVERY render,
  // which is what made an arrow key move the highlight and then snap it back
  // under the cursor a frame later.
  const setActiveValueRef = useRef(setActiveValue);
  useEffect(() => {
    setActiveValueRef.current = setActiveValue;
  });

  // externalKeys: park the highlight on the option under the pointer — but only
  // while the POINTER is the live input modality. A menu opened by typing `/`
  // belongs to the keyboard, and preselecting whatever the cursor happens to be
  // parked over is exactly the hijack this guards against. Re-runs when the
  // modality flips, so the first real mouse move claims the row underneath even
  // if the pointer never crosses a row boundary.
  const modality = useInputModality();
  useEffect(() => {
    if (!externalKeys || modality !== "pointer") return;
    if (typeof document.elementFromPoint !== "function") return;
    const pointer = getPointerPosition();
    if (!pointer) return;
    const raf = requestAnimationFrame(() => {
      const value = document
        .elementFromPoint(pointer.x, pointer.y)
        ?.closest<HTMLElement>("[data-value]")
        ?.getAttribute("data-value");
      if (value) setActiveValueRef.current(value);
    });
    return () => cancelAnimationFrame(raf);
  }, [externalKeys, modality]);

  // The arrows that point ALONG the list — Up/Down down a column, Left/Right
  // across a row. Only the pair matching the axis is claimed, so the other one
  // keeps whatever meaning the surrounding page gives it (caret movement in a
  // combobox's search, horizontal scroll) instead of being swallowed by a list
  // that cannot move that way.
  const [prevKey, nextKey] =
    direction === "inline"
      ? ["ArrowLeft", "ArrowRight"]
      : ["ArrowUp", "ArrowDown"];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === nextKey) {
      event.preventDefault();
      moveActive(1, true, loop);
    } else if (event.key === prevKey) {
      event.preventDefault();
      moveActive(-1, true, loop);
    }
  };

  // Render the authored options that survive the filter, in order. Filtered-out
  // options simply aren't rendered (dropping out of the a11y + tab order with
  // their DOM); non-Option children (should be none) pass through untouched.
  const visible = Children.toArray(children).filter(
    (child) =>
      !isOption(child) ||
      (child.props.value != null && filteredValues.has(child.props.value)),
  );
  const hasOptions = visible.some(isOption);

  return (
    <div
      ref={listRef}
      role="listbox"
      id={listboxId}
      // Only claimed when the consumer actually runs a multi-selection — an
      // ordinary single-select list must keep announcing itself as one.
      aria-multiselectable={selectedSet ? true : undefined}
      // Vertical is the default for a listbox, so only a row has to say so —
      // and it must, since it is also what tells assistive tech which arrows
      // walk it, matching the pair `handleKeyDown` claims.
      aria-orientation={direction === "inline" ? "horizontal" : undefined}
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
  /**
   * Stable identity — what a Listbox's `onValueChange` reports and selection
   * compares on. Optional for a Toolbar action button, which carries no value.
   */
  value?: string;
  /**
   * The searchable + trigger-display text (Listbox). Optional when the children
   * are a plain string (the string is then the label); set it for rich children
   * (icon + text) so the search and the Combobox trigger have text to work with.
   */
  label?: string;
  /**
   * Toolbar only: toggle state → `aria-pressed`. Omit for a plain action button
   * (edit / delete / navigate), which gets no pressed state.
   */
  pressed?: boolean;
  children?: ReactNode;
}

/**
 * One item — a real `<button>`. The "you have the button" leaf: your `className`
 * lands on it while the component sets the state attributes the styling keys off.
 * Its SEMANTICS follow the container it sits in (via context):
 *   • Listbox → `role="option"`, `aria-selected`, `data-active` (the roving
 *     cursor), and a click selects its `value`.
 *   • Toolbar → a plain button with `aria-pressed` when `pressed` is passed (a
 *     toggle) or none (an action); mousedown is prevented so the press can't
 *     collapse the editor's text selection, and the consumer's `onClick` runs.
 * Children are the visible content (text, or icon + text), falling back to
 * `label` then `value`.
 */
function OptionListOption({
  value,
  label,
  pressed,
  className,
  children,
  onClick,
  onMouseDown,
  onPointerEnter,
  onPointerLeave,
  ...rest
}: OptionListOptionProps) {
  const {
    styles,
    selected,
    selectedSet,
    activeValue,
    select,
    setActiveValue,
    clearActive,
    optionId,
  } = useOptionList("OptionList.Option");
  const mode = useContainerMode();
  const content = <WireframeContent>{children ?? label ?? value}</WireframeContent>;

  if (mode === "toolbar") {
    return (
      <button
        {...rest}
        type="button"
        aria-pressed={pressed}
        data-value={value}
        className={cx(styles.option, className)}
        // Keep the editor's selection/caret alive through the press — the toolbar
        // acts ON that selection, so it must not steal it (was Menu.Button's
        // `preserveSelection`).
        onMouseDown={(event) => {
          onMouseDown?.(event);
          if (!event.defaultPrevented) event.preventDefault();
        }}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  // In multi-selection the set is the authority and `selected` is only the
  // anchor, which may well not be a member (you can point at a row without
  // picking it) — so it must not leak into the painted state.
  const isSelected =
    value != null && selectedSet ? selectedSet.has(value) : value === selected;
  const isActive = value === activeValue;
  return (
    <button
      {...rest}
      type="button"
      role="option"
      id={value != null ? optionId(value) : undefined}
      aria-selected={isSelected}
      data-active={isActive ? "" : undefined}
      data-value={value}
      tabIndex={isActive ? 0 : -1}
      className={cx(styles.option, className)}
      onMouseDown={onMouseDown}
      // Hover moves the highlight (the roving cursor), matching a native listbox
      // and the old slash menu's pointer-preselect. A disabled row can't take it.
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (value != null && !rest.disabled) setActiveValue(value);
      }}
      // Release the highlight on the way out, so a row can't stay lit once the
      // pointer has moved on — into the list's empty space, or off the list
      // entirely. Sitting on the option itself (not the list) is what catches
      // the empty-space case, where a list-level leave never fires.
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        if (value == null) return;
        // Straight onto a sibling option in THIS list: its own pointerenter
        // takes over, so don't blank the highlight in between and flicker.
        // A row in a DIFFERENT list can't hand over — this one must release.
        const next = event.relatedTarget;
        const list = event.currentTarget.closest(
          '[role="listbox"],[role="toolbar"]',
        );
        if (
          next instanceof Element &&
          list?.contains(next) &&
          next.closest("[data-value]")
        ) {
          return;
        }
        clearActive(value);
      }}
      // The consumer's own handler runs FIRST and unconditionally — it used to
      // be swallowed here, which is what made modifier-click policies
      // impossible — then the click commits as usual, carrying the event so
      // that policy can read its modifiers.
      onClick={(event) => {
        onClick?.(event);
        if (value != null) select(value, event);
      }}
    >
      {content}
    </button>
  );
}

// --- Toolbar (multi-toggle behavior container) -----------------------------

export interface OptionListToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** Names the toolbar for assistive tech — there's no visible label. */
  "aria-label": string;
}

/**
 * A row of independent action / toggle buttons — the editor's selection, link,
 * bullet and numbering bars. Owns SEMANTICS, not layout or state: it sets
 * `role="toolbar"` and flips its `OptionList.Option` children into action /
 * toggle buttons (pressed state stays controlled by the consumer, per option).
 * No keyboard cursor — arrows would collide with the editor caret over the live
 * selection. Pair with `direction="inline"` on the root for the row layout.
 */
function OptionListToolbar({
  className,
  children,
  ...rest
}: OptionListToolbarProps) {
  const { styles } = useOptionList("OptionList.Toolbar");
  return (
    <OptionListContainerContext.Provider value="toolbar">
      <div role="toolbar" className={cx(styles.list, className)} {...rest}>
        {children}
      </div>
    </OptionListContainerContext.Provider>
  );
}

// --- Divider (between toolbar / list groups) -------------------------------

/** A hairline between groups — vertical in a Toolbar, horizontal in a block list. */
function OptionListDivider({
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  const { styles } = useOptionList("OptionList.Divider");
  return <span aria-hidden className={cx(styles.divider, className)} {...rest} />;
}

/**
 * Compound option list. `OptionList` is the root/context (layout, filtering,
 * skin); the behavior containers own the interaction — `OptionList.Listbox`
 * (single-select listbox) or `OptionList.Toolbar` (multi-toggle). `Option` is the
 * shared item leaf that reads its container to know which. `Field.Search`
 * composes in as the filter row. Surface it as the Combobox's popover body
 * (onBrand), a stand-alone always-open select (default), or an editor toolbar.
 */
export const OptionList = Object.assign(OptionListRoot, {
  Listbox: OptionListListbox,
  Option: OptionListOption,
  Toolbar: OptionListToolbar,
  Divider: OptionListDivider,
});

export type { OptionItem };
