"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  createCalchemy,
  type Calchemy as CalchemyEngine,
  type ParseDateResult,
} from "@calchemy/date-core";
import {
  Calchemy as CalchemyUI,
  useCalchemyCalendar,
  useCalchemyContext,
} from "@calchemy/date-react";
import { CalendarScroll } from "@calchemy/date-react/calendar-scroll";
import { css } from "../../../styled-system/css";
import { menuIcon } from "../../../styled-system/recipes";
import { Button } from "@/components/ui/button";
import { DemoPreloader } from "@/components/demo-component";
import CalendarIcon from "@/assets/icons/calendar.svg";
import ChevronLeftIcon from "@/assets/icons/chevron-left.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";
import { formatLoggerJson, useDemoLogger } from "@/hooks/use-demo-logger";

const CALCHEMY_WIDE_VISIBLE_PERIODS = 3;
const CALCHEMY_NARROW_VISIBLE_PERIODS = 2;
const CALCHEMY_COMPACT_VISIBLE_PERIODS = 1;
const DEMO_FRAME_WIDE_MIN_WIDTH = 761;
const DEMO_FRAME_MEDIUM_MIN_WIDTH = 536;
const CALCHEMY_PLACEHOLDER_WIDE = 'Try "Mondays and Fridays next month"';
const CALCHEMY_PLACEHOLDER_COMPACT = 'Try "Mondays next month"';
const calchemyCellSize = "calc(token(spacing.xxl) + token(spacing.sm))";
const calchemyPeriodSetGap = "token(spacing.xl)";
const calchemyPeriodWidth = `calc(2 * token(spacing.md) + 7 * ${calchemyCellSize} + 6 * token(spacing.sm))`;
const calchemyPeriodAndGapWidth = `calc(${calchemyPeriodWidth} + ${calchemyPeriodSetGap})`;
const calchemyWideDemoWidth = "token(sizes.calchemyDemo)";
const calchemyNarrowDemoWidth = `calc(${calchemyWideDemoWidth} - ${calchemyPeriodAndGapWidth})`;
const calchemyCompactDemoWidth = `calc(${calchemyNarrowDemoWidth} - ${calchemyPeriodAndGapWidth})`;
const calchemyWideScrollViewportWidth = `calc(${calchemyWideDemoWidth} - 2 * token(spacing.md))`;
const calchemyNarrowScrollViewportWidth = `calc(${calchemyNarrowDemoWidth} - 2 * token(spacing.md))`;
const calchemyCompactScrollViewportWidth = `calc(${calchemyCompactDemoWidth} - 2 * token(spacing.md))`;
const calchemyWideVisiblePeriodSetWidth = `calc(${CALCHEMY_WIDE_VISIBLE_PERIODS} * ${calchemyPeriodWidth} + ${CALCHEMY_WIDE_VISIBLE_PERIODS - 1} * ${calchemyPeriodSetGap})`;
const calchemyNarrowVisiblePeriodSetWidth = `calc(${CALCHEMY_NARROW_VISIBLE_PERIODS} * ${calchemyPeriodWidth} + ${CALCHEMY_NARROW_VISIBLE_PERIODS - 1} * ${calchemyPeriodSetGap})`;
const calchemyCompactVisiblePeriodSetWidth = calchemyPeriodWidth;
const calchemyWideScrollCenterPadding = `calc((${calchemyWideScrollViewportWidth} - ${calchemyWideVisiblePeriodSetWidth}) / 2)`;
const calchemyNarrowScrollCenterPadding = `calc((${calchemyNarrowScrollViewportWidth} - ${calchemyNarrowVisiblePeriodSetWidth}) / 2)`;
const calchemyCompactScrollCenterPadding = `calc((${calchemyCompactScrollViewportWidth} - ${calchemyCompactVisiblePeriodSetWidth}) / 2)`;

