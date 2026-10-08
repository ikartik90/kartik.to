"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { Temporal } from "@js-temporal/polyfill";
import { css } from "../../../styled-system/css";
import { DemoComponent } from "@/components/demo-component";
import { DemoFrame } from "@/components/demo-frame";
import { DemoControlsLabels } from "@/components/demo/demo-controls";
import { getDemoComponent } from "@/components/demo/registry";
import { markerStyle } from "./diagram-parts";
import { featureBodyStyle } from "./feature-grid";
import { itemStyle, markIconStyle, markSlotStyle, Split, subheadingStyle } from "./gap-split";
import { MetricCard } from "./metric-card";
import { Head } from "./sheet-article";
import { SHIFT } from "./shift-content";

// The shift scheduling UX gap: the issue as headed points over a live tally of the v0 demo's clicks and dates, beside
// the published v0 demo, bare on the dots. Its demo parts serve the concept testing too (shift-concepts.tsx).

/** A tear's zigzag (8 teeth, as `ShiftFormShell` draws it) filled on one side, as a mask's image. */
function tearFill(width: number, height: number, x0: number, ys: [number, number], side: "above" | "below") {
  const step = (width - 2 * x0) / 16;
  const zigzag = Array.from({ length: 17 }, (_, i) => `${(x0 + i * step).toFixed(3)},${ys[i % 2]}`);
  const points =
    side === "above"
      ? [`0,0`, `${width},0`, `${width},${ys[0]}`, ...zigzag.reverse(), `0,${ys[0]}`]
      : [`0,${ys[0]}`, ...zigzag, `${width},${ys[0]}`, `${width},${height}`, `0,${height}`];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><polygon points="${points.join(" ")}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Each edge's fill runs past the middle of its tear's line by its stroke, so the mask doesn't cut the line in half.
const TEAR_FILLS = {
  "--header-tear": tearFill(615.462, 21.1273, 0.23079, [1.364, 21.364], "above"),
  "--footer-tear": tearFill(616, 21.3874, 0.5, [19.764, -0.236], "below"),
} as CSSProperties;

// No border and no ground of its own, so the demo sits on the dots; the shell's header and footer filled with the
// ground the frame gave them, down to their tears. Found by their tears' drawn bands (`headerWrapStyle`,
// `footerWrapStyle` in shift-form-shell.tsx), as the shell sits at a different depth in each demo. No `&` in the
// matched text: Panda takes it for this class.
const bareFrameStyle = css({
  backgroundColor: "transparent",
  // The demo's controls in words (`DemoControlsLabels`), out of the frame's corner to under the dialog, always shown:
  // Reset, Play/Stop and the hint centred together; the hint on a line of its own where they don't fit on one.
  "& [role=toolbar][aria-label='Demo controls']": {
    position: "static",
    opacity: 1,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    columnGap: "md",
    rowGap: "sm",
    marginBlockStart: "3xl",
    whiteSpace: "nowrap",
    "& > *": { flexShrink: 0 },
    "& > [data-control=hint]": { textStyle: "bodySmall", color: "text.body" },
    // The sheet's Close button (`icon`, `accent`) with its words: a secondary pill, the brand's under the pointer.
    "& > [data-control=transport]": {
      borderRadius: "full",
      textStyle: "bodySmall",
      _hover: { backgroundColor: "bg.button.accent.hover", color: "field.text.active" },
      _active: { backgroundColor: "bg.button.accent.hover", color: "field.text.active" },
    },
    // The frosted buttons' blur (`action`'s `data-floating`); Panda's `backdropFilter` emits only the -webkit- form.
    "& > button": {
      backdropFilter: "blur(token(spacing.md))",
      // @ts-expect-error -- css() has no type for the unprefixed form, which Chromium reads.
      "backdrop-filter": "blur(token(spacing.md))",
    },
  },
  "& :is([class*='::after]:bg-i_url'], [class*='::before]:bg-i_url'])": {
    backgroundColor: "bg.canvas",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  },
  "& [class*='::after]:bg-i_url']": {
    maskImage: "linear-gradient(black, black), var(--header-tear)",
    WebkitMaskImage: "linear-gradient(black, black), var(--header-tear)",
    maskSize: "100% calc(100% - token(spacing.xxl)), 100% token(spacing.xxl)",
    WebkitMaskSize: "100% calc(100% - token(spacing.xxl)), 100% token(spacing.xxl)",
    maskPosition: "top, bottom",
    WebkitMaskPosition: "top, bottom",
  },
  "& [class*='::before]:bg-i_url']": {
    maskImage: "var(--footer-tear), linear-gradient(black, black)",
    WebkitMaskImage: "var(--footer-tear), linear-gradient(black, black)",
    maskSize: "100% token(spacing.xxl), 100% calc(100% - token(spacing.xxl))",
    WebkitMaskSize: "100% token(spacing.xxl), 100% calc(100% - token(spacing.xxl))",
    maskPosition: "top, bottom",
    WebkitMaskPosition: "top, bottom",
  },
});

/** An article demo, bare on the dots. */
function BareDemo({ id }: { id: string }) {
  const demo = getDemoComponent(id)!;
  return (
    <DemoFrame aspectRatio={demo.aspectRatio} chrome="none" className={bareFrameStyle} style={TEAR_FILLS}>
      <DemoControlsLabels.Provider value={SHIFT.demoControls}>
        <DemoComponent entry={demo} aspect={demo.aspectRatio} />
      </DemoControlsLabels.Provider>
    </DemoFrame>
  );
}

/* The tally: the clicks a demo's form took, the cursor tour's or the visitor's, and the dates they scheduled. */

export interface Tally {
  clicks: number;
  dates: number;
}

/** How a demo's dates are read: v1's off its recurrence summary, v0's and v2's off the calendar's selected dates. */
export type DateCount = "recurrence" | "calendar";

export const NO_TALLY: Tally = { clicks: 0, dates: 0 };
const CONTROLS = "[role=toolbar][aria-label='Demo controls']";
// What a press acts on: one on the dialog's ground or its words is no click.
const PRESSABLE = "button, input, [role=switch]";

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]; // prettier-ignore

