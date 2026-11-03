"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { DAY, clock, type Person } from "./data";
import { Avatar } from "./data-table";
import { TypeAhead } from "./search";
import { DatePicker } from "./shift-calendar";
import { TimePicker } from "./time-picker";
import { TEMPLATES, addMonths, type Iso } from "./shifts";
import { TemplateCard, TemplateField } from "./new-shift";
import { DIRECTORY, dayTitle, findWorkers, hoursLabel, worked, type Hours, type OffAppShift } from "./timesheet";
import { WorkerName } from "./profile-card";
import { Button, Card, Checkbox, Chip, Overlay, Field, LabelValuePair, Pill, Stepper, TextArea, Tooltip, Typography, type FieldTone } from "./ui";
import EditIcon from "./assets/edit.svg";
import TrashIcon from "./assets/trash.svg";
import ConfirmedIcon from "./assets/confirmed.svg";

// SW Curie's Off-App Shift Timecard (21543:53758) and the card each one leaves on the Timesheet (21543:54564).
// Figma's "Position" is "Template" and its "Spotter" "worker" here.

const frameRaw = css.raw({
  display: "flex",
  flexDirection: "column",
  width: "var(--sw-width-overlay-large)",
  overflow: "hidden",
});

const bodyStyle = css({
  display: "flex",
  flexDirection: "column",
  paddingInline: "var(--sw-padding-xl)",
  "& > section": { display: "flex", flexDirection: "column", gap: "var(--sw-gap-xl)", paddingBlock: "var(--sw-padding-xl)" },
  "& > section:first-child": { boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)" },
});

const whenStyle = css({ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sw-gap-3xl)" });

const timesStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xs)",
  "& > div": { display: "flex", alignItems: "flex-start", gap: "var(--sw-gap-xs)" },
  "& > div > span": { display: "flex", alignItems: "center", height: "2.5rem", marginBlockStart: "var(--sw-margin-3xl)" },
});

// Molecules/Cell Blueprint/Thumbnail & Content, as a card.
const pickedStyle = css({ width: "18rem" });

const asideStyle = css({ display: "flex", alignItems: "center", minWidth: "7.5rem" });

const MIN_HOURS = 3 * 60;
const MAX_HOURS = 14 * 60;

/** Who the shift was worked by: looked up by name or phone number. */
function WorkerSearch({
  value,
  tone,
  onChange,
}: {
  value: Person | null;
  tone?: FieldTone;
  onChange: (person: Person | null) => void;
}) {
  return (
    <Field tone={tone}>
      <Field.Label>Find a worker</Field.Label>
      <TypeAhead
        value={value?.id ?? null}
        onChange={(id) => onChange(id ? DIRECTORY[id] : null)}
        matches={(id, typed) => findWorkers(typed).some((person) => person.id === id)}
      >
        {Object.values(DIRECTORY).map((person) => (
          <TypeAhead.Item key={person.id} value={person.id}>
            <Avatar src={person.face} size="medium" />
            <Typography variant="bodyLarge">{person.name}</Typography>
            <Typography variant="metadata" color="subdued">{person.profile.phone}</Typography>
          </TypeAhead.Item>
        ))}
      </TypeAhead>
      <Field.HintText>Look workers up by their name or phone number</Field.HintText>
    </Field>
  );
}

