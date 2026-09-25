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
import { scrollToCenter } from "@/utils/scroll-to-center";
import { Field, useOptionalField, type FieldSearchProps } from "./field";
import { WireframeContent } from "../wireframe";

type OptionListStyles = ReturnType<typeof optionList>;

/** Whatever picked an option, so its modifier keys are readable on every path. */
export type OptionSelectEvent =
  | ReactMouseEvent
  | KeyboardEvent<Element>
  | globalThis.KeyboardEvent;

type OptionListContextValue = {
  styles: OptionListStyles;
  filteredValues: Set<string>;
  selected: string | null;
  /** When present, decides which rows paint as picked instead of `selected`. */
  selectedSet: ReadonlySet<string> | null;
  /** The highlight: query/hover/arrow ▸ selected ▸ first. */
  activeValue: string | null;
  /** The event rides along so a consumer can read its modifier keys. */
  select: (value: string, event?: OptionSelectEvent) => void;
  /** `focus` roves real button focus; `loop` wraps around the ends. */
  moveActive: (delta: 1 | -1, focus: boolean, loop?: boolean) => void;
  direction: "block" | "inline";
  /** Pointer-driven; ignored while the keyboard is the live modality. */
  setActiveValue: (value: string | null) => void;
  /** No-op unless `value`'s row holds the highlight. */
  clearActive: (value: string) => void;
  /** `key` highlights persist and scroll into view; `pointer` ones release on leave and never scroll. */
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

// Set by Listbox or Toolbar; decides the semantics of the shared Option leaf.
type ContainerMode = "listbox" | "toolbar";
const OptionListContainerContext = createContext<ContainerMode>("listbox");
const useContainerMode = () => useContext(OptionListContainerContext);

function isOption(
  node: ReactNode,
): node is ReactElement<OptionListOptionProps> {
  return isValidElement(node) && node.type === OptionListOption;
}

/** An explicit `label`, else the string children, else the value. */
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

/** The ordered option data, read from the tree during render; later duplicate values are ignored. */
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
  value?: string | null;
  defaultValue?: string | null;
  /** Multi-selection, presentational only: the consumer owns the policy, and `value` becomes the anchor. */
  selectedValues?: ReadonlyArray<string> | ReadonlySet<string>;
  onValueChange?: (value: string, event?: OptionSelectEvent) => void;
  /** Defaults to a case-insensitive label substring match. */
  filter?: (options: OptionItem[], query: string) => OptionItem[];
  emptyLabel?: string;
  /** `onBrand` inverts for the Combobox popover; `plain` collapses into a surface-owning Popover. */
  tone?: "default" | "onBrand" | "plain";
  /** `inline` is a row (toolbar, segmented select); the root collapses into the consumer's frame. */
  direction?: "block" | "inline";
  /** `scroll` caps at 7 rows; `content` hugs its rows, bounded by the viewport. */
  fit?: "scroll" | "content";
  size?: "md" | "sm";
  /** A Listbox or Toolbar, and an optional Field.Search. */
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
  // Inside a Field it borrows the label/hint ids; standalone, the aria-* simply drop.
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

  const selectedSet = useMemo(() => {
    if (!selectedValues) return null;
    return selectedValues instanceof Set
      ? (selectedValues as ReadonlySet<string>)
      : new Set(selectedValues as ReadonlyArray<string>);
  }, [selectedValues]);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);

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

  // State, not a ref: it changes with `active`, so the scroll effect can depend on it.
  const [activeSource, setActiveSource] = useState<"pointer" | "key" | null>(
    null,
  );

  const setActiveFromPointer = (value: string | null) => {
    // Enter/leave also fire under a still cursor when the list scrolls or opens; only a live pointer counts.
    if (getInputModality() !== "pointer") return;
    setActiveSource(value == null ? null : "pointer");
    setActive(value);
  };

  const clearActive = (value: string) => {
    if (getInputModality() !== "pointer") return;
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
  /** Drive the highlight from document keydowns while focus stays outside (the slash menu). */
  externalKeys?: boolean;
  loop?: boolean;
  /** Focus the highlighted row on mount, for a list with no search to land in. */
  autoFocus?: boolean;
}

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

  useScrollHandoff(listRef);

  // Nudges this list's scrollTop: `scrollIntoView` would also scroll every ancestor, the page included.
  useEffect(() => {
    // Only a keyboard highlight scrolls; a pointer one is already under the cursor.
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

  // Opens centred on the selection. Once, at mount, so a later render never undoes the user's scroll.
  const openOnRef = useRef(activeValue);
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>("[data-active]");
    if (!list || !el || !openOnRef.current) return;
    list.scrollTop = scrollToCenter({
      rowTop: el.offsetTop - list.offsetTop,
      rowHeight: el.offsetHeight,
      boxHeight: list.clientHeight,
      contentHeight: list.scrollHeight,
    });
  }, []);

  // Once, on mount: re-running would fight the roving focus.
  useEffect(() => {
    if (!autoFocus) return;
    const list = listRef.current;
    list?.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus();
  }, [autoFocus]);

  // Captured, so the keys drive the list before the editor reacts. Escape belongs to the Popover.
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

  // The context is rebuilt every render, so `setActiveValue` is read through a ref, not a dependency.
  const setActiveValueRef = useRef(setActiveValue);
  useEffect(() => {
    setActiveValueRef.current = setActiveValue;
  });

  // Preselect the row under the pointer, only while the pointer is the live modality.
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

  // Only the arrows along the list's axis are claimed; the other pair keeps its page meaning.
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
      aria-multiselectable={selectedSet ? true : undefined}
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
  /** Optional for a Toolbar action button. */
  value?: string;
  /** Search and trigger text; needed when the children aren't a plain string. */
  label?: string;
  /** Toolbar only: toggle state. Omit for a plain action. */
  pressed?: boolean;
  children?: ReactNode;
}

/** Its semantics follow the container: a listbox option or a toolbar button. */
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
        // Keeps the editor's selection alive: the toolbar acts on it.
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

  // In multi-selection the set decides; `selected` is only the anchor.
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
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (value != null && !rest.disabled) setActiveValue(value);
      }}
      // On the option, not the list: a leave into the list's empty space never reaches the list.
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        if (value == null) return;
        // Onto a sibling in this list, its enter takes over; a row in another list can't, so release.
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
      // The consumer's handler runs first and unconditionally, then the click commits.
      onClick={(event) => {
        onClick?.(event);
        if (value != null) select(value, event);
      }}
    >
      {content}
    </button>
  );
}

export interface OptionListToolbarProps extends HTMLAttributes<HTMLDivElement> {
  "aria-label": string;
}

/** No keyboard cursor: arrows would collide with the editor caret. */
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

function OptionListDivider({
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  const { styles } = useOptionList("OptionList.Divider");
  return <span aria-hidden className={cx(styles.divider, className)} {...rest} />;
}

export const OptionList = Object.assign(OptionListRoot, {
  Listbox: OptionListListbox,
  Option: OptionListOption,
  Toolbar: OptionListToolbar,
  Divider: OptionListDivider,
});

export type { OptionItem };
