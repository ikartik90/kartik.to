"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  use,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { Avatar } from "./data-table";
import { Div } from "./ds-tailwind";
import { restOf } from "./slots";
import { Button, Field, Link, Typography, lineStyle, tableCellRaw, titleLineStyle, useCardValue } from "./ui";
import ChevronRightIcon from "./assets/icons/medium/chevron-right.svg";
import SmallEditIcon from "./assets/icons/small/edit.svg";

// SW Curie's Molecules/Inline Table Record: the parts the Card page draws its records with (13153:64010).

// A record inside a button (or a cell that is one) lays itself out in spans.
const RecordContext = createContext({ inButton: false });

// Whether a record is picked, and picking it.
const SelectionContext = createContext({ selected: false, select: () => {} });

// A row ruled off from the one above, of Molecules/Cell Blueprints (`cellStyle`); the records' column headings
// (`data-header`) have no rule. One that selects or opens something (a button, or holding one as a cell) lights up
// without the rules above and below it while pointed at, and a progress bar's track with it.
const recordStyle = css({
  display: "flex",
  alignItems: "center",
  width: "100%",
  minWidth: 0,
  boxShadow: "inset 0 1px 0 var(--sw-border-subdued)",
  textAlign: "start",
  "&[data-header]": { boxShadow: "none" },
  "&[data-align=start]": { alignItems: "flex-start" },
  "&:is(button, :has(> button)):hover": {
    borderRadius: "var(--sw-radius-xs)",
    backgroundColor: "var(--sw-hover-shade)",
    boxShadow: "none",
    "--progress-track": "var(--sw-surface-data-viz-track-active)",
  },
  ":is(button, :has(> button)):hover + &": { boxShadow: "none" },
});

// A cell, as wide as Figma's column (`data-width`) or the room left (`data-fill`), its parts at its end (`data-align`).
const cellStyle = css(tableCellRaw, {
  "&:not(:last-child)": { boxShadow: "none" },
  "&[data-fill]": { flex: "1 1 0" },
  "&[data-width='150']": { flex: "0 0 9.25rem" },
  "&[data-width='200']": { flex: "0 0 12.5rem" },
  "&[data-width='220']": { flex: "0 0 13.75rem" },
  "&[data-width='300']": { flex: "0 0 18.75rem" },
  "&[data-align=end]": { justifyItems: "end" },
  "&[data-align=end] > div, &[data-align=end] > [data-line]": { justifySelf: "end" },
});

// A cell's first line, as tall as the 28px buttons in its row: its words cut short, then what follows them, a chevron
// at its end.
const lineRowStyle = css({
  gap: "var(--sw-gap-md)",
  "& > svg": { flexShrink: 0 },
  "& > svg:not([data-meta] + svg)": { marginInlineStart: "auto" },
});

const metadataStyle = css({ flexShrink: 0, minWidth: "9.25rem", marginInlineStart: "auto", textAlign: "end" });

const clampStyle = css({ lineClamp: 2, "&[data-open]": { lineClamp: "none" } });

const moreStyle = css({ display: "flex", flexDirection: "column", alignItems: "flex-start" });

type RecordProps = Omit<HTMLAttributes<HTMLElement>, "onClick"> & {
  align?: "start";
  /** The column headings over its records. */
  header?: boolean;
  onClick?: () => void;
  /** Picked among its card's records by this (`Card`'s `defaultValue`). */
  value?: string;
  /** On its own, picked from the start. */
  defaultSelected?: boolean;
};

function RecordRoot({ align, header, onClick, value, defaultSelected = false, className, ...props }: RecordProps) {
  const card = useCardValue();
  const [own, setOwn] = useState(defaultSelected);
  const selection =
    value === undefined
      ? { selected: own, select: () => setOwn(true) }
      : { selected: card.value === value, select: () => card.pick(value) };
  const look = { className: cx(recordStyle, className), "data-align": align, "data-header": header ? "" : undefined, ...props };
  return (
    <SelectionContext value={selection}>
      <RecordContext value={{ inButton: !!onClick }}>
        {onClick ? <button type="button" onClick={onClick} {...look} /> : <div {...look} />}
      </RecordContext>
    </SelectionContext>
  );
}

