"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { scheduleCounts, type Iso, type Series } from "./shifts";
import { CalendarStrip } from "./shift-calendar";
import { DRAG_HINT, SPOTFILL } from "./new-shift";
import { Button, Field, Overlay, Switch, Typography, toneStyle } from "./ui";

// SW Curie's Edit Schedule (22113:104219, 22092:98905): the shift's dates on the final version's drag-to-select
// calendar, coloured by what the edit does to each, with a tally of the shifts ahead.

const frameRaw = css.raw({
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
  width: "var(--sw-width-overlay-large)",
});

const bodyStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-xs)", paddingInline: "var(--sw-padding-xl)" });

const switchRowStyle = css({ paddingInline: "var(--sw-padding-xl)" });

const legendStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  height: "2.5rem",
  paddingInline: "var(--sw-padding-md)",
  boxShadow: "inset 0 1px 0 var(--sw-border-subdued)",
  "& [data-tone]": { display: "flex", alignItems: "center", gap: "0.25rem" },
  "& [data-tone] > span": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "1.25rem",
    height: "1.25rem",
    borderRadius: "var(--sw-radius-xs)",
    backgroundColor: "var(--tone-surface)",
    color: "var(--tone-glyph)",
  },
  "& > div": {
    display: "flex",
    gap: "0.75rem",
    paddingInlineStart: "0.75rem",
    boxShadow: "inset 1px 0 0 var(--sw-border-subdued)",
  },
});

function Count({ tone, count, label }: { tone: "success" | "warning" | "active" | "alert"; count: number; label: string }) {
  return (
    <span className={toneStyle} data-tone={tone}>
      <span>{count}</span>
      {label}
    </span>
  );
}

export function EditSchedule({
  series,
  position,
  today,
  height,
  onSave,
  onCancel,
}: {
  series: Series;
  /** The template's name, which the subtitle leads with. */
  position: string;
  today: Iso;
  /** The app's, which the overlay's scrim covers. */
  height: number;
  onSave: (dates: Iso[], spotFill: boolean) => void;
  onCancel: () => void;
}) {
  const [dates, setDates] = useState(series.dates);
  const [spotFill, setSpotFill] = useState(series.spotFill ?? true);
  const counts = scheduleCounts(series.dates, dates, today);

  return (
    <Overlay label="Edit schedule" onClose={onCancel} height={height} scrim="light" holds css={frameRaw}>
      <Overlay.Header>
        <Typography variant="heading">Edit schedule</Typography>
        <Overlay.Close />
        <Typography variant="metadata" color="subdued">{`${position} • ${series.title}`}</Typography>
      </Overlay.Header>
      <div className={bodyStyle}>
        <CalendarStrip
          value={dates}
          onChange={setDates}
          today={today}
          first={today}
          base={series.dates}
          footer={
            <Typography tag="div" variant="metadata" className={legendStyle} role="group" aria-label="Changes">
              <Count tone="success" count={counts.regular} label="Regular Shifts" />
              <Count tone="warning" count={counts.edited} label="Edited Shifts" />
              <div>
                <Count tone="active" count={counts.added} label="Add Shifts" />
                <Count tone="alert" count={counts.cancelled} label="Cancel Shifts" />
              </div>
            </Typography>
          }
        />
        <Typography variant="metadata" color="subdued">{DRAG_HINT}</Typography>
      </div>
      <div className={switchRowStyle}>
        <Field orientation="horizontal">
          <Switch checked={spotFill} onChange={setSpotFill} />
          <Field.Content>
            <Field.Label>{SPOTFILL.label}</Field.Label>
            <Field.HintText>{SPOTFILL.hint}</Field.HintText>
          </Field.Content>
        </Field>
      </div>
      <Overlay.ActionBar>
        <Overlay.Cancel />
        <Overlay.ForwardActions>
          <Button onClick={() => onSave(dates, spotFill)}>Save changes</Button>
        </Overlay.ForwardActions>
      </Overlay.ActionBar>
    </Overlay>
  );
}
