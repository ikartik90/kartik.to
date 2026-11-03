"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { css, cx } from "../../../../styled-system/css";
import { SNACKS } from "./copy";
import {
  DAY,
  duration,
  minutesNow,
  type OverlayResult,
  type Shift,
  type Worker,
} from "./data";
import { TimePicker } from "./time-picker";
import { Button, Checkbox, DangerZone, Field, Overlay, Stepper, TextArea, Tooltip, Typography } from "./ui";
import CheckOutIcon from "./assets/icons/small/check-out.svg";
import ChevronLeftIcon from "./assets/chevron-left.svg";
import CloseIcon from "./assets/icons/medium/cross.svg";

// SW Curie's Check In / Edit Check-In / Mark Absent overlays (23516:164298, 20583:34247, 23869:22344), with clip 1's
// "worker" for Figma's "Spotter". "Do not track this action" is the operations team's.

export type { OverlayResult };

export const SCENARIO_NOTES = {
  maria:
    "Worker was on site, but could not check-in as their mobile device ran out of charge.",
  aspen: "Worker got sick after arriving on site and was sent home.",
} as const;

const sizeRaw = css.raw({
  transitionProperty: "height",
  transitionDuration: "250ms",
  transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
});

const viewStyle = css({
  "--entrance-from": "0px",
  animation: "playgroundChromeIn 200ms ease",
});

const timeRowStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--sw-gap-xxl)",
  "&[data-out]": { gap: "var(--sw-gap-xs)" },
});

const dashStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "0.5rem",
  height: "2.5rem",
  marginBlockStart: "var(--sw-margin-3xl)",
});

const leftStyle = css({
  display: "flex",
  flex: "1 1 auto",
  alignItems: "center",
  justifyContent: "space-between",
  height: "2.5rem",
  marginBlockStart: "var(--sw-margin-3xl)",
  paddingInlineStart: "var(--sw-padding-xl)",
  boxShadow: "inset 1px 0 0 var(--sw-border-subdued)",
});

const outStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--sw-gap-md)",
});

const removeOutStyle = css({ marginBlockStart: "1.75rem" });

const absentRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-md)",
  paddingBlock: "var(--sw-padding-xl)",
  boxShadow: "inset 0 1px 0 var(--sw-border-subdued)",
  "& > span": { flex: "1 1 auto" },
  "&[data-ops]": {
    boxShadow:
      "inset 0 1px 0 var(--sw-border-subdued), inset 0 -1px 0 var(--sw-border-subdued)",
  },
});

const ruledStyle = css({
  paddingBlockStart: "var(--sw-padding-xl)",
  boxShadow: "inset 0 1px 0 var(--sw-border-subdued)",
});

const backStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "var(--sw-gap-xxs)",
  alignSelf: "flex-start",
  color: "var(--sw-glyph-link-primary-default)",
  cursor: "pointer",
});

const BREAK_STEP = 15;

interface CheckInOverlayProps {
  shift: Pick<Shift, "start" | "end">;
  worker: Pick<Worker, "id" | "name" | "status" | "checkIn" | "checkOut" | "unpaidBreak" | "note">;
  /** The shifts' anchor, which day the clock's time now falls on. */
  anchor: number;
  /** The operations team's version, with the shift's time zone for its hints; without one, the customer's hints. */
  ops?: { zone?: string };
  /** Opens on Mark Absent instead of Check In. */
  absent?: boolean;
  /** The button that opened it, which it opens beside. */
  trigger?: HTMLElement | null;
  onSubmit: (result: OverlayResult) => void;
  onCancel: () => void;
}

/** Whether the overlay changes a check-in already made. */
const isEditing = (worker: Pick<Worker, "checkIn" | "status">) => worker.checkIn !== undefined && worker.status !== "absent";

/** The snackbar once the overlay's submitted for `worker`. */
export const submittedSnack = (worker: Pick<Worker, "checkIn" | "status">, result: OverlayResult) =>
  result.absent
    ? SNACKS.markedAbsent
    : isEditing(worker)
      ? SNACKS.checkInUpdated
      : SNACKS.checkedIn;

