"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css, cx } from "../../../styled-system/css";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input/field";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { TextArea } from "@/components/ui/input/text-area";
import { TimePicker } from "@/components/ui/input/time-picker";
import { Tooltip } from "@/components/ui/tooltip";
import { Skeleton, Wireframe } from "@/components/ui/wireframe";
import AddIcon from "@/assets/icons/add.svg";
import CheckCircleIcon from "@/assets/icons/check-circle.svg";
import ClockIcon from "@/assets/icons/clock.svg";
import CrossCircleIcon from "@/assets/icons/cross-circle.svg";
import CrossSmallIcon from "@/assets/icons/cross-small.svg";
import EditIcon from "@/assets/icons/edit.svg";
import ExclamationIcon from "@/assets/icons/exclamation-mark.svg";
import LockIcon from "@/assets/icons/lock.svg";
import ResetIcon from "@/assets/icons/reset.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import { cardStyle, columnStyle, paneStyle, toggleStyle } from "./onboarding-wireframes";
import { Stage } from "./wireframe-stage";

// The check-ins sheet's wireframes, after the Figma screens, in the onboarding wireframes' language: what the card is
// about live and in the field's active colour, the rest as bars.

export const ring = "inset 0 0 0 token(spacing.xxs) color-mix(in srgb, token(colors.border.divider) 50%, transparent)";
export const headingStyle = css({ textStyle: "quote", color: "text.title" });
export const titleStyle = css({ textStyle: "bodySmall", color: "text.title" });
const subheadStyle = css({ textStyle: "bodyLarge", color: "text.title" });
export const subStyle = css({ textStyle: "caption", color: "text.body" });
export const whoStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  flex: "1",
  minWidth: 0,
  "& > span": { maxWidth: "token(spacing.full)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
});
export const headStyle = css({
  flexShrink: 0,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "md",
  paddingInline: "xl",
  paddingBlock: "lg",
});
export const countStyle = css({
  paddingBlock: "xs",
  paddingInline: "md",
  borderRadius: "full",
  boxShadow: ring,
  textStyle: "caption",
  color: "text.body",
  whiteSpace: "nowrap",
});
// Never squeezed by the card's height: what doesn't fit runs off the stage's foot.
export const rowStyle = css({
  flexShrink: 0,
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: "md",
  minHeight: "calc(token(spacing.4xl) + 2 * token(spacing.md))",
  paddingInline: "xl",
  paddingBlock: "md",
  borderBlockStartWidth: "token(spacing.xxs)",
  borderBlockStartStyle: "solid",
  borderBlockStartColor: "border.divider",
});
const endStyle = css({ display: "flex", alignItems: "center", gap: "sm", flexShrink: 0 });
// Level with the heading's first line, not the middle of the heading and its subtitle.
export const headEndStyle = cx(endStyle, css({ textStyle: "quote", height: "1lh" }));
const timeStyle = css({ textStyle: "caption", color: "text.body", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" });

// The icons' strokes are white in their files.
const pillStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "xxs",
  flexShrink: 0,
  paddingBlock: "xs",
  paddingInlineStart: "xs",
  paddingInlineEnd: "md",
  borderRadius: "full",
  backgroundColor: "bg.highlight",
  textStyle: "caption",
  lineHeight: "token(spacing.xl)",
  color: "text.highlight",
  whiteSpace: "nowrap",
  "& > svg": { flexShrink: 0, width: "token(spacing.xxl)", height: "token(spacing.xxl)" },
  "& svg path[stroke]": { stroke: "currentColor" },
  "& svg path[fill]:not([fill=none])": { fill: "currentColor" },
  "&[data-tone=waiting]": { backgroundColor: "bg.notice", color: "text.body" },
  "&[data-tone=solid]": {
    backgroundColor: "text.highlight",
    color: "bg.canvas",
    paddingBlock: "calc(token(spacing.xs) - token(spacing.3xs))",
    paddingInlineStart: "calc(token(spacing.xs) - token(spacing.3xs))",
    paddingInlineEnd: "calc(token(spacing.md) - token(spacing.3xs))",
  },
});

export type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export function Pill({ icon: Icon, tone, children }: { icon: Icon; tone?: "waiting" | "solid"; children: string }) {
  return (
    <span className={pillStyle} data-tone={tone}>
      <Icon aria-hidden />
      {children}
    </span>
  );
}

