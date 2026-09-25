"use client";

import {
  Fragment,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css } from "../../../styled-system/css";
import { field } from "../../../styled-system/recipes";
import { ShiftFormShell } from "./shift-form-shell";
import { DemoCursor } from "./demo-cursor";
import { DemoControls } from "./demo-controls";
import { DemoInvitation } from "./demo-invitation";
import { Field } from "@/components/ui/input/field";
import { DatePicker } from "@/components/ui/input/datepicker";
import { TimePicker } from "@/components/ui/input/time-picker";
import { Switch } from "@/components/ui/input/switch";
import { TextInput } from "@/components/ui/input/text-input";
import { Checkbox } from "@/components/ui/input/checkbox";
import { OptionList } from "@/components/ui/input/option-list";
import { Notice } from "@/components/ui/notice";
import { Wireframe } from "@/components/ui/wireframe";
import { useInView } from "@/hooks/use-in-view";
import { useDemoCursorTour } from "@/hooks/use-demo-cursor-tour";
import { useDemoInvitation } from "@/hooks/use-demo-invitation";
import {
  WEEKDAY_KEYS,
  weekdayOf,
  type WeekdayKey,
} from "@/utils/calendar-month";
import { timeZoneLabel } from "@/utils/time-zone-label";
import InfoIcon from "@/assets/icons/info.svg";

const WEEKDAYS: { key: WeekdayKey; letter: string; name: string }[] = [
  { key: "sun", letter: "S", name: "Sunday" },
  { key: "mon", letter: "M", name: "Monday" },
  { key: "tue", letter: "T", name: "Tuesday" },
  { key: "wed", letter: "W", name: "Wednesday" },
  { key: "thu", letter: "T", name: "Thursday" },
  { key: "fri", letter: "F", name: "Friday" },
  { key: "sat", letter: "S", name: "Saturday" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]; // prettier-ignore

// ISO dayOfWeek is 1 (Mon) … 7 (Sun).
const WEEKDAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
]; // prettier-ignore

function formatFull(date: Temporal.PlainDate): string {
  return `${WEEKDAY_NAMES[date.dayOfWeek - 1]}, ${date.day} ${MONTHS[date.month - 1]}, ${date.year}`;
}

function joinDays(names: string[]): ReactNode {
  return names.map((name, i) => (
    <Fragment key={name}>
      {i > 0 && (i === names.length - 1 ? " and " : ", ")}
      <strong>{name}</strong>
    </Fragment>
  ));
}

const formStyle = css({ display: "flex", flexDirection: "column", gap: "lg" });

// Wraps because neither half can shrink: seven fixed chips beside a fixed-width date field.
const rowStyle = css({
  display: "flex",
  flexWrap: "wrap",
  columnGap: "xl",
  rowGap: "lg",
  alignItems: "flex-start",
});
const dateFieldStyle = css({
  width: "token(sizes.dateField)",
  flexShrink: 0,
});

// `flex-end`: the columns match only from their feet up, so aligning feet puts the frames on one line.
const dateTimeRowStyle = css({
  display: "flex",
  flexWrap: "wrap",
  columnGap: "xxl",
  rowGap: "lg",
  alignItems: "flex-end",
});

// A plain div, not an outer Field: a `[data-field]` ancestor's `:has` would light both
// triggers. Each trigger has its own Field, since one field context mints one `controlId`.
const timeRangeStyle = css({
  display: "flex",
  flexDirection: "column",
  width: "fit-content",
  maxWidth: "token(spacing.full)",
  minWidth: 0,
});

// The field recipe's own `hint` slot; `Field.Hint` needs a field context this group lacks.
const zoneHintStyle = field({ size: "md" }).hint;

const timeRowStyle = css({
  display: "flex",
  alignItems: "flex-end",
  gap: "sm",
});

// `minWidth: 0` lets the pair shrink together; a flex item's minimum is otherwise its content.
const timeFieldStyle = css({
  width: "token(sizes.dateField)",
  minWidth: 0,
});

// One frame tall (`spacing.4xl`, the `md` frame) on the row's foot, so it centres on the frames.
const hyphenStyle = css({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  height: "token(spacing.4xl)",
  color: "field.text.muted",
  textStyle: "bodyLarge",
  userSelect: "none",
});

/** The workplace's zone, not the visitor's. */
const SHIFT_TIME_ZONE = "America/New_York";

