"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FC, type ReactNode, type SVGProps } from "react";
import { createPortal } from "react-dom";
import { css } from "../../../../styled-system/css";
import { hstack } from "../../../../styled-system/patterns";
import { pageTopRaw } from "./sidebar";
import { clock, minutesNow, type Day, type OverlayResult, type Shift, type Worker } from "./data";
import {
  OPERATOR,
  apply,
  customerRows,
  dayStartFor,
  filter,
  history,
  inSlice,
  late,
  noShowRisk,
  rowsFor,
  shiftTimes,
  stamp,
  tiles,
  tracking,
  workedTimes,
  type Action,
  type Country,
  type Filters,
  type Row,
  type RowStatus,
  type Signal,
  type Slice,
} from "./dashboard";
import { CheckInOverlay, submittedSnack } from "./check-in-overlay";
import { NOT_TRACKING, SNACKS } from "./copy";
import { DAYS, DAY_LABEL, DateSelector } from "./dashboard-menus";
import { Dropdown } from "./dropdown";
import { SendMessage, ViewLocation } from "./dashboard-overlays";
import { WorkerSheet, type SheetTab } from "./dashboard-sheet";
import { ROW_STATUS, RowStatusPill } from "./row-status";
import { pickCellRaw, pickHeadRaw } from "./picks";
import { WorkerName } from "./profile-card";
import { NO_ROWS, closeSheet as closeRowSheet, pressBox, pressRow, type RowSelection } from "./row-selection";
import { isoOf } from "./shifts";
import { ActionStack, Avatar, RiskMatrix, Table } from "./data-table";
import { Search } from "./search";
import {
  Button,
  Checkbox,
  Chip,
  Link,
  Presence,
  SegmentedControl,
  STATUS_ICON,
  Tooltip,
  Typography,
  pressesRow,
  reveal,
  sheetRowStyle,
  titleButtonStyle,
} from "./ui";
import { TabCard } from "./tabs";
import NewWorkerIcon from "./assets/risk-new-worker.svg";
import FlaggedMessageIcon from "./assets/risk-flagged-message.svg";
import AbnormalLastShiftIcon from "./assets/risk-abnormal-last-shift.svg";
import LocationDisabledIcon from "./assets/risk-location-disabled.svg";
import DistanceIcon from "./assets/icons/small/distance.svg";
import NotesIcon from "./assets/notes.svg";
import CheckInIcon from "./assets/icons/small/check-in.svg";
import CrossIcon from "./assets/icons/small/cross.svg";
import EditSmallIcon from "./assets/icons/small/edit.svg";
import SendIcon from "./assets/send.svg";

// SW Curie's operations Check-Ins dashboard (23423:122193, 24018:51382), fluid from Figma's width up.
// Clip 3's relabels: "Worker" for Figma's "Spotter", and no "SpotOn".

/** Figma's frame, its padding included: the width the dashboard needs beside the sidebar. */
export const DASHBOARD_WIDTH = 1440;

/** `COLUMNS` at their narrowest, with `pageStyle`'s padding. */
export const DASHBOARD_MIN_WIDTH = 45 + 220 + 150 + 251 + 200 + 310 + 2 * 37.5;

type Icon = FC<SVGProps<SVGSVGElement>>;
type Tone = "alert" | "warning" | "success";

const COUNTRIES: { value: Country | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "us", label: "USA" },
  { value: "ca", label: "Canada" },
];

export const TILES: { slice: Slice; label: string; badge?: { label: string; tone: Tone } }[] = [
  { slice: "missing", label: "Missing", badge: { label: "Unread", tone: "alert" } },
  { slice: "newWorkers", label: "New workers", badge: { label: "Unread", tone: "alert" } },
  { slice: "newTeams", label: "New teams", badge: { label: "Unread", tone: "alert" } },
  { slice: "absences", label: "Absences" },
  { slice: "late", label: "Late check-ins", badge: { label: "New", tone: "warning" } },
  { slice: "all", label: "All check-ins", badge: { label: "On Time", tone: "success" } },
];

