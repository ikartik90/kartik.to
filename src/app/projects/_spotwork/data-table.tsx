"use client";

import Image, { type StaticImageData } from "next/image";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentProps,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { useWireframe } from "@/components/ui/wireframe";
import type { SystemStyleObject } from "../../../../styled-system/types";
import { useControllable } from "./controllable";
import type { Status } from "./data";
import { TypeAhead } from "./search";
import { ownPart, partsOf, textOf, useOwner } from "./slots";
import {
  Button,
  Pill,
  STATUS_PILL,
  STATUS_ICON,
  Tooltip,
  Typography,
  alertIf,
  columnHeadRaw,
  dividedRaw,
  searchFocusStyle,
  tableCellRaw,
  tableHeadStyle,
  tableOutlineStyle,
  tableRowRaw,
  useEscapeLayer,
} from "./ui";
import AddIcon from "./assets/icons/medium/add.svg";
import CrossIcon from "./assets/icons/medium/cross.svg";
import SortIcon from "./assets/sort.svg";
import SortDescendingIcon from "./assets/sort-descending.svg";
import BusinessIcon from "./assets/icons/large/business.svg";

// SW Curie's Data Table parts (663:1458): the table, its sections, rows and cells, and what goes in a cell.

// A face or its initials filling its box, a hairline round it keeping a pale face apart from a white ground (an
// outline, so it's drawn over the picture); 55 by default, `medium` 50, `inline` 30 beside a name.
const avatarStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "3.5rem",
  height: "3.5rem",
  "& > img, & > span": {
    width: "100%",
    height: "100%",
    borderRadius: "var(--sw-radius-full)",
    outline: "0.5px solid var(--sw-border-subdued)",
    outlineOffset: "-0.5px",
  },
  "& > img": { objectFit: "cover" },
  // Loading, a blank of its shape.
  "& > [data-blank]": { backgroundColor: "var(--sw-glyph-disabled)", outlineColor: "transparent" },
  "& > span": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--sw-surface-avatar)",
    color: "var(--sw-glyph-avatar)",
  },
  "&[data-size=large]": { width: "4.5rem", height: "4.5rem" },
  "&[data-size=medium]": { width: "3rem", height: "3rem" },
  "&[data-size=inline]": { width: "1.75rem", height: "1.75rem" },
  "&[data-type=company] > *": { borderRadius: "var(--sw-radius-xs)" },
  "&[data-type=company][data-size=large] > *": { borderRadius: "var(--sw-radius-md)" },
  "&[data-size=large] svg": { width: "3rem", height: "3rem" },
});

// A table: its columns laid out once, each section and row taking them up, so a column is as wide in every row.
// Outlined, its rounded corners round whatever meets them too, so no fill or rule shows past them.
const CORNER = "var(--sw-radius-md)";
const tableRaw = css.raw({
  display: "grid",
  backgroundColor: "var(--sw-surface-default)",
  "&[data-outline] > :first-child, &[data-outline] > :first-child > :first-child": {
    borderStartStartRadius: CORNER,
    borderStartEndRadius: CORNER,
  },
  "&[data-outline] > :last-child, &[data-outline] > :last-child > :last-child": {
    borderEndStartRadius: CORNER,
    borderEndEndRadius: CORNER,
  },
  "&[data-outline] > :first-child > :first-child > :first-child": { borderStartStartRadius: CORNER },
  "&[data-outline] > :first-child > :first-child > :last-child": { borderStartEndRadius: CORNER },
  "&[data-outline] > :last-child > :last-child > :first-child": { borderEndStartRadius: CORNER },
  "&[data-outline] > :last-child > :last-child > :last-child": { borderEndEndRadius: CORNER },
});

const sectionStyle = css({
  display: "grid",
  gridColumn: "1 / -1",
  gridTemplateColumns: "subgrid",
});

// A row's lines: each cell's parts take them in turn, so every cell's first part lines up, then its second, and on.
// More than any cell holds; a line no part takes has no height. The first and last split what a cell laid out by
// itself (its slots) needs beyond the lines, so those keep their own heights and the lines sit in the middle.
const rowRaw = css.raw(tableRowRaw, {
  display: "grid",
  gridColumn: "1 / -1",
  gridTemplateColumns: "subgrid",
  gridTemplateRows: "1fr repeat(5, auto) 1fr",
});

