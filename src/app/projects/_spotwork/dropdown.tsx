"use client";

import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { useDismiss } from "@/hooks/use-dismiss";
import { useControllable, useOpen } from "./controllable";
import { misplaced, ownPart, partsOf, refuseOthers, restOf, textOf } from "./slots";
import {
  Badge,
  Divider,
  Presence,
  Typography,
  anchorStyle,
  boxStateRaw,
  checkboxStyle,
  enterRaw,
  panelStyle,
  popoverSidesRaw,
  selectStyle,
  toneStyle,
  useEscapeLayer,
  useField,
  useHang,
  type Tone,
} from "./ui";
import ChevronDownIcon from "./assets/icons/medium/chevron-down.svg";
import ChevronUpIcon from "./assets/icons/medium/chevron-up.svg";
import SmallChevronDownIcon from "./assets/icons/small/chevron-down.svg";
import SmallChevronUpIcon from "./assets/icons/small/chevron-up.svg";
import TickIcon from "./assets/tick.svg";
import NavChevronIcon from "./assets/nav-chevron-right.svg";

// SW Curie's Molecules/Form/Dropdown (434:1139): a 40px box, and its list of List Items (5815:16488) under it while
// open, or over it where there's no room below. Small, it's Atoms/Filter/Dropdown (2750:421523), and picking several
// Atoms/Filter/Multi-select (2886:6577).

const boxStyle = css(boxStateRaw, {
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-md)",
  width: "100%",
  height: "2.5rem",
  paddingInline: "var(--sw-padding-md)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
  color: "var(--sw-glyph-default)",
  textAlign: "start",
  cursor: "pointer",
  "& > span": { flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  "& > svg": { flexShrink: 0 },
  // The value keeps the default glyph while the box and its chevron take the state's colour.
  "&[data-state] > span": { color: "var(--sw-glyph-default)" },
  _disabled: {
    backgroundColor: "var(--sw-surface-disabled)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
    color: "var(--sw-glyph-disabled)",
    cursor: "default",
  },
});

// Small, as wide as its words unless it fills what holds it.
const smallBoxStyle = css({ alignSelf: "flex-start", "&[data-fill]": { alignSelf: "stretch" } });

// A form control's list of items: a border, not an inset shadow, so the items' hover fills stay inside it.
export const listStyle = css(enterRaw, popoverSidesRaw, {
  zIndex: 3,
  display: "flex",
  flexDirection: "column",
  maxHeight: "15rem",
  overflowY: "auto",
  border: "1.5px solid var(--sw-border-focus)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  outline: "2px solid var(--sw-outline-focus)",
  "& > *": { flexShrink: 0 },
  // A type-ahead's suggestions, each with an avatar, run to 300.
  "&[data-tall]": { maxHeight: "18.75rem" },
});