// Calchemy renders an attribute-tagged subtree ([calchemy-*]); every element
// that surfaces a `className` prop is styled directly via its own local `css()`
// below. Only the elements the library renders internally (the field wrapper +
// backdrop, and the weekday/week/date cells inside Weekdays and Grid) can't take
// a class, so they stay as attribute selectors nested under their owning class.
const calchemyDemoStyle = css({
  width: calchemyWideDemoWidth,
  maxWidth: "full",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  backgroundColor: "bg.surface",
  borderRadius: "md",
  overflow: "hidden",
  _demoFrameNarrow: { width: calchemyNarrowDemoWidth },
  _demoFrameCompact: { width: calchemyCompactDemoWidth },
});

// Applied to CalchemyUI.Field, whose `className` lands on the inner <input>.
const calchemyFieldStyle = css({
  position: "relative",
  zIndex: 1,
  flex: "1 1 auto",
  width: "full",
  minWidth: 0,
  border: "none",
  focusVisibleRing: "none",
  background: "transparent",
  padding: 0,
  margin: 0,
  font: "inherit",
  color: "text.body",
  caretColor: "text.body",
  textWrap: "pretty",
  _focusVisible: {
    boxShadow: "none",
    borderRadius: "unset",
  },
  "&::placeholder": {
    color: "text.body/25",
    opacity: 1,
  },
});

const calchemyCandidatesStyle = css({
  display: "none",
});

const calchemyCalendarStyle = css({
  position: "relative",
  display: "flex",
  alignItems: "flex-start",
  width: "full",
  padding: "md",
});

const calchemyScrollStyle = css({
  display: "flex",
  alignItems: "flex-start",
  width: calchemyWideScrollViewportWidth,
  maxWidth: "full",
  overflowX: "auto",
  overflowY: "hidden",
  scrollbarWidth: "none",
  scrollSnapType: "x mandatory",
  scrollPaddingInline: calchemyWideScrollCenterPadding,
  "&::-webkit-scrollbar": {
    display: "none",
  },
  _demoFrameNarrow: {
    width: calchemyNarrowScrollViewportWidth,
    scrollPaddingInline: calchemyNarrowScrollCenterPadding,
  },
  _demoFrameCompact: {
    width: calchemyCompactScrollViewportWidth,
    scrollPaddingInline: calchemyCompactScrollCenterPadding,
  },
});

const calchemyPeriodListStyle = css({
  display: "flex",
  flexDirection: "row",
  flexWrap: "nowrap",
  alignItems: "flex-start",
  gap: "xl",
  width: "max-content",
  paddingInline: calchemyWideScrollCenterPadding,
  _demoFrameNarrow: {
    paddingInline: calchemyNarrowScrollCenterPadding,
  },
  _demoFrameCompact: {
    paddingInline: calchemyCompactScrollCenterPadding,
  },
});

const calchemyPeriodStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "sm",
  padding: "md",
  flexShrink: 0,
  [`&:nth-of-type(${CALCHEMY_WIDE_VISIBLE_PERIODS}n + 1)`]: {
    scrollSnapAlign: "start",
    scrollSnapStop: "always",
  },
  _demoFrameNarrow: {
    [`&:nth-of-type(${CALCHEMY_WIDE_VISIBLE_PERIODS}n + 1)`]: {
      scrollSnapAlign: "unset",
      scrollSnapStop: "unset",
    },
    [`&:nth-of-type(${CALCHEMY_NARROW_VISIBLE_PERIODS}n + 1)`]: {
      scrollSnapAlign: "start",
      scrollSnapStop: "always",
    },
  },
  _demoFrameCompact: {
    [`&:nth-of-type(${CALCHEMY_NARROW_VISIBLE_PERIODS}n + 1)`]: {
      scrollSnapAlign: "unset",
      scrollSnapStop: "unset",
    },
    [`&:nth-of-type(${CALCHEMY_COMPACT_VISIBLE_PERIODS}n + 1)`]: {
      scrollSnapAlign: "start",
      scrollSnapStop: "always",
    },
  },
});

const calchemyPeriodHeadingStyle = css({
  margin: 0,
  textAlign: "center",
  textStyle: "bodyLarge",
  color: "text.body",
});