const OPENING_START = Temporal.PlainTime.from("09:00");
const OPENING_END = Temporal.PlainTime.from("17:00");

// No gap: the region carries its own top spacing, so that spacing folds away with it.
const repeatCardStyle = css({
  display: "flex",
  flexDirection: "column",
  paddingBlock: "md",
  borderRadius: "md",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "field.border.default",
});

const switchRowStyle = css({ paddingInline: "lg" });

// 1fr↔0fr rows animate to intrinsic height cross-browser; `display` rides along via `allow-discrete`.
// `@starting-style` and `display: none` wait for `data-armed`, so load neither animates nor unmeasures it.
const recurrenceStyle = css({
  display: "grid",
  gridTemplateRows: "1fr",
  transitionProperty: "grid-template-rows, display",
  transitionDuration: "180ms",
  transitionTimingFunction: "ease-out",
  transitionDelay: "0s",
  transitionBehavior: "allow-discrete",
  "&[data-collapsed='true']": {
    gridTemplateRows: "0fr",
    transitionDelay: "60ms",
  },
  "&[data-armed='true'][data-collapsed='true']": { display: "none" },
  _starting: {
    "&[data-armed='true'][data-collapsed='false']": { gridTemplateRows: "0fr" },
  },
});

const recurrenceClipStyle = css({ minHeight: 0, overflow: "hidden" });

const recurrenceContentStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "md",
  paddingBlockStart: "md",
  paddingBlockEnd: "sm",
  opacity: 1,
  translate: "0 0",
  transitionProperty: "opacity, translate",
  transitionDuration: "160ms",
  transitionTimingFunction: "ease-out",
  transitionDelay: "80ms",
  "[data-collapsed='true'] &": {
    opacity: 0,
    translate: "0 -20px",
    transitionDelay: "0s",
  },
  _starting: {
    "[data-armed='true'][data-collapsed='false'] &": {
      opacity: 0,
      translate: "0 -20px",
    },
  },
});

const dividerStyle = css({
  flexShrink: 0,
  height: "token(spacing.3xs)",
  backgroundColor: "border.divider",
});

const recurrenceBodyStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  paddingInline: "lg",
});

// Takes back exactly the height the recurrence folds away, on mirrored timing, so the dialog never resizes.
// Unanimated until armed: the reserve arrives from a layout effect, so the first change would play on load.
const counterweightStyle = css({
  height: "token(spacing.none)",
  opacity: 0,
  overflow: "hidden",
  transitionProperty: "none",
  transitionDuration: "180ms, 160ms",
  transitionTimingFunction: "ease-out",
  transitionDelay: "0s, 0s",
  "&[data-armed='true']": { transitionProperty: "height, opacity" },
  "&[data-open='true']": {
    height: "var(--counterweight, 0px)",
    opacity: 1,
    transitionDelay: "60ms, 80ms",
  },
});

// Sized to the reserve, not `100%`, so the fields lay out once instead of re-flowing through the transition.
const counterweightFieldsStyle = css({
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  height: "var(--counterweight, 0px)",
  paddingInline: "xl",
  paddingBlockStart: "lg",
  paddingBlockEnd: "sm",
});

const counterweightChecksStyle = css({
  display: "flex",
  flexDirection: "column",
});

const weekdaysGroupStyle = css({ display: "flex", flexDirection: "column" });

const weekdaysLabelStyle = css({
  textStyle: "bodySmall",
  color: "field.text.muted",
  whiteSpace: "nowrap",
});

const weekdaysFrameStyle = css({
  display: "inline-flex",
  alignItems: "center",
  height: "token(spacing.4xl)",
  paddingInline: "md",
  borderRadius: "sm",
  backgroundColor: "field.bg.default",
  boxShadow: "inset 0 0 0 0.5px var(--colors-field-border-default)",
  width: "fit-content",
});

const weekdaysToolbarStyle = css({ gap: "sm" });

const dayChipStyle = css({
  width: "token(sizes.toolbarButton)",
  height: "token(sizes.toolbarButton)",
  padding: "none",
  justifyContent: "center",
  textAlign: "center",
});

// Wraps the whole dialog: the form's `clip-path` is a stacking context the cursor must paint above.
const stageStyle = css({ position: "relative" });

