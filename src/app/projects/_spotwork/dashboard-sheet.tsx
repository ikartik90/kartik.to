"use client";

import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { css } from "../../../../styled-system/css";
import { clock } from "./data";
import { history, noShowRisk, stamp, type Entry, type Row } from "./dashboard";
import { AddNote, WorkerLocation } from "./dashboard-overlays";
import { NoShowRisk } from "./risk-chart";
import { RowStatusPill } from "./row-status";
import { TabGroup } from "./tabs";
import { Badge, Button, Checkbox, Divider, Field, Pill, Presence, STATUS_PILL, Tooltip, Typography, reveal, SideSheet, useEscapeLayer } from "./ui";
import EditIcon from "./assets/edit.svg";
import NotesIcon from "./assets/notes.svg";
import HistoryDotIcon from "./assets/history-dot.svg";

// SW Curie's worker side sheet (23374:112669) in two tabs: the shift tracker, the row's risk factor and check-in; and
// its notes and history, each status its shift moved to among them.

export const sheetBodyStyle = css({
  position: "relative",
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  paddingBlock: "var(--sw-padding-xxl)",
  paddingInline: "var(--sw-padding-xl)",
  overflowY: "auto",
  overscrollBehavior: "contain",
  // A large sheet's settings: down its middle, a card wide, on the page's grey.
  "&[data-centred]": {
    alignItems: "center",
    gap: "var(--sw-gap-3xl)",
    paddingBlock: "var(--sw-padding-3xl)",
    backgroundColor: "var(--sw-surface-subdued)",
    "& > *": { width: "100%", maxWidth: "var(--sw-width-card)" },
  },
});

export const cardStyle = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  flexShrink: 0,
  paddingBlock: "var(--sw-padding-xl) var(--sw-padding-xs)",
  paddingInline: "var(--sw-padding-xl)",
  borderRadius: "var(--sw-radius-md)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
  "&[data-padded]": { paddingBlockEnd: "var(--sw-padding-xl)" },
});

/** A Notes & history's notes and status changes, a rule apart. */
export const notesListStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-xl)" });

const addNoteStyle = css({ alignSelf: "flex-start" });

const cardHeadStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

const statusRowStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: "3rem",
  boxShadow: "inset 0 1px 0 var(--sw-border-subdued)",
});

const entryStyle = css({
  display: "flex",
  alignItems: "flex-start",
  "& > svg, & > span:first-child": { flexShrink: 0, width: "1.5rem", height: "1.5rem" },
  "& > div": { display: "flex", flex: "1 1 auto", flexDirection: "column", alignItems: "flex-start", gap: "var(--sw-gap-xs)", minWidth: 0 },
});

const messageStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--sw-gap-xs)",
  alignSelf: "stretch",
  padding: "var(--sw-padding-md)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-subdued)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
  color: "var(--sw-glyph-info)",
  "& > svg": { flexShrink: 0 },
  "& > span": { color: "var(--sw-glyph-default)" },
});

const noteTextStyle = css({ display: "flex", flexDirection: "column" });

const BYLINE: Record<Entry["kind"], string> = {
  checkIn: "Checked in by",
  absent: "Marked absent by",
  status: "By",
  message: "By",
  note: "By",
};

export type SheetTab = "tracker" | "notes";

/** The times of the row's unread notes, its newest. */
const unreadOf = (row: Row) =>
  new Set(history(row).filter((entry) => entry.kind === "note").slice(0, row.unreadNotes).map((entry) => entry.at));

/** The overlay open in the sheet: Check In, beside the button that opened it, or Add a note. */
type Inner = { kind: "checkIn"; trigger: HTMLElement } | { kind: "note" } | null;

