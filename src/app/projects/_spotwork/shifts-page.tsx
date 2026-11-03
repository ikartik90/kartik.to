"use client";

import {
  Children,
  createContext,
  isValidElement,
  use,
  useCallback,
  useEffect,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { css } from "../../../../styled-system/css";
import { pageTopRaw } from "./sidebar";
import { ShiftPlanner } from "./shift-planner";
import type { Offers } from "./planner";
import { partsOf, restOf } from "./slots";
import { tagsOf } from "./presets";
import { useTemplates } from "./templates";
import {
  addDays,
  cellTime,
  entryIn,
  FILL_STEPS,
  fillTone,
  monthSpans,
  NO_FILTER,
  shiftRows,
  START_WINDOWS,
  weekLabel,
  weekOf,
  windowLabel,
  type Iso,
  type Series,
} from "./shifts";
import { DateSelector } from "./dashboard-menus";
import { Table } from "./data-table";
import { TeamData } from "./team-loading";
import { Dropdown } from "./dropdown";
import { RangeSelector } from "./filters";
import { ProgressBar } from "./data-viz";
import { Search } from "./search";
import {
  Button,
  enterRaw,
  hatchStyle,
  PLACEHOLDER,
  Presence,
  sheetSlotRaw,
  Tags,
  Typography,
  weekMonthsStyle,
  weekSearchRaw,
} from "./ui";
import CloseIcon from "./assets/close-inverted.svg";

// SW Curie's Shifts dashboard (22112:100370): a week of the company's shifts, a row per template, each shift on its
// own line so it keeps its place across the days. Figma's "Spotter" is "worker" here.

/** The page's width at 1440, and the narrowest its table takes before the app scales down. */
export const SHIFTS_WIDTH = 1440;
export const SHIFTS_MIN_WIDTH = 75 + 200 + 7 * 135;

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pageStyle = css(pageTopRaw, {
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-3xl)",
  paddingBlockEnd: "var(--sw-padding-3xl)",
  paddingInline: "2.25rem",
});

const headStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  "& > div": { display: "flex", gap: "var(--sw-gap-md)" },
});

const toolsStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBlockEnd: "-0.625rem",
  "& > div": { display: "flex", alignItems: "center", gap: "var(--sw-gap-xl)" },
});

const COLUMNS = "12.5rem repeat(7, minmax(0, 1fr))";

const clippedRaw = css.raw({ overflow: "hidden" });

// A row's lines start at its top, where its first shift's do; the rest of its shifts take the lines below.
const linesRaw = css.raw({ gridTemplateRows: "repeat(7, auto)" });

// A day's shifts, a slot each down the cell, the first on the row's lines. Days gone sit on the Subdued surface, today
// and the days ahead white; today's shifts are hatched. The template column's own line divides it from the first day.
const dayRaw = css.raw({
  paddingBlock: "var(--sw-padding-none)",
  paddingInline: "var(--sw-padding-none)",
  backgroundColor: "var(--sw-surface-default)",
  "& > [data-lead]": { display: "contents" },
  "& > :not([data-avatar]) ~ :not([data-avatar], :has(> [data-escape-layer]))": { marginBlockStart: 0 },
  "&:not(:last-child)": { boxShadow: "none" },
  "[role=row] > & + &": { boxShadow: "inset 1px 0 0 var(--sw-border-subdued)" },
  "&[data-when=past]": { backgroundColor: "var(--sw-surface-subdued)" },
});