// In the order a row's risk matrix and the Risk Factors filter list them.
const SIGNALS: Record<Signal, { label: string; Icon: Icon }> = {
  locationDisabled: { label: "Location Disabled", Icon: LocationDisabledIcon },
  abnormalLastShift: { label: "Abnormal Last Shift", Icon: AbnormalLastShiftIcon },
  flaggedMessage: { label: "Flagged Message", Icon: FlaggedMessageIcon },
  newWorker: { label: "New Worker", Icon: NewWorkerIcon },
};

const SIGNAL_ICONS = Object.fromEntries(
  Object.entries(SIGNALS).map(([signal, { Icon }]) => [signal, <Icon key={signal} aria-hidden />]),
) as Record<Signal, ReactNode>;

// The ops dashboard's names for a row's status, the customer chip each wears, and the tone its filter tints it.
const NO_FILTERS: Filters = { teams: [], statuses: [], signals: [] };

const pageStyle = css(pageTopRaw, {
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: "var(--sw-gap-3xl)",
  minWidth: 0,
  paddingBlockEnd: "var(--sw-padding-3xl)",
  paddingInline: "2.25rem",
});

const filtersStyle = css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sw-gap-xl)" });

const filterGroupStyle = css({ display: "flex", alignItems: "center", gap: "var(--sw-gap-xl)" });

const COLUMNS = "2.75rem 13.75rem minmax(9.25rem, 1fr) 15.75rem 12.5rem 19.25rem";

type Kind = "checkIn" | "absent" | "message" | "location";

/** The Check In overlay's view of a row. */
function forOverlay(row: Row): { shift: Shift; worker: Worker } {
  const checkedIn = row.checkIn !== undefined && row.status !== "absent";
  return {
    shift: { id: row.id, position: row.position, name: row.position, start: row.start, end: row.end, codes: { checkIn: "", checkOut: "" }, workers: [] },
    worker: {
      ...row.worker,
      status: checkedIn ? "checkedIn" : "absent",
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      unpaidBreak: row.unpaidBreak,
      note: row.action?.kind === "checkIn" ? row.action.note : undefined,
      excused: row.excused,
    },
  };
}

function TileButton({
  tile,
  count,
  badge,
  pressed,
  onPress,
}: {
  tile: (typeof TILES)[number];
  count: number;
  badge: number;
  pressed: boolean;
  onPress: () => void;
}) {
  return (
    <TabCard current={pressed} onClick={onPress}>
      <Typography variant="body">{tile.label}</Typography>
      <Typography variant="heading">{count}</Typography>
      {tile.badge && badge > 0 && (
        <TabCard.Change tone={tile.badge.tone}>
          <Typography variant="badge">{badge}</Typography>
          {tile.badge.label}
        </TabCard.Change>
      )}
    </TabCard>
  );
}

interface RowProps {
  row: Row;
  now: number;
  picked: boolean;
  open: Kind | undefined;
  /** The button that opened `open`, which its overlay opens beside. */
  trigger: HTMLElement | null;
  sheet: boolean;
  dayStart: Date;
  onPick: (on: boolean) => void;
  onOpen: (kind: Kind | null, trigger?: HTMLElement) => void;
  /** Opens or closes the row's sheet, on `tab` if it names one. */
  onSheet: (tab?: SheetTab) => void;
  renderCheckIn: (trigger: HTMLElement | null, absent: boolean, onDone: () => void) => ReactNode;
}

// 2px after the check-in time, touching the "–" after it.
const lateChipStyle = css({ marginInlineStart: "var(--sw-gap-xxs)" });

