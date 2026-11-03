"use client";

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useRef,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import { css } from "../../../../styled-system/css";
import { useDismiss } from "@/hooks/use-dismiss";
import { useControllable, useOpen } from "./controllable";
import type { Day } from "./data";
import { Calendar, SMALL_PERIOD_LIST } from "./shift-calendar";
import { addDays, type Iso } from "./shifts";
import { Button, Presence, enterRaw, useEscapeLayer } from "./ui";
import DateLeftIcon from "./assets/icons/medium/chevron-left.svg";
import DateRightIcon from "./assets/icons/medium/chevron-right.svg";

// SW Curie's Molecules/Filter/Date Selector (8981:14186), and the filters' box and panel.

/** The days the prototype has, in order, and their words. */
export const DAYS: Day[] = ["yesterday", "today", "tomorrow"];
export const DAY_LABEL: Record<Day, string> = { yesterday: "Yesterday", today: "Today", tomorrow: "Tomorrow" };

const dateRootStyle = css({ position: "relative", display: "flex", alignItems: "center", gap: "var(--sw-gap-xs)" });

const stepStyle = css({ _disabled: { opacity: 0.4, cursor: "default", _hover: { backgroundColor: "transparent" } } });

// A small tertiary button, held in its pressed wash while its calendar is open.
const dateButtonStyle = css({
  "&[aria-expanded=true][data-emphasis]": { backgroundColor: "var(--tertiary-wash-pressed)", color: "var(--tertiary-glyph-pressed)" },
});

// The panel its calendar opens in.
const calendarStyle = css(enterRaw, {
  position: "absolute",
  insetBlockStart: "2.25rem",
  insetInlineEnd: 0,
  zIndex: 4,
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-md)",
  padding: "var(--sw-padding-md)",
  borderRadius: "var(--sw-radius-xs)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)",
  outline: "2px solid var(--sw-outline-focus)",
});

type SelectorState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  close: () => void;
  /** Whether it holds a `DateSelector.Calendar` for its date to open. */
  calendar: boolean;
  panel: RefObject<HTMLDivElement | null>;
  /** The day its parts follow, when it has one. */
  day?: Day;
  setDay: (day: Day) => void;
};

const SelectorContext = createContext<SelectorState | null>(null);

/**
 * Molecules/Filter/Date Selector (8981:14186): its `DateSelector.Previous` and `DateSelector.Next` steps either side of
 * its `DateSelector.Date`, which opens its `DateSelector.Calendar` when it has one. Given a `day` or `defaultDay`, its
 * parts step through, show and pick the prototype's days themselves.
 */
function DateSelectorRoot({
  day: held,
  defaultDay,
  onChange,
  defaultOpen = false,
  children,
}: {
  day?: Day;
  defaultDay?: Day;
  onChange?: (day: Day) => void;
  /** Opens with its calendar showing, as the design system shows the Active state. */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { open, setOpen, outside } = useOpen(defaultOpen);
  const [own, setDay] = useControllable(held, defaultDay ?? "today", onChange);
  const day = held !== undefined || defaultDay !== undefined ? own : undefined;
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useDismiss({ ref: root, onDismiss: close, enabled: open, dismissOnOutsidePointer: outside });
  useEscapeLayer(panel, open, close);
  const calendar = Children.toArray(children).some((child) => isValidElement(child) && child.type === DateSelectorCalendar);
  return (
    <div ref={root} className={dateRootStyle}>
      <SelectorContext value={{ open, setOpen, close, calendar, panel, day, setDay }}>{children}</SelectorContext>
    </div>
  );
}
DateSelectorRoot.displayName = "DateSelector";

const useSelector = () => useContext(SelectorContext)!;

/** A step `by` a day from the selector's, when it has one and its owner gives no `onClick`; none past its days. */
function useStep(by: -1 | 1, { onClick, disabled }: ComponentProps<"button">) {
  const { day, setDay } = useSelector();
  const next = day && DAYS[DAYS.indexOf(day) + by];
  return { disabled: disabled ?? (day !== undefined && !next), onClick: onClick ?? (next ? () => setDay(next) : undefined) };
}

function DateSelectorPrevious(props: ComponentProps<"button">) {
  return (
    <Button size="icon" className={stepStyle} {...props} {...useStep(-1, props)}>
      <DateLeftIcon aria-hidden />
    </Button>
  );
}
DateSelectorPrevious.displayName = "DateSelector.Previous";

function DateSelectorNext(props: ComponentProps<"button">) {
  return (
    <Button size="icon" className={stepStyle} {...props} {...useStep(1, props)}>
      <DateRightIcon aria-hidden />
    </Button>
  );
}
DateSelectorNext.displayName = "DateSelector.Next";

function DateSelectorDate({ children, ...props }: Omit<ComponentProps<"button">, "color">) {
  const { open, setOpen, calendar, day } = useSelector();
  return (
    <Button
      size="small"
      emphasis="tertiary"
      className={dateButtonStyle}
      aria-expanded={calendar ? open : undefined}
      {...props}
      onClick={calendar ? () => setOpen(!open) : props.onClick}
    >
      {children ?? (day && DAY_LABEL[day])}
    </Button>
  );
}
DateSelectorDate.displayName = "DateSelector.Date";

/**
 * A small calendar of yesterday, today and tomorrow around `today`, the days the prototype has; picking one closes it.
 * Its `day` and `onChange` are the selector's when it has a day.
 */
function DateSelectorCalendar({ day: given, onChange, today }: { day?: Day; onChange?: (next: Day) => void; today: Iso }) {
  const { open, close, panel, ...selector } = useSelector();
  const day = given ?? selector.day ?? "today";
  const pick = onChange ?? selector.setDay;
  const dates = DAYS.map((_, i) => addDays(today, i - 1));
  return (
    <Presence>
      {open && (
        <div ref={panel} className={calendarStyle} role="dialog" aria-label="Date" data-escape-layer="">
          <Calendar
            size="small"
            today={today}
            from={dates[0]}
            to={dates[2]}
            picked={[dates[DAYS.indexOf(day)]]}
            onPick={(date) => {
              pick(DAYS[dates.indexOf(date)]);
              close();
            }}
          >
            {SMALL_PERIOD_LIST}
          </Calendar>
        </div>
      )}
    </Presence>
  );
}
DateSelectorCalendar.displayName = "DateSelector.Calendar";

export const DateSelector = Object.assign(DateSelectorRoot, {
  Previous: DateSelectorPrevious,
  Date: DateSelectorDate,
  Next: DateSelectorNext,
  Calendar: DateSelectorCalendar,
});