/** v1's `formatFull`: "Tuesday, 1 December, 2026". */
function parseFull(text: string) {
  const match = /(\d{1,2}) (\w+), (\d{4})$/.exec(text);
  const month = match ? MONTH_NAMES.indexOf(match[2]) + 1 : 0;
  return match && month ? Temporal.PlainDate.from({ year: Number(match[3]), month, day: Number(match[1]) }) : null;
}

/** v1's shifts, off its summary: the first shift alone, or every named weekday from it to the last, while it repeats. */
function recurringDates(pane: HTMLElement) {
  const repeating = pane.querySelector("[role=switch]")?.getAttribute("aria-checked") === "true";
  const named = [...pane.querySelectorAll("[data-testid=recurrence] [role=status] strong")].map((strong) => strong.textContent ?? "");
  const [first, last] = named.map(parseFull).filter((date) => date !== null);
  const days = new Set(named.map((name) => WEEKDAY_NAMES.indexOf(name) + 1).filter((day) => day > 0));
  if (!first) return 0;
  if (!repeating || !last || !days.size) return 1;
  let count = 0;
  for (let date = first; Temporal.PlainDate.compare(date, last) <= 0; date = date.add({ days: 1 }))
    if (days.has(date.dayOfWeek)) count += 1;
  return Math.max(1, count);
}

/** A calendar's selected dates, remembered across months paged out of view: a date only changes while it's shown. */
function calendarDates(pane: HTMLElement, selected: Set<string>) {
  for (const cell of pane.querySelectorAll<HTMLElement>("[data-date]:not([data-outside])")) {
    if (cell.getAttribute("aria-selected") === "true") selected.add(cell.dataset.date!);
    else selected.delete(cell.dataset.date!);
  }
  return selected.size;
}

// The calendar's own `DRAG_THRESHOLD`: a release nearer its press on both axes is a click, not a drag.
const DRAG_THRESHOLD = 3;
// Where the calendar opens its drag: anywhere among its months, its own arrows aside (`CalendarPeriodList`).
const DRAG_AREA = ".calendar__periodList";