// A cell across its row's lines, a part on each from the second; its avatar down its parts' lines, as one down the last
// would stretch it. `data-ahead` (a day still to come) sits on the page's grey, `data-empty` (nothing in it) on the
// Disabled surface. `data-fill` paints the cell white.
const cellRaw = css.raw(tableCellRaw, {
  gridRow: "1 / -1",
  gridTemplateRows: "subgrid",
  rowGap: 0,
  "& > [data-avatar]": { gridColumn: "1", gridRow: "2 / span var(--lines)" },
  "& > :nth-child(1 of :not([data-avatar]))": { gridRow: "2" },
  "& > :nth-child(2 of :not([data-avatar]))": { gridRow: "3" },
  "& > :nth-child(3 of :not([data-avatar]))": { gridRow: "4" },
  "& > :nth-child(4 of :not([data-avatar]))": { gridRow: "5" },
  "& > :nth-child(5 of :not([data-avatar]))": { gridRow: "6" },
  // What holds an overlay hung in the cell is a block of no height for it to hang from: hung from the subgrid itself,
  // WebKit lays the cell's parts out as if the overlay took room until its next layout.
  "& > :has(> [data-escape-layer])": { display: "block", position: "relative", height: 0 },
  "&[data-ahead]:not([data-empty])": { backgroundColor: "var(--sw-surface-subdued)" },
  "&[data-empty]": { backgroundColor: "var(--sw-surface-disabled)" },
  "&[data-fill]:not([data-ahead])": { backgroundColor: "var(--sw-surface-default)" },
});