/** Adds an off-app shift, or with `editing` changes one. */
export function OffAppShiftOverlay({
  today,
  height,
  editing,
  onSave,
  onCancel,
}: {
  today: Iso;
  height: number;
  editing?: OffAppShift;
  onSave: (shift: Omit<OffAppShift, "id">) => void;
  onCancel: () => void;
}) {
  const [template, setTemplate] = useState<string | null>(editing?.template ?? null);
  const [worker, setWorker] = useState<Person | null>(editing ? DIRECTORY[editing.worker] : null);
  const [date, setDate] = useState<Iso | null>(editing?.date ?? null);
  const [hours, setHours] = useState<Hours>(editing?.hours ?? { start: 9 * 60, end: 17 * 60, unpaidBreak: 30 });
  const [note, setNote] = useState(editing?.note ?? "");
  const [toProfile, setToProfile] = useState(false);
  const picked = TEMPLATES.find((t) => t.id === template);
  const billed = worked(hours);
  const long = billed >= MIN_HOURS && billed <= MAX_HOURS;
  const ready = picked && worker && date && long;
  // Pressed before it's ready, it marks what's missing until it's given.
  const [tried, setTried] = useState(false);
  const alert = (given: unknown) => (tried && !given ? ("alert" as const) : undefined);

  return (
    <Overlay label="Off-app shift timecard" onClose={onCancel} height={height} css={frameRaw}>
      <Overlay.Header>
        <Typography variant="heading">Off-app shift timecard</Typography>
        <Overlay.Close />
      </Overlay.Header>
      <div className={bodyStyle}>
        <section>
          <TemplateField value={template} templates={TEMPLATES} tone={alert(picked)} onChange={setTemplate} />
          {picked && <TemplateCard template={picked} brief />}
          <WorkerSearch value={worker} tone={alert(worker)} onChange={setWorker} />
          {worker && (
            <Card className={pickedStyle}>
              <Card.Header align="start">
                <Avatar src={worker.face} size="medium" />
                <Card.Content>
                  <Typography tag="h3" variant="subheading">{worker.name}</Typography>
                  <Typography tag="p" variant="metadata" color="subdued">{worker.profile.phone}</Typography>
                </Card.Content>
              </Card.Header>
            </Card>
          )}
        </section>
        <section>
          <div className={whenStyle}>
            <Field tone={alert(date)}>
              <Field.Label>Shift Date</Field.Label>
              <DatePicker value={date} onChange={setDate} today={today} from={addMonths(today, -3)} to={today} />
              <Field.HintText>mm/dd/yyyy</Field.HintText>
            </Field>
            <div className={timesStyle}>
              <div>
                <Field tone={alert(long)}>
                  <Field.Label>Shift Start Time</Field.Label>
                  <TimePicker
                    value={hours.start}
                    around={hours.start}
                    onChange={(start) => setHours({ ...hours, start, end: hours.end <= start ? hours.end + DAY : hours.end })}
                  />
                </Field>
                <Typography variant="body" aria-hidden>–</Typography>
                <Field tone={alert(long)}>
                  <Field.Label>Shift End Time</Field.Label>
                  <TimePicker
                    value={hours.end}
                    since={hours.start}
                    onChange={(end) => setHours({ ...hours, end })}
                  />
                </Field>
              </div>
              <Typography variant="metadata" color="subdued">(UTC-4) Eastern Daylight Time</Typography>
            </div>
            <Field>
              <Field.Label>Unpaid Break</Field.Label>
              <Stepper
                value={hours.unpaidBreak}
                step={15}
                onChange={(unpaidBreak) => setHours({ ...hours, unpaidBreak })}
              />
              <Field.HintText>In minutes</Field.HintText>
            </Field>
          </div>
          <Field>
            <Field.Label>Note</Field.Label>
            <TextArea value={note} onChange={setNote} />
          </Field>
          <Field orientation="horizontal">
            <Checkbox checked={toProfile} onChange={setToProfile} />
            <Field.Label>Add note to worker&apos;s profile</Field.Label>
          </Field>
        </section>
      </div>
      <Overlay.ActionBar>
        <Overlay.Cancel />
        <Overlay.ForwardActions>
          <span className={asideStyle}>
            <LabelValuePair>
              <Typography variant="metadata" color="subdued">Total Billable Duration</Typography>
              <Typography variant="body">{`${(billed / 60).toFixed(2)} hours`}</Typography>
            </LabelValuePair>
          </span>
          <Button
            onClick={() =>
              ready ? onSave({ template: picked.id, worker: worker.id, date, hours, note: note.trim() }) : setTried(true)
            }
          >
            {editing ? "Save changes" : "Add shift"}
          </Button>
        </Overlay.ForwardActions>
      </Overlay.ActionBar>
    </Overlay>
  );
}

const cardStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--sw-gap-xs)",
  width: "27.75rem",
  padding: "var(--sw-padding-md)",
  borderRadius: "var(--sw-radius-md)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
  "& > div": { display: "flex", flex: "1 1 auto", flexDirection: "column", gap: "var(--sw-gap-xs)", minWidth: 0 },
  "& > div > div:first-child": {
    display: "flex",
    flexDirection: "column",
    gap: "var(--sw-gap-xs)",
    paddingBlockEnd: "var(--sw-padding-sm)",
    boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
  },
  "& > div > div:first-child > div": { display: "flex", alignItems: "center", gap: "var(--sw-gap-md)", height: "1.75rem" },
  "& > div > div:first-child > div > :first-child": { flex: "1 1 auto", minWidth: 0 },
  "& > div > div:last-child": { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sw-gap-md)" },
});

const actionsStyle = css({ display: "flex", gap: "var(--sw-gap-xs)" });

/** An off-app shift on the Timesheet: who, what and when, its hours, confirmed as it was added. */
export function OffAppCard({ shift, onEdit, onDelete }: { shift: OffAppShift; onEdit: () => void; onDelete: () => void }) {
  const person = DIRECTORY[shift.worker];
  const template = TEMPLATES.find((t) => t.id === shift.template)!;
  return (
    <div className={cardStyle} role="group" aria-label={`${person.name}, ${dayTitle(shift.date)}`}>
      <Avatar src={person.face} size="medium" />
      <div>
        <div>
          <div>
            <span>
              <WorkerName worker={person} />
            </span>
            <span className={actionsStyle}>
              <Button size="icon" aria-label="Edit timecard" onClick={onEdit}>
                <EditIcon aria-hidden />
                <Tooltip>Edit timecard</Tooltip>
              </Button>
              <Button size="icon" tone="destructive" aria-label="Delete timecard" onClick={onDelete}>
                <TrashIcon aria-hidden />
                <Tooltip>Delete timecard</Tooltip>
              </Button>
            </span>
          </div>
          <Typography variant="metadata" color="subdued">{template.name}</Typography>
          <Typography variant="metadata" color="subdued">
            {`${dayTitle(shift.date)} ${clock(shift.hours.start)}–${clock(shift.hours.end)}`}
          </Typography>
        </div>
        <div>
          <Chip state="success">
            <ConfirmedIcon aria-hidden />
            {hoursLabel(worked(shift.hours))}
          </Chip>
          <Pill state="success">
            <ConfirmedIcon aria-hidden />
            Confirmed
          </Pill>
        </div>
      </div>
    </div>
  );
}