export function WorkerSheet({
  row,
  height,
  dayStart,
  tab,
  onTab,
  renderCheckIn,
  onAcknowledge,
  onRead,
  onNote,
  onClose,
}: {
  row: Row;
  height: number;
  dayStart: Date;
  tab: SheetTab;
  onTab: (tab: SheetTab) => void;
  /** The Check In overlay for this row, opened beside `trigger`. */
  renderCheckIn: (trigger: HTMLElement, onDone: () => void) => ReactNode;
  onAcknowledge: (on: boolean) => void;
  onRead: () => void;
  onNote: (note: string) => void;
  onClose: () => void;
}) {
  const id = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [inner, setInner] = useState<Inner>(null);
  useEscapeLayer(sheet, true, onClose);

  // Another worker's row fills the open sheet: their contents from the top, the last worker's overlays shut, as another
  // tab's do. The notes unread as a worker's sheet shows stay marked while it does; read by then, they're plain the next
  // time it does.
  const [shown, setShown] = useState(row.id);
  const [shownTab, setShownTab] = useState(tab);
  const [unread, setUnread] = useState(() => unreadOf(row));
  if (shown !== row.id) {
    setShown(row.id);
    setInner(null);
    setUnread(unreadOf(row));
  }
  if (shownTab !== tab) {
    setShownTab(tab);
    setInner(null);
  }
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [row.id, tab]);

  // Opening Notes & history reads its notes.
  useEffect(() => {
    if (tab === "notes" && row.unreadNotes) onRead();
  }, [tab, row.id, row.unreadNotes, onRead]);

  useEffect(() => {
    if (!inner || !body.current) return;
    const node = body.current.querySelector<HTMLElement>("[data-dashboard-overlay], [data-check-in-overlay]");
    if (!node) return;
    const id = window.setTimeout(() => reveal(body.current!, node), 60);
    return () => window.clearTimeout(id);
  }, [inner]);

  const close = () => setInner(null);
  const entries = history(row);
  const zone = `(${row.zone})`;
  // Location off since before tracking began: no report to map.
  const mapped = !!row.trace || !row.signals.includes("locationDisabled");
  const statusText =
    row.checkIn === undefined
      ? `${clock(row.start)}–${clock(row.end)} ${zone}`
      : `${clock(row.checkIn)}–${row.checkOut === undefined ? "In progress" : clock(row.checkOut)} ${zone}`;

  return (
    <SideSheet
      size="small"
      onClose={onClose}
      ref={sheet}
      style={{ height }}
      label={row.worker.name}
      data-escape-layer=""
    >
      <SideSheet.Header>
        <Typography variant="heading">{row.worker.name}</Typography>
        <SideSheet.Close />
        <Typography variant="metadata" color="subdued">{row.position}</Typography>
      </SideSheet.Header>
      <TabGroup size="small" value={tab} onChange={onTab}>
        <TabGroup.Tab value="tracker" id={`${id}-tracker`} aria-controls={`${id}-panel`}>
          Shift tracker
        </TabGroup.Tab>
        <TabGroup.Tab value="notes" id={`${id}-notes`} aria-controls={`${id}-panel`}>
          Notes & history
          {row.unreadNotes > 0 && <Badge>{row.unreadNotes}</Badge>}
        </TabGroup.Tab>
      </TabGroup>
      <div ref={body} id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className={sheetBodyStyle}>
        {tab === "tracker" ? (
          <>
            <section className={cardStyle} data-padded="" aria-label="Risk factor">
              <NoShowRisk
                name={row.worker.name}
                readings={noShowRisk(row.worker)}
                details
                heading="Risk factor"
                action={
                  <Field orientation="horizontal">
                    <Checkbox checked={row.acknowledged} onChange={onAcknowledge} />
                    <Field.Label>Acknowledge Risk</Field.Label>
                  </Field>
                }
              />
            </section>

            <section className={cardStyle} data-padded={mapped && !row.trace ? "" : undefined} aria-label="Check-in status">
              <div className={cardHeadStyle}>
                <Typography tag="h3" variant="heading">
                  Check-in status
                </Typography>
              </div>
              <div className={statusRowStyle}>
                <RowStatusPill status={row.status} />
                <Typography variant="body">{statusText}</Typography>
                <Button size="icon"
                  aria-label="Edit check-in"
                  aria-expanded={inner?.kind === "checkIn"}
                  onClick={(event) =>
                    setInner(inner?.kind === "checkIn" ? null : { kind: "checkIn", trigger: event.currentTarget })
                  }
                >
                  <EditIcon aria-hidden />
                  <Tooltip>Edit check-in</Tooltip>
                </Button>
              </div>
              {mapped && <WorkerLocation key={row.id} row={row} size="wide" history flush />}
              <Presence>{inner?.kind === "checkIn" && renderCheckIn(inner.trigger, close)}</Presence>
            </section>
          </>
        ) : (
          <>
            <Button size="small" emphasis="secondary" className={addNoteStyle} onClick={() => setInner({ kind: "note" })}>
              <NotesIcon aria-hidden />
              Add note...
            </Button>
            <div role="list" aria-label="Notes & history" className={notesListStyle}>
              {entries.map((entry, i) => {
                const fresh = entry.kind === "note" && unread.has(entry.at);
                return (
                  <Fragment key={`${entry.kind}-${entry.at}-${i}`}>
                    {i > 0 && <Divider />}
                    <div role="listitem" className={entryStyle} data-unread={fresh ? "" : undefined}>
                      {fresh ? <HistoryDotIcon aria-hidden /> : <span />}
                      <div>
                        {entry.status ? (
                          <RowStatusPill status={entry.status} />
                        ) : (
                          entry.kind === "message" && <Pill {...STATUS_PILL.checkedIn}>Message Sent</Pill>
                        )}
                        {entry.message && (
                          <Typography tag="div" variant="metadata" className={messageStyle}>
                            <NotesIcon aria-hidden />
                            <span>{entry.message}</span>
                          </Typography>
                        )}
                        <div className={noteTextStyle}>
                          {entry.note && <Typography variant="body">{entry.note}</Typography>}
                          <Typography variant="metadata" color="subdued">
                            {`${BYLINE[entry.kind]} ${entry.by} • ${stamp(dayStart, entry.at)}`}
                          </Typography>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </>
        )}
      </div>
      <Presence>
        {inner?.kind === "note" && (
          <AddNote
            onAdd={(note) => {
              onNote(note);
              close();
            }}
            onCancel={close}
          />
        )}
      </Presence>
    </SideSheet>
  );
}
