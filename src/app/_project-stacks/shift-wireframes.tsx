"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css, cx } from "../../../styled-system/css";
import { calendar } from "../../../styled-system/recipes";
import { ShiftFormFields } from "@/components/demo/shift-form-fields";
import { Calendar, type CalendarDateProps } from "@/components/ui/input/calendar";
import { Field } from "@/components/ui/input/field";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { Notice } from "@/components/ui/notice";
import { Tooltip } from "@/components/ui/tooltip";
import { Skeleton, Wireframe } from "@/components/ui/wireframe";
import BanIcon from "@/assets/icons/ban.svg";
import ChevronLeftIcon from "@/assets/icons/chevron-left.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";
import EditIcon from "@/assets/icons/edit.svg";
import GotoIcon from "@/assets/icons/goto.svg";
import InfoIcon from "@/assets/icons/info.svg";
import MapPinIcon from "@/assets/icons/map-pin.svg";
import SiteMapWireframe from "@/assets/wireframes/site-map.svg";
import {
  cardStyle,
  columnStyle,
  paneStyle,
  stepEyebrowStyle,
  stepNameStyle,
  stepsStyle,
  stepStyle,
  toggleStyle,
} from "./onboarding-wireframes";
import { Stage } from "./wireframe-stage";

const bodyStyle = css({ display: "flex", flexDirection: "column", gap: "lg", padding: "xl" });

const ARRANGEMENTS = [
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
];

const STEPS = [
  { name: "Shift information", state: "done" },
  { name: "Shift planning", state: "current" },
  { name: "Review", state: "pending" },
] as const;

// Beside the card, for each redline: a 4px gutter, the 8px mark, 4px, then the 20px badge.
const REDLINE_ROOM = 36;
const DRAWING_CARD_WIDTH = 560;
const DRAWING_WIDTH = DRAWING_CARD_WIDTH + 2 * REDLINE_ROOM;

interface Redline {
  label: string;
  side: "start" | "end";
  /** From the top of the card; the one view's columns' top by default. */
  top?: number;
  /** The solid run, from the top of the one view's columns. */
  spine: number;
  /** A dotted run-on past the fold; without it the spine closes with a foot tick. */
  tail?: number;
}

// The columns' own heights (300 and 268): the fields', solid for 60% and dotted for the 40% past the fold.
const REDLINES: Redline[] = [
  { label: "Shift information", side: "start", spine: 180, tail: 118 },
  { label: "Shift planning", side: "end", spine: 268 },
];

// Its own share of the column, measured for the drawing's scale: a transform takes no layout.
const figureStyle = css({
  flex: "1",
  minHeight: 0,
  width: "token(spacing.full)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "xxl",
});
// Widths arrive as variables: Panda can't extract a template literal.
const drawingBoxStyle = css({
  position: "relative",
  flex: "1",
  minHeight: 0,
  width: "calc(var(--drawing-width) * var(--fit))",
});
const drawingStyle = css({
  position: "absolute",
  insetBlockStart: "token(spacing.none)",
  insetInlineStart: "token(spacing.none)",
  display: "flex",
  justifyContent: "center",
  width: "var(--drawing-width)",
  height: "calc(100% / var(--fit))",
  transform: "scale(var(--fit))",
  transformOrigin: "top left",
});
const redlinedStyle = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  width: "var(--drawing-card-width)",
});

// The drawn card's width for the cards that aren't drawn: 1:1 on the wide column, its share of a narrower one.
const drawnWidthStyle = css({
  flex: "1",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  width: "min(var(--drawing-card-width), calc(100% * var(--drawing-card-share)))",
});
const DRAWN_WIDTH = {
  "--drawing-card-width": `${DRAWING_CARD_WIDTH}px`,
  "--drawing-card-share": DRAWING_CARD_WIDTH / DRAWING_WIDTH,
} as CSSProperties;

function DrawnWidth({ children }: { children: ReactNode }) {
  return (
    <div className={drawnWidthStyle} style={DRAWN_WIDTH}>
      {children}
    </div>
  );
}