type CellProps = Omit<HTMLAttributes<HTMLElement>, "onClick"> & {
  fill?: boolean;
  width?: 150 | 200 | 220 | 300;
  /** Its parts at its end. */
  align?: "end";
  /** A button picking its record, pressed while it's picked. */
  selects?: boolean;
  onClick?: () => void;
};

type Typed = ReactElement<{ tag?: string; variant?: string; className?: string }>;

const isTypography = (child: ReactNode): child is Typed => isValidElement(child) && child.type === Typography;
const inline = (tag?: string) => tag === undefined || tag === "span";

// What ends a line: words of their own (a `p` Typography), a description, a field, or a box.
const isBlock = (child: ReactNode) =>
  isValidElement(child) &&
  ((child.type === Typography && !inline((child as Typed).props.tag)) ||
    child.type === RecordDescription ||
    child.type === Field ||
    child.type === "div" ||
    (child.type as { tag?: string }).tag === "div");

const isWords = (child: ReactNode): child is Typed =>
  isTypography(child) && inline(child.props.tag) && child.props.variant !== "metadata";

/** Words in a line's row, cut short; its metadata at its end. */
const inRow = (child: ReactNode) =>
  isTypography(child) && inline(child.props.tag)
    ? cloneElement(
        child,
        child.props.variant === "metadata"
          ? ({ className: cx(child.props.className, lineStyle, metadataStyle), "data-meta": "" } as object)
          : { className: cx(child.props.className, lineStyle) },
      )
    : child;

/**
 * A cell's children laid out: a line's row from each of its inline `body` Typographies, holding what follows them
 * (pills, a chip, their metadata, a chevron) until a block. Inside a button, its block Typographies are spans.
 */
function cellContent(children: ReactNode, inButton: boolean) {
  const parts: (ReactNode | ReactNode[])[] = [];
  let line: ReactNode[] | null = null;
  for (const child of Children.toArray(children)) {
    if (line && !isBlock(child)) line.push(inRow(child));
    else if (isWords(child)) parts.push((line = [inRow(child)]));
    else {
      line = null;
      const inSpan = inButton && isTypography(child) && !inline(child.props.tag);
      parts.push(inSpan ? cloneElement(child, { tag: "span" }) : child);
    }
  }
  const Row = inButton ? "span" : "div";
  return parts.map((part, i) =>
    Array.isArray(part) ? (
      <Row key={`line-${i}`} className={cx(titleLineStyle, lineRowStyle)} data-line="">
        {part}
      </Row>
    ) : (
      part
    ),
  );
}

function RecordCell({ fill, width, align, selects, onClick, className, style, children: given, ...props }: CellProps) {
  const { inButton } = use(RecordContext);
  const { selected, select } = use(SelectionContext);
  const press = selects ? select : onClick;
  const children = cellContent(given, inButton || !!press);
  const look = {
    className: cx(cellStyle, className),
    style: { "--lines": Math.max(restOf(children, Avatar).length, 1), ...style } as CSSProperties,
    "data-fill": fill ? "" : undefined,
    "data-width": width,
    "data-align": align,
    "data-selects": selects ? "" : undefined,
    "aria-pressed": selects ? selected : undefined,
    ...props,
  };
  if (!press) return inButton ? <span {...look}>{children}</span> : <div {...look}>{children}</div>;
  return (
    <RecordContext value={{ inButton: true }}>
      <button type="button" onClick={press} {...look}>
        {children}
      </button>
    </RecordContext>
  );
}

/** What shows while its record is picked. */
function RecordSelected({ children }: { children: ReactNode }) {
  return use(SelectionContext).selected ? children : null;
}

