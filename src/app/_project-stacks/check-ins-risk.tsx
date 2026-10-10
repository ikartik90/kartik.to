"use client";

import { useEffect, useId, useState } from "react";
import { css, cx } from "../../../styled-system/css";
import { menuIcon, menuItem } from "../../../styled-system/recipes";
import { useActionTooltip } from "@/components/ui/action";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { Skeleton, Wireframe } from "@/components/ui/wireframe";
import CalendarIcon from "@/assets/icons/calendar.svg";
import CheckCircleIcon from "@/assets/icons/check-circle.svg";
import ChevronLeftIcon from "@/assets/icons/chevron-left.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";
import ClockIcon from "@/assets/icons/clock.svg";
import CrossCircleIcon from "@/assets/icons/cross-circle.svg";
import ExclamationIcon from "@/assets/icons/exclamation-mark.svg";
import FirewallIcon from "@/assets/icons/firewall.svg";
import LocationDisabledIcon from "@/assets/icons/location-disabled.svg";
import MapPinIcon from "@/assets/icons/map-pin.svg";
import MoreIcon from "@/assets/icons/more.svg";
import NewbornIcon from "@/assets/icons/newborn.svg";
import PublishIcon from "@/assets/icons/publish.svg";
import ResetIcon from "@/assets/icons/reset.svg";
import WarningMessageIcon from "@/assets/icons/warning-message.svg";
import {
  countStyle,
  headEndStyle,
  headingStyle,
  headStyle,
  Pill,
  ring,
  rowStyle,
  subStyle,
  titleStyle,
  type Icon,
} from "./check-ins-wireframes";
import { cardStyle, columnStyle } from "./onboarding-wireframes";
import { Stage } from "./wireframe-stage";

// The operations team's Check-ins dashboard, after the Figma screens: its tiles slice the day's check-ins, so new
// workers and new teams are watched apart from the regulars. Which rows fall in which slice is illustrative.

type SliceId = "missing" | "new-workers" | "new-teams" | "late" | "absences" | "all";

const TILES: { id: SliceId; label: string; count: number; badge?: string }[] = [
  { id: "missing", label: "Missing check-ins", count: 30, badge: "6 unread" },
  { id: "new-workers", label: "New workers", count: 44, badge: "5 unread" },
  { id: "new-teams", label: "New teams", count: 12 },
  { id: "late", label: "Late check-ins", count: 5, badge: "1 new" },
  { id: "absences", label: "Absences", count: 11 },
  { id: "all", label: "All check-ins", count: 295, badge: "233 on time" },
];

interface Signal {
  icon: Icon;
  text: string;
  /** Where the worker is: the risk signals' second line, not a risk signal. */
  location?: boolean;
}
const SIGNAL = {
  thirdShift: { icon: NewbornIcon, text: "3rd shift" },
  firstShift: { icon: NewbornIcon, text: "1st shift" },
  teamFirst: { icon: FirewallIcon, text: "Team's 1st shift" },
  cancel: { icon: WarningMessageIcon, text: "Wants to cancel" },
  lateCancel: { icon: CalendarIcon, text: "Cancelled 3.5 h before last shift" },
  locationOff: { icon: LocationDisabledIcon, text: "Location disabled" },
  far: { icon: MapPinIcon, text: "7.3 km away", location: true },
  onSite: { icon: MapPinIcon, text: "On site", location: true },
} satisfies Record<string, Signal>;

type Triage = "check-in" | "message" | "absent";

const ACTION = {
  "check-in": { label: "Check in", done: "Checked in", icon: CheckCircleIcon },
  message: { label: "Message", done: "Message sent", icon: PublishIcon },
  absent: { label: "Mark absent", done: "Absent", icon: CrossCircleIcon },
};

interface Row {
  name: string;
  shift: string;
  late?: string;
  signals: Signal[];
  /** A missing check-in's one action; otherwise its status. */
  action?: Triage;
  status?: { text: string; icon: Icon; waiting?: boolean };
}

const CHECKED_IN = { text: "Checked in", icon: CheckCircleIcon };
const MISSING = { text: "Missing", icon: ExclamationIcon, waiting: true };
const LATE = { text: "Late check-in", icon: ClockIcon, waiting: true };
const UPCOMING = { text: "Upcoming", icon: ClockIcon, waiting: true };
const ABSENT = { text: "Absent", icon: CrossCircleIcon, waiting: true };

