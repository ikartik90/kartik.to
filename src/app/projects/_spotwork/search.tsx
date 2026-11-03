"use client";

import {
  Fragment,
  useCallback,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { css } from "../../../../styled-system/css";
import { useDismiss } from "@/hooks/use-dismiss";
import { useControllable, useOpen } from "./controllable";
import { ItemContext, ListItem, listStyle, useHeldBy, useListKeys, valueOf, wordsOf, type ListItemProps } from "./dropdown";
import { ownPart, partsOf, refuseOthers, textOf } from "./slots";
import {
  Divider,
  Presence,
  Typography,
  anchorStyle,
  boxRaw,
  panelStyle,
  textInputStyle,
  useEscapeLayer,
  useField,
  useFocusWithin,
  useHang,
  type FieldTone,
} from "./ui";
import SearchIcon from "./assets/icons/medium/magnifying-glass.svg";
import CrossIcon from "./assets/icons/medium/cross.svg";
import SmallSearchIcon from "./assets/icons/small/magnifying-glass.svg";
import SmallCrossIcon from "./assets/icons/small/cross.svg";

// SW Curie's search: a box whose typing its owner filters by, at size small Atoms/Context Search; and `TypeAhead`,
// Molecules/Form/Type-ahead Search v2 (21533:28428), that box suggesting its items as it's typed in.

// Small, Atoms/Context Search, on a label holding its icon and input. Its focus shows on the table cell holding
// it (`searchFocusStyle`).
const contextSearchStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-xs)",
  width: "100%",
  height: "1.75rem",
  paddingInline: "var(--sw-padding-xs)",
  borderRadius: "var(--sw-radius-xs)",
  "&:focus-within": { color: "var(--sw-glyph-selected)" },
  "& > svg": { flexShrink: 0 },
  "& input": {
    flex: "1 1 auto",
    minWidth: 0,
    appearance: "none",
    border: "none",
    outline: "none",
    background: "none",
    font: "inherit",
    color: "var(--sw-glyph-default)",
    _placeholder: { color: "var(--sw-glyph-placeholder)" },
    "&::-webkit-search-cancel-button": { display: "none" },
  },
  // On its own in a toolbar, as Figma draws it: 200px, outlined, its focus its own.
  "&[data-boxed]": {
    flexShrink: 0,
    width: "12.5rem",
    backgroundColor: "var(--sw-surface-default)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
    _focusWithin: {
      boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)",
      outline: "2px solid var(--sw-outline-focus)",
    },
  },
  // Stretched across its column (Messenger's Contact List).
  "&[data-boxed][data-fill]": { width: "100%" },
  // Held Active, in a warning's or an alert's colours, or disabled; its currentColor icon follows.
  "&[data-boxed][data-active]": {
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)",
    outline: "2px solid var(--sw-outline-focus)",
  },
  "&[data-boxed][data-tone=warning]": {
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-warning)",
    outline: "2px solid var(--sw-outline-warning)",
    color: "var(--sw-glyph-warning)",
    _focusWithin: {
      boxShadow: "inset 0 0 0 1.5px var(--sw-border-warning)",
      outline: "2px solid var(--sw-outline-warning)",
    },
  },
  "&[data-boxed][data-tone=alert]": {
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-alert)",
    outline: "2px solid var(--sw-outline-alert)",
    color: "var(--sw-glyph-alert)",
    _focusWithin: {
      boxShadow: "inset 0 0 0 1.5px var(--sw-border-alert)",
      outline: "2px solid var(--sw-outline-alert)",
    },
  },
  "&[data-boxed][data-disabled]": {
    backgroundColor: "var(--sw-surface-disabled)",
    boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
    color: "var(--sw-glyph-disabled)",
    "& input": { color: "var(--sw-glyph-disabled)", _placeholder: { color: "var(--sw-glyph-disabled)" } },
  },
});

type SmallProps = Omit<ComponentProps<"input">, "size"> & {
  size: "small";
  boxed?: boolean;
  fill?: boolean;
  tone?: "warning" | "alert";
  "data-active"?: string;
};

/**
 * Atoms/Context Search: a search box named by its placeholder, bare in a table's head or `boxed` on its own; `fill`
 * stretches a boxed one across its column, and `data-active` holds it Active.
 */
function SmallSearch({ size: _size, boxed, fill, tone, "data-active": active, ...props }: SmallProps) {
  return (
    <Typography
      tag="label"
      variant="metadata"
      className={contextSearchStyle}
      data-boxed={boxed ? "" : undefined}
      data-fill={fill ? "" : undefined}
      data-active={active}
      data-tone={tone}
      data-disabled={props.disabled ? "" : undefined}
    >
      <SmallSearchIcon aria-hidden />
      <input type="search" aria-label={props.placeholder} {...props} />
    </Typography>
  );
}