const oneViewStyle = css({ display: "flex", alignItems: "flex-start", gap: "3xl", padding: "xl" });
const fieldColumnStyle = css({ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: "lg" });
const calendarColumnStyle = css({ flex: "none" });

// The Calendar's own slots, so a placeholder month is the size of a real one.
const labelNav = calendar({ navPlacement: "label" });
const edgeNav = calendar({ navPlacement: "edge" });
// Inside the nav slot, which `edge` sizes into a full-height scrim: the chevron button's footprint.
const chevronStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "token(sizes.toolbarButton)",
  height: "token(sizes.toolbarButton)",
  "& svg": { display: "block", width: "token(spacing.xxl)", height: "token(spacing.xxl)" },
});

function SkeletonNav({ slots, side }: { slots: ReturnType<typeof calendar>; side: "prev" | "next" }) {
  return (
    <span className={slots.nav} data-nav={side} aria-hidden>
      <span className={chevronStyle}>{side === "prev" ? <ChevronLeftIcon /> : <ChevronRightIcon />}</span>
    </span>
  );
}

/** A month as the Calendar lays it out: its name as a bar, over an empty weekday row and six empty weeks. */
function SkeletonMonth({ slots, name }: { slots: ReturnType<typeof calendar>; name: string }) {
  return (
    <div className={slots.period}>
      <div className={slots.month}>
        <Skeleton>{name}</Skeleton>
      </div>
      <div className={slots.week}>
        {Array.from({ length: 7 }, (_, i) => (
          // A blank line box, so the weekday row keeps its height.
          <span key={i} className={slots.weekday}>
            {" "}
          </span>
        ))}
      </div>
      <div className={slots.grid}>
        {Array.from({ length: 42 }, (_, i) => (
          <span key={i} className={slots.date} />
        ))}
      </div>
    </div>
  );
}

const redlinesStyle = css({
  position: "absolute",
  inset: 0,
  zIndex: 1,
  pointerEvents: "none",
  color: "field.text.active",
  transitionProperty: "opacity",
  transitionDuration: "200ms",
  transitionTimingFunction: "ease-out",
  "&[data-presented=false]": { opacity: 0 },
});
const redlineStyle = css({
  position: "absolute",
  // The one view's padding, so a mark opens level with its column.
  top: "xl",
  width: "token(spacing.md)",
  transitionProperty: "transform",
  transitionDuration: "260ms",
  transitionTimingFunction: "ease-out",
  "&[data-side=start]": {
    insetInlineStart: "calc(-1 * (token(spacing.md) + token(spacing.sm)))",
    "[data-presented=false] &": { transform: "translateX(-8px)" },
  },
  "&[data-side=end]": {
    insetInlineEnd: "calc(-1 * (token(spacing.md) + token(spacing.sm)))",
    "[data-presented=false] &": { transform: "translateX(8px)" },
  },
});
const redlineMarkStyle = css({ display: "block", "[data-side=end] &": { transform: "scaleX(-1)" } });
const badgeStyle = css({
  display: "flex",
  flex: "none",
  alignItems: "center",
  justifyContent: "center",
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  borderRadius: "full",
  borderWidth: "token(spacing.xxs)",
  borderStyle: "solid",
  borderColor: "field.text.active",
  textStyle: "bodySmall",
  lineHeight: "1",
  // Lifts the digit to optical centre.
  paddingBlockEnd: "token(spacing.xxs)",
  color: "field.text.active",
});
const redlineBadgeStyle = css({
  position: "absolute",
  transform: "translateY(-50%)",
  "[data-side=start] &": { insetInlineEnd: "calc(100% + token(spacing.sm))" },
  "[data-side=end] &": { insetInlineStart: "calc(100% + token(spacing.sm))" },
});
const legendStyle = css({
  flex: "none",
  maxWidth: "token(spacing.full)",
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "center",
  columnGap: "3xl",
  rowGap: "md",
  listStyle: "none",
  transitionProperty: "opacity",
  transitionDuration: "200ms",
  transitionTimingFunction: "ease-out",
  "&[data-presented=false]": { opacity: 0 },
});
const legendEntryStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  textStyle: "bodySmall",
  color: "field.text.active",
  whiteSpace: "nowrap",
});

