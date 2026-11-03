"use client";

import { useState, type ComponentProps } from "react";
import { css } from "../../../../styled-system/css";
import { MESSAGE_TYPES, metresAway, reportedAt, siteOf, siteTemplate, type Ping, type Row } from "./dashboard";
import { COMPANY_PLACE } from "./geo";
import { centroid, offset, type Geofence, type LatLng, type Place } from "./geofence";
import { GeofenceMap } from "./geofence-map";
import { LocationTimeline } from "./location-history";
import { useTemplates } from "./templates";
import { BottomSheet, Button, Chip, Field, Overlay, Pill, Switch, TextArea, Typography, alertIf, boxStateRaw } from "./ui";
import { Dropdown } from "./dropdown";

// SW Curie's Messages modal (23658:29237), Add a Note (23658:24534) in a bottom sheet, the View Location overlay
// (23522:164593), and View Location's map (Molecules/Overlay/View Location, 6989:28063).

const fieldLabelStyle = css({ display: "flex", flexDirection: "column" });

const toFieldStyle = css(boxStateRaw, {
  display: "flex",
  alignItems: "center",
  height: "2.5rem",
  paddingInline: "var(--sw-padding-md)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-default)",
  cursor: "text",
});

const typesStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--sw-gap-md)",
  paddingBlock: "var(--sw-padding-xxs)",
});

const noteGroupStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-md)",
});

// The sending numbers: Figma's Florida line, and one for Canadian workers.
export const PHONES = [
  "Florida, USA (305) 703-0177",
  "Ontario, Canada (647) 555-0100",
];

