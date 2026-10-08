"use client";

import { useRef, type RefObject } from "react";
import { css, cx } from "../../../styled-system/css";
import { Typography } from "@/components/ui/typography";
import ExclamationIcon from "@/assets/icons/exclamation-mark.svg";
import { ClipsCarousel } from "./clips-carousel";
import { FeatureGrid } from "./feature-grid";
import { HeadedCards } from "./headed-cards";
import { Status } from "./onboarding-wireframes";
import {
  articleStyle,
  bandStyle,
  Closing,
  Head,
  Prose,
  roomAboveStyle,
  roomBelowStyle,
  wideSectionStyle,
} from "./sheet-article";
import { NORTH_STAR } from "./data";
import { ConceptsSplit } from "./shift-concepts";
import { fewest, SHIFT } from "./shift-content";
import { footnoteStyle, ShiftGap } from "./shift-gap";
import { EditScheduleWireframe, PositionsWireframe, StepsWireframe } from "./shift-wireframes";

// Between the sheet's margins, where the cards' words start (`rowStyle` in headed-cards.tsx), the heat map across them.
// Its top cancels the split's run into the room below it (`splitStyle`'s negative margin) and the section's gap, so the
// table starts at the split's foot.
const comparisonStyle = css({
  // Over the concepts' dotted ground, which runs on under its header to its rows (`dotsTo`).
  position: "relative",
  display: "flex",
  flexDirection: "column",
  // Over the section's `min(100%, articleContent)` for its children.
  "[data-bleed] > &": { width: "token(spacing.full)" },
  // Its heading as far over the table as a section's head is over its content.
  gap: "3xl",
  marginBlockStart: "calc(2 * token(spacing.4xl) - token(spacing.md))",
  paddingInline: "3xl",
  mdDown: { gap: "xl", marginBlockStart: "calc(2 * token(spacing.3xl) - token(spacing.md))", paddingInline: "xl" },
  // Over no more than the sheet's left half, as the split's head above.
  "& > h3": { maxWidth: "token(sizes.articleContent)", md: { maxWidth: "min(token(sizes.articleContent), 50%)" } },
});
// A ledger on hairline rules, a row's fewest clicks on the prose highlight's tint (`data-best`). Out to the sheet's
// edges, its outer cells' text on the content's margins. On a phone its cells wrap, so it fits the sheet.
const heatmapStyle = css({
  width: "calc(100% + 2 * token(spacing.3xl))",
  marginInline: "calc(-1 * token(spacing.3xl))",
  mdDown: { width: "calc(100% + 2 * token(spacing.xl))", marginInline: "calc(-1 * token(spacing.xl))" },
  // Each cell draws its own rule: WebKit snaps a box's border to the device pixel, but blurs a collapsed table's outer
  // edge across two when it falls between them, so the last rule read thinner.
  borderCollapse: "separate",
  borderSpacing: 0,
  textStyle: "bodySmall",
  color: "text.title",
  fontVariantNumeric: "tabular-nums",
  "& th": { fontWeight: "inherit", textAlign: "start" },
  "& thead th": { textStyle: "bodyLarge", color: "text.body" },
  "& td, & th": {
    paddingBlock: "lg",
    paddingInline: "xl",
    borderBlockEndWidth: "token(spacing.3xs)",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: "border.divider",
  },
  "& :is(td, th):first-child": { paddingInlineStart: "3xl", mdDown: { paddingInlineStart: "xl" } },
  "& :is(td, th):last-child": { paddingInlineEnd: "3xl", mdDown: { paddingInlineEnd: "xl" } },
  "& :is(td, th):not(:first-child)": {
    textAlign: "end",
    whiteSpace: "nowrap",
    mdDown: { whiteSpace: "normal" },
  },
  // A result there is none of ("Not possible") shows the body's hatching, as the figures hatch what's ruled out:
  // hard-stopped lines in the rules' colour. One layer under the whole body, so the lines run on from cell to cell, and
  // tiled in whole pixels, so every line rasterises alike; every other cell covers it with the sheet's ground.
  "& tbody": {
    backgroundImage:
      "linear-gradient(-45deg, token(colors.border.divider) 0 token(spacing.3xs), transparent token(spacing.3xs) calc(50% - token(spacing.3xs)), token(colors.border.divider) calc(50% - token(spacing.3xs)) calc(50% + token(spacing.3xs)), transparent calc(50% + token(spacing.3xs)) calc(100% - token(spacing.3xs)), token(colors.border.divider) calc(100% - token(spacing.3xs)))",
    backgroundSize: "token(spacing.lg) token(spacing.lg)",
  },
  "& tbody :is(td, th):not([data-none])": { backgroundColor: "var(--sheet-ground, token(colors.bg.canvas))" },
  "& td[data-best]": {
    backgroundImage: "linear-gradient(token(colors.bg.highlight), token(colors.bg.highlight))",
    color: "text.highlight",
  },
  // The note, and each scheduler's verdict under its column, off the rules.
  "& tfoot td": { paddingBlockStart: "xl", paddingBlockEnd: 0, borderBlockEndWidth: 0 },
  // The pills end on the numbers' edge; room before them would widen their columns past a phone's width.
  "& tfoot td:not(:first-child)": { paddingInlineStart: 0 },
});
const unseenStyle = css({ srOnly: true });
// "Not possible" after the exclamation mark, drawn in the cell's ink (the icon's own strokes are white). Set at the
// line's top, not its middle: centred, it pushed the line, and its row, taller than the rest.
const noneStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "sm",
  verticalAlign: "top",
  "& svg": { flexShrink: 0, width: "token(spacing.xxl)", height: "token(spacing.xxl)" },
  "& svg path[stroke]": { stroke: "currentColor" },
  "& svg path[fill]": { fill: "currentColor" },
});