/** One redline; only the stroke is `currentColor`. */
function RedlineMark({ spine, tail }: Redline) {
  const height = tail == null ? spine : spine + 2 + tail;
  // The `.375`s are the stroke's half-width, so the SVG renders at 1:1.
  const leader = `${spine / 2 + 0.375}`;
  const foot = tail == null ? `M8.375 ${spine + 0.375}H4.375V${leader}` : `M4.375 ${spine + 0.375}V${leader}`;
  return (
    <svg
      className={redlineMarkStyle}
      width="8.75"
      height={height + 0.75}
      viewBox={`0 0 8.75 ${height + 0.75}`}
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d={`M8.375 0.375H4.375V${leader}${foot}M4.375 ${leader}H0.375`}
        stroke="currentColor"
        strokeWidth="0.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {tail == null ? null : (
        <path
          d={`M4.375 ${height + 0.375}V${spine + 2.375}`}
          stroke="currentColor"
          strokeWidth="0.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1.5 1.5"
        />
      )}
    </svg>
  );
}

/** The drawing's scale: 1 until the column is narrower than it, its share of the column after. */
function useFit(width: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const measure = () => setFit(Math.min(1, box.clientWidth / width));
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    measure();
    return () => observer.disconnect();
  }, [width]);
  return [ref, fit] as const;
}

/** A part of the form before and after on a toggle, the Before's redlines numbered beside the card and in a legend. */
function RedlinedToggle({
  ariaLabel,
  redlines,
  before,
  after,
}: {
  ariaLabel: string;
  redlines: Redline[];
  before: ReactNode;
  after: ReactNode;
}) {
  const [arrangement, setArrangement] = useState("before");
  const showing = (which: string) => arrangement === which;
  const [figureRef, fit] = useFit(DRAWING_WIDTH);
  return (
    <Stage toggle>
      <div className={columnStyle} data-wide="">
        <SegmentedControl
          ariaLabel={ariaLabel}
          className={toggleStyle}
          options={ARRANGEMENTS}
          value={arrangement}
          onValueChange={setArrangement}
        />
        <div ref={figureRef} className={figureStyle}>
          <ol className={legendStyle} data-presented={showing("before")} aria-hidden={!showing("before")}>
            {redlines.map((redline, index) => (
              <li key={redline.label} className={legendEntryStyle}>
                <span className={badgeStyle} aria-hidden>
                  {index + 1}
                </span>
                {redline.label}
              </li>
            ))}
          </ol>
          <div
            className={drawingBoxStyle}
            style={
              {
                "--fit": fit,
                "--drawing-width": `${DRAWING_WIDTH}px`,
                "--drawing-card-width": `${DRAWING_CARD_WIDTH}px`,
              } as CSSProperties
            }
          >
            <div className={drawingStyle}>
              <div className={redlinedStyle}>
                <div className={redlinesStyle} data-presented={showing("before")} aria-hidden>
                  {redlines.map((redline, index) => (
                    <div
                      key={redline.label}
                      className={redlineStyle}
                      data-side={redline.side}
                      style={redline.top == null ? undefined : { top: `${redline.top}px` }}
                    >
                      <span className={cx(badgeStyle, redlineBadgeStyle)} style={{ top: `${redline.spine / 2}px` }}>
                        {index + 1}
                      </span>
                      <RedlineMark {...redline} />
                    </div>
                  ))}
                </div>
                <div className={cardStyle} data-panes="">
                  <div
                    className={paneStyle}
                    data-presented={showing("before")}
                    aria-hidden={!showing("before")}
                    inert={!showing("before")}
                  >
                    {before}
                  </div>
                  <div
                    className={paneStyle}
                    data-presented={showing("after")}
                    aria-hidden={!showing("after")}
                    inert={!showing("after")}
                  >
                    {after}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Stage>
  );
}

