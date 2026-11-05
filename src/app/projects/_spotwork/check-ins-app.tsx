"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { css, cx } from "../../../../styled-system/css";
import { hstack } from "../../../../styled-system/patterns";
import {
  CUSTOMER,
  LOGOS,
  STATUS_LABEL,
  chipOf,
  clock,
  daysFrom,
  lateBy,
  minutesNow,
  onSite,
  shiftHours,
  submitted,
  timeRange,
  untilOf,
  type Day,
  type OverlayResult,
  type Shift,
  type Worker,
} from "./data";
import { APP_TEAM, appTeam, appTeams, prospectsFrom, teamRequirements, updateAppTeam } from "./activations";
import { InlineTableRecord } from "./cards";
import { ACTIVATIONS_MIN_WIDTH, ACTIVATIONS_WIDTH, ActivationsPage } from "./activations-page";
import { COMPANY_TEMPLATES, SNACKS } from "./copy";
import type { Geofence } from "./geofence";
import { addPreset, presetsSeed, tagsOf } from "./presets";
import { PRESETS_MIN_WIDTH, PRESETS_WIDTH, PresetsPage, TemplatesPage } from "./presets-page";
import { POOL_MIN_WIDTH, POOL_WIDTH, PoolPage } from "./pool-page";
import { PresetSheet } from "./preset-sheet";
import { TemplatesContext, activeShifts, newTemplateDraft, shiftTemplates, templatesSeed } from "./templates";
import { CheckInOverlay, submittedSnack } from "./check-in-overlay";
import {
  CheckInsDashboard,
  DASHBOARD_MIN_WIDTH,
  DASHBOARD_WIDTH,
} from "./check-ins-dashboard";
import { NewShift, type Version } from "./new-shift";
import { isoOf, post, postedMessage, reschedule, scheduleCounts, seedSeries, weekOf } from "./shifts";
import { offeredOn } from "./planner";
import { SHIFTS_MIN_WIDTH, SHIFTS_WIDTH, ShiftsPage, Snackbar } from "./shifts-page";
import { TIMESHEET_MIN_WIDTH, TIMESHEET_WIDTH, TimesheetPage } from "./timesheet-page";
import type { Edits, OffAppShift } from "./timesheet";
import { useTour } from "./tour";
import { WorkerName } from "./profile-card";
import { ProgressBar } from "./data-viz";
import {
  Button,
  Chip,
  Divider,
  Pill,
  Presence,
  SegmentedControl,
  STATUS_PILL,
  STATUS_ICON,
  Tooltip,
  Typography,
  placeholdersStyle,
  reveal,
} from "./ui";
import { Avatar } from "./data-table";
import { TeamData, TeamLoading } from "./team-loading";
import CopyIcon from "./assets/icons/small/copy.svg";
import CheckInIcon from "./assets/icons/small/check-in.svg";
import EditIcon from "./assets/edit.svg";
import NavCheckInIcon from "./assets/nav-check-in.svg";
import NavCheckInActiveIcon from "./assets/nav-check-in-active.svg";
import NavShiftsIcon from "./assets/nav-shifts.svg";
import NavBuildingIcon from "./assets/nav-building.svg";
import NavTemplatesIcon from "./assets/duplicate.svg";
import NavPoolIcon from "./assets/icons/medium/safety-vest.svg";
import NavInvoicingIcon from "./assets/notes.svg";
import NavVerificationsIcon from "./assets/icons/medium/verification.svg";
import NavCancellationsIcon from "./assets/icons/medium/cancellation.svg";
import SettingsIcon from "./assets/icons/medium/settings.svg";
import BellIcon from "./assets/icons/medium/bell.svg";
import ConfirmedIcon from "./assets/confirmed.svg";
import ClockIcon from "./assets/clock.svg";
import ClockActiveIcon from "./assets/clock-active.svg";
import { Sidebar, pageTopRaw } from "./sidebar";
import { SummaryCards } from "./summary-cards";

// SW Curie's customer Check-ins page (19031:50678), laid out at the size it's given; the overlay scales it to fit.
// A window narrower than the page's narrowest draws the whole app at that width, scaled down evenly.
// No `main` or `article` here: globals.css pads and narrows both site-wide.

// The app's larger layout box stays inside the window when scaled, without becoming a scroller.
const frameStyle = css({ flexShrink: 0, overflow: "clip" });