/**
 * The three schedulers, counted: the old calendar, the recurrence that was tested, and drag to select. `rowsRef`, its
 * rows under the header, where the dotted ground above ends.
 */
function SchedulerComparison({ rowsRef }: { rowsRef?: RefObject<HTMLTableSectionElement | null> }) {
  const { heading, head, rows, note, verdicts } = SHIFT.comparison;
  return (
    <div className={comparisonStyle}>
      <Typography tag="h3" type="subheading">
        {heading}
      </Typography>
      <table className={heatmapStyle}>
        <thead>
          <tr>
            {head.map((cell, i) => (
              <th key={i} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={rowsRef}>
          {rows.map(([label, ...cells]) => {
            const best = fewest(cells);
            return (
              <tr key={label}>
                <th scope="row">{label}</th>
                {cells.map((cell, i) => (
                  <td
                    key={i}
                    data-best={best[i] ? "" : undefined}
                    data-none={Number.isFinite(Number(cell)) ? undefined : ""}
                  >
                    {Number.isFinite(Number(cell)) ? (
                      cell
                    ) : (
                      <span className={noneStyle}>
                        <ExclamationIcon aria-hidden />
                        {cell}
                      </span>
                    )}
                    {best[i] && <span className={unseenStyle}> (fewest)</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={head.length - verdicts.length}>
              <p className={footnoteStyle}>{note}</p>
            </td>
            {verdicts.map((verdict) => (
              <td key={verdict}>
                <Status decision={verdict} size="large" />
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** The two concepts on a toggle, then their counts against the old calendar, on one dotted ground. */
function ConceptTesting() {
  const tableRows = useRef<HTMLTableSectionElement>(null);
  return (
    <>
      <ConceptsSplit dotsTo={tableRows} />
      <SchedulerComparison rowsRef={tableRows} />
    </>
  );
}

/** The shift scheduling sheet: the clips, why it mattered, the UX gap, the North Star, the form's cards and testing. */
export function ShiftSheet() {
  const { clips, stakes, northStar, cards, outcome, takeaway } = SHIFT;
  return (
    <article className={articleStyle}>
      <ClipsCarousel clips={clips} />

      <section className={cx(wideSectionStyle, roomAboveStyle)} data-sheet-step="">
        <Head caption={stakes.eyebrow}>{stakes.heading}</Head>
        <Prose text={stakes.body} />
        <FeatureGrid features={stakes.reasons} />
      </section>

      <section className={cx(wideSectionStyle, roomAboveStyle)} data-sheet-step="">
        <ShiftGap />
      </section>

      <section className={bandStyle} data-sheet-step="">
        <Head caption={NORTH_STAR} large>
          {northStar}
        </Head>
      </section>

      <section className={wideSectionStyle} data-bleed="" data-sheet-step="">
        <HeadedCards
          rows={[
            { ...cards.steps, graphic: <StepsWireframe /> },
            { ...cards.positions, graphic: <PositionsWireframe /> },
            { ...cards.edit, graphic: <EditScheduleWireframe /> },
          ]}
        />
      </section>

      <section className={cx(wideSectionStyle, roomAboveStyle, roomBelowStyle)} data-bleed="" data-sheet-step="">
        <ConceptTesting />
      </section>

      <Closing outcome={outcome} takeaway={takeaway} />
    </article>
  );
}
