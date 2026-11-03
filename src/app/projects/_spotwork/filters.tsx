"use client";

import {
  Children,
  createContext,
  use,
  useCallback,
  useContext,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { css } from "../../../../styled-system/css";
import type { SystemStyleObject } from "../../../../styled-system/types";
import { useDismiss } from "@/hooks/use-dismiss";
import { useControllable, useOpen } from "./controllable";
import { ListItem, MenuItems, useHeldBy, useListKeys, type ListItemProps } from "./dropdown";
import { ownPart, partsOf, refuseOthers, textOf } from "./slots";
import { Badge, Checkbox, FieldContext, Presence, TextInput, Typography, panelStyle, selectStyle, useEscapeLayer, useFlip } from "./ui";
import ChevronDownIcon from "./assets/icons/small/chevron-down.svg";
import ChevronUpIcon from "./assets/icons/small/chevron-up.svg";

// SW Curie's Filter parts: Atoms/Filter/Bulk Select, and Molecules/Range Type and Range Selector, their ends small
// `TextInput`s.

const rootStyle = css({ position: "relative" });

/** A filter's button and the panel it opens under itself, closed by Escape or a press outside. */
function useFilterPanel(defaultOpen: boolean) {
  const { open, setOpen, outside } = useOpen(defaultOpen);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss({ ref: root, onDismiss: close, enabled: open, dismissOnOutsidePointer: outside });
  useEscapeLayer(panel, open, close);
  return { open, setOpen, close, root, panel };
}

const Chevron = ({ open }: { open: boolean }) => (open ? <ChevronUpIcon aria-hidden /> : <ChevronDownIcon aria-hidden />);

// Range Type's track, dots, fill and handles, which the location history's timeline shares.
export const sliderRaw = css.raw({
  "& [data-track]": {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    height: "0.25rem",
    borderRadius: "var(--sw-radius-xxs)",
    backgroundColor: "var(--sw-surface-disabled)",
    cursor: "pointer",
    touchAction: "none",
  },
  "& [data-dot]": {
    width: "0.25rem",
    height: "0.25rem",
    borderRadius: "var(--sw-radius-full)",
    backgroundColor: "var(--sw-glyph-placeholder)",
    "&[data-dot=end]": { backgroundColor: "var(--sw-surface-disabled)" },
  },
  "& [data-fill]": { position: "absolute", insetBlockStart: 0, height: "0.25rem", backgroundColor: "var(--sw-glyph-selected)" },
  "& [role=slider]": {
    position: "absolute",
    insetBlockStart: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "1rem",
    height: "1rem",
    translate: "-50% -50%",
    outline: "none",
    cursor: "grab",
    "&::before": {
      content: '""',
      width: "0.5rem",
      height: "0.5rem",
      borderRadius: "var(--sw-radius-full)",
      backgroundColor: "var(--sw-surface-default)",
      boxShadow: "inset 0 0 0 1.5px var(--sw-border-selected)",
    },
  },
  // An end grows, its value showing under it, only while pointed at, keyed, dragged or typed into.
  "& [role=slider]:is(:hover, :focus-visible, [data-active])::before": { width: "0.75rem", height: "0.75rem" },
  "& [role=slider]:is(:hover, :focus-visible, [data-active]) > span": { display: "flex" },
  "& [role=slider][data-pressed]": { zIndex: 1, "&::before": { backgroundColor: "var(--sw-glyph-selected)" } },
  "& [role=slider] > span": {
    position: "absolute",
    insetBlockStart: "1rem",
    insetInlineStart: "50%",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "1.5rem",
    height: "1.25rem",
    paddingInline: "var(--sw-padding-xxs)",
    translate: "-50% 0",
    borderRadius: "var(--sw-radius-xxs)",
    backgroundColor: "var(--sw-surface-inverted-subdued)",
    color: "var(--sw-glyph-inverted-default)",
    whiteSpace: "nowrap",
  },
});

// SW Curie's Molecules/Range Type (3256:1548): a bar chart over a track, the range between two handles; Discrete steps
// through its labelled values, Continuous through tenths, with an input for each end.
const rangeRaw = css.raw(sliderRaw, {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--sw-gap-xs)",
  width: "13rem",
  paddingBlock: "var(--sw-padding-md)",
  "&[data-type=continuous]": { alignItems: "flex-start", width: "13rem" },
  "& > [data-frame]": {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "var(--sw-gap-3xs)",
    width: "100%",
    paddingBlockStart: "var(--sw-padding-md)",
    paddingInline: "var(--sw-padding-md)",
  },
  "& [data-graph]": { display: "flex", alignItems: "flex-end", gap: "var(--sw-gap-3xs)", width: "100%", paddingInline: "var(--sw-padding-xxs)" },
  "& [data-graph] > span": { flex: "1 1 0", backgroundColor: "var(--sw-surface-data-viz-track-default)" },
  "& [data-graph] > span[data-in]": { backgroundColor: "var(--sw-surface-data-viz-track-active)" },
  // Its track alone, as wide as what holds it, with room under it for the value its handle shows.
  "&[data-track-only]": { width: "100%", paddingBlock: "0 var(--sw-padding-3xl)" },
  "&[data-track-only] > [data-frame]": { padding: 0 },
  "&[data-type=continuous] [data-graph]": { justifyContent: "space-between", gap: "var(--sw-gap-none)" },
  "&[data-type=continuous] [data-graph] > span": { flex: "none", width: "0.125rem" },
  "& > [data-steps], & > [data-limits]": {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    paddingInline: "var(--sw-padding-xxs)",
    "& > span": { width: "1.25rem", textAlign: "center" },
  },
  "& > [data-steps] > [data-in]": { color: "var(--sw-glyph-default)" },
  "& > [data-inputs]": {
    display: "flex",
    gap: "var(--sw-gap-md)",
    width: "100%",
    paddingBlockStart: "var(--sw-padding-xs)",
    paddingInline: "var(--sw-padding-md)",
  },
});