const iconStyle = css({ display: "flex", flexShrink: 0, cursor: "pointer", _disabled: { cursor: "default" } });

// Lit up while it's typed in, or held so (`active`, Figma's Search Active).
const searchStyle = css(boxRaw, {
  flexShrink: 0,
  "&:focus-within, &[data-state=active]": {
    boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)",
    outline: "2px solid var(--sw-outline-focus)",
    color: "var(--sw-glyph-selected)",
  },
  "& input": {
    _placeholder: { color: "var(--sw-glyph-placeholder)" },
    "&::-webkit-search-cancel-button": { display: "none" },
  },
});

type DefaultProps = Omit<ComponentProps<"input">, "size" | "type" | "value" | "defaultValue" | "onChange"> & {
  size?: "large";
  value?: string;
  defaultValue?: string;
  onChange?: (query: string) => void;
  active?: boolean;
};

/** The search box alone: what's typed, held unless its owner holds `value`, and a Clear once there is some. */
function DefaultSearch({
  size: _size,
  value: held,
  defaultValue = "",
  onChange,
  active,
  placeholder = "Search...",
  ...props
}: DefaultProps) {
  const [query, setQuery] = useControllable(held, defaultValue, onChange);
  const input = useRef<HTMLInputElement>(null);
  return (
    <Typography tag="div" variant="bodyLarge" className={searchStyle} data-state={active ? "active" : undefined}>
      <input
        ref={input}
        type="search"
        placeholder={placeholder}
        aria-label={props["aria-label"] ?? placeholder}
        {...props}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {query ? (
        <button
          type="button"
          className={iconStyle}
          aria-label="Clear"
          onClick={() => {
            setQuery("");
            input.current?.focus();
          }}
        >
          <CrossIcon aria-hidden />
        </button>
      ) : (
        <SearchIcon aria-hidden />
      )}
    </Typography>
  );
}

type OptionElement = ReactElement<{ value?: string; children?: ReactNode }>;

const nameOf = (option: OptionElement) => textOf(wordsOf(option.props.children));

type TypeAheadProps = {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  disabled?: boolean;
  /** Opens with its suggestions showing, as the design system shows the Active state. */
  defaultOpen?: boolean;
  /** Typed before anything's picked. */
  defaultQuery?: string;
  /** Whether what's typed suggests the item of this value; by default, when its words hold it. */
  matches?: (value: string, typed: string) => boolean;
  /** What's typed as it changes, for an owner that fetches its items. */
  onQueryChange?: (typed: string) => void;
  /** The browser's own suggestions: none (`off`) unless its owner says otherwise. */
  autoComplete?: string;
  "aria-label"?: string;
  /** Its look outside a `Field`. */
  tone?: FieldTone;
  children?: ReactNode;
} & (
  | { size?: "large"; creates?: never }
  | {
      /** Atoms/Inline Input's box, a table cell's, its suggestions a filter's. */
      size: "small";
      /**
       * What it makes of what's typed that names none of its items: offered last, as `Create "…" <creates>`, and held
       * as its value.
       */
      creates?: string;
    }
);

/**
 * Molecules/Form/Type-ahead Search v2: its box suggests the `TypeAhead.Item`s whose words hold what's typed. It holds the
 * item picked, from `defaultValue`, unless its owner holds `value`.
 */