// Root is [calchemy-days]; the weekday cells are rendered internally.
const calchemyWeekdaysStyle = css({
  display: "grid",
  gridTemplateColumns: `repeat(7, ${calchemyCellSize})`,
  gap: "sm",
  justifyContent: "center",
  "& [calchemy-weekday]": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: calchemyCellSize,
    height: calchemyCellSize,
    textStyle: "bodySmall",
    textAlign: "center",
    color: "text.body",
  },
  "& [calchemy-weekday][calchemy-weekend]": {
    color: "text.body/50",
  },
});

// Root is [calchemy-grid]; the week rows and day cells are rendered internally.
const calchemyGridStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "sm",
  "& [calchemy-week]": {
    display: "grid",
    gridTemplateColumns: `repeat(7, ${calchemyCellSize})`,
    gap: "sm",
    justifyContent: "center",
  },
  "& [calchemy-date], & [calchemy-cell]": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: calchemyCellSize,
    height: calchemyCellSize,
    padding: 0,
    border: "none",
    background: "transparent",
    textStyle: "bodySmall",
    fontVariantNumeric: "tabular-nums",
    textAlign: "center",
    color: "text.body",
    borderRadius: "sm",
    cursor: "default",
  },
  "& [calchemy-date][calchemy-weekend]": {
    color: "text.body/50",
  },
  "& [calchemy-date][calchemy-selected]": {
    backgroundColor: "brand.pink/15",
    color: "brand.pink",
  },
  "& [calchemy-date][calchemy-today]": {
    color: "brand.pink",
  },
  _dark: {
    "& [calchemy-date][calchemy-selected]": {
      backgroundColor: "brand.orange/15",
      color: "brand.orange",
    },
    "& [calchemy-date][calchemy-today]": {
      color: "brand.orange",
    },
  },
});

const calchemyDemoLoadingStyle = css({
  width: calchemyWideDemoWidth,
  maxWidth: "full",
  minHeight: "calc(token(spacing.4xl) + token(spacing.5xl) * 3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "bg.surface",
  borderRadius: "md",
});

// The demo owns this row div, so the field wrapper + backdrop layers (which
// Calchemy renders internally around the input) are styled here via attribute
// selectors; the input itself carries `calchemyFieldStyle` through Field.
const inputRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  width: "full",
  height: "token(spacing.4xl)",
  paddingInline: "lg",
  borderBottomWidth: "token(spacing.3xs)",
  borderBottomStyle: "solid",
  borderColor: "border.divider",
  flexShrink: 0,
  color: "text.body",
  textStyle: "bodySmall",
  textWrap: "pretty",

  "& [calchemy-field]": {
    position: "relative",
    display: "flex",
    flex: "1 1 auto",
    alignItems: "center",
    minWidth: 0,
  },

  "& [calchemy-field-backdrop]": {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    whiteSpace: "pre",
    pointerEvents: "none",
    font: "inherit",
  },

  "& [calchemy-field-typed]": {
    color: "transparent",
  },

  "& [calchemy-completions]": {
    color: "text.body/25",
  },
});

const iconStyle = menuIcon();

const calchemyNavPreviousPositionStyle = css({
  position: "absolute",
  top: "half",
  left: "md",
});

const calchemyNavNextPositionStyle = css({
  position: "absolute",
  top: "half",
  right: "md",
});

function CalchemyCalendarNavPrevious() {
  const calendar = useCalchemyCalendar();
  const moveCount = -calendar.period.count;

  return (
    <div className={calchemyNavPreviousPositionStyle}>
      <Button
        type="button"
        variant="icon"
        aria-label="Previous months"
        disabled={
          calendar.isNavigating ||
          !calendar.canMove(calendar.period.unit, moveCount)
        }
        onClick={() => calendar.move(calendar.period.unit, moveCount)}
      >
        <ChevronLeftIcon className={iconStyle} aria-hidden />
      </Button>
    </div>
  );
}

function CalchemyCalendarNavNext() {
  const calendar = useCalchemyCalendar();
  const moveCount = calendar.period.count;

  return (
    <div className={calchemyNavNextPositionStyle}>
      <Button
        type="button"
        variant="icon"
        aria-label="Next months"
        disabled={
          calendar.isNavigating ||
          !calendar.canMove(calendar.period.unit, moveCount)
        }
        onClick={() => calendar.move(calendar.period.unit, moveCount)}
      >
        <ChevronRightIcon className={iconStyle} aria-hidden />
      </Button>
    </div>
  );
}