function Revert({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="icon" aria-label={label} onClick={onClick}>
      <ResetIcon />
      <Button.Tooltip>
        <Tooltip.Text>Revert changes</Tooltip.Text>
      </Button.Tooltip>
    </Button>
  );
}

// ——— Check-ins page (floor managers) ———

// Under its row's button, their ends level, over the rows below. Below `xl` the stage is too short for it there, so it
// opens over the row, its actions clear of the fade.
const overlayStyle = css({
  position: "absolute",
  zIndex: 1,
  top: "calc(100% - token(spacing.sm))",
  xlDown: { top: 0 },
  insetInlineEnd: "xl",
  width: "min(calc(100% - 2 * token(spacing.xl)), token(sizes.testimonialCardWide))",
  borderRadius: "md",
  backgroundColor: "bg.surface",
  color: "text.body",
  "--colors-field-bg-default": "var(--colors-field-bg-default-on-surface)",
  boxShadow: `${ring}, 0 4px 16px color-mix(in srgb, token(colors.neutral.900) 12%, transparent)`,
});
const formStyle = css({ display: "flex", flexDirection: "column", gap: "lg", padding: "xl" });
// Ruled off edge to edge, as the card's rows are.
const actionsStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "sm",
  marginInline: "-xl",
  paddingInline: "xl",
  paddingBlockStart: "lg",
  borderBlockStartWidth: "token(spacing.xxs)",
  borderBlockStartStyle: "solid",
  borderBlockStartColor: "border.divider",
});
const overlayHeadStyle = css({ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "md" });
const overlayHeadEndStyle = cx(endStyle, css({ textStyle: "bodyLarge", height: "1lh" }));
const timesStyle = css({ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "sm" });
const timeRangeStyle = css({ display: "flex", alignItems: "flex-end", gap: "sm", minWidth: 0 });
const actionGroupStyle = css({ display: "flex", gap: "sm" });
// As tall as a small field's frame (`field.ts`), so what's in it centres on the frame beside it.
const onFrameStyle = css({ display: "flex", alignItems: "center", height: "calc(token(spacing.xxl) + token(spacing.md))" });
const hyphenStyle = cx(
  onFrameStyle,
  css({ flexShrink: 0, color: "field.text.muted", textStyle: "bodySmall", userSelect: "none" }),
);
// Holds the longest time ("12:00 AM") whether or not a check-out sits beside it.
const timeFieldStyle = css({
  flexShrink: 0,
  width: "token(sizes.dateField)",
  mdDown: { width: "calc(token(spacing.5xl) + token(spacing.xxl))" },
});
const SHIFT_START = Temporal.PlainTime.from("15:00");
const SHIFT_END = Temporal.PlainTime.from("00:00");
const checkInButtonStyle = css({ marginInlineStart: "lg" });

const SHIFT_ROWS: { name: string; status: string; icon: Icon; time: string }[] = [
  { name: "Aspen Curtis", status: "Late check-in", icon: ClockIcon, time: "3:55 PM–In progress" },
  { name: "Angel Saris", status: "Checked in", icon: CheckCircleIcon, time: "2:58 PM–In progress" },
  { name: "Rayna Rhiel Madsen", status: "Checked out", icon: CheckCircleIcon, time: "3:00 PM–12:15 AM" },
  { name: "Alejandro Vasquez", status: "Checked out", icon: CheckCircleIcon, time: "3:00 PM–11:20 PM" },
];

/**
 * A shift on the Check-ins page, its Check In overlay open for a worker whose phone died: the floor manager checks her
 * in, adds a check-out, or marks her absent instead. A checked-in row's pencil reopens it to edit.
 */