/**
 * Its `Typography` child under a cell's line, in full; `clamp`ed, two lines of it until Show more. Inside a button,
 * a span.
 */
function RecordDescription({ clamp, children }: { clamp?: boolean; children: ReactNode }) {
  const { inButton } = use(RecordContext);
  const [open, setOpen] = useState(false);
  const words = Children.toArray(children).filter(isTypography);
  if (!clamp)
    return words.map((word) =>
      cloneElement(word, { tag: inButton ? "span" : (word.props.tag ?? "p"), "data-description": "" } as object),
    );
  return (
    <div className={moreStyle}>
      {words.map((word) =>
        cloneElement(word, {
          tag: word.props.tag ?? "p",
          className: cx(word.props.className, clampStyle),
          "data-open": open ? "" : undefined,
        } as object),
      )}
      {!open && <Link onClick={() => setOpen(true)}>Show more</Link>}
    </div>
  );
}

RecordRoot.displayName = "InlineTableRecord";
RecordCell.displayName = "InlineTableRecord.Cell";
RecordDescription.displayName = "InlineTableRecord.Description";
RecordSelected.displayName = "InlineTableRecord.Selected";

/**
 * Molecules/Inline Table Record: a row with a slot for its cells, a button as a whole given `onClick`. A `Cell` lays
 * out its `Typography` children: its line's words (`body`), what follows them in its row and their metadata
 * (`metadata`, at the line's end), then under it subcontent (a `p`) or a `Description`, beside an `Avatar`. A cell that
 * `selects` picks the record, and `Selected` shows while it's picked.
 */
export const InlineTableRecord = Object.assign(RecordRoot, {
  Cell: RecordCell,
  Description: RecordDescription,
  Selected: RecordSelected,
});

/** Settings Record, Type Navigation: a setting that opens its own page, with what it holds; `record` goes on the record. */
export const navigationRecord = (title: string, metadata?: string, record?: RecordProps & Record<`data-${string}`, string>) => (
  <InlineTableRecord {...record}>
    <InlineTableRecord.Cell fill>
      <Typography variant="body">{title}</Typography>
      {metadata && <Typography variant="metadata" color="subdued">{metadata}</Typography>}
      <ChevronRightIcon aria-hidden />
    </InlineTableRecord.Cell>
  </InlineTableRecord>
);

/** Settings Record, Type Destructive: what can't be undone, said in full over its button. */
export const destructiveRecord = (title: string, description: string, action: string) => (
  <InlineTableRecord>
    <InlineTableRecord.Cell fill>
      <Typography variant="body">{title}</Typography>
      <Div tw="flex flex-col items-start gap-(--sw-gap-md)">
        <InlineTableRecord.Description>
          <Typography variant="metadata" color="subdued">{description}</Typography>
        </InlineTableRecord.Description>
        <Button size="small" emphasis="secondary" tone="destructive">
          {action}
        </Button>
      </Div>
    </InlineTableRecord.Cell>
  </InlineTableRecord>
);

/** Settings Record, Type Switch: its small `Switch` named by `label`, what it does under them. */
export const switchRecord = (label: string, toggle: ReactElement, description?: string) => (
  <InlineTableRecord>
    <InlineTableRecord.Cell fill>
      <Field orientation="horizontal">
        <Field.Label>{label}</Field.Label>
        {toggle}
      </Field>
      {description && (
        <InlineTableRecord.Description>
          <Typography variant="metadata" color="subdued">{description}</Typography>
        </InlineTableRecord.Description>
      )}
    </InlineTableRecord.Cell>
  </InlineTableRecord>
);

/** A Generic Card head's button, editing what the card is about. */
export const editButton = (label: string, onClick?: () => void) => (
  <Button size="small" emphasis="secondary" onClick={onClick}>
    <SmallEditIcon aria-hidden />
    {label}
  </Button>
);