function CheckInRow({ row, now, picked, open, trigger, sheet, dayStart, onPick, onOpen, onSheet, renderCheckIn }: RowProps) {
  const lateness = late(row, now);
  const notes = history(row).filter((entry) => entry.kind !== "status").length;
  const located = tracking(row) && !!row.location;
  const close = () => onOpen(null);
  const actions: ReactNode =
    row.status === "missing" || row.status === "upcoming" || row.status === "absent" ? (
      <>
        <Button
          size="small"
          emphasis="secondary"
          aria-expanded={open === "checkIn"}
          onClick={(event) => onOpen("checkIn", event.currentTarget)}
        >
          <CheckInIcon aria-hidden />
          Check-in...
        </Button>
        {row.status !== "absent" && (
          <Button
            size="small"
            emphasis="secondary"
            tone="destructive"
            aria-expanded={open === "absent"}
            onClick={(event) => onOpen("absent", event.currentTarget)}
          >
            <CrossIcon aria-hidden />
            Mark absent...
          </Button>
        )}
      </>
    ) : (
      <Button
        size="small"
        emphasis="secondary"
        aria-expanded={open === "checkIn"}
        onClick={(event) => onOpen("checkIn", event.currentTarget)}
      >
        <EditSmallIcon aria-hidden />
        Edit check-in...
      </Button>
    );

  return (
    <Table.Row
      className={sheetRowStyle}
      data-worker={row.worker.name}
      data-sheet-trigger=""
      data-sheet={sheet ? "" : undefined}
      data-picked={picked ? "" : undefined}
      onClick={(event) => pressesRow(event) && onSheet()}
    >
      <Table.Cell css={pickCellRaw}>
        <Checkbox aria-label={row.worker.name} checked={picked} onChange={onPick} />
      </Table.Cell>

      <Table.Cell>
        <Avatar src={row.worker.face} />
        <WorkerName worker={row.worker} risk={noShowRisk(row.worker)} />
        <Typography variant="metadata" color="subdued">{row.worker.profile.phone}</Typography>
      </Table.Cell>

      <Table.Cell>
        <Typography tag="button" variant="body" type="button" className={titleButtonStyle} onClick={() => onSheet()} data-sheet-trigger="">
          {row.position}
        </Typography>
        <Typography variant="metadata" color="subdued">{row.role}</Typography>
        <Typography variant="metadata" color="subdued">{row.team}</Typography>
      </Table.Cell>

      <Table.Cell>
        <RowStatusPill status={row.status} />
        <Typography variant="metadata" color="subdued">{shiftTimes(row)}</Typography>
        {row.status === "missing" && <Chip size="small" state={lateness.tone}>{lateness.text}</Chip>}
        {(row.status === "lateCheckIn" || row.status === "checkedIn" || row.status === "leftSite") && (
          <div className={hstack({ gap: "var(--sw-gap-none)", alignItems: "flex-start" })}>
            <Typography variant="metadata" color="subdued">{clock(row.checkIn!)}</Typography>
            {row.status === "lateCheckIn" && <Chip size="small" state={lateness.tone} className={lateChipStyle}>{lateness.text}</Chip>}
            <Typography variant="metadata" color="subdued">{`–In Progress ${row.zone}`}</Typography>
          </div>
        )}
        {row.status === "checkedOut" && <Typography variant="metadata" color="subdued">{workedTimes(row)}</Typography>}
      </Table.Cell>

      <Table.Cell>
        <RiskMatrix>
          {(Object.keys(SIGNALS) as Signal[]).filter((signal) => row.signals.includes(signal)).map((signal) => {
            const { label, Icon } = SIGNALS[signal];
            return (
              <RiskMatrix.Metric key={signal} onClick={() => onSheet("tracker")}>
                <Icon aria-hidden />
                <Tooltip>{label}</Tooltip>
              </RiskMatrix.Metric>
            );
          })}
        </RiskMatrix>
        <Link
          disabled={!located}
          aria-expanded={located ? open === "location" : undefined}
          onClick={(event) => onOpen("location", event.currentTarget)}
        >
          <DistanceIcon aria-hidden />
          {tracking(row) ? (row.location ?? "-") : NOT_TRACKING}
        </Link>
        {row.unreadSignals > 0 && <Chip size="small" state="alert">{`${row.unreadSignals} Unread`}</Chip>}
        <Presence>
          {open === "location" && (
            <ViewLocation
              row={row}
              updated={stamp(dayStart, row.trace?.at(-1)?.at ?? now - 20, false)}
              trigger={trigger}
              onClose={close}
            />
          )}
        </Presence>
      </Table.Cell>

      <Table.Cell>
        <ActionStack>
          <ActionStack.Secondary>{actions}</ActionStack.Secondary>
          <Button
            size="icon"
            aria-label="Send message"
            aria-expanded={open === "message"}
            onClick={() => onOpen("message")}
          >
            <SendIcon aria-hidden />
            <Tooltip>Send message</Tooltip>
          </Button>
        </ActionStack>
        {notes > 0 && (
          <Link onClick={() => onSheet("notes")}>
            <NotesIcon aria-hidden />
            {`${notes} note${notes === 1 ? "" : "s"}`}
          </Link>
        )}
        {notes > 0 && row.unreadNotes > 0 && <Chip size="small" state="alert">{`${row.unreadNotes} Unread`}</Chip>}
        <Presence>{(open === "checkIn" || open === "absent") && renderCheckIn(trigger, open === "absent", close)}</Presence>
      </Table.Cell>
    </Table.Row>
  );
}