export function CheckInOverlay({
  shift,
  worker,
  anchor,
  ops,
  absent,
  trigger,
  onSubmit,
  onCancel,
}: CheckInOverlayProps) {
  const editing = isEditing(worker);
  const [view, setView] = useState<"checkIn" | "absent">(
    absent ? "absent" : "checkIn",
  );
  const [time, setTime] = useState(() => worker.checkIn ?? minutesNow(anchor));
  const [timeInvalid, setTimeInvalid] = useState(false);
  const [out, setOut] = useState<number | undefined>(worker.checkOut);
  const [outInvalid, setOutInvalid] = useState(false);
  const [unpaidBreak, setUnpaidBreak] = useState(worker.unpaidBreak ?? 30);
  const [note, setNote] = useState(worker.note ?? "");
  const [excused, setExcused] = useState(false);
  const [absentNote, setAbsentNote] = useState("");
  const [excuseAbsence, setExcuseAbsence] = useState(false);
  const [block, setBlock] = useState(false);
  const [untracked, setUntracked] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  // The height eases between the two views; the header stays put.
  useLayoutEffect(() => {
    const node = body.current;
    if (!node) return;
    const measure = () => setHeight(node.offsetTop + node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [view]);

  const minutesLate = time - shift.start;
  const lateHint =
    minutesLate > 0 ? (
      <Field.HintText tone="warning">
        {ops?.zone
          ? `${duration(minutesLate)} late (${ops.zone})`
          : `${minutesLate} minutes late`}
      </Field.HintText>
    ) : undefined;

  const title =
    view === "absent" ? "Mark absent" : editing ? "Edit check-in" : "Check in";
  const checkOut =
    out === undefined ? undefined : out <= time ? out + DAY : out;
  const untrackedBox = ops && (
    <Field orientation="horizontal">
      <Checkbox checked={untracked} onChange={setUntracked} />
      <Field.Content>
        <Field.Label>Do not track this action</Field.Label>
        <Field.HintText>This action will not be visible under notes and history on timesheet</Field.HintText>
      </Field.Content>
    </Field>
  );

  return (
    <Overlay
      label={worker.name ? `${title}: ${worker.name}` : title}
      onClose={onCancel}
      trigger={trigger}
      css={sizeRaw}
      style={{ height }}
      data-check-in-overlay=""
      onClick={(event) => event.stopPropagation()}
    >
        <Overlay.Header>
          <Typography variant="heading">{title}</Typography>
          <Overlay.Close />
          {worker.name && <Typography variant="metadata" color="subdued">{worker.name}</Typography>}
        </Overlay.Header>

        <div
          ref={body}
          key={view}
          className={cx(view === "absent" && viewStyle)}
        >
          {view === "checkIn" ? (
            <>
              <Overlay.Body>
                <div
                  className={timeRowStyle}
                  data-out={out !== undefined ? "" : undefined}
                >
                  <div>
                    <Field>
                      <Field.Label>Check-in Time</Field.Label>
                      <TimePicker value={time} around={shift.start} onInvalid={setTimeInvalid} onChange={setTime} />
                      {lateHint}
                    </Field>
                  </div>
                  {out === undefined ? (
                    <div className={leftStyle}>
                      <Typography variant="body">Has the worker left?</Typography>
                      <Button
                        size="small"
                        emphasis="secondary"
                        onClick={() => setOut(minutesNow(anchor))}
                      >
                        <CheckOutIcon aria-hidden />
                        Check-out
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Typography variant="body" className={dashStyle}>
                        –
                      </Typography>
                      <div className={outStyle}>
                        <Field>
                          <Field.Label>Check-out Time</Field.Label>
                          <TimePicker value={out} since={time} onInvalid={setOutInvalid} onChange={setOut} />
                        </Field>
                        <Field>
                          <Field.Label>Unpaid Break</Field.Label>
                          <Stepper value={unpaidBreak} step={BREAK_STEP} onChange={setUnpaidBreak} />
                          <Field.HintText>In minutes</Field.HintText>
                        </Field>
                      </div>
                      <Button size="icon"
                        className={removeOutStyle}
                        aria-label="Remove check-out time"
                        onClick={() => setOut(undefined)}
                      >
                        <CloseIcon aria-hidden />
                        <Tooltip>Remove check-out time</Tooltip>
                      </Button>
                    </>
                  )}
                </div>
                <Field orientation="horizontal">
                  <Checkbox checked={excused} onChange={setExcused} data-tour="excuse-late" />
                  <Field.Label>Excuse late check-in</Field.Label>
                </Field>
                <Field>
                  <Field.Label>Notes</Field.Label>
                  <TextArea
                    value={note}
                    onChange={setNote}
                    autofill={
                      worker.id === "maria" ? SCENARIO_NOTES.maria : undefined
                    }
                  />
                </Field>
                <div className={absentRowStyle} data-ops={ops ? "" : undefined}>
                  <Typography variant="body">Worker never showed up for their shift?</Typography>
                  <Button
                    size="small"
                    emphasis="secondary"
                    tone="destructive"
                    onClick={() => setView("absent")}
                  >
                    Mark absent
                  </Button>
                </div>
                {untrackedBox}
              </Overlay.Body>
              <Overlay.ActionBar>
                <Overlay.Cancel />
                <Overlay.ForwardActions>
                  <Button
                    onClick={() => {
                      // A time that isn't one already shows Alert in its field; nothing's checked in till it's fixed.
                      if (timeInvalid || (out !== undefined && outInvalid)) return;
                      onSubmit({
                        checkIn: time,
                        checkOut,
                        unpaidBreak:
                          checkOut === undefined ? undefined : unpaidBreak,
                        note,
                        excused,
                        absent: false,
                        untracked,
                      });
                    }}
                  >
                    {editing ? "Save changes" : "Check in"}
                  </Button>
                </Overlay.ForwardActions>
              </Overlay.ActionBar>
            </>
          ) : (
            <>
              <Overlay.Body>
                <Typography
                  tag="button"
                  variant="metadata"
                  type="button"
                  className={backStyle}
                  onClick={() => setView("checkIn")}
                >
                  <ChevronLeftIcon aria-hidden />
                  Back to check-in
                </Typography>
                <Field orientation="horizontal">
                  <Checkbox checked={excuseAbsence} onChange={setExcuseAbsence} />
                  <Field.Label>Excuse this absence</Field.Label>
                </Field>
                <Field>
                  <Field.Label>Notes</Field.Label>
                  <TextArea
                    value={absentNote}
                    onChange={setAbsentNote}
                    autofill={
                      worker.id === "aspen" ? SCENARIO_NOTES.aspen : undefined
                    }
                  />
                </Field>
                <DangerZone title="Danger zone">
                  <Field orientation="horizontal">
                    <Checkbox checked={block} onChange={setBlock} />
                    <Field.Content>
                      <Field.Label>Block this worker</Field.Label>
                      <Field.HintText>
                        This worker will be removed and prevented from applying to all future shifts at your company.
                      </Field.HintText>
                    </Field.Content>
                  </Field>
                </DangerZone>
                {ops && <div className={ruledStyle}>{untrackedBox}</div>}
              </Overlay.Body>
              <Overlay.ActionBar>
                <Overlay.Cancel />
                <Overlay.ForwardActions>
                  <Button
                    tone="destructive"
                    onClick={() =>
                      onSubmit({
                        note: absentNote,
                        excused: excuseAbsence,
                        absent: true,
                        untracked,
                        blocked: block,
                      })
                    }
                  >
                    Mark absent
                  </Button>
                </Overlay.ForwardActions>
              </Overlay.ActionBar>
            </>
          )}
        </div>
    </Overlay>
  );
}