const BRITTANY: Row = {
  name: "Brittany Pilz",
  shift: "Packaging Worker · CCLS First Gulf",
  late: "+18m",
  signals: [SIGNAL.thirdShift, SIGNAL.cancel, SIGNAL.far],
  action: "message",
};
const ASPEN: Row = {
  name: "Aspen Curtis",
  shift: "Picker Packer · CCLS First Gulf",
  late: "+55m",
  signals: [SIGNAL.thirdShift, SIGNAL.lateCancel],
  status: LATE,
};

const ROWS: Record<SliceId, Row[]> = {
  missing: [
    BRITTANY,
    {
      name: "Disha Patil",
      shift: "Warehouse Selector · Four Seasons Produce",
      late: "+2h 03m",
      signals: [SIGNAL.locationOff],
      action: "absent",
    },
    {
      name: "Cristofer Dorwart",
      shift: "Packer · Bristol Circle Oakville",
      late: "+33m",
      signals: [SIGNAL.onSite],
      action: "check-in",
    },
  ],
  "new-workers": [
    BRITTANY,
    {
      name: "Giana Baptista",
      shift: "Picker Packer · CCLS First Gulf",
      signals: [SIGNAL.firstShift, SIGNAL.onSite],
      status: CHECKED_IN,
    },
    ASPEN,
  ],
  "new-teams": [
    {
      name: "Shonda Williams",
      shift: "Cutting Machine Operator · Sweets from the Earth",
      late: "+12m",
      signals: [SIGNAL.teamFirst, SIGNAL.firstShift],
      action: "message",
    },
    {
      name: "Marilyn Calzoni",
      shift: "Cutting Machine Operator · Sweets from the Earth",
      signals: [SIGNAL.teamFirst, SIGNAL.onSite],
      status: CHECKED_IN,
    },
    {
      name: "Brianna Santos",
      shift: "Can Filling Production Operator · Logistics",
      signals: [SIGNAL.teamFirst],
      status: UPCOMING,
    },
  ],
  late: [
    ASPEN,
    {
      name: "Shonda Williams",
      shift: "Cutting Machine Operator · Sweets from the Earth",
      late: "+12m",
      signals: [SIGNAL.teamFirst, SIGNAL.firstShift],
      status: LATE,
    },
  ],
  absences: [
    { name: "Maria Franci", shift: "Picker Packer · CCLS First Gulf", signals: [], status: ABSENT },
    {
      name: "Disha Patil",
      shift: "Warehouse Selector · Four Seasons Produce",
      signals: [SIGNAL.locationOff],
      status: ABSENT,
    },
  ],
  all: [
    { name: "Angel Saris", shift: "Picker Packer · CCLS First Gulf", signals: [SIGNAL.onSite], status: CHECKED_IN },
    { ...BRITTANY, action: undefined, status: MISSING },
    { name: "Rayna Rhiel Madsen", shift: "Picker Packer · CCLS First Gulf", signals: [SIGNAL.onSite], status: CHECKED_IN },
  ],
};

const tilesStyle = css({
  flexShrink: 0,
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "md",
  paddingInline: "xl",
  paddingBlockEnd: "lg",
  mdDown: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
});
const tileStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "xs",
  minWidth: 0,
  paddingBlock: "md",
  paddingInline: "lg",
  borderRadius: "md",
  borderWidth: "token(spacing.xxs)",
  borderStyle: "solid",
  borderColor: "field.border.default",
  textAlign: "start",
  cursor: "pointer",
  transition: "border-color 150ms ease, background-color 150ms ease",
  _hover: { backgroundColor: "field.bg.hover" },
  // The one showing sits on the brand's tint, as its pill does at rest; its pill turns neutral so it still shows.
  "&[aria-pressed=true]": {
    borderColor: "field.border.active",
    backgroundColor: "bg.highlight",
    _hover: { backgroundColor: "bg.button.accent.hover" },
  },
});
const tileLabelStyle = css({
  textStyle: "caption",
  color: "text.body",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "token(spacing.full)",
  "[aria-pressed=true] &": { color: "text.highlight" },
});
const tileCountStyle = css({ display: "flex", alignItems: "center", gap: "sm", minWidth: 0, maxWidth: "token(spacing.full)" });
const tileNumberStyle = css({ textStyle: "bodyLarge", color: "text.title", fontVariantNumeric: "tabular-nums" });
// Centred on the count's figures, which sit `3xs` below the middle of their line box.
const badgeStyle = css({
  position: "relative",
  top: "token(spacing.3xs)",
  minWidth: 0,
  paddingInline: "sm",
  borderRadius: "full",
  backgroundColor: "bg.highlight",
  textStyle: "sidenote",
  lineHeight: "token(spacing.xl)",
  color: "text.highlight",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  "[aria-pressed=true] &": { backgroundColor: "bg.notice", color: "text.body" },
});