// Text in a row of a cell's parts, cut short at the cell's end too; not a part whose tooltip hangs out of it.
const partsRaw = css.raw({
  "& > div:not([data-lead]) > [data-typography]:not([data-tip])": {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

// The first part, on a line as tall as the 28px buttons in its row, in the middle of a taller one; a 28px face before
// a name stands 8px off it.
const leadStyle = css({
  display: "flex",
  alignSelf: "center",
  alignItems: "center",
  minHeight: "1.75rem",
  minWidth: 0,
  "& > [data-typography]": { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  "& > div": { flex: "1 1 auto", minWidth: 0 },
  "&:has(> [data-size=inline])": { gap: "var(--sw-gap-sm)" },
});

/** Its parts, the first on its lead line. */
function parts(children: ReactNode) {
  const [lead, ...rest] = Children.toArray(children);
  return (
    <>
      {lead !== undefined && (
        <div className={leadStyle} data-lead="">
          {lead}
        </div>
      )}
      {rest}
    </>
  );
}

// Inside a table, one of its sections and a row: each part throws outside the one it sits in.
const TableContext = createContext<object | null>(null);
type Section = "head" | "body" | "foot";
const SectionContext = createContext<Section | null>(null);
const RowContext = createContext<object | null>(null);
const OWN = {};

/** Organisms/Data Table: `columns`' widths, laid out once for its `Head`, `Body` and `Foot`; `outline`d round. */
function TableRoot({
  columns,
  outline,
  css: own,
  className,
  style,
  ...props
}: ComponentProps<"div"> & { columns: string; outline?: boolean; css?: SystemStyleObject }) {
  return (
    <TableContext value={OWN}>
      <div
        role="table"
        className={cx(css(tableRaw, own), outline && tableOutlineStyle, className)}
        style={{ gridTemplateColumns: columns, ...style }}
        data-outline={outline ? "" : undefined}
        {...props}
      />
    </TableContext>
  );
}
TableRoot.displayName = "Table";

/** A section of a table: its rows. */
function sectionOf(section: Section, displayName: string) {
  function TableSection({ className, ...props }: ComponentProps<"div">) {
    useOwner(TableContext, TableSection);
    return (
      <SectionContext value={section}>
        <div
          role="rowgroup"
          className={cx(sectionStyle, section === "head" && tableHeadStyle, className)}
          data-section={section}
          {...props}
        />
      </SectionContext>
    );
  }
  TableSection.displayName = displayName;
  return ownPart(TableSection, "Table");
}

const TableHead = sectionOf("head", "Table.Head");
const TableBody = sectionOf("body", "Table.Body");
const TableFoot = sectionOf("foot", "Table.Foot");

/** A row of a table's section: its `Cell`s, a column each. */
function TableRow({ css: own, className, ...props }: ComponentProps<"div"> & { css?: SystemStyleObject }) {
  useOwner(SectionContext, TableRow);
  return (
    <RowContext value={OWN}>
      <div role="row" className={cx(css(rowRaw, own), className)} {...props} />
    </RowContext>
  );
}
TableRow.displayName = "Table.Row";

type HeadOptions = {
  active?: boolean;
  search?: boolean;
  sortable?: boolean;
  sort?: Sort | null;
  defaultSort?: Sort;
  onSort?: (sort: Sort) => void;
};
type BodyOptions = { ahead?: boolean; empty?: boolean; fill?: boolean; header?: boolean };
type CellProps = Omit<ComponentProps<"div">, "onChange"> & HeadOptions & BodyOptions & { css?: SystemStyleObject };

const HEAD_OPTIONS = ["active", "search", "sortable", "sort", "defaultSort", "onSort"] as const;
const BODY_OPTIONS = ["ahead", "empty", "fill", "header"] as const;

/**
 * Atoms/Table Cell, or in a table's `Head` Atoms/Table Header: a slot for its parts, each on a line of the row's, an
 * `Avatar` (or another part marked `data-avatar`, a swatch) down them all. In the head, a column's words, a day's date and weekday (`active` on today's), or a context
 * `search`, each a `Typography`, ending in a sort button when `sortable`. Elsewhere, a day still to come (`ahead`),
 * a cell with nothing in it (`empty`), painted white (`fill`), or its row's `header`.
 */
function TableCellRoot(props: CellProps) {
  useOwner(RowContext, TableCellRoot);
  const head = use(SectionContext) === "head";
  const wrong = (head ? BODY_OPTIONS : HEAD_OPTIONS).filter((option) => props[option] !== undefined);
  if (wrong.length) throw new Error(`Table.Cell's ${wrong.join(", ")} is for a cell ${head ? "outside" : "in"} Table.Head`);
  return head ? <HeadCell {...props} /> : <BodyCell {...props} />;
}
TableCellRoot.displayName = "Table.Cell";

// An `Avatar`, or another part marked `data-avatar`, standing down a cell's lines.
const standsDown = (child: ReactNode) =>
  isValidElement(child) && (child.type === Avatar || (child.props as Record<string, unknown>)["data-avatar"] !== undefined);

function BodyCell({ ahead, empty, fill, header, css: own, className, style, children, ...props }: CellProps) {
  const all = Children.toArray(children);
  const rest = all.filter((child) => !standsDown(child));
  return (
    <div
      {...props}
      role={header ? "rowheader" : "cell"}
      className={cx(css(cellRaw, partsRaw, own), className)}
      style={{ "--lines": Math.max(rest.length, 1), ...style } as CSSProperties}
      data-ahead={ahead ? "" : undefined}
      data-empty={empty ? "" : undefined}
      data-fill={fill ? "" : undefined}
    >
      {all.find(standsDown)}
      {parts(rest)}
    </div>
  );
}

const actionStackStyle = css({ display: "flex", alignItems: "center", gap: "var(--sw-gap-md)", "&[data-centered]": { justifyContent: "center" } });

const secondaryActionsStyle = css({
  display: "flex",
  flex: "1 1 0",
  alignItems: "center",
  gap: "var(--sw-gap-md)",
  minWidth: 0,
});

const statusStyle = css({
  display: "flex",
  flex: "1 1 0",
  alignItems: "center",
  gap: "var(--sw-gap-md)",
  minWidth: 0,
  minHeight: "1.75rem",
  "& > [data-typography]:not([data-tone])": { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  "& > button": { marginInlineStart: "auto" },
});

// Whether the row's action is taken, and taking or undoing it, for the parts under an `ActionStack.Provider`.
const DoneContext = createContext<{ done: boolean; setDone: (done: boolean) => void }>({ done: false, setDone: () => {} });

/** Holds whether the row's action is taken, from `defaultDone` unless given `done`, for the parts under it. */
function ActionStackProvider({
  done: held,
  defaultDone = false,
  onDoneChange,
  children,
}: {
  done?: boolean;
  defaultDone?: boolean;
  onDoneChange?: (done: boolean) => void;
  children: ReactNode;
}) {
  const [done, setDone] = useControllable(held, defaultDone, onDoneChange);
  return <DoneContext value={{ done, setDone }}>{children}</DoneContext>;
}
ActionStackProvider.displayName = "ActionStack.Provider";

/**
 * Molecules/Cell Content/Main Content/Action Stack: a row's `Secondary` actions or its `Status`, then its menu of more;
 * `centered` in its cell.
 */
function ActionStackRoot({ centered, children }: { centered?: boolean; children: ReactNode }) {
  return (
    <div className={actionStackStyle} data-centered={centered ? "" : undefined}>
      {children}
    </div>
  );
}
ActionStackRoot.displayName = "ActionStack";

function SecondaryActions({ children }: { children: ReactNode }) {
  return <div className={secondaryActionsStyle}>{children}</div>;
}
SecondaryActions.displayName = "ActionStack.Secondary";

/**
 * Molecules/Cell Content/Main Content/Status: the row's chip, its value (a `Typography`) if it has one, and its action
 * at the end.
 */
function ActionStatus({ children }: { children: ReactNode }) {
  return <div className={statusStyle}>{children}</div>;
}
ActionStatus.displayName = "ActionStack.Status";

/** What shows until the row's action is taken. */
function Pending({ children }: { children: ReactNode }) {
  return use(DoneContext).done ? null : children;
}
Pending.displayName = "ActionStack.Pending";

/** What shows once it's taken. */
function Done({ children }: { children: ReactNode }) {
  return use(DoneContext).done ? children : null;
}
Done.displayName = "ActionStack.Done";

type Pressable = ReactElement<{ onClick?: (event: MouseEvent) => void }>;

/** Its button takes the row's action. */
function Complete({ children }: { children: Pressable }) {
  const { setDone } = use(DoneContext);
  return cloneElement(children, {
    onClick: (event: MouseEvent) => {
      children.props.onClick?.(event);
      setDone(true);
    },
  });
}
Complete.displayName = "ActionStack.Complete";

/** Its button undoes it. */
function Undo({ children }: { children: Pressable }) {
  const { setDone } = use(DoneContext);
  return cloneElement(children, {
    onClick: (event: MouseEvent) => {
      children.props.onClick?.(event);
      setDone(false);
    },
  });
}
Undo.displayName = "ActionStack.Undo";

/**
 * A row's actions, its status once its action is taken. Under an `ActionStack.Provider`, `Pending` and `Done` show
 * their parts by whether it's taken, anywhere in the cell, and `Complete` and `Undo` mark the buttons that change it.
 */
export const ActionStack = Object.assign(ActionStackRoot, {
  Provider: ActionStackProvider,
  Secondary: SecondaryActions,
  Status: ActionStatus,
  Pending,
  Done,
  Complete,
  Undo,
});

const metricsStyle = css({ display: "flex", alignItems: "center", gap: "var(--sw-gap-md)", height: "1.75rem" });

/** Molecules/Cell Content/Main Content/Risk Matrix: a row's signals side by side. */
function RiskMatrixRoot({ children }: { children: ReactNode }) {
  return <div className={metricsStyle}>{children}</div>;
}
RiskMatrixRoot.displayName = "RiskMatrix";

/** Atoms/Risk Matrix: a signal's icon, then its `Tooltip`, shown while pointed at, whose words name it. */
function RiskMatrixMetric({ children, ...props }: ComponentProps<"button">) {
  return (
    <Button size="icon" data-bare="" aria-label={textOf(partsOf(children, Tooltip))} {...props}>
      {children}
    </Button>
  );
}
RiskMatrixMetric.displayName = "RiskMatrix.Metric";

export const RiskMatrix = Object.assign(RiskMatrixRoot, {
  Metric: RiskMatrixMetric,
});

// A row's tags wrap across their cell, Add after the last; its field keeps to one line, wrapping whole.
const tagsStyle = css({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--sw-gap-sm)" });
const addingStyle = css({ display: "flex", alignItems: "flex-start", gap: "var(--sw-gap-xs)" });

/**
 * Molecules/Cell Content/Tags: a row's tags, each a `Chip` its cross takes away, then Add. Add opens a small type-ahead
 * of the `options` in its place, offering to create a tag from what's typed, with its Save and Cancel; saved with
 * nothing typed, it turns Alert. `defaultAdding` opens with it.
 */
export function Tags({
  options,
  onAdd,
  defaultAdding = false,
  children,
}: {
  options: string[];
  onAdd?: (tag: string) => void;
  defaultAdding?: boolean;
  children?: ReactNode;
}) {
  const [adding, setAdding] = useState(defaultAdding);
  const [tag, setTag] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  // Pressed open or shut, the focus moves with it: into the field, or back to Add.
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) (adding ? form.current?.querySelector("input") : add.current)?.focus();
  }, [adding]);
  const shut = useCallback(() => {
    moved.current = true;
    setAdding(false);
    setTag(null);
    setTried(false);
  }, []);
  useEscapeLayer(form, adding, shut);
  const save = () => {
    if (!tag) return setTried(true);
    onAdd?.(tag);
    shut();
  };

  return (
    <div className={tagsStyle}>
      {children}
      {adding ? (
        <form
          ref={form}
          className={addingStyle}
          data-escape-layer=""
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <TypeAhead size="small" creates="tag" aria-label="Tag name" value={tag} onChange={setTag} tone={alertIf(tried, !tag)}>
            {options.map((option) => (
              <TypeAhead.Item key={option} value={option}>
                <Typography variant="metadata">{option}</Typography>
              </TypeAhead.Item>
            ))}
          </TypeAhead>
          <Button size="small" emphasis="secondary" type="submit">
            Save
          </Button>
          <Button size="icon" aria-label="Cancel" onClick={shut}>
            <CrossIcon aria-hidden />
            <Tooltip>Cancel</Tooltip>
          </Button>
        </form>
      ) : (
        <Button
          ref={add}
          size="icon"
          aria-label="Add tags"
          onClick={() => {
            moved.current = true;
            setAdding(true);
          }}
        >
          <AddIcon aria-hidden />
          <Tooltip>Add tags</Tooltip>
        </Button>
      )}
    </div>
  );
}

/** "Allison George" → "AG", for an `Avatar` without a picture. */
export const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("");

/**
 * Figma's Images/Placeholder/Face and /Company: a person's picture, or without one the initials it holds
 * (`<Avatar>BP</Avatar>`); or a company's logo (`type="company"`), square, without one the Business icon.
 */
export function Avatar({
  src,
  type,
  size,
  children,
}: {
  /** Its picture: an import, or the address of one just picked. */
  src?: StaticImageData | string;
  type?: "company";
  size?: "large" | "medium" | "inline";
  children?: ReactNode;
}) {
  const side = size === "large" ? 72 : type !== "company" && size === "medium" ? 50 : size === "inline" ? 30 : 55;
  const loading = useWireframe()?.mode === "loading";
  return (
    <span className={avatarStyle} data-avatar="" data-type={type} data-size={size}>
      {loading ? (
        <span data-blank="" />
      ) : src ? (
        <Image src={src} alt="" width={side} height={side} unoptimized={typeof src === "string"} />
      ) : type === "company" ? (
        <span>
          <BusinessIcon aria-hidden />
        </span>
      ) : (
        <Typography variant="subheading" aria-hidden>
          {children}
        </Typography>
      )}
    </span>
  );
}

export type CheckInStatus =
  | "Upcoming"
  | "Waiting"
  | "Checked In"
  | "Missing Check-in"
  | "Late Check-in"
  | "Absent"
  | "Cancelled"
  | "Checked Out";

// The app's check-in chip each status wears: Waiting looks Upcoming, Cancelled looks Absent.
const CHECK_IN_CHIP: Record<CheckInStatus, Status> = {
  Upcoming: "upcoming",
  Waiting: "upcoming",
  "Checked In": "checkedIn",
  "Missing Check-in": "late",
  "Late Check-in": "lateCheckIn",
  Absent: "absent",
  Cancelled: "absent",
  "Checked Out": "checkedOut",
};

/** Molecules/Cell Content/Main Content/Check-in Status's pill. */
export function CheckInPill({ status }: { status: CheckInStatus }) {
  const chip = CHECK_IN_CHIP[status];
  return (
    <Pill {...STATUS_PILL[chip]}>
      {STATUS_ICON[chip]}
      {status}
    </Pill>
  );
}

// The code view shows the pill it draws.
CheckInPill.unwrap = CheckInPill;

export type Sort = "ascending" | "descending";

/** A sortable column's order after a press: ascending first, then turned round each time. */
export const nextSort = (sort: Sort | undefined): Sort => (sort === "ascending" ? "descending" : "ascending");

// Atoms/Table Header as the app's tables draw it: a 32px cell of subdued words, ruled off from the next. A day's
// (its date, then its weekday in placeholder) runs into the next unruled, its date ringed on today's; a context
// search's lights up the whole cell while it's typed in; a sortable one ends in its sort button.
const headerRaw = css.raw(columnHeadRaw, dividedRaw, {
  gridRow: "1 / -1",
  gap: "var(--sw-gap-xs)",
  "& > [data-label], & > label": { flex: "1 1 auto", minWidth: 0 },
  // Over `dividedRaw`'s rule, which would otherwise tie with it.
  "&:not(:last-child):has(> [data-date])": { boxShadow: "none" },
  "& > [data-date]": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "1.5rem",
    height: "1.5rem",
    borderRadius: "var(--sw-radius-full)",
    color: "var(--sw-glyph-subdued)",
  },
  "&[aria-current] > [data-date]": { backgroundColor: "var(--sw-surface-selected)", color: "var(--sw-glyph-selected)" },
  "& > [data-date] ~ [data-label]": { color: "var(--sw-glyph-placeholder)" },
  "& > [data-sort]": {
    display: "flex",
    flexShrink: 0,
    color: "var(--sw-glyph-subdued)",
    cursor: "pointer",
    _hover: { color: "var(--sw-glyph-default)" },
    "&[data-dir=ascending] > svg": { transform: "scaleY(-1)" },
  },
});

function HeadCell({
  active,
  search,
  sortable: sorts,
  sort: held,
  defaultSort,
  onSort,
  css: own,
  className,
  children,
  ...props
}: CellProps) {
  const sortable = sorts || onSort !== undefined;
  const [sort, setSort] = useControllable<Sort | null | undefined>(held, defaultSort, (next) => {
    if (next) onSort?.(next);
  });
  const name = props["aria-label"] ?? textOf(children);
  // Of a day's two Typographies, the first is its date.
  const dated = partsOf(children, Typography).length > 1;
  let seen = 0;
  return (
    <div
      role="columnheader"
      className={cx(css(headerRaw, own), search && searchFocusStyle, className)}
      aria-current={active ? "date" : undefined}
      aria-sort={sortable ? (sort ?? "none") : undefined}
      // A press in the cell around its search goes to the search, without taking focus from it on the way.
      onMouseDown={
        search
          ? (event) => {
              if ((event.target as Element).closest("label, button")) return;
              event.preventDefault();
              event.currentTarget.querySelector("input")?.focus();
            }
          : undefined
      }
      {...props}
    >
      {Children.map(children, (child) =>
        isValidElement(child) && child.type === Typography
          ? cloneElement(
              child as ReactElement<Record<string, string>>,
              dated && seen++ === 0 ? { "data-date": "" } : { "data-label": "" },
            )
          : child,
      )}
      {sortable && (
        <button type="button" data-sort="" data-dir={sort ?? undefined} aria-label={`Sort by ${name}`} onClick={() => setSort(nextSort(sort ?? undefined))}>
          {sort ? <SortDescendingIcon aria-hidden /> : <SortIcon aria-hidden />}
        </button>
      )}
    </div>
  );
}

export const Table = Object.assign(TableRoot, {
  Head: TableHead,
  Body: TableBody,
  Foot: TableFoot,
  Row: ownPart(TableRow, "Table.Head, Table.Body or Table.Foot"),
  Cell: ownPart(TableCellRoot, "Table.Row"),
});
