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

// ---------------------------------------------------------------------------
// The Calchemy demo — the playground, in a card.
//
// It is the same instrument: the same engine, the same `useCalchemyQuery` state
// machine, the same readings row, and the app's own Calendar. What differs is
// only what a card can hold. The playground gives a phrase a century to answer
// in and scrolls to the answer; this gives it one to three months and MOVES to
// the month the answer falls in. Everything else — previewing a reading, Enter
// to settle on it, an unparseable phrase meaning an empty selection rather than
// an error — is the shared hook's, so the two cannot drift apart.
//
// It was built on `@calchemy/date-react` and is not any more: that package was
// unpublished, and everything it drew this repo now draws better with its own
// primitives.
// ---------------------------------------------------------------------------

const WIDE_MONTHS = 3;
const NARROW_MONTHS = 2;
const COMPACT_MONTHS = 1;
const DEMO_FRAME_WIDE_MIN_WIDTH = 761;
const DEMO_FRAME_MEDIUM_MIN_WIDTH = 536;
const PLACEHOLDER_WIDE = 'Try "Mondays and Fridays next month"';
const PLACEHOLDER_COMPACT = 'Try "Mondays next month"';

/**
 * How far the bar and the chevrons stand off the frame's edges — `spacing.lg`,
 * which is the inset the frame's own furniture uses (see `demoFrameControls`,
 * 12px in so its corner and the frame's stay concentric).
 */
const EDGE_INSET = "token(spacing.lg)";

// The playground, at the size of a frame: the months take the middle, and the
// bar they are talked to through sits at the foot. No card — the playground has
// no card, and a surface behind the months would be a second panel inside the
// frame that is already one.
//
// It FILLS the frame (the registry asks for `fill`, which is what hands it the
// demo area instead of the intrinsic-size wrapper that would hug it), and then
// gives the area's 20px padding band back: the bar and the chevrons sit on the
// FRAME's own 12px inset, not on the band's inner edge, and a demo centred
// inside the band could never reach it.
//
// The band's foot is the one asymmetric side — 12px under a logger, where the
// panel below has an inset of its own — so it is given back by the measure the
// area actually took.
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
    // That frame also SIZES its children to the area's content width, which
    // held the demo 20px short on the right while the negative margin above
    // pulled it 20px past on the left — the band given back on one side only.
    // Handed back to `align-self: stretch`, which measures the MARGIN box and
    // so takes the negative pair into account. Said from here rather than on
    // the class alone: these and the recipe's are the same specificity, and
    // the recipe is written later.
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

// The months take the slack and centre in it — centre stage, with the bar
// below holding only the height it needs.
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
  // The Calendar's own field surface, withdrawn — `yearStyle`'s bargain in the
  // playground, for the same reason: the months are the picture, and the panel
  // they sit on is one the frame already provides.
  backgroundColor: "transparent",
  "&::after": { content: "none" },
});

// The playground's bar, minus everything a frame has no room to say. What is
// left is the phrase itself: no kinds control (the demo asks for `multiple`,
// which is the interesting one), no way into a settings rail, and no scrim to
// float over. The pill is the same pill.
// The chevrons flank the FRAME rather than the months.
//
// A nav dropped straight into `Calendar.PeriodList` is pinned by the recipe to
// that list's own edge. The rule is scoped to DIRECT children precisely so a
// consumer can take them back: nested in chrome of its own, a nav stays in the
// flow and is placed by whatever it is nested in. So each is wrapped and
// positioned against the calendar's own box, which now spans the demo — 10px
// off that edge, and centred on it, which is centring on the months because
// they are centred in it too.
// The months keep clear of the chevrons that flank them. `edge` placement buys
// this with a scrim that fades the outer columns UNDER the chevron; on a
// transparent calendar there is nothing to fade to, so the room is made
// instead.
//
// Derived from the chevron rather than taken from `calendarNavZone` (72px, the
// zone the recipe reserves for a scrim as well): its own inset, its own 28px
// chip and a gap after it. The recipe's number would leave a one-month frame
// 214px for a 208px month, which is a fit with nothing in hand.
const periodListStyle = css({
  paddingInline: `calc(${EDGE_INSET} + token(sizes.toolbarButton) + token(spacing.md))`,
  // Air between the months. The list packs them with nothing between by
  // default, which is right in a popover a single month wide and too tight
  // across a run — three grids of numbers abutting read as one grid. Each
  // period still carries its own 8px inset, so the distance between the day
  // columns either side of a seam is this plus 16.
  gap: "xxl",
});

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
  // Clear of the frame's own rounded corners at the sides, too.
  maxWidth: "calc(token(spacing.full) - 2 * token(spacing.lg))",
  borderRadius: "md",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "field.border.default",
  backgroundColor: "bg.surface",
  "--colors-field-bg-default": "var(--colors-field-bg-default-on-surface)",
  // The elevation every other floating surface here carries.
  boxShadow:
    "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
  // The glyph is `currentColor`, so the row owns its hue.
  color: "field.text.default",
});