// Atoms/Form/List Item: Default, Hovered & Active (`data-hover` holds it), Selected; an avatar or icon before its words
// (a `Typography`), a caption (another) under them. A menu's (a sidebar's, a context menu's) is rounded, its icon 13px
// from its words.
export const listItemStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-xs)",
  width: "100%",
  paddingBlock: "var(--sw-padding-sm)",
  paddingInline: "var(--sw-padding-md)",
  color: "var(--sw-glyph-default)",
  textAlign: "start",
  cursor: "pointer",
  outline: "none",
  "& > [data-words]": { display: "flex", flexDirection: "column", gap: "var(--sw-gap-xs)", flex: "1 1 auto", minWidth: 0 },
  "& > [data-words] > *": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  // Words with an icon or badge in them, as a status shows.
  "& > [data-words] > :has(> svg, > [data-badge])": { display: "flex", alignItems: "center", gap: "var(--sw-gap-xxs)" },
  "& > [data-words] > * > svg": { flexShrink: 0, width: "1.25rem", height: "1.25rem" },
  "& > svg": { flexShrink: 0 },
  // The selected or current item takes no hover: a press on it changes nothing.
  "&:is(:hover, [data-hover], [data-keyed], :focus-visible):not([aria-selected=true], [aria-current=page])": {
    backgroundColor: "var(--sw-hover-shade)",
  },
  "&:is([aria-selected=true], [aria-current=page])": {
    backgroundColor: "var(--sw-surface-selected)",
    color: "var(--sw-glyph-selected)",
  },
  "&[data-size=small]": { paddingBlock: "var(--sw-padding-xs)" },
  "&[data-type=menu]": { borderRadius: "var(--sw-radius-xs)", "& > svg:not([data-chevron])": { marginInlineEnd: "0.5rem" } },
  // Tinted as Figma tints a status.
  "&[data-tone] > [data-words] > :first-child": { color: "var(--tone-glyph)" },
  // One of several picked shows its checkbox ticked, not a fill.
  "&[data-multiple][aria-selected=true]": { backgroundColor: "transparent", color: "var(--sw-glyph-default)" },
  "&[data-multiple][aria-selected=true]:is(:hover, [data-keyed])": { backgroundColor: "var(--sw-hover-shade)" },
  // A sidebar's chevron, under the pointer only; its file sets `display` inline.
  "&:not(:hover):not(:focus-visible):not([data-hover]) > [data-chevron]": { display: "none !important" },
  // Its chevron xs from its end, level with an icon button's glyph at the sidebar's end.
  "& > [data-chevron]": { marginInlineEnd: "calc(var(--sw-padding-xs) - var(--sw-padding-md))" },
});

/**
 * Inside a list (a dropdown's, a type-ahead's, a sidebar's), an item is picked through it, selected when it holds the
 * item's value.
 */
export const ItemContext = createContext<{
  /** The item its list holds, so no other list's sits in it. */
  of: unknown;
  selected: boolean;
  pick: () => void;
  keepFocus?: boolean;
  /** One of several picked, ticked. */
  multiple?: boolean;
  /** Its list's size, which its items take. */
  size?: "large" | "small";
} | null>(null);