/** The dashboard's day, a day back or forward on either side. */
function Day() {
  return (
    <span className={headEndStyle}>
      <Button variant="icon" aria-label="Previous day">
        <ChevronLeftIcon />
        <Button.Tooltip>
          <Tooltip.Text>Previous day</Tooltip.Text>
        </Button.Tooltip>
      </Button>
      <span className={countStyle}>Today</span>
      <Button variant="icon" aria-label="Next day">
        <ChevronRightIcon />
        <Button.Tooltip>
          <Tooltip.Text>Next day</Tooltip.Text>
        </Button.Tooltip>
      </Button>
    </span>
  );
}

function Tiles({ slice, onSlice }: { slice: SliceId; onSlice: (id: SliceId) => void }) {
  return (
    <div className={tilesStyle}>
      {TILES.map(({ id, label, count, badge }) => (
        <button key={id} type="button" className={tileStyle} aria-pressed={id === slice} onClick={() => onSlice(id)}>
          <span className={tileLabelStyle}>{label}</span>
          <span className={tileCountStyle}>
            <span className={tileNumberStyle}>{count}</span>
            {badge && <span className={badgeStyle}>{badge}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

// Every row two lines of a status pill's height, whatever the slice: the worker over their shift, the risk signals
// over where the worker is, the status over how late, then the menu. Fixed columns line up down the list; the status
// column is as wide as the widest status, Late check-in. On a phone the signals take two more lines, under.
const LINE = "calc(token(spacing.xxl) + 2 * token(spacing.xs))";
const STATUS = "calc(token(spacing.5xl) + token(spacing.xxl) + token(spacing.sm))";
const linesStyle = css({
  flex: "1",
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: `minmax(0, 1fr) token(spacing.3xl) minmax(0, 1fr) token(spacing.xl) ${STATUS} token(spacing.sm) token(sizes.toolbarButton)`,
  gridTemplateRows: `repeat(2, ${LINE})`,
  gridTemplateAreas: '"name . risk . status . menu" "shift . risk . late . ."',
  alignItems: "center",
  "& [data-cell=name]": { gridArea: "name" },
  "& [data-cell=shift]": { gridArea: "shift" },
  "& [data-cell=risk]": { gridArea: "risk", alignSelf: "stretch" },
  "& [data-cell=status]": { gridArea: "status", justifySelf: "end" },
  "& [data-cell=late]": { gridArea: "late", justifySelf: "end" },
  "& [data-cell=menu]": { gridArea: "menu" },
  mdDown: {
    gridTemplateColumns: `minmax(0, 1fr) token(spacing.xl) ${STATUS} token(spacing.sm) token(sizes.toolbarButton)`,
    gridTemplateRows: `repeat(4, ${LINE})`,
    gridTemplateAreas: '"name . status . menu" "shift . late . ." "risk risk risk risk risk" "risk risk risk risk risk"',
  },
});
const cellStyle = css({ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });
const lateStyle = css({ textStyle: "caption", color: "text.highlight", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" });
// The risk signals on the first line, each its icon alone in the brand's colour, its words in a tooltip, a dash if
// there are none; where the worker is on the second, always, a dash when it isn't known.
const riskLinesStyle = css({
  display: "grid",
  gridTemplateRows: `repeat(2, ${LINE})`,
  minWidth: 0,
  "& > *": { minWidth: 0, overflow: "hidden", "& > *": { height: LINE } },
});
const signalsStyle = css({ display: "flex", flexWrap: "wrap", columnGap: "md" });
const signalStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "xxs",
  textStyle: "caption",
  color: "text.body",
  whiteSpace: "nowrap",
  "& > svg": { flexShrink: 0, width: "token(spacing.xl)", height: "token(spacing.xl)" },
  "& svg path[stroke]": { stroke: "currentColor" },
  "& svg path[fill]:not([fill=none])": { fill: "currentColor" },
});
const signalIconStyle = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: LINE,
  height: LINE,
  color: "text.highlight",
  "& > svg": { width: "token(spacing.xxl)", height: "token(spacing.xxl)" },
  "& svg path[stroke]": { stroke: "currentColor" },
  "& svg path[fill]:not([fill=none])": { fill: "currentColor" },
});
const noSignalStyle = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: LINE,
  height: LINE,
  textStyle: "caption",
  color: "text.body",
});
// The status cells and the menu as the grid's own items, inside the part that keeps their clicks off the row.
const endsStyle = css({ display: "contents" });

function SignalIcon({ icon: SignalGlyph, text }: Signal) {
  const { content, tooltipNode, show, hide } = useActionTooltip([
    <SignalGlyph key="icon" aria-hidden />,
    <Tooltip key="tooltip">
      <Tooltip.Text>{text}</Tooltip.Text>
    </Tooltip>,
  ]);
  return (
    <>
      <span className={signalIconStyle} role="img" aria-label={text} onPointerEnter={show} onPointerLeave={hide}>
        {content}
      </span>
      {tooltipNode}
    </>
  );
}

function Signals({ signals }: { signals: Signal[] }) {
  const risks = signals.filter((s) => !s.location);
  const where = signals.find((s) => s.location);
  return (
    <span className={riskLinesStyle} data-cell="risk">
      <span className={signalsStyle}>
        {risks.length ? (
          risks.map((signal) => <SignalIcon key={signal.text} {...signal} />)
        ) : (
          <span className={noSignalStyle}>–</span>
        )}
      </span>
      <span className={signalsStyle}>
        <span className={signalStyle}>
          <MapPinIcon aria-hidden />
          {where?.text ?? "–"}
        </span>
      </span>
    </span>
  );
}

// Onboarding's row menu: under its row's menu button, their ends level, over the rows below.
const menuStyle = css({
  position: "absolute",
  zIndex: 1,
  top: "calc(100% - token(spacing.sm))",
  insetInlineEnd: "xl",
  display: "flex",
  flexDirection: "column",
  padding: "xs",
  borderRadius: "md",
  backgroundColor: "bg.surface",
  boxShadow: `${ring}, 0 4px 16px color-mix(in srgb, token(colors.neutral.900) 12%, transparent)`,
});
const menuRowStyle = css({
  whiteSpace: "nowrap",
  _hover: { backgroundColor: "field.bg.hover" },
  "&[data-active]": { color: "field.text.active" },
});
// Both labels in one cell, so the menu keeps the longer one's width as they swap.
const labelsStyle = css({
  display: "grid",
  textAlign: "start",
  "& > *": { gridArea: "1 / 1" },
  "& > :not([data-shown])": { visibility: "hidden" },
});
const TRIAGE: Triage[] = ["check-in", "message", "absent"];

/**
 * A check-in's status and lateness; then, for a missing one, its menu: the actions, the one its signals call for in the
 * active colour, and a revert once one is taken. A message says it went, then the menu closes.
 */
function RowEnd({ row, taken, onTake }: { row: Row; taken?: Triage; onTake: (to?: Triage) => void }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const trigger = useId();
  useEffect(() => {
    if (!sending) return;
    const timer = setTimeout(() => {
      setOpen(false);
      setSending(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [sending]);
  // The sheet's dialog takes Escape at the document, ahead of the menu's dismiss, and Safari cancels a dialog even on a
  // prevented Escape: so while open, the menu takes both at the window, first.
  useEffect(() => {
    if (!open) return;
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      swallow(e);
      window.addEventListener("cancel", swallow, { capture: true });
      setTimeout(() => window.removeEventListener("cancel", swallow, { capture: true }), 100);
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open]);

  const status: NonNullable<Row["status"]> =
    taken === "check-in" ? CHECKED_IN : taken === "absent" ? ABSENT : (row.status ?? MISSING);
  const take = (to?: Triage) => {
    onTake(to);
    if (to === "message") setSending(true);
    else setOpen(false);
  };
  return (
    <>
      <span data-cell="status">
        <Pill icon={status.icon} tone={status.waiting ? "waiting" : undefined}>
          {status.text}
        </Pill>
      </span>
      {row.late && (
        <span className={lateStyle} data-cell="late">
          {row.late}
        </span>
      )}
      {row.action && (
        <Button
          variant="icon"
          aria-label={`Actions for ${row.name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          data-hover={open ? "" : undefined}
          data-menu-for={trigger}
          data-cell="menu"
          onClick={() => setOpen(!open)}
        >
          <MoreIcon />
        </Button>
      )}
      {open && (
        <Popover
          className={menuStyle}
          role="menu"
          ariaLabel={`Actions for ${row.name}`}
          ignoreSelector={`[data-menu-for="${trigger}"]`}
          onDismiss={() => setOpen(false)}
        >
          {TRIAGE.map((action) => {
            const { label, done, icon: ActionIcon } = ACTION[action];
            const sent = action === "message" && taken === "message";
            return (
              <button
                key={action}
                type="button"
                role="menuitem"
                className={cx(menuItem(), menuRowStyle)}
                data-active={action === row.action ? "" : undefined}
                onClick={() => take(action)}
              >
                <ActionIcon className={menuIcon()} />
                <span className={labelsStyle}>
                  <span data-shown={sent ? undefined : ""}>{label}</span>
                  <span data-shown={sent ? "" : undefined}>{done}</span>
                </span>
              </button>
            );
          })}
          {taken && (
            <button type="button" role="menuitem" className={cx(menuItem(), menuRowStyle)} onClick={() => take(undefined)}>
              <ResetIcon className={menuIcon()} />
              Revert changes
            </button>
          )}
        </Popover>
      )}
    </>
  );
}

const MORE = [
  { name: "Sikander Mazumdar", shift: "Cutting Machine Operator · Sweets from the Earth" },
  { name: "Tashonda Williams", shift: "Cutting Machine Operator · Sweets from the Earth" },
];

function Table({ slice }: { slice: SliceId }) {
  const [taken, setTaken] = useState<Record<string, Triage | undefined>>({});
  return (
    <>
      {ROWS[slice].map((row) => (
        <div key={row.name} className={rowStyle}>
          <div className={linesStyle}>
            <span className={cx(titleStyle, cellStyle)} data-cell="name">
              {row.name}
            </span>
            <span className={cx(subStyle, cellStyle)} data-cell="shift">
              {row.shift}
            </span>
            <Signals signals={row.signals} />
            <span className={endsStyle} onClick={(event) => event.stopPropagation()}>
              <RowEnd row={row} taken={taken[row.name]} onTake={(to) => setTaken((t) => ({ ...t, [row.name]: to }))} />
            </span>
          </div>
        </div>
      ))}
      {MORE.map(({ name, shift }) => (
        <Wireframe key={name} className={rowStyle} opacity={25}>
          <div className={linesStyle}>
            <Skeleton className={cx(titleStyle, cellStyle)} data-cell="name">
              {name}
            </Skeleton>
            <Skeleton className={cx(subStyle, cellStyle)} data-cell="shift">
              {shift}
            </Skeleton>
          </div>
        </Wireframe>
      ))}
    </>
  );
}

/** The dashboard: its six tiles, three to a row, over the slice they pick, starting on missing check-ins. */
export function RiskDashboardWireframe() {
  const [slice, setSlice] = useState<SliceId>("missing");
  return (
    <Stage>
      <div className={columnStyle} data-wide="">
        <div className={cardStyle}>
          <div className={headStyle}>
            <span className={headingStyle}>Check-ins</span>
            <Day />
          </div>
          <Tiles slice={slice} onSlice={setSlice} />
          <Table key={slice} slice={slice} />
        </div>
      </div>
    </Stage>
  );
}
