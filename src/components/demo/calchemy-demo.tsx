"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  createCalchemy,
  type Calchemy as CalchemyEngine,
  type ParseDateResult,
} from "@calchemy/date-core";
import { css, cx } from "../../../styled-system/css";
import { Calendar } from "@/components/ui/input/calendar";
import { Field } from "@/components/ui/input/field";
import { CalchemyReadings } from "@/components/calchemy-readings";
import { CalchemyQueryField } from "@/components/calchemy-query-field";
import { CalchemySuggestion } from "@/components/calchemy-suggestion";
import { useCalchemyQuery } from "@/hooks/use-calchemy-query";
import { DemoPreloader } from "@/components/demo-component";
import ChevronLeftIcon from "@/assets/icons/chevron-left.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";
import { formatLoggerJson, useDemoLogger } from "@/hooks/use-demo-logger";

const WIDE_MONTHS = 3;
const NARROW_MONTHS = 2;
const COMPACT_MONTHS = 1;
const DEMO_FRAME_WIDE_MIN_WIDTH = 761;
const DEMO_FRAME_MEDIUM_MIN_WIDTH = 536;
const PLACEHOLDER_WIDE = 'Try "Mondays and Fridays next month"';
const PLACEHOLDER_COMPACT = 'Try "Mondays next month"';

/** The inset the frame's own furniture uses (see `demoFrameControls`). */
const EDGE_INSET = "token(spacing.lg)";

// Gives back the demo area's padding band so the bar and chevrons sit on the frame's 12px inset.
const demoStyle = css({
  display: "flex",
  flexDirection: "column",
  flex: "1 1 auto",
  minHeight: 0,
  alignSelf: "stretch",
  marginInline: "calc(-1 * token(spacing.xxl))",
  marginBlockStart: "calc(-1 * token(spacing.xxl))",
  marginBlockEnd: "calc(-1 * token(spacing.xxl))",
  ".demo-frame__demo-area--logger_true > &": {
    marginBlockEnd: "calc(-1 * token(spacing.lg))",
    // `auto` lets `align-self: stretch` count the negative margins; the recipe, of equal
    // specificity, is written later, so this is stated here.
    width: "auto",
    maxWidth: "none",
  },
});

const loadingStyle = css({
  width: "token(spacing.full)",
  minHeight: "calc(token(spacing.4xl) + token(spacing.5xl) * 3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const calendarSlotStyle = css({
  position: "relative",
  flex: "1 1 auto",
  minHeight: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "token(spacing.full)",
});

const calendarStyle = css({
  backgroundColor: "transparent",
  "&::after": { content: "none" },
});

// Room for the chevrons: their inset, their chip and a gap (the recipe's 72px zone is too wide for one month).
const periodListStyle = css({
  paddingInline: `calc(${EDGE_INSET} + token(sizes.toolbarButton) + token(spacing.md))`,
  gap: "xxl",
});

// Wrapped, so the recipe's direct-child pinning lets go and the navs flank the calendar's box.
const navStyle = css({
  position: "absolute",
  insetBlockStart: "50%",
  translate: "0 -50%",
});

const navPrevStyle = css({ insetInlineStart: EDGE_INSET });
const navNextStyle = css({ insetInlineEnd: EDGE_INSET });

const barStyle = css({
  display: "flex",
  flexDirection: "column",
  width: "min(480px, token(spacing.full))",
  flexShrink: 0,
  marginInline: "auto",
  marginBlockEnd: EDGE_INSET,
  maxWidth: "calc(token(spacing.full) - 2 * token(spacing.lg))",
  borderRadius: "md",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "field.border.default",
  backgroundColor: "bg.surface",
  "--colors-field-bg-default": "var(--colors-field-bg-default-on-surface)",
  boxShadow:
    "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
  color: "field.text.default",
});

// The query row below draws this rule instead.
const readingsStyle = css({
  borderTopWidth: 0,
});

function demoLayout(frameWidth: number): {
  months: number;
  placeholder: string;
} {
  if (frameWidth < DEMO_FRAME_MEDIUM_MIN_WIDTH)
    return { months: COMPACT_MONTHS, placeholder: PLACEHOLDER_COMPACT };
  if (frameWidth < DEMO_FRAME_WIDE_MIN_WIDTH)
    return { months: NARROW_MONTHS, placeholder: PLACEHOLDER_WIDE };
  return { months: WIDE_MONTHS, placeholder: PLACEHOLDER_WIDE };
}