const slotStyle = css(sheetSlotRaw, {
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
  height: "6.75rem",
  paddingBlock: "var(--sw-padding-md)",
  paddingInline: "var(--sw-padding-sm)",
  "& > span:first-child": { lineHeight: "1.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  "& > [data-progress]": { marginBlockStart: "auto" },
  "&[data-posted]": { animation: "playgroundChromeIn 300ms cubic-bezier(0.22, 1, 0.36, 1)", "--entrance-from": "4px" },
  // A shift's slot is a button that opens its Shift Planner, and shows while it's open.
  width: "100%",
  textAlign: "start",
  outline: "none",
  _focusVisible: { boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)" },
  "&[data-sheet]": { backgroundColor: "var(--sw-surface-selected)" },  // The first down a day takes the row's lines, its title and times level with its template's name and tags.
  "[data-lead] > &": {
    display: "grid",
    gridRow: "1 / -1",
    gridTemplateRows: "subgrid",
    gridTemplateColumns: "minmax(0, 1fr)",
    rowGap: 0,
    height: "auto",
    "& > :nth-child(1)": { gridRow: "2" },
    "& > :nth-child(2)": { gridRow: "3", marginBlockStart: "var(--sw-gap-xs)" },
    "& > :nth-child(3)": { gridRow: "4", marginBlockStart: "var(--sw-gap-sm)" },
  },
  "[data-lead]:has(+ [data-rest]) > &": { gridRow: "1 / 5" },
});

// Over everything the app draws: the layer holding its sheets and overlays (5), and the floating sidebar (6).
const SNACK_LAYER = 7;

// Molecules/Snackbar (22402:176216).
const snackStyle = css(enterRaw, {
  position: "absolute",
  insetBlockEnd: "1.5rem",
  insetInlineStart: "50%",
  zIndex: SNACK_LAYER,
  display: "flex",
  alignItems: "center",
  // One width for every message, so a stack's snackbars match as they come and go.
  width: "var(--sw-width-snackbar)",
  justifyContent: "space-between",
  gap: "var(--sw-gap-xxl)",
  paddingBlock: "var(--sw-padding-sm)",
  paddingInline: "var(--sw-padding-xl) var(--sw-padding-sm)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-inverted-default)",
  color: "white",
  transform: "translateX(-50%)",
  "--entrance-from": "20px",
  "& > span": { display: "flex", alignItems: "center" },
  "& > span:first-child": { flex: "1 1 auto", minWidth: 0, gap: "var(--sw-gap-md)", paddingBlock: "var(--sw-padding-xs)" },
  "& > span + span": { gap: "var(--sw-gap-xs)" },
  "& [data-dismiss]": {
    color: "white",
    _hover: { backgroundColor: "var(--sw-surface-inverted-subdued)", color: "white" },
    _active: { backgroundColor: "var(--sw-surface-inverted-subdued)", color: "white" },
  },
  // In a stack, the newest in front and the rest tucked above it, smaller and fainter with
  // their words hidden, until it's pointed at.
  "&[data-stacked]": {
    position: "relative",
    insetBlockEnd: "auto",
    insetInlineStart: "auto",
    gridArea: "1 / 1",
    alignSelf: "end",
    zIndex: "calc(10 - var(--index))",
    transform: "translateY(calc(var(--index) * -0.625rem)) scale(calc(1 - var(--index) * 0.05))",
    // It comes in from below its place and leaves back down to it, at the pace the others move.
    "--entrance-from": "100%",
    animationDuration: "400ms",
    transition:
      "transform 400ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms cubic-bezier(0.22, 1, 0.36, 1), translate 400ms cubic-bezier(0.22, 1, 0.36, 1)",
    "& > span": { transition: "opacity 400ms cubic-bezier(0.22, 1, 0.36, 1)" },
    "&[data-leaving]": { opacity: 0, translate: "0 100%", pointerEvents: "none" },
    "&[data-behind]": { opacity: "calc(1 - var(--index) * 0.25)", "& > span": { opacity: 0 } },
    "&[data-behind][data-tucked]": { opacity: 0, pointerEvents: "none" },
    "&[data-behind][data-leaving]": { opacity: 0 },
    // Inside `Presence`, or straight in the stack.
    "[data-expanded] > * > &, [data-expanded] > &": {
      transform: "translateY(calc(var(--index) * (-100% - var(--sw-gap-md))))",
    },
  },
});

// The stack's box is as wide as a snackbar and as tall as its front one; while open, it reaches up over the
// ones above so the pointer stays in it.
const stackStyle = css({
  position: "absolute",
  insetBlockEnd: "1.5rem",
  insetInlineStart: "50%",
  zIndex: SNACK_LAYER,
  // Its own compositing layer: without one, Safari can draw the scrolling page over it.
  willChange: "transform",
  display: "grid",
  width: "max-content",
  transform: "translateX(-50%)",
  "&[data-expanded]::before": {
    content: '""',
    position: "absolute",
    insetInline: 0,
    insetBlockEnd: "100%",
    height: "calc((var(--count) - 1) * (100% + var(--sw-gap-md)))",
  },
});

const SNACK_MS = 5000;
// How long a stacked snackbar takes to come in, move, or leave.
const STACK_MS = 400;
// Behind the third, a snackbar shows only while the stack is open.
const SHOWN_BEHIND = 2;

const SnackbarContext = createContext<() => void>(() => {});

// A stacked snackbar's place from the front, and whether its stack is open, which holds its timer.
const StackContext = createContext<{ index: number; open: boolean; leaving?: boolean } | null>(null);

/**
 * Snackbars at once, as Sonner stacks its toasts: the last in front, the others tucked above it until the stack is
 * pointed at or focused, which spreads them out and holds their timers.
 */
function SnackbarStack({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const items = Children.toArray(children).filter(isValidElement);
  const keys = items.map((item) => item.key).join("\n");
  // `order`: every key shown, in the order each came in. Moving one in the page would play its entrance again.
  const [last, setLast] = useState({ keys, items, order: items.map((item) => item.key) });
  // Each taken out, kept at its place a moment while it leaves.
  const [leaving, setLeaving] = useState<{ item: ReactElement; index: number }[]>([]);
  if (last.keys !== keys) {
    const stays = (item: ReactElement) => items.some((kept) => kept.key === item.key);
    const gone = last.items.flatMap((item, i) => (stays(item) ? [] : [{ item, index: last.items.length - 1 - i }]));
    const nowLeaving = [...leaving.filter(({ item }) => !stays(item)), ...gone];
    const kept = last.order.filter((key) => [...items, ...nowLeaving.map(({ item }) => item)].some((each) => each.key === key));
    setLeaving(nowLeaving);
    setLast({ keys, items, order: [...kept, ...items.map((item) => item.key).filter((key) => !kept.includes(key))] });
  }
  useEffect(() => {
    if (leaving.length === 0) return;
    const id = window.setTimeout(() => setLeaving([]), STACK_MS);
    return () => window.clearTimeout(id);
  }, [leaving]);
  return (
    <div
      className={stackStyle}
      style={{ "--count": items.length } as CSSProperties}
      data-expanded={open && items.length > 1 ? "" : undefined}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setOpen(false)}
    >
      {last.order.map((key) => {
        const i = items.findIndex((item) => item.key === key);
        const left = leaving.find(({ item }) => item.key === key);
        const shown = i >= 0 ? { item: items[i], index: items.length - 1 - i } : left;
        return (
          shown && (
            <StackContext key={key} value={{ index: shown.index, open, leaving: i < 0 }}>
              {shown.item}
            </StackContext>
          )
        );
      })}
    </div>
  );
}

/**
 * Says what was posted, at the foot of the app, until closed or after a few seconds. Its words (after their icon) come
 * first, then its `Snackbar.Action` and `Snackbar.Close` wherever they're put. Given `onClose`, its owner closes it;
 * without, it closes itself. A new message restarts the timer only as a new snackbar (`key`).
 */
function SnackbarRoot({ onClose, children }: { onClose?: () => void; children: ReactNode }) {
  const [shown, setShown] = useState(true);
  const stack = use(StackContext);
  const held = !!stack?.open || !!stack?.leaving;
  const close = useCallback(() => (onClose ? onClose() : setShown(false)), [onClose]);
  useEffect(() => {
    if (!shown || held) return;
    const id = window.setTimeout(close, SNACK_MS);
    return () => window.clearTimeout(id);
  }, [close, shown, held]);
  const end = [...partsOf(children, SnackbarAction), ...partsOf(children, SnackbarClose)];
  const snackbar = (
    <SnackbarContext value={close}>
      <div
        className={snackStyle}
        role="status"
        style={stack ? ({ "--index": stack.index } as CSSProperties) : undefined}
        data-stacked={stack ? "" : undefined}
        data-behind={stack && stack.index > 0 && !stack.open ? "" : undefined}
        data-tucked={stack && stack.index > SHOWN_BEHIND ? "" : undefined}
        data-leaving={stack?.leaving ? "" : undefined}
      >
        <Typography variant="metadata">{restOf(children, SnackbarAction, SnackbarClose)}</Typography>
        {end.length > 0 && <span>{end}</span>}
      </div>
    </SnackbarContext>
  );
  return onClose ? snackbar : <Presence>{shown && snackbar}</Presence>;
}

/** Figma's Has Action Button: it takes its action, then closes the snackbar. */
function SnackbarAction({ onClick, ...props }: Omit<ComponentProps<"button">, "type">) {
  const close = use(SnackbarContext);
  return (
    <Button
      size="small"
      emphasis="tertiary"
      tone="dark"
      onClick={(event) => {
        onClick?.(event);
        close();
      }}
      {...props}
    />
  );
}

/** Figma's Is Dismissable: Dismiss, closing it. */
function SnackbarClose() {
  const onClose = use(SnackbarContext);
  return (
    <Button size="icon" tone="dark" aria-label="Dismiss" data-dismiss="" onClick={onClose}>
      <CloseIcon aria-hidden />
    </Button>
  );
}

SnackbarRoot.displayName = "Snackbar";
SnackbarAction.displayName = "Snackbar.Action";
SnackbarClose.displayName = "Snackbar.Close";
SnackbarStack.displayName = "Snackbar.Stack";

/** Molecules/Snackbar. */
export const Snackbar = Object.assign(SnackbarRoot, { Action: SnackbarAction, Close: SnackbarClose, Stack: SnackbarStack });

export function ShiftsPage({
  today,
  series,
  weekStart,
  onWeek,
  onNewShift,
  onManageTemplates,
  layer,
  height,
  onReschedule,
  onOffers,
  onSnack,
  placeholder,
}: {
  today: Iso;
  series: Series[];
  /** The Sunday of the week on show. */
  weekStart: Iso;
  onWeek: (weekStart: Iso) => void;
  onNewShift: () => void;
  onManageTemplates: () => void;
  /** Where a shift's Shift Planner hangs, so it stays in view: the app's overlay layer. */
  layer: HTMLElement | null;
  /** The app's, which the Shift Planner runs down. */
  height: number;
  /** Edit Schedule's save, in the version that has it. */
  onReschedule?: (id: string, dates: Iso[], spotFill: boolean) => void;
  /** The Shift Planner's Send offers and Withdraw offers: the shift's offers after them. */
  onOffers?: (id: string, offers: Offers) => void;
  onSnack?: (message: string) => void;
  /** Another project's page: under its heading and buttons, a placeholder. */
  placeholder?: boolean;
}) {
  const standIn = placeholder ? PLACEHOLDER : {};
  const setWeekStart = onWeek;
  const templates = useTemplates();
  const [filter, setFilter] = useState(NO_FILTER);
  const [opened, setOpened] = useState<{ line: string; date: string } | null>(null);
  const planned = series.find((s) => s.id === opened?.line);
  const closePlanner = useCallback(() => setOpened(null), []);
  const week = weekOf(weekStart);
  const months = monthSpans(week);
  // Only the shifts on this week's days in the filters take a line.
  const rows = shiftRows(templates, series, week, filter);
  const tags = tagsOf(templates);

  return (
    <div className={pageStyle} role="main">
      <div className={headStyle}>
        <Typography tag="h1" variant="title">Shifts</Typography>
        <div>
          <Button emphasis="secondary" onClick={onManageTemplates}>
            Manage templates
          </Button>
          <Button onClick={onNewShift}>New shift...</Button>
        </div>
      </div>

      <div className={toolsStyle} {...standIn}>
        <div>
          <RangeSelector steps={FILL_STEPS} value={filter.fill} onChange={(fill) => setFilter((now) => ({ ...now, fill }))}>
            <Typography variant="metadata">Fill %</Typography>
          </RangeSelector>
          <Dropdown
            size="small"
            multiple
            value={filter.starts.map(String)}
            onChange={(starts) => setFilter((now) => ({ ...now, starts: starts.map(Number) }))}
          >
            <Typography variant="metadata">Shift start time</Typography>
            {START_WINDOWS.map((opens) => (
              <Dropdown.Item key={opens} value={String(opens)}>
                <Typography variant="metadata">{windowLabel(opens)}</Typography>
              </Dropdown.Item>
            ))}
          </Dropdown>
          <Dropdown size="small" multiple value={filter.tags} onChange={(picked) => setFilter((now) => ({ ...now, tags: picked }))}>
            <Typography variant="metadata">Tags</Typography>
            {tags.map((tag) => (
              <Dropdown.Item key={tag} value={tag}>
                <Typography variant="metadata">{tag}</Typography>
              </Dropdown.Item>
            ))}
          </Dropdown>
        </div>
        <div>
          <DateSelector>
            <DateSelector.Previous aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))} />
            <DateSelector.Date aria-label={`Week of ${weekLabel(week)}`} onClick={() => setWeekStart(weekOf(today)[0])}>
              {weekLabel(week)}
            </DateSelector.Date>
            <DateSelector.Next aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))} />
          </DateSelector>
        </div>
      </div>

      <Table aria-label="Shifts" columns={COLUMNS} outline css={clippedRaw} {...standIn}>
        <Table.Head>
          <Table.Row style={{ gridTemplateRows: "2rem 2rem" }}>
            <Table.Cell search aria-label="Shift" css={weekSearchRaw}>
              <Search
                size="small"
                aria-label="Find a shift"
                placeholder="Find a shift..."
                value={filter.search}
                onChange={(event) => setFilter((now) => ({ ...now, search: event.target.value }))}
              />
            </Table.Cell>
            <div className={weekMonthsStyle} aria-hidden>
              {months.map(({ name, span }) => (
                <Typography key={name} variant="metadata" style={{ gridRow: 1, gridColumn: `span ${span}` }}>
                  {name}
                </Typography>
              ))}
            </div>
            {week.map((date, i) => (
              <Table.Cell key={date} active={date === today} style={{ gridRow: 2, gridColumn: i + 2 }}>
                <Typography variant="metadata">{Number(date.slice(8))}</Typography>
                <Typography variant="metadata">{WEEKDAY_SHORT[week.indexOf(date)]}</Typography>
              </Table.Cell>
            ))}
          </Table.Row>
        </Table.Head>
        <TeamData>
          <Table.Body>
            {rows.map(({ template, lines }) => (
              <Table.Row key={template.id} css={linesRaw}>
                <Table.Cell header fill>
                  <Typography variant="body">{template.name}</Typography>
                  <Tags tags={template.tags} />
                </Table.Cell>
                {week.map((date) => {
                  const empty = !lines.some((line) => entryIn(line, date, filter.fill));
                  const [first, ...rest] = (lines.length ? lines : [null]).map((line, i) => {
                    const entry = line && entryIn(line, date, filter.fill);
                    return line && entry ? (
                      <button
                        key={line.id}
                        type="button"
                        className={slotStyle}
                        data-posted={line.filled ? undefined : ""}
                        data-sheet={opened?.line === line.id && opened.date === date ? "" : undefined}
                        onClick={() => setOpened({ line: line.id, date })}
                      >
                        <Typography variant="body">{line.title}</Typography>
                        <Typography variant="metadata" color="subdued">{cellTime(line.start, line.end)}</Typography>
                        <ProgressBar fill value={entry.filled} max={entry.total} tone={fillTone(entry.filled, entry.total)}>
                          <Typography variant="metadata" color="subdued">
                            {entry.filled}/{entry.total}
                          </Typography>
                          <Typography variant="metadata" color="subdued">
                            Filled
                          </Typography>
                        </ProgressBar>
                      </button>
                    ) : (
                      <div key={line?.id ?? i} className={slotStyle} />
                    );
                  });
                  return (
                    <Table.Cell
                      key={date}
                      css={dayRaw}
                      className={date === today && !empty ? hatchStyle : undefined}
                      data-when={date < today ? "past" : date === today ? "today" : "ahead"}
                    >
                      {first}
                      {rest.length > 0 && (
                        <div data-rest="" style={{ gridRow: "5 / -1" }}>
                          {rest}
                        </div>
                      )}
                    </Table.Cell>
                  );
                })}
              </Table.Row>
            ))}
          </Table.Body>
        </TeamData>
      </Table>
      {layer &&
        createPortal(
          <Presence>
            {planned && (
              <ShiftPlanner
                key={planned.id}
                series={planned}
                today={today}
                height={height}
                layer={layer}
                onReschedule={onReschedule && ((dates, spotFill) => onReschedule(planned.id, dates, spotFill))}
                onOffers={onOffers && ((offers) => onOffers(planned.id, offers))}
                onSnack={onSnack}
                onClose={closePlanner}
              />
            )}
          </Presence>,
          layer,
        )}
    </div>
  );
}