type Ends = [number, number];
type End = 0 | 1;

const format = (value: number) => String(Math.round(value * 10) / 10);

/** A track from `min` to `max`, or a Discrete one's `steps`: the values its stops stand for, evenly spaced. */
type Bounds = { min: number; max: number; steps?: undefined } | { steps: number[]; min?: undefined; max?: undefined };

const endsOf = (bounds: Bounds): Ends => (bounds.steps ? [bounds.steps[0], bounds.steps.at(-1)!] : [bounds.min, bounds.max]);

/** A Discrete track's stops: its steps, or every whole number from `min` to `max`. */
const stopsOf = (bounds: Bounds) =>
  bounds.steps ?? Array.from({ length: Math.round(bounds.max - bounds.min) + 1 }, (_, i) => bounds.min + i);

type RangeShape = { type: "discrete" | "continuous"; stops: number[]; min: number; max: number; value: Ends };

const RangeContext = createContext<RangeShape>({ type: "discrete", stops: [0, 1], min: 0, max: 1, value: [0, 1] });

// Whether a bar is in its range type's range, from the Data Viz holding it.
const BarContext = createContext(false);

/** One of its Data Viz's bars, `height` px tall, lit while in the range. */
function RangeTypeBar({ height }: { height: number }) {
  return <span data-in={useContext(BarContext) ? "" : undefined} style={{ height }} />;
}
RangeTypeBar.displayName = "RangeType.Bar";

/** Its Data Viz: a bar chart of its `RangeType.Bar`s over its track, those in its range lit. */
function RangeTypeDataViz({ children }: { children: ReactNode }) {
  const { type, stops, min, max, value } = useContext(RangeContext);
  const bars = partsOf(children, RangeTypeBar);
  const inRange = (v: number) => v >= value[0] && v <= value[1];
  return (
    <div data-graph="" aria-hidden>
      {bars.map((bar, i) => {
        const at = type === "discrete" ? stops[i] : min + (i / Math.max(bars.length - 1, 1)) * (max - min);
        const on = type === "discrete" ? inRange(at) && inRange(stops[i + 1]) : inRange(at);
        return (
          <BarContext key={bar.key} value={on}>
            {bar}
          </BarContext>
        );
      })}
    </div>
  );
}
RangeTypeDataViz.displayName = "RangeType.DataViz";