function useDemoLayout(
  rootRef: RefObject<HTMLDivElement | null>,
  ready: boolean,
) {
  const [layout, setLayout] = useState(() =>
    demoLayout(DEMO_FRAME_WIDE_MIN_WIDTH),
  );

  useEffect(() => {
    if (!ready) return;
    const frame = rootRef.current?.closest(".demo-frame");
    if (!frame) return;

    // Compared by tier, so a width change within one returns `current` and React bails out.
    const update = () => {
      const next = demoLayout(frame.getBoundingClientRect().width);
      setLayout((current) => (current.months === next.months ? current : next));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [ready, rootRef]);

  return layout;
}

/** Changes only when the answer does, not on every keystroke. */
function parseSnapshot(
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

function actionableErrors(result: ParseDateResult) {
  if (result.status !== "invalid") return [];
  return result.errors.filter((error) => error.code !== "empty-input");
}

function useParseLog(result: ParseDateResult | null, calchemy: CalchemyEngine) {
  const logger = useDemoLogger();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (!result) return;
    const snapshot = parseSnapshot(result, calchemy);
    if (snapshot === previous.current) return;
    previous.current = snapshot;

    switch (result.status) {
      case "valid":
        logger.setStatus(
          "log",
          `✓ valid\n${formatLoggerJson(calchemy.toJSON(result.value))}`,
        );
        return;
      case "ambiguous":
        logger.setStatus(
          "warn",
          result.candidates.map((candidate) => candidate.label).join(", "),
        );
        return;
      case "invalid": {
        const errors = actionableErrors(result);
        if (errors.length === 0) {
          logger.clearStatus();
          return;
        }
        logger.setStatus(
          "error",
          `✕ invalid\n${errors.map((error) => error.message).join("; ")}`,
        );
      }
    }
  }, [result, calchemy, logger]);
}

// Cached so `prepareCalchemyDemo()` can warm it under the frame's preloader.
let cachedCalchemyEngine: CalchemyEngine | null = null;
let calchemyEnginePromise: Promise<CalchemyEngine> | null = null;

const PARSE_CONTEXT = { locale: "en-US", weekStartsOn: 0 as const };

function acquireCalchemyEngine(): Promise<CalchemyEngine> {
  if (cachedCalchemyEngine) return Promise.resolve(cachedCalchemyEngine);
  if (!calchemyEnginePromise) {
    calchemyEnginePromise = createCalchemy({
      defaultContext: PARSE_CONTEXT,
    }).then((instance) => {
      cachedCalchemyEngine = instance;
      return instance;
    });
  }
  return calchemyEnginePromise;
}

/** Warms the engine so the demo mounts ready. */
export function prepareCalchemyDemo(): Promise<void> {
  return acquireCalchemyEngine().then(() => undefined);
}

/** Test-only: drops the cached engine. */
export function __resetCalchemyDemoCache(): void {
  cachedCalchemyEngine = null;
  calchemyEnginePromise = null;
}

function CalchemyCard({ engine }: { engine: CalchemyEngine }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { months, placeholder } = useDemoLayout(rootRef, true);
  const phrase = useCalchemyQuery(engine, PARSE_CONTEXT);

  const result = useMemo(
    () => engine.parseDate(phrase.query, PARSE_CONTEXT),
    [engine, phrase.query],
  );
  useParseLog(result, engine);

  // The run opens with the answer's month centred; as the Calendar's `key`, it moves the run.
  const answer = phrase.dates[0];
  const opening = answer
    ? answer.with({ day: 1 }).subtract({ months: Math.floor((months - 1) / 2) })
    : undefined;

  return (
    <div ref={rootRef} className={demoStyle}>
      <Field className={calendarSlotStyle}>
        <Calendar
          key={opening?.toString() ?? "today"}
          className={calendarStyle}
          // Fills the frame, so the chevrons (positioned against its box) reach the frame's edges.
          fluid
          selectionMode="multiple"
          values={phrase.dates}
          defaultView={opening}
          months={months}
          // Matches the parser's `weekStartsOn: 0`.
          weekStartsOn="sun"
          navPlacement="label"
        >
          <div className={cx(navStyle, navPrevStyle)}>
            <Calendar.Prev>
              <ChevronLeftIcon />
            </Calendar.Prev>
          </div>
          <div className={cx(navStyle, navNextStyle)}>
            <Calendar.Next>
              <ChevronRightIcon />
            </Calendar.Next>
          </div>
          <Calendar.PeriodList className={periodListStyle}>
            <Calendar.Period>
              <Calendar.Month />
              <Calendar.Week>
                <Calendar.Day />
              </Calendar.Week>
              <Calendar.Grid>
                <Calendar.Date />
              </Calendar.Grid>
            </Calendar.Period>
          </Calendar.PeriodList>
        </Calendar>
      </Field>
      <div className={barStyle}>
        <CalchemyReadings query={phrase} className={readingsStyle} />
        <CalchemySuggestion query={phrase} />
        <CalchemyQueryField query={phrase} placeholder={placeholder} />
      </div>
    </div>
  );
}

export function CalchemyDemo() {
  const [engine, setEngine] = useState<CalchemyEngine | null>(
    cachedCalchemyEngine,
  );

  useEffect(() => {
    if (engine) return;

    let cancelled = false;
    acquireCalchemyEngine().then((instance) => {
      if (!cancelled) setEngine(instance);
    });

    return () => {
      cancelled = true;
    };
  }, [engine]);

  // Nothing date-shaped until the engine lands, which also keeps "today" off the server.
  if (!engine) {
    return (
      <div className={loadingStyle} aria-busy="true">
        <DemoPreloader />
      </div>
    );
  }

  return <CalchemyCard engine={engine} />;
}