export function CheckInsPageWireframe() {
  const [status, setStatus] = useState<"missing" | "checked-in" | "absent">("missing");
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<"check-in" | "absent">("check-in");
  const [checkOut, setCheckOut] = useState(false);
  const checkedIn = status === "checked-in";
  const cancel = () => {
    setOpen(false);
    setView("check-in");
  };
  const submit = (to: "checked-in" | "absent") => {
    setStatus(to);
    cancel();
  };
  return (
    <Stage>
      <div className={columnStyle} data-wide="">
        <div className={cardStyle}>
          <div className={headStyle}>
            <span className={whoStyle}>
              <span className={headingStyle}>Picker Packer</span>
              <span className={subStyle}>Weekdays Afternoon Shift · 3:00 PM–12:00 AM (+1 day)</span>
            </span>
            <span className={headEndStyle}>
              <span className={countStyle}>{checkedIn && !checkOut ? 3 : 2}/5 on site</span>
            </span>
          </div>
          <div className={rowStyle}>
            <span className={whoStyle}>
              <span className={titleStyle}>Maria Franci</span>
            </span>
            <span className={endStyle}>
              {checkedIn ? (
                <>
                  <span className={timeStyle}>{checkOut ? "3:00 PM–12:00 AM" : "3:00 PM–In progress"}</span>
                  <Pill icon={CheckCircleIcon}>{checkOut ? "Checked out" : "Checked in"}</Pill>
                  <Button variant="icon" aria-label="Edit Maria Franci's check-in" onClick={() => setOpen(true)}>
                    <EditIcon />
                    <Button.Tooltip>
                      <Tooltip.Text>Edit check-in</Tooltip.Text>
                    </Button.Tooltip>
                  </Button>
                </>
              ) : (
                <>
                  {status === "absent" ? (
                    <Pill icon={CrossCircleIcon} tone="waiting">
                      Absent
                    </Pill>
                  ) : (
                    <Pill icon={ExclamationIcon} tone="waiting">
                      Missing
                    </Pill>
                  )}
                  <Button size="sm" className={checkInButtonStyle} onClick={() => setOpen(true)}>
                    Check in…
                  </Button>
                </>
              )}
            </span>
            {open && (
              <div className={overlayStyle} role="dialog" aria-label={`${view === "absent" ? "Mark absent" : "Check in"} Maria Franci`}>
                {view === "check-in" ? (
                  <div className={formStyle}>
                    <span className={overlayHeadStyle}>
                      <span className={subheadStyle}>Maria Franci</span>
                      <span className={overlayHeadEndStyle}>
                        <Button size="sm" onClick={() => setView("absent")}>
                          Mark absent…
                        </Button>
                      </span>
                    </span>
                    <span className={timesStyle}>
                      <span className={timeRangeStyle}>
                        <Field size="sm" className={timeFieldStyle}>
                          <Field.Label>Check-in time</Field.Label>
                          <TimePicker defaultValue={SHIFT_START} />
                        </Field>
                        {checkOut && (
                          <>
                            <span aria-hidden className={hyphenStyle}>
                              -
                            </span>
                            <Field size="sm" className={timeFieldStyle}>
                              <Field.Label>Check-out time</Field.Label>
                              <TimePicker defaultValue={SHIFT_END} differenceFrom={SHIFT_START} />
                            </Field>
                            <span className={onFrameStyle}>
                              <Button variant="icon" aria-label="Remove check-out" onClick={() => setCheckOut(false)}>
                                <CrossSmallIcon />
                              </Button>
                            </span>
                          </>
                        )}
                      </span>
                      {!checkOut && (
                        <span className={onFrameStyle}>
                          <Button size="sm" onClick={() => setCheckOut(true)}>
                            Add check out…
                          </Button>
                        </span>
                      )}
                    </span>
                    <TextArea
                      label="Note"
                      size="sm"
                      rows={2}
                      defaultValue="Worker was on site, but could not check-in as their mobile device ran out of charge."
                    />
                    <span className={actionsStyle}>
                      <Button size="sm" emphasis="tertiary" onClick={cancel}>
                        Cancel
                      </Button>
                      <Button size="sm" emphasis="accent" onClick={() => submit("checked-in")}>
                        Check in
                      </Button>
                    </span>
                  </div>
                ) : (
                  <div className={formStyle}>
                    <span className={subheadStyle}>Maria Franci</span>
                    <TextArea
                      label="Note"
                      size="sm"
                      rows={2}
                      defaultValue="Worker got sick after arriving on site and was sent home."
                    />
                    <span className={actionsStyle}>
                      <span className={actionGroupStyle}>
                        <Button size="sm" emphasis="tertiary" onClick={cancel}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => setView("check-in")}>
                          Back to check-in
                        </Button>
                      </span>
                      <Button size="sm" emphasis="accent" onClick={() => submit("absent")}>
                        Mark absent
                      </Button>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          {SHIFT_ROWS.map(({ name, status, icon, time }) => (
            <Wireframe key={name} className={rowStyle} opacity={25}>
              <span className={whoStyle}>
                <Skeleton className={titleStyle}>{name}</Skeleton>
              </span>
              <span className={endStyle}>
                <Skeleton className={timeStyle}>{time}</Skeleton>
                <Pill icon={icon} tone="waiting">
                  {status}
                </Pill>
                <Button variant="icon" aria-label={`Edit ${name}'s check-in`} tabIndex={-1}>
                  <EditIcon />
                </Button>
              </span>
            </Wireframe>
          ))}
        </div>
      </div>
    </Stage>
  );
}

// ——— Timecard ———

const sourcesStyle = css({ display: "flex", flexDirection: "column", gap: "md", paddingInline: "xl", paddingBlockEnd: "xl" });
const sourceStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "sm",
  paddingBlock: "md",
  paddingInline: "lg",
  borderRadius: "md",
  borderWidth: "token(spacing.xxs)",
  borderStyle: "solid",
  borderColor: "field.border.default",
  textAlign: "start",
  cursor: "pointer",
  transition: "border-color 150ms ease",
  _hover: { backgroundColor: "field.bg.hover" },
  "&[aria-checked=true]": { borderColor: "text.highlight" },
});
const sourceTopStyle = css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "md" });
const sourceNameStyle = css({ textStyle: "bodySmall", color: "field.text.default", "[aria-checked=true] &": { color: "field.text.active" } });
// Every card's facts are as wide as the next's (same labels, tabular figures), so they line up across the cards.
const factsStyle = css({
  display: "flex",
  justifyContent: "space-between",
  gap: "xl",
  "& > span": { display: "flex", flexDirection: "column" },
});
const factLabelStyle = css({ textStyle: "sidenote", color: "field.text.muted", whiteSpace: "nowrap" });
const factValueStyle = css({ textStyle: "caption", color: "text.title", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" });
const noteStyle = css({
  display: "flex",
  flexDirection: "column",
  paddingBlockStart: "sm",
  borderBlockStartWidth: "token(spacing.xxs)",
  borderBlockStartStyle: "solid",
  borderBlockStartColor: "border.divider",
});
const noteTextStyle = css({ textStyle: "caption", color: "text.title" });

const SOURCES = [
  {
    id: "checked",
    name: "Checked in/out",
    times: ["3:00 PM", "12:15 AM"],
    hours: "8.75",
    note: {
      text: "Worker was on site, but could not check-in as their mobile device ran out of charge.",
      by: "Adjusted by Jesse Pistorius · Apr 4, 2025, 12:03 AM",
    },
  },
  { id: "submitted", name: "Worker submitted", times: ["3:00 PM", "12:30 AM"], hours: "9.00" },
  { id: "posted", name: "Posted hours", times: ["3:00 PM", "12:00 AM"], hours: "8.50" },
];

/** One shift's timecard: every source of its hours kept apart, one selected for billing, then confirmed. */
export function TimecardWireframe() {
  const [selected, setSelected] = useState("checked");
  const [confirmed, setConfirmed] = useState(false);
  const hours = SOURCES.find((s) => s.id === selected)!.hours;
  return (
    <Stage>
      <div className={columnStyle} data-wide="">
        <div className={cardStyle}>
          <div className={headStyle}>
            <span className={whoStyle}>
              <span className={headingStyle}>Wednesday, April 3, 2025</span>
              <span className={subStyle}>Rayna Rhiel Madsen · Picker Packer</span>
            </span>
            <span className={headEndStyle}>
              {confirmed ? (
                <>
                  <Pill icon={CheckCircleIcon} tone="solid">{`Confirmed ${hours} h`}</Pill>
                  <Revert label="Revert confirmation" onClick={() => setConfirmed(false)} />
                </>
              ) : (
                <Button size="sm" emphasis="accent" onClick={() => setConfirmed(true)}>
                  {`Confirm ${hours} h`}
                </Button>
              )}
            </span>
          </div>
          <div className={sourcesStyle} role="radiogroup" aria-label="Billable duration">
            {SOURCES.map(({ id, name, times, hours: h, note }) => {
              const on = id === selected;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={sourceStyle}
                  disabled={confirmed}
                  onClick={() => setSelected(id)}
                >
                  <span className={sourceTopStyle}>
                    <span className={sourceNameStyle}>{name}</span>
                    {on && <Pill icon={CheckCircleIcon}>Selected</Pill>}
                  </span>
                  <Wireframe className={factsStyle} opacity={on ? 100 : 50}>
                    <span>
                      <span className={factLabelStyle}>Start</span>
                      <span className={factValueStyle}>{times[0]}</span>
                    </span>
                    <span>
                      <span className={factLabelStyle}>End</span>
                      <span className={factValueStyle}>{times[1]}</span>
                    </span>
                    <span>
                      <span className={factLabelStyle}>Unpaid break</span>
                      <span className={factValueStyle}>30 minutes</span>
                    </span>
                    <span>
                      <span className={factLabelStyle}>Billable</span>
                      <span className={factValueStyle}>{h} h</span>
                    </span>
                  </Wireframe>
                  {note && (
                    <span className={noteStyle}>
                      <span className={noteTextStyle}>{note.text}</span>
                      <span className={subStyle}>{note.by}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Stage>
  );
}

// ——— Off-app shifts ———

const sectionLabelStyle = css({ textStyle: "sidenote", color: "field.text.muted", paddingInline: "xl", paddingBlockEnd: "sm" });
const offAppStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "md",
  marginInline: "xl",
  marginBlockEnd: "xl",
  paddingBlock: "md",
  paddingInline: "lg",
  borderRadius: "md",
  borderWidth: "token(spacing.xxs)",
  borderStyle: "solid",
  borderColor: "field.border.default",
});
const offAppFactsStyle = css({ display: "flex", alignItems: "center", gap: "sm", marginBlockStart: "sm" });
const lockedStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "xxs",
  textStyle: "caption",
  color: "field.text.active",
  whiteSpace: "nowrap",
  "& > svg": { width: "token(spacing.xl)", height: "token(spacing.xl)" },
  "& svg path[stroke]": { stroke: "currentColor" },
});

const VIEWS = [
  { value: "finance", label: "Finance" },
  { value: "company", label: "Company" },
];
const REGULAR = ["Rayna Rhiel Madsen", "Angel Saris", "Aspen Curtis"];

function TimesheetPane({ finance }: { finance: boolean }) {
  return (
    <>
      <div className={headStyle}>
        <span className={whoStyle}>
          <span className={headingStyle}>Timesheet</span>
          <span className={subStyle}>CCLS · 250 First Gulf Boulevard, Brampton</span>
        </span>
        {finance && (
          <span className={headEndStyle}>
            <Button size="sm" emphasis="accent">
              <AddIcon aria-hidden />
              Add off-app shift
            </Button>
          </span>
        )}
      </div>
      <span className={sectionLabelStyle}>Off-app shifts</span>
      <div className={offAppStyle}>
        <span className={whoStyle}>
          <span className={titleStyle}>Tashonda Parker</span>
          <span className={subStyle}>Forklift Operator</span>
          <span className={subStyle}>Sunday, March 24, 2025 · 3:00 PM–12:15 AM</span>
          <span className={offAppFactsStyle}>
            <Pill icon={CheckCircleIcon}>8.75 h</Pill>
            <Pill icon={CheckCircleIcon} tone="waiting">
              Confirmed
            </Pill>
          </span>
        </span>
        {finance ? (
          <span className={endStyle}>
            <Button variant="icon" aria-label="Edit Tashonda Parker's off-app shift">
              <EditIcon />
            </Button>
            <Button variant="icon" aria-label="Delete Tashonda Parker's off-app shift">
              <TrashIcon />
            </Button>
          </span>
        ) : (
          <span className={lockedStyle}>
            <LockIcon aria-hidden />
            View only
          </span>
        )}
      </div>
      <span className={sectionLabelStyle}>Regular shifts</span>
      <Wireframe opacity={25}>
        {REGULAR.map((name) => (
          <div key={name} className={rowStyle}>
            <span className={whoStyle}>
              <Skeleton className={titleStyle}>{name}</Skeleton>
            </span>
            <Pill icon={CheckCircleIcon} tone="waiting">
              8.25 h
            </Pill>
          </div>
        ))}
      </Wireframe>
    </>
  );
}

/** A company's timesheet as finance sees it, adding and editing off-app shifts, and as the company does, read-only. */
export function OffAppWireframe() {
  const [view, setView] = useState("finance");
  return (
    <Stage toggle>
      <div className={columnStyle} data-wide="">
        <SegmentedControl ariaLabel="View as" className={toggleStyle} options={VIEWS} value={view} onValueChange={setView} />
        <div className={cardStyle} data-panes="">
          {VIEWS.map(({ value }) => (
            <div
              key={value}
              className={paneStyle}
              data-presented={view === value}
              aria-hidden={view !== value}
              inert={view !== value}
            >
              <TimesheetPane finance={value === "finance"} />
            </div>
          ))}
        </div>
      </div>
    </Stage>
  );
}