// The readings sit ABOVE the phrase here, where the playground puts them
// between its kinds row and its query row. First in the pill, though, so the
// rule they carry would land on the pill's own edge — it comes off, and the
// query row below draws it instead (that row rules against whatever is above
// it, and against nothing when it is alone).
const readingsStyle = css({
  borderTopWidth: 0,
});

/** How many months the card can hold, and what to suggest typing into it. */
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

    // Compared by RESOLVED TIER rather than by width: every width change WITHIN
    // a tier is a re-render avoided, and returning `current` unchanged is what
    // makes React bail out — which matters because this watches the frame, and
    // the frame's height moves with its own content.
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

/** A snapshot that changes only when the ANSWER does, not on every keystroke. */
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

/**
 * An empty box is not a mistake — it is a box waiting to be typed in — so the
 * error it reports is not one the reader can act on.
 */
function actionableErrors(result: ParseDateResult) {
  if (result.status !== "invalid") return [];
  return result.errors.filter((error) => error.code !== "empty-input");
}

/** Mirrors the parse into the frame's console, and draws nothing itself. */
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

// The engine (which lazily imports the Temporal polyfill) is created once and
// cached, so `prepareCalchemyDemo()` can warm it during the demo's load — the
// demo frame's preloader then covers this init too and the component mounts
// ready, with no second internal spinner.
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

/** Warms the Calchemy engine so the demo can render synchronously once loaded. */
export function prepareCalchemyDemo(): Promise<void> {
  return acquireCalchemyEngine().then(() => undefined);
}

/** Test-only: drops the cached engine so cases can exercise the loading state. */
export function __resetCalchemyDemoCache(): void {
  cachedCalchemyEngine = null;
  calchemyEnginePromise = null;
}

function CalchemyCard({ engine }: { engine: CalchemyEngine }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { months, placeholder } = useDemoLayout(rootRef, true);
  const phrase = useCalchemyQuery(engine, PARSE_CONTEXT);

  // Parsed a second time, for the log alone. The hook's own note applies: a
  // phrase costs microseconds, and two of those a keystroke is not a budget
  // worth threading a raw result back through the shared state machine for.
  const result = useMemo(
    () => engine.parseDate(phrase.query, PARSE_CONTEXT),
    [engine, phrase.query],
  );
  useParseLog(result, engine);

  // Where the run of months OPENS. The answer's month, held back so it sits in
  // the middle of a wider run rather than at its leading edge — and used as the
  // Calendar's `key`, which is what MOVES the run when a phrase is answered
  // somewhere else. Remounting costs nothing here (no scroll position to keep)
  // and buys the chevrons an uncontrolled view they can page freely between
  // answers, which a controlled `view` would have to hold state to allow.
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
          // Fills the frame instead of hugging its months — the playground's
          // own bargain at its own width, and the recipe's way of saying it, so
          // the slack goes into the gutters between the day columns and never
          // into the cells. It is also what carries the chevrons out to the
          // frame's edges: they are positioned against the calendar's box, so
          // that box has to be the width they should flank.
          fluid
          selectionMode="multiple"
          // The days a PHRASE means, not a selection the reader is building —
          // the calendar is the answer being drawn, so there is nothing here
          // for a click to toggle.
          values={phrase.dates}
          defaultView={opening}
          months={months}
          // The parser counts weekdays from zero and the Calendar names them —
          // the same Sunday, said twice, so they are stated together.
          weekStartsOn="sun"
          // `label` is the placement without a scrim; where the chevrons
          // actually land is said in `calendarStyle`.
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
      {/* The bar the months are talked to through, at the foot as it is on the
          playground — the readings above the phrase, and nothing else in it. */}
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

  // Nothing date-shaped until the engine lands, which also keeps "today" off
  // the server: it is read from the client's clock, and a server in another
  // zone would hand React markup to hydrate against that disagrees about which
  // cell is today.
  if (!engine) {
    return (
      <div className={loadingStyle} aria-busy="true">
        <DemoPreloader />
      </div>
    );
  }

  return <CalchemyCard engine={engine} />;
}