/**
 * Molecules/Range Type: a range between `min` and `max`, or across a Discrete one's `steps`; dragged, pressed on its
 * track, keyed, or typed. Its `RangeType.DataViz` goes over its track, one bar per step for Discrete, any number for
 * Continuous. `single`, only its upper end has a handle, its range running from the track's start. `trackOnly`, it
 * shows its track alone, without limits or inputs. `smooth`, a Continuous end follows the pointer between tenths.
 * In a `Field`, its label names it; elsewhere its `aria-label`.
 */
function RangeTypeRoot({
  type,
  single,
  trackOnly,
  smooth,
  "aria-label": label,
  value: held,
  defaultValue,
  onChange: heard,
  css: own,
  children,
  ...bounds
}: Bounds & {
  type: RangeShape["type"];
  single?: boolean;
  trackOnly?: boolean;
  smooth?: boolean;
  "aria-label"?: string;
  /** Its ends; without them, it holds its own, starting at `defaultValue` (or the whole track). */
  value?: Ends;
  defaultValue?: Ends;
  onChange?: (next: Ends) => void;
  css?: SystemStyleObject;
  children?: ReactNode;
}) {
  const { labelId } = use(FieldContext);
  const [min, max] = endsOf(bounds);
  const stops = stopsOf(bounds);
  const [value, onChange] = useControllable(held, defaultValue ?? [min, max], heard);
  const discrete = type === "discrete";
  const [drafts, setDrafts] = useState<[string | null, string | null]>([null, null]);
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<End | null>(null);
  const [typing, setTyping] = useState<End | null>(null);

  const fraction = (v: number) => (discrete ? stops.indexOf(v) / (stops.length - 1) : (v - min) / (max - min));
  // Discrete ends sit on the step dots, whose centres are 2px in from the track's ends.
  const place = (v: number) => (discrete ? `calc(0.125rem + (100% - 0.25rem) * ${fraction(v)})` : `calc(100% * ${fraction(v)})`);
  const span = (from: number, to: number) =>
    discrete ? `calc((100% - 0.25rem) * ${fraction(to) - fraction(from)})` : `calc(100% * ${fraction(to) - fraction(from)})`;
  // A Discrete end only ever lands on a stop; a Continuous one on a tenth, unless it's dragged `smooth`.
  const snap = (v: number) => (discrete ? v : Number((Math.round(v * 10) / 10).toFixed(1)));

  const move = (end: End, to: number, free = false) => {
    const at = free ? to : snap(to);
    const next: Ends = [...value];
    next[end] = end === 0 ? Math.min(Math.max(at, min), value[1]) : Math.max(Math.min(at, max), value[0]);
    if (next[end] !== value[end]) onChange(next);
  };

  const valueAt = (clientX: number) => {
    const node = track.current!;
    const box = node.getBoundingClientRect();
    const inset = discrete ? (2.5 * box.width) / (node.offsetWidth || box.width || 1) : 0;
    const width = box.width - 2 * inset || 1;
    const along = (clientX - box.left - inset) / width;
    if (!discrete) return min + along * (max - min);
    return stops[Math.min(Math.max(Math.round(along * (stops.length - 1)), 0), stops.length - 1)];
  };

  const press = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const to = valueAt(event.clientX);
    const off = (end: End) => Math.abs(fraction(to) - fraction(value[end]));
    const end: End = !single && (off(0) < off(1) || (value[0] === value[1] && to < value[0])) ? 0 : 1;
    setDragging(end);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    move(end, to, smooth);
  };

  const key = (end: End) => (event: KeyboardEvent<HTMLSpanElement>) => {
    const by = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
    if (by === undefined) return;
    event.preventDefault();
    const next = discrete ? stops[stops.indexOf(value[end]) + by] : value[end] + by / 10;
    if (next !== undefined) move(end, next);
  };

  const typeInto = (end: End) => (text: string) => {
    setDrafts((current) => (end === 0 ? [text, current[1]] : [current[0], text]));
    const typed = text.trim() === "" ? NaN : Number(text);
    const [low, high] = end === 0 ? [min, value[1]] : [value[0], max];
    if (!Number.isNaN(typed) && typed >= low && typed <= high) move(end, typed);
  };

  const inRange = (v: number) => v >= value[0] && v <= value[1];
  const ends = single ? ([1] as const) : ([0, 1] as const);

  return (
    <div className={css(rangeRaw, own)} data-type={type} data-track-only={trackOnly ? "" : undefined}>
      <div data-frame="">
        <RangeContext value={{ type, stops, min, max, value }}>{children}</RangeContext>
        <div
          ref={track}
          data-track=""
          onPointerDown={press}
          onPointerMove={(event) => dragging !== null && move(dragging, valueAt(event.clientX), smooth)}
          onPointerUp={() => setDragging(null)}
          onPointerCancel={() => setDragging(null)}
        >
          {discrete &&
            stops.map((at, i) => <span key={at} data-dot={i === 0 || i === stops.length - 1 ? "end" : ""} />)}
          <span data-fill="" style={{ left: place(value[0]), width: span(value[0], value[1]) }} />
          {ends.map((end) => (
            <span
              key={end}
              role="slider"
              tabIndex={0}
              aria-labelledby={labelId}
              aria-label={label}
              aria-valuemin={end === 0 ? min : value[0]}
              aria-valuemax={end === 0 ? value[1] : max}
              aria-valuenow={value[end]}
              data-active={dragging === end || typing === end ? "" : undefined}
              data-pressed={dragging === end ? "" : undefined}
              style={{ left: place(value[end]) }}
              onKeyDown={key(end)}
            >
              {!discrete && <Typography variant="metadata">{format(value[end])}</Typography>}
            </span>
          ))}
        </div>
      </div>
      {trackOnly ? null : discrete ? (
        <Typography tag="div" variant="metadata" color="placeholder" data-steps="">
          {stops.map((at) => (
            <span key={at} data-in={inRange(at) ? "" : undefined}>
              {at}
            </span>
          ))}
        </Typography>
      ) : (
        <>
          <Typography tag="div" variant="metadata" color="placeholder" data-limits="">
            <span>{min}</span>
            <span>{max}</span>
          </Typography>
          <div data-inputs="">
            {ends.map((end) => (
              <TextInput
                key={end}
                size="small"
                inputMode="decimal"
                value={drafts[end] ?? format(value[end])}
                onChange={typeInto(end)}
                active={typing === end}
                onFocus={() => setTyping(end)}
                onBlur={() => {
                  setTyping(null);
                  setDrafts((current) => (end === 0 ? [null, current[1]] : [current[0], null]));
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
RangeTypeRoot.displayName = "RangeType";

export const RangeType = Object.assign(RangeTypeRoot, { DataViz: RangeTypeDataViz, Bar: RangeTypeBar });

/**
 * Molecules/Range Selector (3264:2507): a filter's button, its label a `Typography` (which names its dialog too), and
 * the range applied, over a Discrete Range Type from `min` to `max` or across its `steps`.
 */
export function RangeSelector({
  value: held,
  defaultValue,
  onChange: heard,
  disabled,
  defaultOpen = false,
  children,
  ...bounds
}: Bounds & {
  /** The range applied; without it, it holds its own, starting at `defaultValue` (or the whole track, none applied). */
  value?: Ends;
  defaultValue?: Ends;
  onChange?: (next: Ends) => void;
  disabled?: boolean;
  /** Opens with its range showing, as the design system shows the Active state. */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { open, setOpen, root, panel } = useFilterPanel(defaultOpen);
  const [min, max] = endsOf(bounds);
  const [value, onChange] = useControllable(held, defaultValue ?? [min, max], heard);
  const applied = value[0] !== min || value[1] !== max;
  return (
    <div ref={root} className={rootStyle}>
      <button
        type="button"
        className={selectStyle}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <span data-group="">
          {children}
          {applied && (
            <Badge state={disabled ? "disabled" : undefined} inverted={disabled} aria-hidden={false}>
              {`${value[0]}–${value[1]}`}
            </Badge>
          )}
        </span>
        <Chevron open={open} />
      </button>
      <Presence>
        {open && (
          <div
            ref={panel}
            className={panelStyle}
            data-hug=""
            role="dialog"
            aria-label={textOf(children)}
            data-escape-layer=""
          >
            <RangeType type="discrete" {...bounds} value={value} onChange={onChange} />
          </div>
        )}
      </Presence>
    </div>
  );
}

const bulkChevronStyle = css({ display: "flex", color: "inherit", cursor: "pointer", overflow: "hidden" });

/**
 * Atoms/Filter/Bulk Select (6571:14740): a checkbox picking every row, and a menu of its `BulkSelect.Item`s, the groups
 * to pick instead, or no menu without any; its checkbox and menu small or `large`. `subtle`, it's a plain checkbox until pointed at, focused by keyboard
 * or open, when its box opens out round the chevron.
 */
function BulkSelectRoot({
  checked: held,
  defaultChecked = false,
  onCheck,
  onPick,
  defaultOpen = false,
  size = "small",
  subtle,
  "aria-label": label = "Select all",
  children,
}: {
  /** Its tick; without it, it holds its own, from `defaultChecked`, ticked by an option picked too. */
  checked?: boolean;
  defaultChecked?: boolean;
  onCheck?: (on: boolean) => void;
  onPick?: (value: string) => void;
  /** Opens with its menu showing, as the design system shows the Active state. */
  defaultOpen?: boolean;
  size?: "large" | "small";
  subtle?: boolean;
  /** Its checkbox's name. */
  "aria-label"?: string;
  children: ReactNode;
}) {
  refuseOthers(children, BulkSelectItem);
  const { open, setOpen, close, root, panel } = useFilterPanel(defaultOpen);
  const side = useFlip(root, panel, open);
  const keys = useListKeys(panel, open, () => setOpen(true));
  const [checked, setChecked] = useControllable(held, defaultChecked, onCheck);
  const pick = (value: string) => {
    onPick?.(value);
    if (held === undefined) setChecked(true);
    close();
  };
  return (
    <div ref={root} className={rootStyle}>
      <Typography
        tag="div"
        variant="metadata"
        className={selectStyle}
        data-bulk=""
        data-size={size === "large" ? size : undefined}
        data-subtle={subtle ? "" : undefined}
      >
        <Checkbox size={size === "small" ? "small" : undefined} aria-label={label} checked={checked} onChange={setChecked} />
        {Children.count(children) > 0 && (
          <button
            type="button"
            className={bulkChevronStyle}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            onKeyDown={keys}
          >
            <Chevron open={open} />
          </button>
        )}
      </Typography>
      <Presence>
        {open && (
          <div
            ref={panel}
            className={panelStyle}
            data-list=""
            data-side={side}
            data-size={size === "large" ? size : undefined}
            role="menu"
            data-escape-layer=""
          >
            <MenuItems of={BulkSelectItem} onPick={pick} size={size}>
              {children}
            </MenuItems>
          </div>
        )}
      </Presence>
    </div>
  );
}
BulkSelectRoot.displayName = "BulkSelect";

/** A bulk select's group to pick: an item of its menu, the bulk select's size; large, its words are `body`. */
function BulkSelectItem(props: Omit<ListItemProps, "type" | "role" | "nav" | "size">) {
  useHeldBy(BulkSelectItem);
  return <ListItem {...props} role="menuitem" />;
}
BulkSelectItem.displayName = "BulkSelect.Item";

export const BulkSelect = Object.assign(BulkSelectRoot, { Item: ownPart(BulkSelectItem) });