type CalchemyVisiblePeriods =
  | typeof CALCHEMY_WIDE_VISIBLE_PERIODS
  | typeof CALCHEMY_NARROW_VISIBLE_PERIODS
  | typeof CALCHEMY_COMPACT_VISIBLE_PERIODS;

function getCalchemyDemoLayout(frameWidth: number): {
  visiblePeriods: CalchemyVisiblePeriods;
  placeholder: string;
} {
  if (frameWidth < DEMO_FRAME_MEDIUM_MIN_WIDTH) {
    return {
      visiblePeriods: CALCHEMY_COMPACT_VISIBLE_PERIODS,
      placeholder: CALCHEMY_PLACEHOLDER_COMPACT,
    };
  }

  if (frameWidth < DEMO_FRAME_WIDE_MIN_WIDTH) {
    return {
      visiblePeriods: CALCHEMY_NARROW_VISIBLE_PERIODS,
      placeholder: CALCHEMY_PLACEHOLDER_WIDE,
    };
  }

  return {
    visiblePeriods: CALCHEMY_WIDE_VISIBLE_PERIODS,
    placeholder: CALCHEMY_PLACEHOLDER_WIDE,
  };
}

function useCalchemyDemoLayout(
  rootRef: RefObject<HTMLDivElement | null>,
  ready: boolean,
) {
  const [layout, setLayout] = useState(() =>
    getCalchemyDemoLayout(DEMO_FRAME_WIDE_MIN_WIDTH),
  );

  useEffect(() => {
    if (!ready) {
      return;
    }

    const root = rootRef.current;
    if (!root) {
      return;
    }

    const frame = root.closest(".demo-frame");
    if (!frame) {
      return;
    }

    const lastWidthRef = {
      current: Math.round(frame.getBoundingClientRect().width),
    };

    const updateLayout = () => {
      const rect = frame.getBoundingClientRect();
      const w = Math.round(rect.width);
      const widthChanged = lastWidthRef.current !== w;
      lastWidthRef.current = w;
      if (!widthChanged) return;

      setLayout(getCalchemyDemoLayout(rect.width));
    };

    updateLayout();

    const observer = new ResizeObserver(updateLayout);
    observer.observe(frame);

    return () => {
      observer.disconnect();
    };
  }, [ready, rootRef]);

  return layout;
}

function getParseResultSnapshot(
  result: ParseDateResult,
  calchemy: CalchemyEngine,
): string {
  switch (result.status) {
    case "valid":
      return JSON.stringify({
        status: result.status,
        value: calchemy.toJSON(result.value),
      });
    case "ambiguous":
      return JSON.stringify({
        status: result.status,
        candidates: result.candidates.map((candidate) => candidate.id),
      });
    case "invalid":
      return JSON.stringify({
        status: result.status,
        errors: result.errors.map((error) => error.message),
      });
  }
}

function getActionableParseErrors(result: ParseDateResult) {
  if (result.status !== "invalid") {
    return [];
  }

  return result.errors.filter((error) => error.code !== "empty-input");
}

function formatValidLoggerStatus(value: unknown): string {
  return `✓ valid\n${formatLoggerJson(value)}`;
}

function formatInvalidLoggerStatus(message: string): string {
  return `✕ invalid\n${message}`;
}

function CalchemyParseLogger() {
  const { result, calchemy } = useCalchemyContext();
  const logger = useDemoLogger();
  const previousSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    const snapshot = getParseResultSnapshot(result, calchemy);
    if (snapshot === previousSnapshotRef.current) {
      return;
    }
    previousSnapshotRef.current = snapshot;

    switch (result.status) {
      case "valid":
        logger.setStatus(
          "log",
          formatValidLoggerStatus(calchemy.toJSON(result.value)),
        );
        return;
      case "ambiguous":
        logger.setStatus(
          "warn",
          result.candidates.map((candidate) => candidate.label).join(", "),
        );
        return;
      case "invalid": {
        const actionableErrors = getActionableParseErrors(result);
        if (actionableErrors.length === 0) {
          logger.clearStatus();
          return;
        }

        logger.setStatus(
          "error",
          formatInvalidLoggerStatus(
            actionableErrors.map((error) => error.message).join("; "),
          ),
        );
        return;
      }
    }
  }, [result, calchemy, logger]);

  return null;
}