/** Every field in one view, running past the fold, or each part in a step of its own. */
export function StepsWireframe() {
  return (
    <RedlinedToggle
      ariaLabel="Shift form layout"
      redlines={REDLINES}
      before={
        <div className={oneViewStyle}>
          <Wireframe className={fieldColumnStyle} opacity={50}>
            <ShiftFormFields />
          </Wireframe>
          <Wireframe className={calendarColumnStyle} opacity={50}>
            <Field>
              <Field.Label>Scheduling calendar</Field.Label>
              <div className={labelNav.root}>
                <div className={labelNav.periodList}>
                  <SkeletonNav slots={labelNav} side="prev" />
                  <SkeletonMonth slots={labelNav} name="Dec 2026" />
                  <SkeletonNav slots={labelNav} side="next" />
                </div>
              </div>
            </Field>
          </Wireframe>
        </div>
      }
      after={
        <>
          <ol className={stepsStyle}>
            {STEPS.map((step, index) => (
              <li key={step.name} className={stepStyle} data-state={step.state}>
                <span className={stepEyebrowStyle}>Step {index + 1}</span>
                <span className={stepNameStyle}>{step.name}</span>
              </li>
            ))}
          </ol>
          <Wireframe className={bodyStyle} opacity={25}>
            <Field>
              <Field.Label>Scheduling calendar</Field.Label>
              <div className={cx(edgeNav.root, calendarStyle)}>
                <div className={edgeNav.periodList}>
                  <SkeletonNav slots={edgeNav} side="prev" />
                  <SkeletonMonth slots={edgeNav} name="Nov 2026" />
                  <SkeletonMonth slots={edgeNav} name="Dec 2026" />
                  <SkeletonMonth slots={edgeNav} name="Jan 2027" />
                  <SkeletonNav slots={edgeNav} side="next" />
                </div>
              </div>
            </Field>
          </Wireframe>
        </>
      }
    />
  );
}