/** An item's status, after its words. */
function Status({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
Status.displayName = "ListItem.Status";

/** Throws unless `part` sits in the list that holds it: `Dropdown.Item` in a `Dropdown`. */
export function useHeldBy(part: { displayName?: string }) {
  if (use(ItemContext)?.of !== part) throw misplaced(part);
}

/** An item's words: its first `Typography`. */
export const wordsOf = (children: ReactNode) => partsOf(children, Typography)[0];

/**
 * Atoms/Form/List Item, which each list's own item draws (`Dropdown.Item`, `PopoverMenu.Item`…): its `Avatar` or icon,
 * its words (a `Typography`), its caption under them (another) and its `Status` after; its value is its words unless
 * given. Out of a list, it's selected when pressed (from `defaultSelected`) unless its owner holds `selected`, and does
 * what `onClick` says; `data-hover` holds its Hovered & Active look. Small, it's a filter's; among several picked, it's
 * ticked. Its `role` is an option's unless a menu's; `nav`, it's Atoms/Navigation/Nav Item (4889:7125), the current page
 * while selected, a chevron under the pointer otherwise.
 */
function ListItemRoot({
  value: _value,
  selected: held,
  defaultSelected = false,
  size: own,
  type,
  role = "option",
  nav,
  tone,
  onClick,
  className,
  children,
  ...props
}: {
  value?: string;
  selected?: boolean;
  defaultSelected?: boolean;
  size?: "large" | "small";
  /** A dropdown's look (the default) or a menu's: a sidebar's or a popover menu's. */
  type?: "dropdown" | "menu";
  role?: "option" | "menuitem";
  nav?: boolean;
  /** Its words tinted, as a status is. */
  tone?: Tone;
  onClick?: () => void;
  className?: string;
  "data-hover"?: string;
  /** What it opens, as a sidebar's Notifications does. */
  "aria-haspopup"?: "dialog";
  "aria-expanded"?: boolean;
  children: ReactNode;
}) {
  const inside = use(ItemContext);
  const size = own ?? inside?.size ?? "large";
  const [selected, setSelected] = useControllable(held, defaultSelected);
  const on = inside?.selected ?? selected;
  return (
    <button
      type="button"
      role={nav ? undefined : role}
      className={cx(listItemStyle, tone && toneStyle, className)}
      data-size={size === "small" ? size : undefined}
      data-type={type === "menu" ? type : undefined}
      data-tone={tone}
      data-multiple={inside?.multiple ? "" : undefined}
      aria-selected={!nav && role === "option" ? on : undefined}
      aria-current={nav && on ? "page" : undefined}
      onPointerDown={inside?.keepFocus ? (event) => event.preventDefault() : undefined}
      onClick={
        inside?.pick ??
        (() => {
          setSelected(true);
          onClick?.();
        })
      }
      {...props}
    >
      {inside?.multiple && (
        <span className={checkboxStyle} data-size="small" data-checked={inside.selected ? "" : undefined} aria-hidden>
          <span>{inside.selected && <TickIcon />}</span>
        </span>
      )}
      {restOf(children, Typography, Status)}
      <span data-words="">{partsOf(children, Typography)}</span>
      {partsOf(children, Status)}
      {nav && !on && <NavChevronIcon aria-hidden data-chevron="" />}
    </button>
  );
}
ListItemRoot.displayName = "ListItem";

export const ListItem = Object.assign(ListItemRoot, { Status });

export type ListItemProps = ComponentProps<typeof ListItemRoot>;

const ITEMS = ":is([role=option], [role=menuitem]):not(:disabled)";

const itemsIn = (list: HTMLElement | null) => [...(list?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];

/** Scrolls `box` as little as shows all of `item`, one of its own rows. */
function showIn(box: HTMLElement, item: HTMLElement) {
  const bottom = item.offsetTop + item.offsetHeight;
  if (item.offsetTop < box.scrollTop) box.scrollTop = item.offsetTop;
  else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
}

const selectedIn = (items: HTMLElement[]) => items.findIndex((item) => item.getAttribute("aria-selected") === "true");

// A step up or down from `from`, held inside the list; from none, its first or last. From between two items, it's the
// one either side.
const step = (from: number | undefined, down: boolean, count: number) =>
  from === undefined
    ? down ? 0 : count - 1
    : Math.min(Math.max(down ? Math.floor(from) + 1 : Math.ceil(from) - 1, 0), count - 1);

/**
 * Up and Down through `list`'s options or menu items from the control that opens it, which keeps the focus: closed,
 * they open it; open, they step on from the one reached, the selected one, or where the list rests (`from`, an index
 * between two for a value between them). That one shows Hovered & Active and is the control's `aria-activedescendant`;
 * Enter picks it, as Space does from a button. The pointer moves it too, and it's let go as the list closes or `typed`
 * changes.
 */
export function useListKeys(
  list: RefObject<HTMLElement | null>,
  open: boolean,
  onOpen: () => void,
  { typed, from }: { typed?: string; from?: number } = {},
) {
  const [at, setAt] = useState(-1);
  const control = useRef<HTMLElement>(null);
  const base = useId();
  const [was, setWas] = useState({ open, typed });
  if (was.open !== open || was.typed !== typed) {
    setWas({ open, typed });
    if (!open || was.typed !== typed) setAt(-1);
  }

  // Marked on the DOM, as an item can be any list's, after every render that may have redrawn them.
  useLayoutEffect(() => {
    const items = itemsIn(list.current);
    items.forEach((item, i) => {
      item.toggleAttribute("data-keyed", i === at);
      if (i !== at && item.id.startsWith(base)) item.removeAttribute("id");
    });
    if (items[at]) items[at].id ||= `${base}-${at}`;
    if (items[at]) control.current?.setAttribute("aria-activedescendant", items[at].id);
    else control.current?.removeAttribute("aria-activedescendant");
  });

  // Its own list only: `scrollIntoView` would move every box round it too, a landing card's carousel and the page.
  useEffect(() => {
    const box = list.current;
    const item = itemsIn(box)[at];
    if (box && item) showIn(box, item);
  }, [list, at]);

  useEffect(() => {
    if (!open) return;
    const follow = (event: PointerEvent) => {
      const items = itemsIn(list.current);
      if (items.length) setAt(items.indexOf((event.target as Element).closest?.(ITEMS) as HTMLElement));
    };
    document.addEventListener("pointermove", follow);
    return () => document.removeEventListener("pointermove", follow);
  }, [list, open]);

  /** Takes the keys it handles, saying so. */
  return (event: KeyboardEvent<HTMLElement>) => {
    control.current = event.currentTarget;
    const down = event.key === "ArrowDown";
    if (down || event.key === "ArrowUp") {
      event.preventDefault();
      const items = itemsIn(list.current);
      if (!open) onOpen();
      else if (items.length) {
        const selected = selectedIn(items);
        setAt(step(at >= 0 ? at : selected >= 0 ? selected : from, down, items.length));
      }
      return true;
    }
    const picks = event.key === "Enter" || (event.key === " " && event.currentTarget.tagName === "BUTTON");
    if (!picks || !open || at < 0) return false;
    event.preventDefault();
    itemsIn(list.current)[at]?.click();
    return true;
  };
}

/** Up and Down move the focus through the options or menu items in the list holding it. */
export function moveFocus(event: KeyboardEvent<HTMLElement>) {
  const down = event.key === "ArrowDown";
  if (!down && event.key !== "ArrowUp") return;
  event.preventDefault();
  const items = itemsIn(event.currentTarget);
  items[step(items.indexOf(document.activeElement as HTMLElement), down, items.length)]?.focus();
}

/** Molecules/Form/Dropdown's item: an option, as large or small as its dropdown. */
function DropdownItem(props: Omit<ListItemProps, "type" | "role" | "nav">) {
  useHeldBy(DropdownItem);
  return <ListItem {...props} />;
}
DropdownItem.displayName = "Dropdown.Item";

type ItemElement = ReactElement<{ value?: string; onClick?: () => void; children?: ReactNode }>;

/** An item's value: its own, or its words. */
export const valueOf = (item: ItemElement) => item.props.value ?? textOf(wordsOf(item.props.children));

/** Each `of` among `children` as a menu's: picking one passes its value to `onPick`, then does what it says. */
export function MenuItems({
  of,
  onPick,
  size,
  children,
}: {
  of: unknown;
  onPick: (value: string) => void;
  size?: "large" | "small";
  children: ReactNode;
}) {
  return Children.map(children, (child) => {
    if (!isValidElement(child) || child.type !== of) return child;
    const item = child as ItemElement;
    const pick = () => {
      onPick(valueOf(item));
      item.props.onClick?.();
    };
    return <ItemContext value={{ of, selected: false, pick, size }}>{item}</ItemContext>;
  });
}

type DropdownBase = {
  /** Small, Atoms/Filter's 28px box over 12px items. */
  size?: "large" | "small";
  disabled?: boolean;
  /** Opens with its list showing, as the design system shows the Active state. */
  defaultOpen?: boolean;
  /** Small, across what holds it, its chevron at the end (a table cell's inline edit). */
  fill?: boolean;
  children?: ReactNode;
};

type SingleProps<T extends string> = DropdownBase & {
  multiple?: false;
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
};

type MultipleProps<T extends string> = DropdownBase & {
  /** Several picked at once, each item ticked; its box shows its label (its `Typography`) and how many are picked. */
  multiple: true;
  value?: T[];
  defaultValue?: T[];
  onChange?: (value: T[]) => void;
};

/**
 * Molecules/Form/Dropdown: its box, showing the value's item (`multiple`, its label), opens its `Dropdown.Item`s. It holds
 * the item picked, from `defaultValue`, unless its owner holds `value`; `multiple`, the items picked.
 */
function DropdownRoot(props: SingleProps<string> | MultipleProps<string>) {
  const { size = "large", disabled: off, defaultOpen = false, fill, children } = props;
  const small = size === "small";
  const [value, setValue] = useControllable<string | string[]>(
    props.value,
    props.defaultValue ?? (props.multiple ? [] : ""),
    props.onChange as ((value: string | string[]) => void) | undefined,
  );
  const picks = Array.isArray(value) ? value : [value];
  const { open, setOpen, outside } = useOpen(defaultOpen);
  const field = useField({ active: open });
  const disabled = off ?? field.disabled;
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), [setOpen]);
  const keys = useListKeys(list, open, () => setOpen(true));
  const { side, style, hang, mark, ignore } = useHang(root, list, open, { gap: small ? 4 : 2 });
  useDismiss({ ref: root, onDismiss: close, enabled: open, dismissOnOutsidePointer: outside, ignoreSelector: ignore });
  useEscapeLayer(list, open, close);
  const Chevron = small ? (open ? SmallChevronUpIcon : SmallChevronDownIcon) : open ? ChevronUpIcon : ChevronDownIcon;
  refuseOthers(children, DropdownItem);
  const items = partsOf(children, DropdownItem) as ItemElement[];
  const [label] = props.multiple ? partsOf(children, Typography) : [];
  const picked = items.findIndex((item) => valueOf(item) === value);
  const pick = (item: ItemElement) => {
    const next = valueOf(item);
    if (!props.multiple) {
      setValue(next);
      close();
    } else setValue(picks.includes(next) ? picks.filter((v) => v !== next) : [...picks, next]);
  };
  const shown = props.multiple ? (
    <>
      {label}
      {picks.length > 0 && (
        <Badge state={disabled ? "disabled" : undefined} inverted={disabled} aria-hidden={false}>
          {picks.length}
        </Badge>
      )}
    </>
  ) : (
    <span id={`${id}-value`} data-value="">
      {picked < 0 ? value : wordsOf(items[picked].props.children)}
    </span>
  );

  return (
    <div ref={root} className={anchorStyle} data-anchor="">
      <Typography
        tag="button"
        variant={small ? "metadata" : "bodyLarge"}
        type="button"
        id={field.id}
        className={small ? cx(selectStyle, smallBoxStyle) : boxStyle}
        data-box=""
        data-fill={fill ? "" : undefined}
        data-state={disabled ? undefined : field.state}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={field.labelId && !props.multiple ? `${field.labelId} ${id}-value` : undefined}
        aria-describedby={field.hintId}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={keys}
      >
        {shown}
        <Chevron aria-hidden />
      </Typography>
      {hang(
        <Presence>
          {open && (
            <div
              ref={list}
              style={style}
              {...mark}
              id={`${id}-list`}
              className={small ? panelStyle : listStyle}
              role="listbox"
              aria-multiselectable={props.multiple || undefined}
              aria-label={label && textOf(label)}
              aria-labelledby={label ? undefined : field.labelId}
              data-list={small ? (props.multiple ? "" : "short") : undefined}
              data-fill={small && fill ? "" : undefined}
              data-side={small ? undefined : side}
              data-escape-layer=""
            >
              {items.map((item, i) => (
                <Fragment key={i}>
                  {i > 0 && !small && <Divider />}
                  <ItemContext
                    value={{
                      of: DropdownItem,
                      // Of items alike, only the first holds a single value.
                      selected: props.multiple ? picks.includes(valueOf(item)) : i === picked,
                      pick: () => pick(item),
                      multiple: props.multiple,
                      size,
                    }}
                  >
                    {item}
                  </ItemContext>
                </Fragment>
              ))}
            </div>
          )}
        </Presence>,
      )}
    </div>
  );
}
DropdownRoot.displayName = "Dropdown";

export const Dropdown = Object.assign(DropdownRoot, { Item: ownPart(DropdownItem) }) as {
  <T extends string = string>(props: SingleProps<T>): ReactNode;
  <T extends string = string>(props: MultipleProps<T>): ReactNode;
  displayName?: string;
  Item: typeof DropdownItem;
};