export function SendMessage({
  row,
  height,
  onSend,
  onCancel,
}: {
  row: Row;
  /** The app's, which the modal covers. */
  height: number;
  onSend: (message: string, note: string) => void;
  onCancel: () => void;
}) {
  const [to, setTo] = useState(true);
  const [phone, setPhone] = useState(PHONES[row.country === "us" ? 0 : 1]);
  const [message, setMessage] = useState("");
  const [noting, setNoting] = useState(true);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);

  return (
    <Overlay label={`Send message: ${row.worker.name}`} onClose={onCancel} height={height}>
        <Overlay.Header>
          <Typography variant="heading">Send message</Typography>
          <Overlay.Close />
        </Overlay.Header>
        <Overlay.Body>
          <div className={fieldLabelStyle}>
            <Typography variant="body" color="subdued">
              To
            </Typography>
            <div className={toFieldStyle} data-state={alertIf(tried, !to)} onClick={() => setTo(true)}>
              {to && (
                <Chip state="affirmative">
                  {row.worker.name}
                  <Chip.Remove
                    aria-label={`Remove ${row.worker.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setTo(false);
                    }}
                  />
                </Chip>
              )}
            </div>
          </div>
          <Field>
            <Field.Label>Sending Phone Number</Field.Label>
            <Dropdown value={phone} onChange={setPhone}>
              {PHONES.map((number) => (
                <Dropdown.Item key={number}>
                  <Typography variant="bodyLarge">{number}</Typography>
                </Dropdown.Item>
              ))}
            </Dropdown>
          </Field>
          <div className={fieldLabelStyle}>
            <Typography variant="body" color="subdued">
              Message Type
            </Typography>
            <div className={typesStyle}>
              {MESSAGE_TYPES.map((type) => (
                <Pill actionable key={type.label} onClick={() => setMessage(type.text(row))}>
                  {type.label}
                </Pill>
              ))}
            </div>
          </div>
          <Field tone={alertIf(tried, !message.trim())}>
            <Field.Label>Message</Field.Label>
            <TextArea value={message} onChange={setMessage} />
          </Field>
          <div className={noteGroupStyle}>
            <Field orientation="horizontal">
              <Field.Label>Add an internal note</Field.Label>
              <Switch checked={noting} onChange={setNoting} />
            </Field>
            {noting && (
              <Field>
                <Field.Label>Note</Field.Label>
                <TextArea value={note} onChange={setNote} />
              </Field>
            )}
          </div>
        </Overlay.Body>
        <Overlay.ActionBar>
          <Overlay.Cancel />
          <Overlay.ForwardActions>
            <Button onClick={() => (to && message.trim() ? onSend(message.trim(), noting ? note.trim() : "") : setTried(true))}>
              Send message
            </Button>
          </Overlay.ForwardActions>
        </Overlay.ActionBar>
    </Overlay>
  );
}

/** Add a Note, in a bottom sheet over the side sheet it's opened from. */
export function AddNote({ onAdd, onCancel }: { onAdd: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  return (
    <BottomSheet label="Add a note" onClose={onCancel} holds>
      <BottomSheet.Header>
        <Typography variant="heading">Add a note</Typography>
        <BottomSheet.Close />
      </BottomSheet.Header>
      <BottomSheet.Body>
        <Field tone={alertIf(tried, !note.trim())}>
          <Field.Label>Note</Field.Label>
          <TextArea value={note} onChange={setNote} autoFocus />
        </Field>
      </BottomSheet.Body>
      <BottomSheet.ActionBar>
        <BottomSheet.Cancel />
        <BottomSheet.ForwardActions>
          <Button onClick={() => (note.trim() ? onAdd(note.trim()) : setTried(true))}>
            Add note
          </Button>
        </BottomSheet.ForwardActions>
      </BottomSheet.ActionBar>
    </BottomSheet>
  );
}

/** Which way an off-site worker is from the site. */
const AWAY_BEARING = 250;

/** Where a report puts the worker, given the site's fence. */
const placed = (ping: Ping) => (drawn: Geofence) => reportedAt(ping, centroid(drawn));

/**
 * The job site's geofence (its building's outline until a template gives one) with the worker's dot: in the middle of
 * the building when on site, otherwise where their phone `reported` them or `away` metres off, the map framing both; no
 * dot where `away` is `null`, and where it was last known when `untracked`. Given a `trace`, a timeline under it shows
 * each report in turn, opening on the last, the earlier ones faint and no arc, the map following the worker; untracked,
 * only the last is. `flush` sets the timeline level with the map's sides.
 */
export function LocationMap({
  site = COMPANY_PLACE,
  fence = null,
  entrance = null,
  away = 0,
  reported,
  untracked,
  trace,
  size = "location",
  flush,
}: {
  site?: Place;
  fence?: Geofence | null;
  entrance?: LatLng | null;
  away?: number | null;
  reported?: LatLng;
  untracked?: boolean;
  trace?: Ping[];
  size?: ComponentProps<typeof GeofenceMap>["size"];
  flush?: boolean;
}) {
  const [position, setPosition] = useState(() => (trace ? trace.length - 1 : 0));
  const shown = trace ? Math.floor(position) : -1;
  const map = (
    <GeofenceMap
      place={site}
      value={fence}
      entrance={entrance}
      size={size}
      editable={false}
      worker={
        trace ? placed(trace[shown]) : away === null ? undefined : (drawn) => reported ?? offset(centroid(drawn), away, AWAY_BEARING)
      }
      trail={trace && ((drawn) => trace.slice(0, shown).map((ping) => placed(ping)(drawn)))}
      untracked={untracked && (!trace || shown === trace.length - 1)}
    />
  );
  if (!trace) return map;
  return (
    <div>
      {map}
      <LocationTimeline trace={trace} position={position} onPosition={setPosition} flush={flush} />
    </div>
  );
}

/**
 * A row's worker on a `LocationMap` at their team's job site, inside the geofence of their position's template, where
 * their phone last reported them; with `history`, its timeline of their reports, `flush` level with the map's sides.
 */
export function WorkerLocation({
  row,
  size,
  history,
  flush,
}: {
  row: Row;
  size?: ComponentProps<typeof LocationMap>["size"];
  history?: boolean;
  flush?: boolean;
}) {
  const template = siteTemplate(row, useTemplates());
  return (
    <LocationMap
      site={siteOf(row.team)}
      fence={template?.geofence}
      entrance={template?.entrance}
      away={metresAway(row.location)}
      reported={row.trace?.at(-1)?.place}
      untracked={row.signals.includes("locationDisabled")}
      trace={history ? row.trace : undefined}
      size={size}
      flush={flush}
    />
  );
}

/** A row's worker's location on a `LocationMap` at their team's job site, hung beside the link that opened it. */
export function ViewLocation({
  row,
  updated,
  trigger,
  onClose,
}: {
  row: Row;
  /** "Oct 17, 2026 7:43 AM". */
  updated?: string;
  /** The link that opened it, which it opens beside. */
  trigger?: HTMLElement | null;
  onClose: () => void;
}) {
  const name = row.worker.name;
  return (
    <Overlay label={`View location: ${name}`} onClose={onClose} trigger={trigger} data-dashboard-overlay="">
      <Overlay.Header>
        <Typography variant="heading">View location</Typography>
        <Overlay.Close />
        {updated && <Typography variant="metadata" color="subdued">{`Last updated on ${updated}`}</Typography>}
      </Overlay.Header>
      <WorkerLocation row={row} history />
    </Overlay>
  );
}