// The engine (which lazily imports the Temporal polyfill) is created once and
// cached, so `prepareCalchemyDemo()` can warm it during the demo's load — the
// demo frame's preloader then covers this init too and the component mounts
// ready, with no second internal spinner.
let cachedCalchemyEngine: CalchemyEngine | null = null;
let calchemyEnginePromise: Promise<CalchemyEngine> | null = null;

function acquireCalchemyEngine(): Promise<CalchemyEngine> {
  if (cachedCalchemyEngine) return Promise.resolve(cachedCalchemyEngine);
  if (!calchemyEnginePromise) {
    calchemyEnginePromise = createCalchemy({
      defaultContext: { locale: "en-US", weekStartsOn: 0 },
    }).then((instance) => {
      cachedCalchemyEngine = instance;
      return instance;
    });
  }
  return calchemyEnginePromise;
}

/** Warms the Calchemy engine so the demo can render synchronously once loaded. */
export function prepareCalchemyDemo(): Promise<void> {
  return acquireCalchemyEngine().then(() => undefined);
}

/** Test-only: drops the cached engine so cases can exercise the loading state. */
export function __resetCalchemyDemoCache(): void {
  cachedCalchemyEngine = null;
  calchemyEnginePromise = null;
}

export function CalchemyDemo() {
  const [calchemy, setCalchemy] = useState<CalchemyEngine | null>(
    cachedCalchemyEngine,
  );
  const demoRootRef = useRef<HTMLDivElement>(null);
  const { visiblePeriods, placeholder } = useCalchemyDemoLayout(
    demoRootRef,
    calchemy !== null,
  );

  useEffect(() => {
    if (calchemy) return;

    let cancelled = false;
    acquireCalchemyEngine().then((instance) => {
      if (!cancelled) setCalchemy(instance);
    });

    return () => {
      cancelled = true;
    };
  }, [calchemy]);

  if (!calchemy) {
    return (
      <div
        ref={demoRootRef}
        className={calchemyDemoLoadingStyle}
        aria-busy="true"
      >
        <DemoPreloader />
      </div>
    );
  }

  return (
    <CalchemyUI.Root
      calchemy={calchemy}
      expectedValue="multiple"
      parseContext={{ locale: "en-US", weekStartsOn: 0 }}
    >
      <CalchemyParseLogger />
      <div ref={demoRootRef} className={calchemyDemoStyle}>
        <div className={inputRowStyle} data-calchemy-input-row>
          <CalendarIcon className={iconStyle} aria-hidden />
          <CalchemyUI.Field
            placeholder={placeholder}
            className={calchemyFieldStyle}
          />
        </div>
        <CalchemyUI.Candidates className={calchemyCandidatesStyle} />
        <CalchemyUI.Calendar
          key={visiblePeriods}
          period={{ months: visiblePeriods }}
          className={calchemyCalendarStyle}
        >
          <CalchemyCalendarNavPrevious />
          <CalchemyCalendarNavNext />
          <CalendarScroll direction="horizontal" className={calchemyScrollStyle}>
            <CalchemyUI.CalendarPeriodList className={calchemyPeriodListStyle}>
              <CalchemyUI.CalendarPeriod className={calchemyPeriodStyle}>
                <CalchemyUI.CalendarPeriodHeading
                  className={calchemyPeriodHeadingStyle}
                />
                <CalchemyUI.CalendarWeekdays
                  weekdayFormat="narrow"
                  className={calchemyWeekdaysStyle}
                />
                <CalchemyUI.CalendarGrid
                  showBookends={false}
                  className={calchemyGridStyle}
                />
              </CalchemyUI.CalendarPeriod>
            </CalchemyUI.CalendarPeriodList>
          </CalendarScroll>
        </CalchemyUI.Calendar>
      </div>
    </CalchemyUI.Root>
  );
}
