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
import { css, cx } from "../../../styled-system/css";
import { menuIcon } from "../../../styled-system/recipes";
import { Button } from "@/components/ui/button";
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

const calchemyDemoStyle = css({
  width: calchemyWideDemoWidth,
  maxWidth: "full",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  backgroundColor: "bg.surface",
  borderRadius: "md",
  overflow: "hidden",

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
    color: "text.commandItem/25",
  },

  "& [calchemy-field] input": {
    position: "relative",
    zIndex: 1,
    flex: "1 1 auto",
    width: "full",
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    font: "inherit",
    color: "text.commandItem",
    caretColor: "text.commandItem",
    textWrap: "pretty",
  },

  "& [calchemy-field] input::placeholder": {
    color: "text.commandItem/25",
    opacity: 1,
  },

  "& [calchemy-candidates]": {
    display: "none",
  },

  "& [calchemy-calendar]": {
    position: "relative",
    display: "flex",
    alignItems: "flex-start",
    width: "full",
    padding: "md",
  },

  "& [calchemy-scroll]": {
    display: "flex",
    alignItems: "flex-start",
    width: calchemyWideScrollViewportWidth,
    maxWidth: "full",
    overflowX: "auto",
    overflowY: "hidden",
    scrollbarWidth: "none",
    scrollSnapType: "x mandatory",
    scrollPaddingInline: calchemyWideScrollCenterPadding,
  },

  "& [calchemy-scroll]::-webkit-scrollbar": {
    display: "none",
  },

  "& [calchemy-period-list]": {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "flex-start",
    gap: "xl",
    width: "max-content",
    paddingInline: calchemyWideScrollCenterPadding,
  },

  "& [calchemy-period]": {
    display: "flex",
    flexDirection: "column",
    gap: "sm",
    padding: "md",
    flexShrink: 0,
  },

  [`& [calchemy-period]:nth-of-type(${CALCHEMY_WIDE_VISIBLE_PERIODS}n + 1)`]: {
    scrollSnapAlign: "start",
    scrollSnapStop: "always",
  },

  _demoFrameNarrow: {
    width: calchemyNarrowDemoWidth,

    [`& [calchemy-period]:nth-of-type(${CALCHEMY_WIDE_VISIBLE_PERIODS}n + 1)`]:
      {
        scrollSnapAlign: "unset",
        scrollSnapStop: "unset",
      },

    [`& [calchemy-period]:nth-of-type(${CALCHEMY_NARROW_VISIBLE_PERIODS}n + 1)`]:
      {
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
      },

    "& [calchemy-scroll]": {
      width: calchemyNarrowScrollViewportWidth,
      scrollPaddingInline: calchemyNarrowScrollCenterPadding,
    },

    "& [calchemy-period-list]": {
      paddingInline: calchemyNarrowScrollCenterPadding,
    },
  },

  _demoFrameCompact: {
    width: calchemyCompactDemoWidth,

    [`& [calchemy-period]:nth-of-type(${CALCHEMY_NARROW_VISIBLE_PERIODS}n + 1)`]:
      {
        scrollSnapAlign: "unset",
        scrollSnapStop: "unset",
      },

    [`& [calchemy-period]:nth-of-type(${CALCHEMY_COMPACT_VISIBLE_PERIODS}n + 1)`]:
      {
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
      },

    "& [calchemy-scroll]": {
      width: calchemyCompactScrollViewportWidth,
      scrollPaddingInline: calchemyCompactScrollCenterPadding,
    },

    "& [calchemy-period-list]": {
      paddingInline: calchemyCompactScrollCenterPadding,
    },
  },

  "& [calchemy-period-heading]": {
    margin: 0,
    textAlign: "center",
    textStyle: "paragraph",
    color: "text.commandItem",
  },

  "& [calchemy-days]": {
    display: "grid",
    gridTemplateColumns: `repeat(7, ${calchemyCellSize})`,
    gap: "sm",
    justifyContent: "center",
  },

  "& [calchemy-weekday]": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: calchemyCellSize,
    height: calchemyCellSize,
    textStyle: "commandItem",
    textAlign: "center",
    color: "text.commandItem",
  },

  "& [calchemy-weekday][calchemy-weekend]": {
    color: "text.commandItem/50",
  },

  "& [calchemy-grid]": {
    display: "flex",
    flexDirection: "column",
    gap: "sm",
  },

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
    textStyle: "commandItem",
    fontVariantNumeric: "tabular-nums",
    textAlign: "center",
    color: "text.commandItem",
    borderRadius: "sm",
    cursor: "default",
  },

  "& [calchemy-date][calchemy-weekend]": {
    color: "text.commandItem/50",
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
  minHeight: "calc(token(spacing.4xl) + token(spacing.5xl) * 3)",
});

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
  color: "text.commandItem",
  textStyle: "commandItem",
  textWrap: "pretty",
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

    const lastWidthRef = { current: Math.round(frame.getBoundingClientRect().width) };

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

export function CalchemyDemo() {
  const [calchemy, setCalchemy] = useState<CalchemyEngine | null>(null);
  const demoRootRef = useRef<HTMLDivElement>(null);
  const { visiblePeriods, placeholder } = useCalchemyDemoLayout(
    demoRootRef,
    calchemy !== null,
  );

  useEffect(() => {
    let cancelled = false;

    createCalchemy({
      defaultContext: {
        locale: "en-US",
        weekStartsOn: 0,
      },
    }).then((instance) => {
      if (!cancelled) {
        setCalchemy(instance);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!calchemy) {
    return (
      <div
        ref={demoRootRef}
        className={cx(calchemyDemoStyle, calchemyDemoLoadingStyle)}
        aria-busy="true"
        aria-hidden
      />
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
        <div className={inputRowStyle}>
          <CalendarIcon className={iconStyle} aria-hidden />
          <CalchemyUI.Field placeholder={placeholder} />
        </div>
        <CalchemyUI.Candidates />
        <CalchemyUI.Calendar
          key={visiblePeriods}
          period={{ months: visiblePeriods }}
        >
          <CalchemyCalendarNavPrevious />
          <CalchemyCalendarNavNext />
          <CalendarScroll direction="horizontal">
            <CalchemyUI.CalendarPeriodList>
              <CalchemyUI.CalendarPeriod>
                <CalchemyUI.CalendarPeriodHeading />
                <CalchemyUI.CalendarWeekdays weekdayFormat="narrow" />
                <CalchemyUI.CalendarGrid showBookends={false} />
              </CalchemyUI.CalendarPeriod>
            </CalchemyUI.CalendarPeriodList>
          </CalendarScroll>
        </CalchemyUI.Calendar>
      </div>
    </CalchemyUI.Root>
  );
}