// The sidebar holds still and only the page scrolls, so nothing hung under its last row can push it.
const appStyle = css({
  position: "relative",
  transformOrigin: "0 0",
  // Its layers stay under the browser bar's menu.
  isolation: "isolate",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  "& button": { cursor: "pointer" },
  // While a new comment waits for its spot (tour's comment editor).
  "[data-placing] &": { cursor: "crosshair", "& *": { cursor: "crosshair" } },
});

// Where the app's sheets and overlays hang, from its top: over the page and the rail, under the floating sidebar (6).
// Its own compositing layer: without one, Safari can draw the scrolling page over it.
const layerStyle = css({ position: "absolute", insetBlockStart: 0, insetInline: 0, zIndex: 5, willChange: "transform" });

// Positioned, so `reveal`'s offsets stop at it.
// A page's own stack: nothing in it, however high its z-index, paints over the sidebar or a sheet.
export const pageScrollStyle = css({
  position: "relative",
  isolation: "isolate",
  flex: "1 1 auto",
  minWidth: 0,
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },
});

// The snackbars' place, which a modal's wall leaves live.
const snackLayerStyle = css({ display: "contents" });

// The nav stays open beside a page while the page has its room: the customer's keeps a gutter either side.
// Wide enough for Check-ins Dashboard beside its hover chevron.
const NAV_WIDTH = 256;
// Shut, the nav's rail keeps this much beside the page.
const RAIL_WIDTH = 64;
// How long a team switched to takes to load.
const TEAM_LOAD_MS = 1000;
const PAGE_WIDTH = 800;
const PAGE_GUTTER = 25;

export type Page = "check-ins" | "shifts" | "templates" | "pool" | "timesheets" | "dashboard" | "activations" | "presets";
/** Changes the page as the sidebar does, for a control outside the app. */
export type AppHandle = { go: (page: Page) => void };
// The overlay's two projects' pages; the sidebar draws the other project's as placeholders.
const PROJECT_PAGES: Page[][] = [
  ["check-ins", "templates", "timesheets", "dashboard"],
  ["shifts", "pool", "activations", "presets"],
];
const PAGE_ROOM: Record<Page, number> = {
  "check-ins": PAGE_WIDTH + 2 * PAGE_GUTTER,
  shifts: SHIFTS_WIDTH,
  templates: PRESETS_WIDTH,
  pool: POOL_WIDTH,
  timesheets: TIMESHEET_WIDTH,
  dashboard: DASHBOARD_WIDTH,
  activations: ACTIVATIONS_WIDTH,
  presets: PRESETS_WIDTH,
};
const PAGE_MIN: Record<Page, number> = {
  "check-ins": PAGE_WIDTH + 2 * PAGE_GUTTER,
  shifts: SHIFTS_MIN_WIDTH,
  templates: PRESETS_MIN_WIDTH,
  pool: POOL_MIN_WIDTH,
  timesheets: TIMESHEET_MIN_WIDTH,
  dashboard: DASHBOARD_MIN_WIDTH,
  activations: ACTIVATIONS_MIN_WIDTH,
  presets: PRESETS_MIN_WIDTH,
};

const bodyStyle = css({
  position: "relative",
  display: "flex",
  flex: "1 1 auto",
  minHeight: 0,
});

// The Check-ins page's column, centred in what the sidebar leaves.
export const pageColumnRaw = css.raw({ width: "var(--sw-width-card)", marginInline: "auto" });

const pageStyle = css(pageColumnRaw, pageTopRaw, {
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  gap: "var(--sw-gap-3xl)",
  paddingBlockEnd: "var(--sw-padding-xl)",
});

// The codes' buttons meet the divider between them.
const codesStyle = css({ display: "flex" });

const cardStyle = css({
  display: "flex",
  flexDirection: "column",
  borderRadius: "var(--sw-radius-md)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
});

const sectionStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
});

const sectionHeadStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

const shiftStyle = css({
  paddingBlock: "var(--sw-padding-xl) var(--sw-padding-xs)",
  paddingInline: "var(--sw-padding-xl)",
  gap: "var(--sw-gap-xl)",
});

const shiftHeadStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--sw-gap-md)",
});

const shiftInfoStyle = css({
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
});

const positionStyle = css({
  display: "flex",
  alignItems: "center",
  height: "1.75rem",
});