const TOUR_SHIFTS = 25;
const TOUR_WEEKDAYS = 4;
const TOUR_FINALE_MS = 1800;

export interface DemoRecurrencePlan {
  /** The first shift's own weekday leads. */
  weekdays: WeekdayKey[];
  /** Closes the run on exactly `shifts` shifts. */
  lastShift: Temporal.PlainDate;
}

/** Every other weekday from the first shift's own, closing on the day the count reaches `shifts`. */
export function planDemoRecurrence(
  firstShift: Temporal.PlainDate,
  shifts = TOUR_SHIFTS,
): DemoRecurrencePlan {
  const opening = WEEKDAY_KEYS.indexOf(weekdayOf(firstShift));
  const weekdays = Array.from(
    { length: TOUR_WEEKDAYS },
    (_, index) => WEEKDAY_KEYS[(opening + index * 2) % 7],
  );
  const repeats = new Set(weekdays);

  let lastShift = firstShift;
  let counted = 1;
  while (counted < shifts) {
    lastShift = lastShift.add({ days: 1 });
    if (repeats.has(weekdayOf(lastShift))) counted += 1;
  }
  return { weekdays, lastShift };
}

/** Chevron presses to page a calendar showing `from`'s month over to `to`'s. */
export function monthsBetween(
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}

/** Portalled to the body, so queried on the document. */
const DATE_POPOVER = '[role="dialog"][aria-label="Choose date"]';

const WEEKDAY_NAMES_BY_KEY = new Map(
  WEEKDAYS.map((day) => [day.key, day.name]),
);

/** A constant render anchor: reading the clock while rendering breaks hydration (#418) on prerendered pages. */
const SEED_TODAY = Temporal.PlainDate.from("2026-01-01");

/** Tomorrow through a week later, on the first shift's weekday; what every reset restores. */
function openingFrom(today: Temporal.PlainDate) {
  const firstShift = today.add({ days: 1 });
  return {
    firstShift,
    lastShift: today.add({ days: 8 }),
    days: [weekdayOf(firstShift)] as WeekdayKey[],
  };
}

/** Read once and cached: `useSyncExternalStore` needs a stable snapshot. */
let clientToday: Temporal.PlainDate | null = null;
const readToday = () => (clientToday ??= Temporal.Now.plainDateISO());

const holdStill = () => () => {};

/** Renders from `SEED_TODAY`, then the real date; keyed so the form's state re-seeds from it. */
export function ShiftSchedulingV1() {
  const today = useSyncExternalStore(holdStill, readToday, () => SEED_TODAY);
  return <ShiftSchedulingForm key={today.toString()} today={today} />;
}