/**
 * An article demo, bare, with its tally, reported as it changes. Back to no clicks whenever the demo puts its form
 * back: as a tour starts, as it ends or rewinds (unless the visitor took over, which leaves the form as the tour had
 * it), and on Reset. `sweeps`, for a calendar a drag selects across: a drag is two clicks, its press and its release,
 * wherever among the months it starts; a change of month is a click, as any button pressed is.
 */
export function TalliedDemo({
  demo,
  dates,
  sweeps,
  onTally,
}: {
  demo: string;
  dates: DateCount;
  sweeps?: boolean;
  onTally: (tally: Tally) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const clicks = useRef(0);
  const dragFrom = useRef<{ x: number; y: number; counted: boolean } | null>(null);
  const selected = useRef(new Set<string>());
  const running = useRef(false);
  const interrupted = useRef(false);
  const last = useRef<Tally | null>(null);
  const tallyRef = useRef(onTally);
  useEffect(() => {
    tallyRef.current = onTally;
  });

  const report = useCallback(() => {
    const pane = ref.current;
    if (!pane) return;
    const count = dates === "recurrence" ? recurringDates(pane) : calendarDates(pane, selected.current);
    if (last.current?.clicks === clicks.current && last.current.dates === count) return;
    last.current = { clicks: clicks.current, dates: count };
    tallyRef.current(last.current);
  }, [dates]);
  const zero = () => {
    clicks.current = 0;
    selected.current.clear();
  };

  useEffect(() => {
    const pane = ref.current;
    if (!pane) return;
    const observer = new MutationObserver(() => {
      const now = Boolean(pane.querySelector(`${CONTROLS} [aria-label='Stop Demo']`));
      if (now !== running.current) {
        if (now || !interrupted.current) zero();
        running.current = now;
        interrupted.current = false;
      }
      report();
    });
    observer.observe(pane, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-selected", "aria-checked", "aria-pressed", "aria-label"],
    });
    report();
    return () => observer.disconnect();
  }, [report]);

  // On the window: a drag ends wherever the pointer is let go, and the tour lets its sweep go there.
  useEffect(() => {
    if (!sweeps) return;
    const release = (event: PointerEvent) => {
      const from = dragFrom.current;
      dragFrom.current = null;
      if (!from) return;
      if (Math.abs(event.clientX - from.x) < DRAG_THRESHOLD && Math.abs(event.clientY - from.y) < DRAG_THRESHOLD) return;
      // Its press too, when it started on no button.
      clicks.current += from.counted ? 1 : 2;
      report();
    };
    window.addEventListener("pointerup", release);
    return () => window.removeEventListener("pointerup", release);
  }, [sweeps, report]);

  // In the React tree's capture phase, so presses in the date picker's portalled popover count too.
  const count = (event: SyntheticEvent) => {
    const target = event.target as Element;
    if (target.closest(CONTROLS) || !target.closest(PRESSABLE)) return false;
    clicks.current += 1;
    report();
    return true;
  };
  // A press of the visitor's on the form, or on Stop, ends a tour where it stands.
  const takeOver = (event: SyntheticEvent) => {
    const target = event.target as Element;
    if (running.current && event.nativeEvent.isTrusted && (!target.closest(CONTROLS) || target.closest("[aria-label='Stop Demo']")))
      interrupted.current = true;
  };

  return (
    <div
      ref={ref}
      onPointerDownCapture={(event) => {
        if (event.button !== 0) return;
        takeOver(event);
        const counted = count(event);
        const target = event.target as Element;
        if (sweeps && event.pointerType !== "touch" && target.closest(DRAG_AREA) && !target.closest("[data-nav]"))
          dragFrom.current = { x: event.clientX, y: event.clientY, counted };
      }}
      onKeyDownCapture={takeOver}
      onClickCapture={(event) => {
        if ((event.target as Element).closest("[aria-label='Reset Demo']")) zero();
        if (!event.detail) takeOver(event);
        // A pointer's click was counted at its press; the tour's and the keyboard's come with no press before them.
        if (!event.detail) count(event);
      }}
    >
      <BareDemo id={demo} />
    </div>
  );
}