// A worker's row, SW Curie's Molecules/Inline Table Record/Check-in Status Record, on the record's rule.
export const rowStyle = css({
  position: "relative",
  height: "3rem",
  "&[data-open]": { zIndex: 2 },
  // Figma's: the worker and the time share evenly what the status leaves, so a narrow row cuts the time short.
  "&[data-split] > :first-child": { flexBasis: 0 },
  "&[data-split] > :last-child": { flexBasis: 0, minWidth: 0 },
});

// The time's cell takes up to 224px of the room the status leaves, so every row's status lines up.
export const timeCellStyle = css({ flex: "1 1 auto", maxWidth: "16.5rem" });

// 4px after the check-in time, touching the "–" after it.
const lateChipStyle = css({ marginInlineStart: "var(--sw-gap-xs)" });

// The day control's segments, in Figma's order.
const DAYS: [Day, string][] = [
  ["today", "Today"],
  ["tomorrow", "Tomorrow"],
  ["yesterday", "Yesterday"],
];

export function CheckInsApp({
  anchor,
  width,
  height,
  initialPage = "check-ins",
  onPage,
  shiftVersion = "final",
  admin = false,
  fences,
  ref,
}: {
  /** Where the afternoon shift starts, in minutes after midnight. */
  anchor: number;
  width: number;
  height: number;
  initialPage?: Page;
  /** Each change of page, wherever it came from. */
  onPage?: (page: Page) => void;
  /** Which of Activation and retention's Shift scheduling versions New Shift opens. */
  shiftVersion?: Version;
  /** Timesheets as a Spotwork admin sees them, adding off-app shifts. */
  admin?: boolean;
  /** Templates' fences to start on, by template, in place of their buildings'. */
  fences?: Record<string, Geofence>;
  ref?: Ref<AppHandle>;
}) {
  const [today] = useState(() => isoOf(new Date()));
  const [series, setSeries] = useState(() => seedSeries(today));
  // New Shift, with the template it's posted from.
  const [posting, setPosting] = useState<{ template?: string } | null>(null);
  // Create a Template, and New Shift's pick of what it creates when it was opened from there.
  const [creating, setCreating] = useState<{ pick?: (id: string) => void } | null>(null);
  // Stacked, oldest first, each with its own id and timer, so the same message twice stacks too.
  const [snacks, setSnacks] = useState<{ message: string; id: number; close: () => void }[]>([]);
  const said = useRef(0);
  const say = useCallback((message: string) => {
    const id = ++said.current;
    const close = () => setSnacks((all) => all.filter((snack) => snack.id !== id));
    setSnacks((all) => [...all, { message, id, close }]);
  }, []);
  const [weekStart, setWeekStart] = useState(() => weekOf(today)[0]);
  const [days, setDays] = useState(() => daysFrom(anchor, minutesNow(anchor)));
  const [timesheetEdits, setTimesheetEdits] = useState<Edits>({});
  const [offApp, setOffApp] = useState<OffAppShift[]>([]);
  const [prospects, setProspects] = useState(() => prospectsFrom(new Date()));
  const locked = teamRequirements(prospects);
  const [presets, setPresets] = useState(presetsSeed);
  const [templates, setTemplates] = useState(() =>
    templatesSeed().map((template) => (fences?.[template.id] ? { ...template, geofence: fences[template.id] } : template)),
  );
  const [team, setTeam] = useState(APP_TEAM.team);
  const [teams, setTeams] = useState(false);
  // A team switched to loads its pages afresh, for a moment.
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const id = window.setTimeout(() => setLoading(false), TEAM_LOAD_MS);
    return () => window.clearTimeout(id);
  }, [loading, team]);
  const switchTeam = (name: string) => {
    setTeams(false);
    if (name === team) return;
    setTeam(name);
    setLoading(true);
  };
  const [open, setOpen] = useState<{
    shift: string;
    worker: string;
    trigger: HTMLElement;
  } | null>(null);
  const [day, setDay] = useState<Day>("today");
  const shifts = days[day];
  const [page, setPage] = useState<Page>(initialPage);
  const placeholder = (item: Page) => !PROJECT_PAGES.find((pages) => pages.includes(page))!.includes(item);
  // New Shift and Create a Template are Activation and retention's; opened from Check-ins' pages, placeholders.
  const elsewhere = placeholder("shifts");
  const scroll = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const tour = useTour();

  const scale = Math.min(1, width / (PAGE_MIN[page] + RAIL_WIDTH));
  const appWidth = Math.max(width, PAGE_MIN[page] + RAIL_WIDTH);
  const appHeight = height / scale;
  const roomy = appWidth >= NAV_WIDTH + PAGE_ROOM[page];

  useEffect(() => {
    if (!open || !scroll.current) return;
    const node = scroll.current.querySelector<HTMLElement>(
      "[data-check-in-overlay]",
    );
    if (!node) return;
    const id = window.setTimeout(() => reveal(scroll.current!, node), 60);
    return () => window.clearTimeout(id);
  }, [open]);

  const openFor = (shift: Shift, worker: Worker, trigger: HTMLElement) => {
    setOpen({ shift: shift.id, worker: worker.id, trigger });
    if (worker.id === "maria") tour.done("open-check-in");
  };

  const close = (worker: Worker) => {
    setOpen(null);
    if (worker.id === "maria") tour.backTo("open-check-in");
  };

  // The customer's shifts, which the operations dashboard changes too.
  const submitFor = useCallback(
    (
      on: Day,
      shiftId: string,
      workerId: string,
      result: OverlayResult,
      by: string,
    ) =>
      setDays((all) => ({
        ...all,
        [on]: all[on].map((s) =>
          s.id !== shiftId
            ? s
            : {
                ...s,
                workers: s.workers.map((w) =>
                  w.id === workerId
                    ? submitted(w, s, result, by, minutesNow(anchor))
                    : w,
                ),
              },
        ),
      })),
    [anchor],
  );

  const submit = (shift: Shift, worker: Worker, result: OverlayResult) => {
    submitFor(day, shift.id, worker.id, result, CUSTOMER);
    say(submittedSnack(worker, result));
    setOpen(null);
  };

  // Another day's rows share today's ids, so an open overlay closes first.
  const show = (next: Day) => {
    if (open?.worker === "maria") tour.backTo("open-check-in");
    setOpen(null);
    setDay(next);
  };

  const go = (next: Page) => {
    if (next === page) return;
    if (open?.worker === "maria") tour.backTo("open-check-in");
    setOpen(null);
    setPosting(null);
    setCreating(null);
    setPage(next);
    onPage?.(next);
    if (scroll.current) scroll.current.scrollTop = 0;
  };
  useImperativeHandle(ref, () => ({ go }));

  const newShift = (template?: string) => {
    setSnacks([]);
    setPosting({ template });
  };

  const app = (
    <div className={frameStyle} style={{ width, height }}>
      <div
        className={cx(appStyle, placeholdersStyle)}
        style={{
          width: appWidth,
          height: appHeight,
          transform: scale < 1 ? `scale(${scale})` : undefined,
        }}
        data-check-ins-app=""
      >
        <div ref={setLayer} className={layerStyle} />

        <div className={bodyStyle}>
          <Sidebar label="Main" value={page} onChange={go} open={roomy} floating={!roomy} rail>
            <Sidebar.Switcher label="Switch team" open={teams} onOpenChange={setTeams}>
              <Avatar type="company" src={LOGOS["Canada Cartage"]} />
              <Typography variant="body">{team}</Typography>
              {appTeams(prospects).map(({ name, address }) => (
                <InlineTableRecord
                  key={name}
                  defaultSelected={name === team}
                  aria-current={name === team || undefined}
                  onClick={() => switchTeam(name)}
                >
                  <InlineTableRecord.Cell fill>
                    <Avatar type="company" size="medium" src={LOGOS["Canada Cartage"]} />
                    <Typography variant="body">{name}</Typography>
                    <InlineTableRecord.Selected>
                      <Pill state="success">
                        <ConfirmedIcon aria-hidden />
                        Selected
                      </Pill>
                    </InlineTableRecord.Selected>
                    <Typography tag="p" variant="metadata" color="subdued">{address.label}</Typography>
                  </InlineTableRecord.Cell>
                </InlineTableRecord>
              ))}
            </Sidebar.Switcher>
            <Sidebar.Item value="check-ins" placeholder={placeholder("check-ins")}>
              {page === "check-ins" ? <NavCheckInActiveIcon aria-hidden /> : <NavCheckInIcon aria-hidden />}
              <Typography variant="body">Overview</Typography>
            </Sidebar.Item>
            <Sidebar.Item value="shifts" placeholder={placeholder("shifts")}>
              <NavShiftsIcon aria-hidden />
              <Typography variant="body">Shifts</Typography>
            </Sidebar.Item>
            <Sidebar.Item value="timesheets" placeholder={placeholder("timesheets")}>
              {page === "timesheets" ? <ClockActiveIcon aria-hidden /> : <ClockIcon aria-hidden />}
              <Typography variant="body">Timesheets</Typography>
            </Sidebar.Item>
            <Sidebar.Item placeholder>
              <NavInvoicingIcon aria-hidden width={24} height={24} />
              <Typography variant="body">Invoicing</Typography>
            </Sidebar.Item>
            <Sidebar.Item value="templates" placeholder={placeholder("templates")}>
              <NavTemplatesIcon aria-hidden />
              <Typography variant="body">Manage templates</Typography>
            </Sidebar.Item>
            <Sidebar.Item value="pool" placeholder={placeholder("pool")}>
              <NavPoolIcon aria-hidden />
              <Typography variant="body">Manage worker pool</Typography>
            </Sidebar.Item>
            <Sidebar.Group>
              <Sidebar.GroupLabel>
                <Typography tag="div" variant="metadataStrong" color="subdued">
                  Admin
                </Typography>
              </Sidebar.GroupLabel>
              <Sidebar.Item value="dashboard" placeholder={placeholder("dashboard")}>
                {page === "dashboard" ? <NavCheckInActiveIcon aria-hidden /> : <NavCheckInIcon aria-hidden />}
                <Typography variant="body">Check-ins dashboard</Typography>
              </Sidebar.Item>
              <Sidebar.Item value="activations" placeholder={placeholder("activations")}>
                <NavBuildingIcon aria-hidden />
                <Typography variant="body">Companies</Typography>
              </Sidebar.Item>
              <Sidebar.Item value="presets" placeholder={placeholder("presets")}>
                <NavTemplatesIcon aria-hidden />
                <Typography variant="body">Manage presets</Typography>
              </Sidebar.Item>
              <Sidebar.Item placeholder>
                <NavVerificationsIcon aria-hidden />
                <Typography variant="body">Verifications</Typography>
              </Sidebar.Item>
              <Sidebar.Item placeholder>
                <NavCancellationsIcon aria-hidden />
                <Typography variant="body">Cancellations</Typography>
              </Sidebar.Item>
              <Sidebar.Item placeholder>
                <SettingsIcon aria-hidden />
                <Typography variant="body">Platform settings</Typography>
              </Sidebar.Item>
            </Sidebar.Group>
            <Sidebar.Footer>
              <Sidebar.Item>
                <BellIcon aria-hidden />
                <Typography variant="body">Notifications</Typography>
              </Sidebar.Item>
              <Sidebar.Account>
                <Avatar>JP</Avatar>
                <Typography variant="body">Jesse Pereira</Typography>
                <Button size="icon" aria-label="Profile settings" data-neutral="">
                  <SettingsIcon aria-hidden />
                </Button>
              </Sidebar.Account>
            </Sidebar.Footer>
          </Sidebar>

          <div ref={scroll} className={pageScrollStyle} data-app-scroll="">
            <TeamLoading value={loading}>
              {page === "presets" ? (
                <PresetsPage presets={presets} onPresets={setPresets} onSnack={say} layer={layer} height={appHeight} />
              ) : page === "templates" ? (
                <TemplatesPage
                  templates={templates}
                  onTemplates={setTemplates}
                  locked={locked}
                  shifts={(id) => activeShifts(series, id, today)}
                  onPostShift={newShift}
                  onSnack={say}
                  layer={layer}
                  height={appHeight}
                />
              ) : page === "pool" ? (
                <PoolPage
                  team={appTeam(prospects)}
                  onTeam={(change) => setProspects((all) => updateAppTeam(all, change))}
                  onSnack={say}
                />
              ) : page === "activations" ? (
                <ActivationsPage
                  prospects={prospects}
                  onProspects={setProspects}
                  presets={presets}
                  layer={layer}
                  height={appHeight}
                  onSnack={say}
                />
              ) : page === "dashboard" ? (
                <CheckInsDashboard
                  anchor={anchor}
                  customer={days}
                  onCustomerSubmit={submitFor}
                  onSnack={say}
                  layer={layer}
                  height={appHeight}
                />
              ) : page === "timesheets" ? (
                <TimesheetPage
                  admin={admin}
                  today={today}
                  days={days}
                  edits={timesheetEdits}
                  onEdits={setTimesheetEdits}
                  offApp={offApp}
                  onOffApp={setOffApp}
                  onSnack={say}
                  layer={layer}
                  height={appHeight}
                />
              ) : page === "shifts" ? (
                <ShiftsPage
                  today={today}
                  series={series}
                  weekStart={weekStart}
                  onWeek={setWeekStart}
                  onNewShift={() => newShift()}
                  onManageTemplates={() => go("templates")}
                  layer={layer}
                  height={appHeight}
                  onSnack={say}
                  onOffers={(id, offers) => setSeries((all) => all.map((line) => (line.id === id ? { ...line, offers } : line)))}
                  onReschedule={
                    shiftVersion === "final"
                      ? (id, dates, spotFill) => {
                          setSeries((all) => reschedule(all, id, dates, spotFill));
                          const line = series.find((s) => s.id === id)!;
                          const { added, cancelled } = scheduleCounts(line.dates, dates, today);
                          const posted = dates.filter((date) => date >= today && !line.dates.includes(date));
                          const offered = offeredOn(reschedule([line], id, dates, spotFill)[0], posted, today);
                          if (added || cancelled) say(SNACKS.rescheduled(added, cancelled, offered));
                          else if (spotFill !== (line.spotFill ?? true)) say(SNACKS.spotFill(spotFill));
                        }
                      : undefined
                  }
                />
              ) : (
                <div className={pageStyle} role="main">
                  <Typography tag="h1" variant="title">Hello, Jesse!</Typography>
                  <SummaryCards today={today} series={series} />

                  <section className={sectionStyle} aria-label="Check-ins">
                    <div className={sectionHeadStyle}>
                      <Typography tag="h2" variant="heading">Check-ins</Typography>
                      <SegmentedControl value={day} onChange={show} size="small" aria-label="Day">
                        {DAYS.map(([key, label]) => (
                          <SegmentedControl.Segment key={key} value={key}>
                            {label}
                          </SegmentedControl.Segment>
                        ))}
                      </SegmentedControl>
                    </div>

                    {shifts.map((shift) => {
                      const count = onSite(shift);
                      return (
                        <TeamData key={shift.id}>
                          <div
                            className={cx(cardStyle, shiftStyle)}
                            role="group"
                            aria-label={shift.name}
                            data-shift={shift.name}
                          >
                            <div className={shiftHeadStyle}>
                              <div className={shiftInfoStyle}>
                                <Typography tag="div" variant="subheading" className={positionStyle}>
                                  {shift.position}
                                </Typography>
                                <Typography tag="div" variant="metadata" color="subdued">
                                  {`${shift.name} • ${shiftHours(shift)}`}
                                </Typography>
                                <ProgressBar value={count} max={shift.workers.length} tone="active">
                                  <Typography variant="metadata" color="subdued">
                                    {`${count}/${shift.workers.length}`}
                                  </Typography>
                                  <Typography variant="metadata" color="subdued">
                                    On Site
                                  </Typography>
                                </ProgressBar>
                              </div>
                              <div className={codesStyle}>
                                {(["checkIn", "checkOut"] as const).map((kind) => (
                                  <Fragment key={kind}>
                                    {kind === "checkOut" && <Divider orientation="vertical" />}
                                    <Button
                                      size="small"
                                      emphasis="tertiary"
                                      onClick={() => {
                                        navigator.clipboard?.writeText(shift.codes[kind]).catch(() => {});
                                        say(SNACKS[kind === "checkIn" ? "checkInCode" : "checkOutCode"](shift.codes[kind]));
                                      }}
                                    >
                                      {`${kind === "checkIn" ? "Check-in" : "Check-out"}: ${shift.codes[kind]}`}
                                      <CopyIcon aria-hidden />
                                    </Button>
                                  </Fragment>
                                ))}
                              </div>
                            </div>

                            <div>
                              {shift.workers.map((worker) => {
                                const isOpen =
                                  open?.shift === shift.id &&
                                  open.worker === worker.id;
                                const missing = worker.checkIn === undefined;
                                const chip = chipOf(worker, day);
                                const lateness = chip === "lateCheckIn" ? lateBy(worker.checkIn! - shift.start) : undefined;
                                return (
                                  <InlineTableRecord
                                    key={worker.id}
                                    className={rowStyle}
                                    data-worker={worker.name}
                                    data-open={isOpen ? "" : undefined}
                                  >
                                    <InlineTableRecord.Cell fill>
                                      <Avatar src={worker.face} size="inline" />
                                      <WorkerName worker={worker} />
                                    </InlineTableRecord.Cell>
                                    <InlineTableRecord.Cell width={200}>
                                      <Pill {...STATUS_PILL[chip]}>
                                        {STATUS_ICON[chip]}
                                        {STATUS_LABEL[chip]}
                                      </Pill>
                                    </InlineTableRecord.Cell>
                                    <InlineTableRecord.Cell align="end" className={timeCellStyle}>
                                      {missing && (
                                        <Button
                                          size="small"
                                          emphasis="secondary"
                                          data-tour={
                                            worker.id === "maria" && day === "today"
                                              ? "open-check-in"
                                              : undefined
                                          }
                                          onClick={(event) =>
                                            openFor(shift, worker, event.currentTarget)
                                          }
                                        >
                                          <CheckInIcon aria-hidden />
                                          Check in...
                                        </Button>
                                      )}
                                      {!missing && !lateness && <Typography variant="body">{timeRange(worker)}</Typography>}
                                      {lateness && (
                                        <Typography variant="body" className={hstack({ gap: "var(--sw-gap-none)" })}>
                                          {clock(worker.checkIn!)}
                                          <Chip size="small" state={lateness.tone} className={lateChipStyle}>{lateness.text}</Chip>
                                          {untilOf(worker)}
                                        </Typography>
                                      )}
                                      {!missing && (
                                        <Button size="icon"
                                          aria-label="Edit check-in"
                                          onClick={(event) =>
                                            openFor(shift, worker, event.currentTarget)
                                          }
                                        >
                                          <EditIcon aria-hidden />
                                          <Tooltip>Edit check-in</Tooltip>
                                        </Button>
                                      )}
                                    </InlineTableRecord.Cell>
                                    <Presence>
                                      {isOpen && (
                                        <CheckInOverlay
                                          shift={shift}
                                          worker={worker}
                                          anchor={anchor}
                                          trigger={open.trigger}
                                          onCancel={() => close(worker)}
                                          onSubmit={(result) =>
                                            submit(shift, worker, result)
                                          }
                                        />
                                      )}
                                    </Presence>
                                  </InlineTableRecord>
                                );
                              })}
                            </div>
                          </div>
                        </TeamData>
                      );
                    })}
                  </section>
                </div>
              )}
            </TeamLoading>
          </div>
        </div>
        <div className={snackLayerStyle} data-unwalled="">
          <Snackbar.Stack>
            {snacks.map(({ message, id, close }) => (
              <Snackbar key={id} onClose={close}>
                {message}
                <Snackbar.Close />
              </Snackbar>
            ))}
          </Snackbar.Stack>
        </div>
        {layer &&
          createPortal(
            <>
              <Presence>
                {posting && (
                  <NewShift
                    version={shiftVersion}
                    placeholder={elsewhere}
                    today={today}
                    template={posting.template}
                    height={appHeight}
                    onCancel={() => setPosting(null)}
                    onPost={(next) => {
                      setSeries((all) => post(all, next));
                      setPosting(null);
                      say(postedMessage(next.dates.length));
                      // To the week of the first shift posted, so it shows.
                      setWeekStart(weekOf(next.dates.toSorted()[0])[0]);
                    }}
                    onAddTemplate={(pick) => setCreating({ pick })}
                  />
                )}
              </Presence>
              <Presence>
                {creating && (
                  <PresetSheet
                    words={COMPANY_TEMPLATES}
                    placeholder={elsewhere}
                    addressed
                    initial={newTemplateDraft()}
                    locked={locked}
                    tags={tagsOf(templates)}
                    height={appHeight}
                    onCancel={() => setCreating(null)}
                    onSave={(draft, status) => {
                      const next = addPreset(templates, draft, status, new Date());
                      setTemplates(next);
                      say(SNACKS.template[status === "active" ? "created" : "drafted"]);
                      if (status === "active") creating.pick?.(next.at(-1)!.id);
                      setCreating(null);
                    }}
                  />
                )}
              </Presence>
            </>,
            layer,
          )}
      </div>
    </div>
  );

  return <TemplatesContext value={shiftTemplates(templates)}>{app}</TemplatesContext>;
}