function TypeAheadRoot({
  value: held,
  defaultValue = null,
  onChange,
  disabled: off,
  defaultOpen = false,
  defaultQuery,
  matches,
  onQueryChange,
  autoComplete = "off",
  "aria-label": label,
  tone,
  size,
  creates,
  children,
}: TypeAheadProps) {
  const small = size === "small";
  const id = useId();
  const [value, setValue] = useControllable(held, defaultValue, onChange);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  refuseOthers(children, TypeAheadItem);
  const options = partsOf(children, TypeAheadItem) as OptionElement[];
  const [query, setQuery] = useState(() => {
    const held = options.find((option) => valueOf(option) === value);
    return defaultQuery ?? (held ? nameOf(held) : "");
  });
  // An option its owner picks from outside shows its name.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    const named = options.find((option) => valueOf(option) === value);
    if (named && nameOf(named).toLowerCase() !== query.trim().toLowerCase()) setQuery(nameOf(named));
  }
  const { open, setOpen, outside } = useOpen(defaultOpen);
  const close = useCallback(() => setOpen(false), [setOpen]);
  const typed = query.trim().toLowerCase();
  const suggestions = options.filter((option) =>
    matches && typed ? matches(valueOf(option), typed) : nameOf(option).toLowerCase().includes(typed),
  );
  const named = (text: string) => options.find((option) => nameOf(option).toLowerCase() === text.trim().toLowerCase());
  const created = creates && typed && !named(query) ? query.trim() : undefined;
  const listing = open && (suggestions.length > 0 || created !== undefined);
  const { side, style, hang, mark, ignore } = useHang(root, list, listing);
  useDismiss({ ref: root, onDismiss: close, enabled: open, dismissOnOutsidePointer: outside, ignoreSelector: ignore });
  useEscapeLayer(list, open, close);
  const keys = useListKeys(list, listing, () => setOpen(true), { typed: query });
  const [focused, focus] = useFocusWithin();
  const field = useField({ active: focused || listing, tone });
  const disabled = off ?? field.disabled;
  const pick = (option: OptionElement) => {
    setQuery(nameOf(option));
    setValue(valueOf(option));
    close();
  };
  const create = (text: string) => {
    setQuery(text);
    setValue(text);
    close();
  };
  const [Clear, Glass] = small ? [SmallCrossIcon, SmallSearchIcon] : [CrossIcon, SearchIcon];

  return (
    <div ref={root} className={anchorStyle} data-anchor="" {...focus}>
      <Typography
        tag="div"
        variant={small ? "metadata" : "bodyLarge"}
        className={textInputStyle}
        data-box=""
        data-size={small ? size : undefined}
        data-state={disabled ? undefined : field.state}
        data-disabled={disabled ? "" : undefined}
      >
        <input
          ref={input}
          id={field.id ?? id}
          role="combobox"
          aria-label={label}
          aria-expanded={listing}
          aria-controls={`${id}-list`}
          aria-describedby={field.hintId}
          autoComplete={autoComplete}
          disabled={disabled}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const text = event.target.value;
            setQuery(text);
            onQueryChange?.(text);
            setOpen(true);
            const match = named(text);
            setValue(match ? valueOf(match) : creates && text.trim() ? text.trim() : null);
          }}
          onKeyDown={(event) => {
            if (keys(event) || event.key !== "Enter" || !listing) return;
            event.preventDefault();
            if (suggestions[0]) pick(suggestions[0]);
            else if (created) create(created);
          }}
        />
        {listing || field.tone ? (
          <button
            type="button"
            className={iconStyle}
            aria-label="Clear"
            disabled={disabled}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery("");
              onQueryChange?.("");
              setValue(null);
              input.current?.focus();
            }}
          >
            <Clear aria-hidden />
          </button>
        ) : (
          <Glass aria-hidden />
        )}
      </Typography>
        {hang(
          <Presence>
            {listing && (
              <div
                ref={list}
                style={style}
                {...mark}
                id={`${id}-list`}
                className={small ? panelStyle : listStyle}
                role="listbox"
                aria-label={label}
                aria-labelledby={label ? undefined : field.labelId}
                data-tall={small ? undefined : ""}
                data-list={small ? "short" : undefined}
                data-side={small ? undefined : side}
                data-escape-layer=""
              >
                {suggestions.map((option, i) => (
                  <Fragment key={valueOf(option)}>
                    {i > 0 && !small && <Divider />}
                    <ItemContext
                      value={{ of: TypeAheadItem, selected: valueOf(option) === value, pick: () => pick(option), keepFocus: true, size }}
                    >
                      {option}
                    </ItemContext>
                  </Fragment>
                ))}
                {created !== undefined && (
                  <ItemContext value={{ of: TypeAheadItem, selected: false, pick: () => create(created), keepFocus: true, size }}>
                    <TypeAheadItem value={created}>
                      <Typography variant="metadata">{`Create "${created}" ${creates}`}</Typography>
                    </TypeAheadItem>
                  </ItemContext>
                )}
              </div>
            )}
          </Presence>,
        )}
    </div>
  );
}
TypeAheadRoot.displayName = "TypeAhead";

/** A search box; at size small, Atoms/Context Search. */
export function Search(props: DefaultProps | SmallProps) {
  if (props.size === "small") return <SmallSearch {...props} />;
  return <DefaultSearch {...props} />;
}
Search.displayName = "Search";

/** A type-ahead's suggestion: an option. */
function TypeAheadItem(props: Omit<ListItemProps, "type" | "role" | "nav">) {
  useHeldBy(TypeAheadItem);
  return <ListItem {...props} />;
}
TypeAheadItem.displayName = "TypeAhead.Item";

export const TypeAhead = Object.assign(TypeAheadRoot, { Item: ownPart(TypeAheadItem) });