// One heading line tall (`1lh`), so the glyph centres on the heading.
const noticeIconStyle = css.raw({
  display: "flex",
  alignItems: "center",
  textStyle: "bodySmall",
  height: "1lh",
  "& svg": { height: "token(spacing.xxl)" },
});
const noticeHeadingStyle = css.raw({ textStyle: "bodySmall" });
const noticeHintStyle = css({
  display: "flex",
  flexDirection: "column",
  marginBlockStart: "xs",
  textStyle: "sidenote",
  color: "field.text.muted",
});
const linkStyle = css({
  display: "flex",
  flex: "none",
  alignItems: "center",
  gap: "sm",
  textStyle: "bodySmall",
  color: "field.text.active",
  whiteSpace: "nowrap",
});
const glyphStyle = css({
  display: "block",
  flexShrink: 0,
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  "& svg": { display: "block", width: "token(spacing.full)", height: "token(spacing.full)" },
});
const positionFieldsStyle = css({ display: "flex", flexDirection: "column", gap: "xl" });
const positionRowStyle = css({ display: "flex", alignItems: "flex-start", gap: "xl" });
const narrowFieldStyle = css({ width: "133.75px", flexShrink: 0 });
const wideFieldStyle = css({ flex: "1 1 0", minWidth: 0 });
const disabledLabelStyle = css({ color: "field.text.default/50" });
const disabledFrameStyle = css({ opacity: 0.5 });
const banStyle = css({ marginInlineStart: "auto", color: "field.text.default/50" });
const textareaFrameStyle = css({ height: "68px", alignItems: "flex-start", paddingBlock: "6px" });
const textareaLinesStyle = css({ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" });

const DISABLED_ROWS = [
  [
    { label: "Site address", value: "60%", narrow: false },
    { label: "Unit", value: "44%", narrow: true },
  ],
  [
    { label: "Hourly wage", value: "54%", narrow: true },
    { label: "Department", value: "32%", narrow: false },
  ],
];

function DisabledField({
  label,
  frameClassName,
  children,
}: {
  label: string;
  frameClassName?: string;
  children: ReactNode;
}) {
  return (
    <>
      <Field.Label className={disabledLabelStyle}>{label}</Field.Label>
      <Field.Frame className={cx(disabledFrameStyle, frameClassName)}>
        {children}
        <span className={cx(glyphStyle, banStyle)} aria-hidden>
          <BanIcon />
        </span>
      </Field.Frame>
    </>
  );
}

const panelStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  borderRadius: "md",
  backgroundColor: "field.bg.default",
  boxShadow: "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
});
const panelHeaderStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "lg",
  height: "token(spacing.4xl)",
  paddingInline: "lg",
  borderBottomWidth: "token(spacing.3xs)",
  borderBottomStyle: "solid",
  borderBottomColor: "field.border.default",
});
const panelBodyStyle = css({ display: "flex", gap: "lg", paddingInline: "lg", paddingBlockEnd: "lg" });
const detailColumnStyle = css({ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: "md" });
const mapColumnStyle = css({ width: "208px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "lg" });
const detailStyle = css({ display: "flex", flexDirection: "column", "&[data-footer]": { marginBlockStart: "auto" } });
const detailLabelStyle = css({ textStyle: "sidenote", color: "field.text.muted", whiteSpace: "nowrap" });
const detailValueStyle = css({ display: "flex", flexDirection: "column", opacity: 0.5 });
// The SVG is the streets only (`currentColor`); the wash and ring are drawn here.
const mapStyle = css({
  position: "relative",
  width: "208px",
  height: "112px",
  flexShrink: 0,
  borderRadius: "sm",
  backgroundColor: "field.bg.default",
  boxShadow: "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
  color: "field.text.muted",
  "& > svg": { display: "block", width: "token(spacing.full)", height: "token(spacing.full)" },
});
const mapPinStyle = css({
  position: "absolute",
  insetBlockStart: "35px",
  insetInlineStart: "102px",
  color: "field.text.active",
});

function Detail({ label, footer, children }: { label: string; footer?: boolean; children: ReactNode }) {
  return (
    <span className={detailStyle} data-footer={footer ? "" : undefined}>
      <span className={detailLabelStyle}>{label}</span>
      <span className={detailValueStyle}>{children}</span>
    </span>
  );
}

/** Where the disabled fields sit in the card, at 1:1 (a transform takes no layout), for the redlines beside them. */
function useFieldsSpan() {
  const ref = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState({ top: 0, height: 0 });
  useLayoutEffect(() => {
    const fields = ref.current;
    const card = fields?.closest<HTMLElement>("[data-panes]");
    if (!fields || !card) return;
    const measure = () => {
      let top = 0;
      for (let node: HTMLElement | null = fields; node && node !== card; node = node.offsetParent as HTMLElement | null)
        top += node.offsetTop;
      setSpan({ top, height: fields.offsetHeight });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(fields);
    measure();
    return () => observer.disconnect();
  }, []);
  return [ref, span] as const;
}

/** Reference-only position details in disabled fields, or consolidated into a card with a map of the site. */
export function PositionsWireframe() {
  const [fieldsRef, { top, height }] = useFieldsSpan();
  return (
    <RedlinedToggle
      ariaLabel="Position details layout"
      redlines={[
        { label: "Disabled fields", side: "start", top, spine: height },
        { label: "Poor hierarchy", side: "end", top, spine: height },
      ]}
      before={
        <div className={bodyStyle}>
          <Notice>
            <Notice.Icon css={noticeIconStyle}>
              <InfoIcon />
            </Notice.Icon>
            <Notice.Label css={noticeHeadingStyle}>
              <strong>Default job position</strong>
              <span className={noticeHintStyle}>
                <Skeleton width="97%" />
                <Skeleton width="21%" />
              </span>
            </Notice.Label>
            <span className={linkStyle}>
              <span className={glyphStyle} aria-hidden>
                <EditIcon />
              </span>
              Edit position
            </span>
          </Notice>
          <div ref={fieldsRef} className={positionFieldsStyle}>
            {DISABLED_ROWS.map((row) => (
              <div key={row[0].label} className={positionRowStyle}>
                {row.map(({ label, value, narrow }) => (
                  <Field key={label} className={narrow ? narrowFieldStyle : wideFieldStyle}>
                    <DisabledField label={label}>
                      <Skeleton width={value} />
                    </DisabledField>
                  </Field>
                ))}
              </div>
            ))}
            <Field>
              <DisabledField label="Entrance instructions" frameClassName={textareaFrameStyle}>
                <span className={textareaLinesStyle}>
                  <Skeleton width="91%" />
                  <Skeleton width="14%" />
                </span>
              </DisabledField>
            </Field>
          </div>
        </div>
      }
      after={
        <div className={bodyStyle}>
          <div className={panelStyle}>
            <div className={panelHeaderStyle}>
              <Skeleton width="27%" />
              <span className={linkStyle}>
                View position
                <span className={glyphStyle} aria-hidden>
                  <GotoIcon />
                </span>
              </span>
            </div>
            <div className={panelBodyStyle}>
              <div className={detailColumnStyle}>
                <Detail label="Site location">
                  <Skeleton width="72%" />
                  <Skeleton width="17%" />
                </Detail>
                <span className={cx(detailValueStyle, noticeHintStyle)}>
                  <Skeleton width="90%" />
                  <Skeleton width="19%" />
                </span>
                <Detail label="Hourly wage" footer>
                  <Skeleton width="30%" />
                </Detail>
              </div>
              <div className={mapColumnStyle}>
                <span className={mapStyle}>
                  <SiteMapWireframe aria-hidden />
                  <span className={cx(glyphStyle, mapPinStyle)} aria-hidden>
                    <MapPinIcon />
                  </span>
                </span>
                <Detail label="Department" footer>
                  <Skeleton width="80%" />
                </Detail>
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
}

const FIRST_SHIFT = Temporal.PlainDate.from("2026-12-01");
const CHRISTMAS = Temporal.PlainDate.from("2026-12-25");

// Wider than the card can hold, so December sits in the middle and its neighbours crop evenly at the edges.
const calendarStyle = css({ width: "token(spacing.full)" });
// Blanks spill days; `visibility`, not `display`, so the grid keeps six rows.
const dateStyle = css({ "&[data-outside]": { visibility: "hidden" } });

// Posted: December's weekdays to the 18th. Mid-edit, all in December, the calendar's whole middle month: the 11th
// cancelled, and the schedule run on to the month's end, Christmas Day left off.
const DECEMBER_WEEKDAYS = Array.from({ length: 31 }, (_, i) => FIRST_SHIFT.add({ days: i })).filter(
  (date) => date.dayOfWeek <= 5,
);
const POSTED = DECEMBER_WEEKDAYS.filter((date) => date.day <= 18);
const POSTED_KEYS = new Set(POSTED.map(String));
const MID_EDIT = DECEMBER_WEEKDAYS.filter((date) => date.day !== 11 && !date.equals(CHRISTMAS));

/** How a date stands against the posted schedule: kept (none), added, or cancelled. */
function editOf(key: string, chosen: ReadonlySet<string>) {
  if (chosen.has(key)) return POSTED_KEYS.has(key) ? undefined : "added";
  return POSTED_KEYS.has(key) ? "cancelled" : undefined;
}

const EditedDates = createContext<ReadonlySet<string>>(new Set());

// Kept dates are the calendar's own selection; added ones the brand's solid fill; cancelled ones the comparison
// table's hatching, struck through.
const HATCH =
  "linear-gradient(-45deg, token(colors.border.divider) 0 token(spacing.3xs), transparent token(spacing.3xs) calc(50% - token(spacing.3xs)), token(colors.border.divider) calc(50% - token(spacing.3xs)) calc(50% + token(spacing.3xs)), transparent calc(50% + token(spacing.3xs)) calc(100% - token(spacing.3xs)), token(colors.border.divider) calc(100% - token(spacing.3xs)))";
const editDateStyle = css({
  "&[data-edit=added]": { backgroundColor: "text.highlight", color: "bg.canvas" },
  "&[data-edit=added]::after": { borderWidth: 0 },
  "&[data-edit=cancelled]": {
    backgroundImage: HATCH,
    backgroundSize: "token(spacing.lg) token(spacing.lg)",
    color: "text.body",
    textDecoration: "line-through",
  },
});
const editLegendStyle = css({
  display: "flex",
  flexWrap: "wrap",
  columnGap: "xl",
  rowGap: "sm",
  textStyle: "bodySmall",
  color: "text.body",
  "& > span": { display: "inline-flex", alignItems: "center", gap: "sm" },
  "& i": {
    flexShrink: 0,
    width: "token(spacing.lg)",
    height: "token(spacing.lg)",
    borderRadius: "xs",
  },
  "& i[data-edit=kept]": {
    backgroundColor: "field.bg.active",
    boxShadow: "inset 0 0 0 token(spacing.3xs) token(colors.field.border.active)",
  },
  "& i[data-edit=added]": { backgroundColor: "text.highlight" },
  "& i[data-edit=cancelled]": {
    backgroundImage: HATCH,
    backgroundSize: "token(spacing.lg) token(spacing.lg)",
    boxShadow: "inset 0 0 0 token(spacing.3xs) token(colors.border.divider)",
  },
});

/** A day in the edit, marked as it stands against what was posted. */
function EditDate({ cell, className, ...rest }: CalendarDateProps) {
  const chosen = useContext(EditedDates);
  const edit = cell?.inCurrentMonth ? editOf(cell.key, chosen) : undefined;
  return <Calendar.Date cell={cell} className={cx(dateStyle, editDateStyle, className)} data-edit={edit} {...rest} />;
}

function EditScheduleBody() {
  const [shifts, setShifts] = useState<Temporal.PlainDate[]>(MID_EDIT);
  const chosen = new Set(shifts.map(String));
  const kept = POSTED.filter((date) => chosen.has(String(date))).length;
  const counts = {
    kept,
    added: shifts.filter((date) => !POSTED_KEYS.has(String(date))).length,
    cancelled: POSTED.length - kept,
  };
  return (
    <div className={bodyStyle}>
      <Field>
        <Field.Label>Edit schedule</Field.Label>
        <EditedDates.Provider value={chosen}>
          <Calendar
            className={calendarStyle}
            selectionMode="multiple"
            values={shifts}
            onValuesChange={setShifts}
            defaultView={FIRST_SHIFT.subtract({ months: 1 })}
            months={3}
            // Steps one month, so a run drawn across a boundary stays on screen.
            step={1}
            navPlacement="edge"
          >
            <Calendar.PeriodList>
              <Calendar.Tooltip>
                <Tooltip.Text>Drag to select multiple</Tooltip.Text>
              </Calendar.Tooltip>
              <Calendar.Prev>
                <ChevronLeftIcon />
              </Calendar.Prev>
              <Calendar.Period>
                <Calendar.Month monthFormat="narrow" />
                <Calendar.Week>
                  <Calendar.Day />
                </Calendar.Week>
                <Calendar.Grid>
                  <EditDate />
                </Calendar.Grid>
              </Calendar.Period>
              <Calendar.Next>
                <ChevronRightIcon />
              </Calendar.Next>
            </Calendar.PeriodList>
          </Calendar>
        </EditedDates.Provider>
        <Field.Hint>Drag across dates to extend the schedule, or click a date to cancel it</Field.Hint>
      </Field>
      <div className={editLegendStyle} role="status" aria-live="polite">
        <span>
          <i data-edit="kept" aria-hidden />
          {counts.kept} regular
        </span>
        <span>
          <i data-edit="added" aria-hidden />
          {counts.added} added
        </span>
        <span>
          <i data-edit="cancelled" aria-hidden />
          {counts.cancelled} cancelled
        </span>
      </div>
    </div>
  );
}

/** A posted shift's schedule reopened in the calendar, live: drag on past its end, click a date off. */
export function EditScheduleWireframe() {
  return (
    <Stage low>
      <div className={columnStyle} data-wide="">
        <DrawnWidth>
          <div className={cardStyle}>
            <EditScheduleBody />
          </div>
        </DrawnWidth>
      </div>
    </Stage>
  );
}
