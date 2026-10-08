"use client";

import { useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { css, cx } from "../../../styled-system/css";
import ChevronDownIcon from "@/assets/icons/chevron-down.svg";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { Split } from "./gap-split";
import { Marked } from "./marked";
import { paneStyle, toggleStyle } from "./onboarding-wireframes";
import { Head } from "./sheet-article";
import { SHIFT } from "./shift-content";
import {
  footnoteStyle,
  NO_TALLY,
  SHELL_HEADER,
  TalliedDemo,
  tallyColumnStyle,
  TallyStats,
  useAlignToShell,
  type DateCount,
  type Tally,
} from "./shift-gap";

// The two concepts tested, laid out as the UX gap: the heading above, the shown concept's words in the left column over
// a tally of its demo's clicks and dates, and the article's two concept demos (v1, v2) in the right, one at a time on a
// toggle, bare on the dots.

const CONCEPTS: {
  value: keyof typeof SHIFT.concepts;
  label: string;
  demo: string;
  dates: DateCount;
  sweeps?: boolean;
}[] = [
  { value: "recurrence", label: "Recurrence", demo: "shift-scheduling-v1", dates: "recurrence" },
  { value: "drag", label: "Drag to select", demo: "shift-scheduling-v2", dates: "calendar", sweeps: true },
];

// One concept's words open at a time, the one on the toggle, between the table's hairline rules.
const accordionStyle = css({
  display: "flex",
  flexDirection: "column",
  borderBlockStartWidth: "token(spacing.3xs)",
  borderBlockStartStyle: "solid",
  borderBlockStartColor: "border.divider",
  "& > *": {
    borderBlockEndWidth: "token(spacing.3xs)",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: "border.divider",
  },
});
const segmentHeadStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "md",
  width: "token(spacing.full)",
  // The comparison table's cells' padding (`heatmapStyle` in shift-sheet.tsx).
  paddingBlock: "lg",
  paddingInline: "xl",
  textAlign: "start",
  textStyle: "bodyLarge",
  color: "text.title",
  cursor: "pointer",
  transition: "color 300ms ease-out",
  "&[aria-expanded=true]": { color: "text.highlight", cursor: "default" },
  "& svg": { flexShrink: 0, width: "token(spacing.xxl)", height: "token(spacing.xxl)", transition: "rotate 300ms ease-out" },
  "&[aria-expanded=true] svg": { rotate: "180deg" },
});
// Opens to its words' height and closes to none (`1fr` and `0fr`), so the segments trade height as they switch.
const segmentPanelStyle = css({
  display: "grid",
  gridTemplateRows: "0fr",
  transition: "grid-template-rows 300ms ease-out",
  "&[data-open=true]": { gridTemplateRows: "1fr" },
  "& > *": { minHeight: 0, overflow: "hidden" },
  // As much room under the words as over them, from the heading's line: within a pixel at either end of the type's range.
  "& p": {
    paddingBlockEnd: "xxl",
    paddingInline: "xl",
    textStyle: "bodyLarge",
    color: "text.body",
    textWrap: "pretty",
  },
});
const conceptStyle = css({ display: "flex", flexDirection: "column", alignItems: "center", gap: "md" });
// Drag to select's note on how its drags count, hung under the cards so they stay level with the dialog's foot
// (`useAlignToShell`) and nothing moves as it fades with the concept. Stacked on a phone, where there's no foot to
// keep: in the flow, its room kept while it's hidden.
const tallyFootStyle = css({ position: "relative" });
const dragNoteStyle = css({
  position: "absolute",
  insetBlockStart: "calc(100% + token(spacing.md))",
  insetInlineStart: 0,
  transition: "opacity 300ms ease-out",
  "&[data-shown=false]": { opacity: 0 },
  mdDown: { position: "static", marginBlockStart: "md" },
});
// Both demos in one cell, so it holds the taller one's height and the sheet doesn't move when they cross-fade.
const panesStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignSelf: "stretch",
  "& > *": { gridArea: "1 / 1" },
});

/**
 * The shorter demo's form body grown until both dialogs are as tall, so the footer stays put when they switch, with
 * its contents centred in it. Measured, not set: their heights change with the fluid type and the calendar's reflow,
 * and the demos load late.
 */