function ShiftSchedulingForm({ today }: { today: Temporal.PlainDate }) {
  const opening = useMemo(() => openingFrom(today), [today]);

  const [firstShift, setFirstShift] = useState<Temporal.PlainDate | null>(
    opening.firstShift,
  );
  const [lastShift, setLastShift] = useState<Temporal.PlainDate | null>(
    opening.lastShift,
  );
  const [startTime, setStartTime] = useState<Temporal.PlainTime | null>(
    OPENING_START,
  );
  const [endTime, setEndTime] = useState<Temporal.PlainTime | null>(
    OPENING_END,
  );
  // Closed at rest: the walkthrough's first move opens it.
  const [repeat, setRepeat] = useState(false);
  const [days, setDays] = useState<Set<WeekdayKey>>(
    () => new Set(opening.days),
  );
  // Arms the entry animation once the switch is first touched, so it cannot fire on load.
  const [armed, setArmed] = useState(false);

  // The recurrence's natural height, for the counterweight; zero readings (`display: none`) are discarded.
  const recurrenceContentRef = useRef<HTMLDivElement>(null);
  const [reserve, setReserve] = useState(0);
  useLayoutEffect(() => {
    const content = recurrenceContentRef.current;
    if (!content) return;
    const measure = () => {
      const height = content.getBoundingClientRect().height;
      if (height > 0) setReserve(height);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, []);

  const toggleDay = (key: WeekdayKey) =>
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectedNames = WEEKDAYS.filter((d) => days.has(d.key)).map(
    (d) => d.name,
  );
  // Not gated on `repeat`: the Notice fades with the region and must not re-flow mid-fade.
  const repeating = selectedNames.length > 0;

  const tour = useMemo(
    () => planDemoRecurrence(opening.firstShift),
    [opening.firstShift],
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const onScreen = useInView(stageRef);

  /** Puts the run back; `repeating` is false only for replay, whose first click opens the card. */
  const restore = useCallback(
    (repeating: boolean) => {
      setRepeat(repeating);
      setDays(new Set(opening.days));
      setFirstShift(opening.firstShift);
      setLastShift(opening.lastShift);
      setStartTime(OPENING_START);
      setEndTime(OPENING_END);

      // Drops focus the tour left inside the form; a visitor's focus outside it stays.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && stageRef.current?.contains(focused))
        focused.blur();
    },
    [opening],
  );

  // From `today`, not the live clock (hydration); noon in the zone keeps the day off a DST changeover.
  const timeZoneNote = useMemo(
    () =>
      timeZoneLabel(
        SHIFT_TIME_ZONE,
        new Date(
          today.toZonedDateTime({
            timeZone: SHIFT_TIME_ZONE,
            plainTime: "12:00",
          }).epochMilliseconds,
        ),
      ),
    [today],
  );

  const invitation = useDemoInvitation(stageRef);

  const cursor = useDemoCursorTour({
    stageRef,
    active: onScreen,
    finaleMs: TOUR_FINALE_MS,
    stops: () => {
      const stage = stageRef.current;
      if (!stage || repeat || days.size !== 1) return [];

      const inStage = (selector: string) => () =>
        stage.querySelector<HTMLElement>(selector);
      const inPopover = (selector: string) => () =>
        document.querySelector<HTMLElement>(`${DATE_POPOVER} ${selector}`);

      const shown = lastShift ?? opening.lastShift;
      const turns = Math.max(0, monthsBetween(shown, tour.lastShift));

      return [
        inStage('[role="switch"]'),
        // The first weekday is already the seeded one.
        ...tour.weekdays
          .slice(1)
          .map((key) =>
            inStage(
              `[aria-label="Repeat on weekdays"] [aria-label="${WEEKDAY_NAMES_BY_KEY.get(key)}"]`,
            ),
          ),
        inStage('[data-testid="recurrence"] button[aria-haspopup="dialog"]'),
        ...Array.from({ length: turns }, () =>
          inPopover('button[aria-label="Next month"]'),
        ),
        inPopover(`[data-date="${tour.lastShift}"]:not([data-outside])`),
      ];
    },
    onComplete: () => {
      restore(true);
      invitation.offer();
    },
    onRewind: () => restore(false),
  });

  // Rewinds to the card shut first: the tour's clicks toggle, so replaying over its work would undo it.
  const { replay: replayTour, stop: stopTour } = cursor;
  const replay = useCallback(() => {
    restore(false);
    replayTour();
  }, [restore, replayTour]);

  // Stops the tour too, or its remaining clicks would put the run back.
  const reset = useCallback(() => {
    stopTour();
    restore(true);
  }, [stopTour, restore]);

  // Chips and dates only: reset always leaves the card open, so the switch never makes it dirty.
  const dirty =
    !firstShift?.equals(opening.firstShift) ||
    !lastShift?.equals(opening.lastShift) ||
    !startTime?.equals(OPENING_START) ||
    !endTime?.equals(OPENING_END) ||
    days.size !== opening.days.length ||
    !opening.days.every((key) => days.has(key));

  return (
    <>
      <div className={stageStyle} ref={stageRef}>
        <ShiftFormShell
          footerFill={
            <div
              className={counterweightStyle}
              data-testid="repeat-counterweight"
              data-open={!repeat}
              data-armed={armed}
              style={{ "--counterweight": `${reserve}px` } as CSSProperties}
            >
              <Wireframe className={counterweightFieldsStyle} opacity={25}>
                <TextInput
                  label="Additional Notes"
                  defaultValue="Anything the team should know"
                  hint="Visible to everyone rostered on this shift"
                />
                <div className={counterweightChecksStyle}>
                  <Field>
                    <Checkbox />
                    <Field.Label>
                      Notify the team when this shift is posted
                    </Field.Label>
                  </Field>
                  <Field>
                    <Checkbox />
                    <Field.Label>
                      Let staff swap this shift with a colleague
                    </Field.Label>
                  </Field>
                </div>
              </Wireframe>
            </div>
          }
        >
          <div className={formStyle}>
            <div className={dateTimeRowStyle}>
              <Field className={dateFieldStyle}>
                <Field.Label>Shift Date</Field.Label>
                <DatePicker value={firstShift} onValueChange={setFirstShift} />
                <Field.Hint>dd/mm/yyyy</Field.Hint>
              </Field>

              <div
                className={timeRangeStyle}
                role="group"
                aria-label="Shift time"
              >
                <div className={timeRowStyle}>
                  <Field className={timeFieldStyle}>
                    <Field.Label>Start Time</Field.Label>
                    <TimePicker
                      value={startTime}
                      onValueChange={setStartTime}
                    />
                  </Field>
                  <span aria-hidden className={hyphenStyle}>
                    -
                  </span>
                  <Field className={timeFieldStyle}>
                    <Field.Label>End Time</Field.Label>
                    <TimePicker
                      value={endTime}
                      onValueChange={setEndTime}
                      differenceFrom={startTime}
                    />
                  </Field>
                </div>
                <p className={zoneHintStyle}>{timeZoneNote}</p>
              </div>
            </div>

            <div className={repeatCardStyle} data-testid="repeat-card">
              <div className={switchRowStyle}>
                <Field size="lg">
                  <Switch
                    checked={repeat}
                    onCheckedChange={(next) => {
                      setArmed(true);
                      setRepeat(next);
                    }}
                  />
                  <Field.Label>Repeat this shift on other days</Field.Label>
                </Field>
              </div>

              <div
                className={recurrenceStyle}
                data-testid="recurrence"
                data-collapsed={!repeat}
                data-armed={armed}
                inert={!repeat}
              >
                <div className={recurrenceClipStyle}>
                  <div
                    className={recurrenceContentStyle}
                    ref={recurrenceContentRef}
                  >
                    <div
                      className={dividerStyle}
                      data-testid="repeat-divider"
                    />

                    <div className={recurrenceBodyStyle}>
                      <div className={rowStyle}>
                        <div className={weekdaysGroupStyle}>
                          <span className={weekdaysLabelStyle}>
                            Repeat Every Week On
                          </span>
                          <div className={weekdaysFrameStyle}>
                            <OptionList direction="inline">
                              <OptionList.Toolbar
                                aria-label="Repeat on weekdays"
                                className={weekdaysToolbarStyle}
                              >
                                {WEEKDAYS.map((day, i) => (
                                  <OptionList.Option
                                    key={`${day.key}-${i}`}
                                    pressed={days.has(day.key)}
                                    aria-label={day.name}
                                    className={dayChipStyle}
                                    onClick={() => toggleDay(day.key)}
                                  >
                                    {day.letter}
                                  </OptionList.Option>
                                ))}
                              </OptionList.Toolbar>
                            </OptionList>
                          </div>
                        </div>
                        <Field className={dateFieldStyle}>
                          <Field.Label>Until</Field.Label>
                          <DatePicker
                            value={lastShift}
                            onValueChange={setLastShift}
                          />
                          <Field.Hint>dd/mm/yyyy</Field.Hint>
                        </Field>
                      </div>

                      <Notice role="status" aria-live="polite">
                        <Notice.Icon>
                          <InfoIcon />
                        </Notice.Icon>
                        <Notice.Label>
                          {repeating && lastShift ? (
                            <>
                              This shift will repeat every{" "}
                              {joinDays(selectedNames)} between{" "}
                              <strong>
                                {firstShift ? formatFull(firstShift) : "—"}
                              </strong>{" "}
                              and <strong>{formatFull(lastShift)}</strong>
                            </>
                          ) : (
                            <>
                              This shift will start on{" "}
                              <strong>
                                {firstShift ? formatFull(firstShift) : "—"}
                              </strong>
                            </>
                          )}
                          .
                        </Notice.Label>
                      </Notice>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ShiftFormShell>

        {/* A sibling of the clipped form (see `stageStyle`), last so it paints on top. */}
        <DemoCursor {...cursor} />
        <DemoInvitation {...invitation} />
      </div>

      {/* Outside the stage, so a press is not taken for touching the form. */}
      <DemoControls
        onPlay={replay}
        onStop={stopTour}
        running={cursor.running}
        onReset={reset}
        resettable={dirty && !cursor.running}
      />
    </>
  );
}