// The shell's header (`headerWrapStyle` in shift-form-shell.tsx); its torn form body is the next element. Inside the
// frame: the frame's own class names (`bareFrameStyle`) carry this text too.
export const SHELL_HEADER = "[data-demo-frame] [class*='::after]:bg-i_url']";

// The words as tall as the demo beside them: their top at its dialog's top, the tally at its foot (`useAlignToShell`).
export const tallyColumnStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "xl",
  alignSelf: "stretch",
  justifyContent: "space-between",
});
// A small note on how something was counted: the tally's, the comparison table's.
export const footnoteStyle = css({ textStyle: "caption", color: "text.body", textWrap: "pretty" });

/**
 * Pads the words so their top meets the dialog's top in the demo `cell` (the one shown, of several), and their foot its
 * bottom, while side by side. `shown` re-measures when the shown demo changes.
 */
export function useAlignToShell(words: RefObject<HTMLDivElement | null>, cell: RefObject<HTMLDivElement | null>, shown?: string) {
  useLayoutEffect(() => {
    const column = words.current;
    const panes = cell.current;
    if (!column || !panes) return;
    const align = () => {
      column.style.removeProperty("padding-block-start");
      column.style.removeProperty("padding-block-end");
      const header = [...panes.querySelectorAll(SHELL_HEADER)].find((found) => !found.closest("[data-presented=false]"));
      const shell = header?.parentElement;
      if (!shell) return;
      const text = column.getBoundingClientRect();
      const dialog = shell.getBoundingClientRect();
      // Stacked on a phone.
      if (text.right > dialog.left) return;
      column.style.setProperty("padding-block-start", `${dialog.top - text.top}px`);
      column.style.setProperty("padding-block-end", `${text.bottom - dialog.bottom}px`);
    };
    let frame = 0;
    // The demos load late and reflow with the type; a frame later, out of the observer's callback.
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(align);
    });
    resize.observe(panes);
    align();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [words, cell, shown]);
}

// The cards share the row evenly.
const statsStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "lg",
  "& > [data-metric-card]": { flex: "1 1 0", minWidth: 0 },
});

/** The clicks spent beside the dates they scheduled, each on a small metric card in the brand colour. */
export function TallyStats({ clicks, dates }: Tally) {
  const { tally } = SHIFT.gap;
  return (
    <div className={statsStyle}>
      <MetricCard metric={{ value: String(clicks), label: tally.clicks }} variant="brand" size="small" onDots />
      <MetricCard metric={{ value: String(dates), label: tally.dates }} variant="brand" size="small" onDots />
    </div>
  );
}

const pointsStyle = css({ display: "flex", flexDirection: "column", gap: "3xl" });

function Points() {
  return (
    <ul className={pointsStyle}>
      {SHIFT.gap.points.map(({ Icon, title, body }) => (
        <li key={title} className={itemStyle}>
          <span className={markSlotStyle}>
            <span className={markerStyle}>
              <Icon className={markIconStyle} aria-hidden />
            </span>
          </span>
          <span className={subheadingStyle}>{title}</span>
          <span className={featureBodyStyle}>{body}</span>
        </li>
      ))}
    </ul>
  );
}

/** The heading above; the points over the v0 demo's tally, beside the demo, from its dialog's top to its bottom. */
export function ShiftGap() {
  const [tally, setTally] = useState(NO_TALLY);
  const words = useRef<HTMLDivElement>(null);
  const demo = useRef<HTMLDivElement>(null);
  useAlignToShell(words, demo);
  return (
    <Split words={<Head caption={SHIFT.gap.eyebrow}>{SHIFT.gap.heading}</Head>} centre open>
      <div ref={words} className={tallyColumnStyle}>
        <Points />
        <TallyStats {...tally} />
      </div>
      <div ref={demo}>
        <TalliedDemo demo={SHIFT.gap.demo} dates="calendar" onTally={setTally} />
      </div>
    </Split>
  );
}