export function CheckInsDashboard({
  anchor,
  customer,
  onCustomerSubmit,
  onSnack,
  layer,
  height,
}: {
  /** Where the customer's afternoon shift starts, as CheckInsApp has it. */
  anchor: number;
  /** The customer's shifts, which its CCLS rows follow. */
  customer: Record<Day, Shift[]>;
  onCustomerSubmit: (day: Day, shift: string, worker: string, result: OverlayResult, by: string) => void;
  onSnack?: (message: string) => void;
  /** Where the side sheet and the message modal hang, so they stay in view: the app's overlay layer. */
  layer: HTMLElement | null;
  height: number;
}) {
  const [now] = useState(() => minutesNow(anchor));
  // Actions land at the clock's minute, never before the dashboard's.
  const atNow = useCallback(() => Math.max(now, minutesNow(anchor)), [now, anchor]);
  const [dayStart] = useState(() => dayStartFor(now));
  const [local, setLocal] = useState(() => rowsFor(now));
  const [extras, setExtras] = useState<Record<string, Partial<Row>>>({});
  const [day, setDay] = useState<Day>("today");
  const [country, setCountry] = useState<Country | "all">("all");
  const [slice, setSlice] = useState<Slice>("missing");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [{ picked, sheet: sheetId }, setSelection] = useState<RowSelection>(NO_ROWS);
  const [sheetTab, setSheetTab] = useState<SheetTab>("tracker");
  const [open, setOpen] = useState<{ id: string; kind: Kind; trigger?: HTMLElement } | null>(null);
  const table = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const own = local[day];
    const theirs = customerRows(customer[day], day, now).map((row) => ({ ...row, ...extras[`${day}:${row.id}`] }));
    return [...own.filter((row) => row.country === "us"), ...theirs, ...own.filter((row) => row.country === "ca")];
  }, [local, customer, extras, day, now]);

  const inCountry = useMemo(() => rows.filter((row) => country === "all" || row.country === country), [rows, country]);
  const counts = useMemo(() => tiles(inCountry), [inCountry]);
  const shown = filter(inCountry.filter((row) => inSlice(row, slice)), filters, query);
  const allPicked = shown.length > 0 && shown.every((row) => picked.has(row.id));
  const teams = [...new Set(inCountry.map((row) => row.team))];
  const sheetRow = rows.find((row) => row.id === sheetId);
  const messageRow = open?.kind === "message" ? rows.find((row) => row.id === open.id) : undefined;

  const act = useCallback(
    (row: Row, action: Action) => {
      if (row.source) {
        if (action.type === "submit") {
          onCustomerSubmit(row.source.day, row.source.shift, row.id, action.result, action.by);
          return;
        }
        const { entries, acknowledged, unreadSignals, unreadNotes } = apply(row, action);
        setExtras((all) => ({
          ...all,
          [`${row.source!.day}:${row.id}`]: { entries, acknowledged, unreadSignals, unreadNotes },
        }));
        return;
      }
      setLocal((all) => ({ ...all, [day]: all[day].map((r) => (r.id === row.id ? apply(r, action) : r)) }));
    },
    [day, onCustomerSubmit],
  );

  function checkInFor(row: Row, trigger: HTMLElement | null, absent: boolean, onDone: () => void) {
    const { shift, worker } = forOverlay(row);
    return (
      <CheckInOverlay
        key={`${row.id}-${absent}`}
        shift={shift}
        worker={worker}
        anchor={anchor}
        ops={{ zone: row.zone }}
        absent={absent}
        trigger={trigger}
        onCancel={onDone}
        onSubmit={(result) => {
          act(row, { type: "submit", result, at: atNow(), by: OPERATOR });
          onSnack?.(submittedSnack(worker, result));
          onDone();
        }}
      />
    );
  }

  // Scrolls the app so an overlay hung under a row shows whole.
  useEffect(() => {
    const node = table.current?.querySelector<HTMLElement>("[data-dashboard-overlay], [data-check-in-overlay]");
    const app = table.current?.closest<HTMLElement>("[data-app-scroll]");
    if (!open || !node || !app) return;
    const id = window.setTimeout(() => reveal(app, node), 60);
    return () => window.clearTimeout(id);
  }, [open]);

  const pick = (ids: string[], on: boolean) => setSelection((now) => pressBox(now, ids, on));

  const changeDay = (next: Day) => {
    setOpen(null);
    setSelection(closeRowSheet);
    setDay(next);
  };

  const closeSheet = useCallback(() => setSelection(closeRowSheet), []);
  // A sheet opens on Shift tracker unless asked for a tab, and keeps its tab for another row; asked for another tab of
  // the sheet open, it moves to it.
  const sheetFor = (row: Row, tab?: SheetTab) => {
    if (tab && sheetId === row.id && tab !== sheetTab) return setSheetTab(tab);
    setSheetTab(tab ?? (sheetId ? sheetTab : "tracker"));
    setSelection((now) => pressRow(now, row.id));
  };
  const readSheet = useCallback(() => sheetRow && act(sheetRow, { type: "read" }), [sheetRow, act]);

  return (
    <div className={pageStyle} role="main">
      <Typography tag="h1" variant="title">Check-Ins</Typography>

      <TabCard.Group label="Check-in counts">
        {TILES.map((t) => (
          <TileButton
            key={t.slice}
            tile={t}
            count={counts[t.slice].count}
            badge={counts[t.slice].badge}
            pressed={slice === t.slice}
            onPress={() => {
              setOpen(null);
              setSlice(t.slice);
            }}
          />
        ))}
      </TabCard.Group>

      <div className={filtersStyle}>
        <div className={filterGroupStyle}>
          <SegmentedControl
            value={country}
            onChange={(next) => {
              setOpen(null);
              setCountry(next);
            }}
            size="small"
            aria-label="Country"
          >
            {COUNTRIES.map(({ value, label }) => (
              <SegmentedControl.Segment key={value} value={value}>
                {label}
              </SegmentedControl.Segment>
            ))}
          </SegmentedControl>
          <Dropdown size="small" multiple value={filters.teams} onChange={(next) => setFilters({ ...filters, teams: next })}>
            <Typography variant="metadata">Companies</Typography>
            {teams.map((team) => (
              <Dropdown.Item key={team} value={team}>
                <Typography variant="metadata">{team}</Typography>
              </Dropdown.Item>
            ))}
          </Dropdown>
          <Dropdown size="small" multiple value={filters.statuses} onChange={(next) => setFilters({ ...filters, statuses: next })}>
            <Typography variant="metadata">Status</Typography>
            {(Object.keys(ROW_STATUS) as RowStatus[]).map((status) => (
              <Dropdown.Item key={status} value={status} tone={ROW_STATUS[status].tone}>
                <Typography variant="metadata">
                  {STATUS_ICON[ROW_STATUS[status].chip]}
                  {ROW_STATUS[status].label}
                </Typography>
              </Dropdown.Item>
            ))}
          </Dropdown>
          <Dropdown size="small" multiple value={filters.signals} onChange={(next) => setFilters({ ...filters, signals: next })}>
            <Typography variant="metadata">Risk factor</Typography>
            {(Object.keys(SIGNALS) as Signal[]).map((signal) => (
              <Dropdown.Item key={signal} value={signal}>
                <Typography variant="metadata">
                  {SIGNAL_ICONS[signal]}
                  {SIGNALS[signal].label}
                </Typography>
              </Dropdown.Item>
            ))}
          </Dropdown>
        </div>
        <DateSelector>
          <DateSelector.Previous
            aria-label="Previous day"
            disabled={day === DAYS[0]}
            onClick={() => changeDay(DAYS[DAYS.indexOf(day) - 1])}
          />
          <DateSelector.Date>{DAY_LABEL[day]}</DateSelector.Date>
          <DateSelector.Next
            aria-label="Next day"
            disabled={day === DAYS.at(-1)}
            onClick={() => changeDay(DAYS[DAYS.indexOf(day) + 1])}
          />
          <DateSelector.Calendar day={day} today={isoOf(dayStart)} onChange={changeDay} />
        </DateSelector>
      </div>

      {/* Not clipped, so overlays can hang past it. */}
      <Table ref={table} aria-label="Check-Ins" columns={COLUMNS} outline>
        <Table.Head>
          <Table.Row>
            <Table.Cell css={pickHeadRaw}>
              <Checkbox
                aria-label="Select all"
                checked={allPicked}
                onChange={(on) => pick(shown.map((row) => row.id), on)}
              />
            </Table.Cell>
            <Table.Cell search aria-label="Worker">
              <Search size="small" placeholder="Find a check-in..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </Table.Cell>
            <Table.Cell>
              <Typography variant="metadata">Shift information</Typography>
            </Table.Cell>
            <Table.Cell>
              <Typography variant="metadata">Check-in status</Typography>
            </Table.Cell>
            <Table.Cell>
              <Typography variant="metadata">Risk factor</Typography>
            </Table.Cell>
            <Table.Cell>
              <Typography variant="metadata">Actions</Typography>
            </Table.Cell>
          </Table.Row>
        </Table.Head>
        {shown.length > 0 && (
          <Table.Body>
            {shown.map((row) => (
              <CheckInRow
                key={row.id}
                row={row}
                now={now}
                picked={picked.has(row.id)}
                open={open?.id === row.id ? open.kind : undefined}
                trigger={(open?.id === row.id && open.trigger) || null}
                sheet={sheetId === row.id}
                dayStart={dayStart}
                onPick={(on) => pick([row.id], on)}
                onOpen={(kind, trigger) => setOpen(kind && { id: row.id, kind, trigger })}
                onSheet={(tab) => sheetFor(row, tab)}
                renderCheckIn={(trigger, absent, onDone) => checkInFor(row, trigger, absent, onDone)}
              />
            ))}
          </Table.Body>
        )}
      </Table>

      {layer &&
        createPortal(
          <Presence>
            {sheetRow && (
              <WorkerSheet
                row={sheetRow}
                height={height}
                dayStart={dayStart}
                tab={sheetTab}
                onTab={setSheetTab}
                renderCheckIn={(trigger, onDone) => checkInFor(sheetRow, trigger, false, onDone)}
                onAcknowledge={(on) => {
                  act(sheetRow, { type: "acknowledge", on });
                  onSnack?.(on ? SNACKS.riskAcknowledged : SNACKS.riskUnacknowledged);
                }}
                onRead={readSheet}
                onNote={(note) => {
                  act(sheetRow, { type: "note", note, at: atNow() });
                  onSnack?.(SNACKS.noteAdded);
                }}
                onClose={closeSheet}
              />
            )}
          </Presence>,
          layer,
        )}

      {layer &&
        createPortal(
          <Presence>
            {messageRow && (
              <SendMessage
                row={messageRow}
                height={height}
                onCancel={() => setOpen(null)}
                onSend={(message, note) => {
                  act(messageRow, { type: "message", message, note, at: atNow() });
                  onSnack?.(SNACKS.messageSent);
                  setOpen(null);
                }}
              />
            )}
          </Presence>,
          layer,
        )}
    </div>
  );
}