function useEvenShells(cell: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const root = cell.current;
    if (!root) return;
    const bodies = () =>
      [...root.children].map((pane) => pane.querySelector(SHELL_HEADER)?.nextElementSibling as HTMLElement | null);

    const even = () => {
      const found = bodies();
      if (found.some((body) => !body)) return;
      for (const body of found) Object.assign(body!.style, { minHeight: "", display: "", flexDirection: "", justifyContent: "" });
      const heights = found.map((body) => body!.parentElement!.offsetHeight);
      const tallest = Math.max(...heights);
      found.forEach((body, i) => {
        if (heights[i] === tallest) return;
        Object.assign(body!.style, {
          minHeight: `${body!.offsetHeight + tallest - heights[i]}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        });
      });
    };

    // A frame later: resizing a watched shell inside the observer's callback is a "ResizeObserver loop" error.
    let frame = 0;
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(even);
    });
    let watched: (HTMLElement | null)[] = [];
    // A demo loading brings a new shell to watch.
    const rewatch = () => {
      const shells = bodies().map((body) => body?.parentElement ?? null);
      if (shells.every((shell, i) => shell === watched[i])) return;
      watched = shells;
      resize.disconnect();
      for (const shell of shells) if (shell) resize.observe(shell);
      even();
    };
    const mutate = new MutationObserver(rewatch);
    mutate.observe(root, { childList: true, subtree: true });
    rewatch();
    return () => {
      cancelAnimationFrame(frame);
      mutate.disconnect();
      resize.disconnect();
    };
  }, [cell]);
}

// Moved off screen once faded out, so its demo is out of view (`useInView`): its cursor tour stops and rewinds, and plays
// from the top when it comes back, at the start of its fade-in. A move, so the cell keeps its height.
const parkStyle = css({
  "[data-presented=false] > &": { translate: "calc(-100vw - 100%) 0", transition: "translate 0s 300ms" },
});

/** A segment per concept, `open` the one on the toggle; opening another chooses it. The open one stays open. */
function ConceptAccordion({ open, onOpen }: { open: string; onOpen: (value: string) => void }) {
  const id = useId();
  return (
    <div className={accordionStyle}>
      {CONCEPTS.map(({ value }) => {
        const { title, text } = SHIFT.concepts[value];
        const expanded = value === open;
        return (
          <div key={value}>
            <h4>
              <button
                type="button"
                id={`${id}-${value}-head`}
                className={segmentHeadStyle}
                aria-expanded={expanded}
                aria-controls={`${id}-${value}`}
                onClick={() => onOpen(value)}
              >
                {title}
                <ChevronDownIcon aria-hidden />
              </button>
            </h4>
            <div
              id={`${id}-${value}`}
              role="region"
              aria-labelledby={`${id}-${value}-head`}
              className={segmentPanelStyle}
              data-open={expanded}
              inert={!expanded}
            >
              <div>
                <p>
                  <Marked text={text} />
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** `dotsTo`, an element further down the sheet the section's dotted ground runs on to. */
export function ConceptsSplit({ dotsTo }: { dotsTo?: RefObject<HTMLElement | null> }) {
  const { eyebrow, heading } = SHIFT.conceptTesting;
  const [concept, setConcept] = useState("recurrence");
  const [tallies, setTallies] = useState<Record<string, Tally>>({});
  const panes = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLDivElement>(null);
  useEvenShells(panes);
  useAlignToShell(words, panes, concept);
  const shown = tallies[concept] ?? NO_TALLY;
  return (
    <Split words={<Head caption={eyebrow}>{heading}</Head>} centre inBleed open dotsTo={dotsTo}>
      <div ref={words} className={tallyColumnStyle}>
        <ConceptAccordion open={concept} onOpen={setConcept} />
        <div className={tallyFootStyle}>
          <TallyStats {...shown} />
          <p className={cx(footnoteStyle, dragNoteStyle)} data-shown={concept === "drag"} aria-hidden={concept !== "drag"}>
            {SHIFT.gap.tally.drag}
          </p>
        </div>
      </div>
      <div className={conceptStyle}>
        <SegmentedControl
          ariaLabel="Scheduling concept"
          className={toggleStyle}
          options={CONCEPTS}
          value={concept}
          onValueChange={setConcept}
        />
        <div ref={panes} className={panesStyle}>
          {CONCEPTS.map(({ value, demo, dates, sweeps }) => (
            <div
              key={value}
              className={paneStyle}
              data-presented={value === concept}
              aria-hidden={value !== concept}
              inert={value !== concept}
            >
              <div className={parkStyle}>
                <TalliedDemo
                  demo={demo}
                  dates={dates}
                  sweeps={sweeps}
                  onTally={(tally) => setTallies((current) => ({ ...current, [value]: tally }))}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Split>
  );
}
