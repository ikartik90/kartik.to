"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { css, cva, cx } from "../../../../styled-system/css";
import {
  KNOWN_OUTCOMES,
  benchmarkSummary,
  candidateSetStatus,
  outcomeCounts,
  type BenchmarkRow,
  type CandidateSetStatus,
} from "./benchmark";
import {
  OUTCOME_LABEL,
  RULE_ABOVE,
  RULE_BELOW,
  cellStyle,
  checkboxCellStyle,
  headCellStyle,
  nameCellStyle,
  nameHeadStyle,
  nameStyle,
  rowTone,
  ruledBesideStyle,
  ruledStyle,
  sortStyle,
  tableScrollStyle,
  tableStyle,
} from "./candidate-table";
import {
  BENCHMARK_CANDIDATES,
  MIN_BENCHMARK_CANDIDATES,
  type Evaluation,
  type KnownOutcome,
} from "./harness-data";
import SearchIcon from "./icons/search-ink.svg";
import TabCornerBefore from "./icons/tab-corner-before.svg";
import TabCornerAfter from "./icons/tab-corner-after-horizontal.svg";
import AddIcon from "./icons/add-ink.svg";
import SeparatorLine from "./icons/separator-account.svg";
import TableViewIcon from "./icons/table-view.svg";
import SortIcon from "./icons/sort-alphabetic-asc.svg";
import MismatchIcon from "./icons/changed-warning.svg";
import MatchIcon from "./icons/question-mark-badge.svg";
import { SuggestedCandidates } from "./suggested-candidates";
import { OverflowTooltip } from "./overflow-tooltip";
import { Checkbox } from "./checkbox";
import { AvgScore } from "./avg-score";
import { plainButtonLabelStyle, plainButtonStyle } from "./parts";
import { useWalkthrough, WalkthroughTip } from "./walkthrough";

// ---------------------------------------------------------------------------
// The benchmark's results (Figma 73:2989): the candidate set, split by what
// really happened to each candidate, and a row for each saying whether the
// criteria would have let them through — flagged where that disagrees. The
// Suggested candidates tab beside it (Figma 57:846) lists the same twelve;
// Candidate search is drawn but not offered.
//
// Everything is read off the fixture by `benchmark.ts`; nothing here decides.
// The first mismatch opens with its details shown, as drawn, and each can be
// folded and unfolded. The rest of the product around the table — the search,
// the other tabs, the column controls — is drawn but not offered. Review suggested rewrites is the way on, back to the form; with no
// mismatch there is nothing to review, and the footer only says that every
// result matches (Figma 106:5781).
// Last results viewed after the criteria have changed say they are no longer
// valid, whatever they found, and offer a retest in place of the review.
//
// The summary is of the candidates in the benchmark — not those taken out from
// the Suggested candidates list, where each can be removed and added back —
// and says whether they make a fair benchmark: every known outcome among them,
// and at least ten (Figma 110:5881, 115:5909, 117:5944). A removed candidate's
// result is gone; one added back is listed with their average score — the
// talent pool's, not the benchmark's — and nothing else until a retest, so the
// results say they are no longer valid.
//
// Candidates can be selected to act on together: Remove, beside Add column,
// takes those selected out of the benchmark; on Suggested candidates, Add puts
// those selected back — each offered where it applies to any of them, and
// applied only to those. Each tab starts with nothing selected. The results open
// on Benchmark results, or on Suggested candidates to change the candidates.
//
// Rules are inset shadows rather than borders: the source draws its strokes
// inside each box without taking room, and a real half-pixel border would
// push every row below it down by half a pixel more.
// ---------------------------------------------------------------------------

// Past this the findings are too narrow to read; the table scrolls instead.
const resultsTableStyle = css({ minWidth: "760px" });

// --- The product around the results -----------------------------------------

const chromeStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  flexShrink: 0,
  paddingBlockStart: "8px",
  paddingInline: "8px",
  backgroundColor: "var(--cashby-fill)",
});

const searchStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px",
});

const searchPlaceholderStyle = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--cashby-ink-muted)",
});

const tabsStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  paddingBlockStart: "8px",
  paddingInline: "8px",
  whiteSpace: "nowrap",
});

// The current tab is joined onto the white panel under it, with two inverted
// corners carrying its edge out into the band; the others sit in the band.
const tab = cva({
  base: {
    position: "relative",
    display: "flex",
    flexShrink: 0,
    paddingInline: "6px",
    color: "var(--cashby-ink)",
    "html[data-keyboard-focus] &": {
      _focusVisible: { boxShadow: "var(--cashby-focus-ring)" },
    },
  },
  variants: {
    current: {
      true: {
        alignItems: "flex-start",
        gap: "4px",
        height: "40px",
        paddingBlockStart: "6px",
        borderStartStartRadius: "8px",
        borderStartEndRadius: "8px",
        backgroundColor: "var(--cashby-surface)",
        font: "var(--cashby-text-tab)",
      },
      false: {
        alignItems: "center",
        gap: "2px",
        height: "32px",
        borderRadius: "6px",
        font: "var(--cashby-text-body)",
      },
    },
  },
});

const tabLabelStyle = css({ minWidth: "32px" });

// The corner glyphs are `currentColor` once SVGR has been at them.
const tabCornerStyle = css({
  position: "absolute",
  insetBlockEnd: 0,
  color: "var(--cashby-surface)",
});
const tabCornerBeforeStyle = css({ insetInlineStart: "-8px" });
const tabCornerAfterStyle = css({ insetInlineStart: "100%" });

const tabCountStyle = css({
  display: "flex",
  alignItems: "center",
  height: "20px",
  paddingInline: "6px",
  borderRadius: "10px",
  backgroundColor: "var(--cashby-accent)",
  color: "var(--cashby-surface)",
  font: "var(--cashby-text-small)",
});

// --- Summary ----------------------------------------------------------------

const panelStyle = css({
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  backgroundColor: "var(--cashby-surface)",
});

const summaryStyle = css({ padding: "8px", boxShadow: RULE_BELOW });

const summaryInnerStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  paddingInline: "6px",
});

const summaryTitleRowStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
});

const summaryTitleStyle = css({
  flexShrink: 0,
  font: "var(--cashby-text-card-title)",
});

// Whether the candidates make a fair benchmark: a tint laid over white, ruled
// as the drawer's Up to date is. One line, cut short where the row is too
// narrow for it, with the whole of it in a tooltip.
const setStatus = cva({
  base: {
    display: "inline-block",
    minWidth: 0,
    height: "24px",
    paddingInline: "8px",
    borderRadius: "16px",
    font: "var(--cashby-text-small)",
    // The line is the pill's height, so the text sits in its middle.
    lineHeight: "24px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  variants: {
    tone: {
      positive: {
        backgroundColor: "var(--cashby-positive-tag)",
        boxShadow:
          "inset 0 0 0 var(--cashby-rule) var(--cashby-positive-border)",
        color: "var(--cashby-positive-ink)",
      },
      caution: {
        backgroundColor: "var(--cashby-caution-tag)",
        boxShadow:
          "inset 0 0 0 var(--cashby-rule) var(--cashby-caution-border)",
        color: "var(--cashby-caution-ink)",
      },
    },
  },
});

const outcomeColor = cva({
  variants: {
    outcome: {
      hired: { backgroundColor: "var(--cashby-positive)" },
      "archived-interview": { backgroundColor: "var(--cashby-caution)" },
      "archived-application-review": { backgroundColor: "var(--cashby-slate)" },
    },
  },
});

// A 5px rounded stroke on a line of no height, as drawn — so its caps hang
// half its weight past every edge — split by how many candidates each
// outcome holds, out of at least the ten a benchmark needs: short of them, the
// rest of the bar is left empty (Figma 110:5881).
const outcomeBarStyle = css({
  display: "flex",
  gap: "3px",
  height: "5px",
  marginBlock: "-2.5px",
  marginInline: "-2.5px",
});

const outcomeBarSegmentStyle = css({ flexBasis: 0, borderRadius: "2.5px" });

const shortfallStyle = css({ backgroundColor: "var(--cashby-fill-solid)" });

const legendStyle = css({
  display: "flex",
  flexWrap: "wrap",
  columnGap: "12px",
});

// An outcome with no one in it is flagged (Figma 115:5909): its dot gives way
// to a warning, in a tint ruled in the caution colour.
const legendItem = cva({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    color: "var(--cashby-slate)",
    font: "var(--cashby-text-small)",
  },
  variants: {
    missing: {
      true: {
        gap: "2px",
        paddingInlineStart: "2px",
        paddingInlineEnd: "4px",
        borderRadius: "4px",
        backgroundColor: "var(--cashby-caution-tint)",
        boxShadow:
          "inset 0 0 0 var(--cashby-rule) var(--cashby-caution-border)",
        color: "var(--cashby-caution-ink)",
      },
    },
  },
});

const legendDotStyle = css({
  width: "8px",
  height: "8px",
  borderRadius: "50%",
});

// --- Toolbar ----------------------------------------------------------------

const toolbarStyle = css({
  display: "flex",
  justifyContent: "flex-end",
  padding: "8px",
  boxShadow: RULE_BELOW,
});

// The actions on the selected candidates, on the toolbar's left.
const selectionActionsStyle = css({
  display: "flex",
  gap: "8px",
  marginInlineEnd: "auto",
});

const selectionActionStyle = css({ paddingInline: "8px" });

const columnsControlStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  height: "32px",
  paddingInlineStart: "6px",
  paddingInlineEnd: "8px",
  borderRadius: "8px",
  backgroundColor: "var(--cashby-surface)",
  boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-border)",
  whiteSpace: "nowrap",
});

const addColumnStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "2px",
  paddingInlineEnd: "2px",
});

// The rule's own half-pixel stroke hangs either side of a line of no width.
const columnsSeparatorStyle = css({ marginInline: "-0.25px" });

// --- Table ------------------------------------------------------------------

/** A known outcome's tag; the intro's pictures draw a hired one's for a strong fit. */
export const outcomeTag = cva({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    height: "20px",
    paddingInline: "4px",
    borderRadius: "4px",
    font: "var(--cashby-text-fine)",
    whiteSpace: "nowrap",
  },
  variants: {
    outcome: {
      hired: {
        backgroundColor: "var(--cashby-positive-tag)",
        color: "var(--cashby-positive-ink)",
      },
      "archived-interview": {
        backgroundColor: "var(--cashby-caution-tag)",
        color: "var(--cashby-caution-ink)",
      },
      "archived-application-review": {
        backgroundColor: "var(--cashby-hairline)",
        color: "var(--cashby-slate)",
      },
    },
  },
});

const centredStyle = css({ display: "flex", justifyContent: "center" });

// An arrow and the next part, spaced by the tag's own gap.
const contentsStyle = css({ display: "contents" });

// Drawn at three quarters in the intro's pictures (Figma 133:6289): the arcs
// scale with the box, so their stroke does too.
const ring = cva({
  base: { position: "relative" },
  variants: {
    small: {
      false: { width: "32px", height: "32px" },
      true: { width: "24px", height: "24px" },
    },
  },
});

const ringArcsStyle = css({ position: "absolute", inset: 0 });

// One arc per criterion tested, clockwise from the top in the order of the
// criteria. The source draws four quarter arcs (Figma 73:2989); these are the
// same arcs worked out rather than traced — the circle through their ends, the
// stroke they are drawn with, and the angle each stops short of a quarter — so
// three criteria draw thirds in the same hand.
const RING = { centre: 16, radius: 14.1687, stroke: 2.72435, gap: 8.851 };

function arcPath(from: number, to: number) {
  const { centre, radius } = RING;
  const at = (degrees: number) => {
    const angle = (degrees * Math.PI) / 180;
    return `${(centre + radius * Math.sin(angle)).toFixed(3)} ${(centre - radius * Math.cos(angle)).toFixed(3)}`;
  };
  return `M ${at(from)} A ${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${at(to)}`;
}

const arc = cva({
  variants: {
    evaluation: {
      met: { color: "var(--cashby-positive)" },
      "not-met": { color: "var(--cashby-negative)" },
      undecided: { color: "var(--cashby-slate)" },
    },
  },
});

const ringLabel = cva({
  base: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  variants: {
    small: {
      false: { font: "var(--cashby-text-small)" },
      true: { font: "var(--cashby-text-ring-small)" },
    },
  },
});

const resultStyle = css({ font: "var(--cashby-text-body-strong)" });

export const cautionStyle = css({ color: "var(--cashby-caution-ink)" });

const findingCellStyle = css({ paddingInlineStart: "32px" });

const findingIconStyle = css({
  position: "absolute",
  insetBlockStart: "10px",
  insetInlineStart: "8px",
});

const findingStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "4px",
});

const findingTitleStyle = css({
  font: "var(--cashby-text-body-strong)",
  color: "var(--cashby-caution-ink)",
});

const criterionNameStyle = css({
  textDecorationLine: "underline",
  textDecorationThickness: "from-font",
  textUnderlinePosition: "from-font",
  textDecorationSkipInk: "none",
});

// Folded, it holds nothing and makes no box, so the gap closes up with it.
const detailsStyle = css({ display: "contents" });

const detailStyle = css({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  color: "var(--cashby-slate)",
  font: "var(--cashby-text-small)",
});

const detailHeadingStyle = css({ font: "var(--cashby-text-small-bold)" });

// The quote's rule is a 2px rounded stroke on a line of no width, so it hangs
// a pixel past the quote at either end and a pixel into the margin.
const quoteStyle = css({ display: "flex", gap: "9px" });

const quoteRuleStyle = css({
  flexShrink: 0,
  width: "2px",
  marginBlock: "-1px",
  marginInlineStart: "-1px",
  borderRadius: "1px",
  backgroundColor: "var(--cashby-caution-border)",
});

const detailsToggleStyle = css({
  font: "var(--cashby-text-label)",
  color: "var(--cashby-accent)",
  borderRadius: "2px",
  "html[data-keyboard-focus] &": {
    _focusVisible: { boxShadow: "var(--cashby-focus-ring)" },
  },
});

const noFindingStyle = css({ font: "var(--cashby-text-body-strong)" });

// --- Footer -----------------------------------------------------------------

const footerStyle = css({ flexShrink: 0 });

const banner = cva({
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    minHeight: "32px",
    paddingInline: "8px",
    font: "var(--cashby-text-body-strong)",
    textAlign: "center",
  },
  variants: {
    tone: {
      caution: {
        backgroundColor: "var(--cashby-caution-tint)",
        boxShadow:
          "inset 0 1px 0 calc(var(--cashby-rule) - 1px) var(--cashby-caution-border)",
        color: "var(--cashby-caution-ink)",
      },
      // Every result matches (Figma 106:5781).
      positive: {
        backgroundColor: "var(--cashby-positive-tint)",
        boxShadow:
          "inset 0 1px 0 calc(var(--cashby-rule) - 1px) var(--cashby-positive-border)",
        color: "var(--cashby-positive-ink)",
      },
    },
  },
});

const bannerIconStyle = css({ flexShrink: 0 });

const actionsStyle = css({
  display: "flex",
  justifyContent: "flex-end",
  padding: "12px",
  backgroundColor: "var(--cashby-fill)",
  boxShadow: RULE_ABOVE,
});

const reviewButtonStyle = css({
  display: "flex",
  alignItems: "center",
  height: "32px",
  paddingInline: "12px",
  borderRadius: "8px",
  backgroundColor: "var(--cashby-accent)",
  color: "var(--cashby-surface)",
  font: "var(--cashby-text-body-strong)",
  whiteSpace: "nowrap",
  "html[data-keyboard-focus] &": {
    _focusVisible: {
      boxShadow:
        "0 0 0 1.5px var(--cashby-surface), 0 0 0 3px var(--cashby-accent)",
    },
  },
});

// ---------------------------------------------------------------------------

export interface BenchmarkResultsProps {
  titleId: string;
  rows: BenchmarkRow[];
  /** The results no longer answer for the benchmark: the criteria have changed since, or a candidate added back has not been benchmarked. */
  stale: boolean;
  /** The candidates taken out of the benchmark from the suggested list. */
  removed: ReadonlySet<string>;
  onRemoveCandidates: (ids: readonly string[]) => void;
  onAddCandidates: (ids: readonly string[]) => void;
  onReviewRewrites: () => void;
  onRetest: () => void;
  /** Close the overlay the results are in. */
  onClose: () => void;
  /** The tab it opens on. */
  opensOn: CandidatesTab;
}

export type CandidatesTab = "results" | "suggested";

export function BenchmarkResults({
  titleId,
  rows,
  stale,
  removed,
  onRemoveCandidates,
  onAddCandidates,
  onReviewRewrites,
  onRetest,
  onClose,
  opensOn,
}: BenchmarkResultsProps) {
  const { total, mismatches, criteriaAtFault } = benchmarkSummary(rows);
  const benchmarked = BENCHMARK_CANDIDATES.filter(
    (candidate) => !removed.has(candidate.id),
  );
  const outcomes = outcomeCounts(benchmarked);
  const status = candidateSetStatus(outcomes);
  const shortfall = MIN_BENCHMARK_CANDIDATES - benchmarked.length;
  // Every candidate in the benchmark, with their result — none for one added
  // back since the last run.
  const listed = benchmarked.map((candidate) => ({
    candidate,
    result: rows.find((row) => row.id === candidate.id) ?? null,
  }));
  const countId = useId();
  const reviewRef = useRef<HTMLButtonElement>(null);
  const matchRef = useRef<HTMLSpanElement>(null);
  // The first mismatch's finding, which the walkthrough's fourth step is about.
  const findingRef = useRef<HTMLParagraphElement>(null);
  const firstMismatch = rows.find((row) => row.mismatch)?.id;
  const walkthrough = useWalkthrough();
  const suggestedTabId = useId();
  const panelId = useId();
  const selectAllId = useId();
  const [current, setCurrent] = useState(opensOn);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const tabIds: Record<CandidatesTab, string> = {
    results: titleId,
    suggested: suggestedTabId,
  };

  // Opening, the dialog focuses the first tab, current or not; opened on
  // Suggested candidates, that tab takes focus once it has.
  useEffect(() => {
    if (opensOn === "suggested")
      document.getElementById(suggestedTabId)?.focus();
  }, [opensOn, suggestedTabId]);

  function choose(tab: CandidatesTab) {
    if (tab === current) return;
    setCurrent(tab);
    setSelected(new Set());
  }

  // The candidates the tab lists, and which of those selected each action
  // applies to.
  const selectable = (
    current === "results"
      ? listed.map(({ candidate }) => candidate)
      : BENCHMARK_CANDIDATES
  ).map((candidate) => candidate.id);
  const allSelected =
    selectable.length > 0 && selectable.every((id) => selected.has(id));
  const toRemove = [...selected].filter((id) => !removed.has(id));
  const toAdd = [...selected].filter((id) => removed.has(id));

  function select(id: string) {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    setSelected(next);
  }

  // The action's buttons go with the selection, so focus goes to the header.
  function act(action: (ids: readonly string[]) => void, ids: string[]) {
    action(ids);
    setSelected(new Set());
    document.getElementById(selectAllId)?.focus();
  }

  const selectAll = (
    <Checkbox
      id={selectAllId}
      label="Select all candidates"
      checked={allSelected}
      mixed={!allSelected && selectable.some((id) => selected.has(id))}
      onChange={() => setSelected(new Set(allSelected ? [] : selectable))}
    />
  );

  // Arrows, Home and End move between the two tabs on offer, and choose it.
  function handleTabKeys(event: KeyboardEvent<HTMLDivElement>) {
    const next: CandidatesTab | undefined = {
      ArrowRight: current === "results" ? "suggested" : "results",
      ArrowLeft: current === "results" ? "suggested" : "results",
      Home: "results",
      End: "suggested",
    }[event.key] as CandidatesTab | undefined;
    if (!next) return;
    event.preventDefault();
    choose(next);
    document.getElementById(tabIds[next])?.focus();
  }
  // The first mismatch opens unfolded, as drawn.
  const [unfolded, setUnfolded] = useState(
    () =>
      new Set(
        rows
          .filter((row) => row.mismatch)
          .slice(0, 1)
          .map((row) => row.id),
      ),
  );

  function toggle(id: string) {
    setUnfolded((was) => {
      const next = new Set(was);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className={chromeStyle}>
        <div className={searchStyle}>
          <SearchIcon aria-hidden />
          <span className={searchPlaceholderStyle}>
            Search for relevant candidates based on names, lists, or jobs...
          </span>
        </div>
        <div
          role="tablist"
          aria-label="Candidates"
          className={tabsStyle}
          onKeyDown={handleTabKeys}
        >
          <CandidateTab
            id={titleId}
            panelId={panelId}
            current={current === "results"}
            onSelect={() => choose("results")}
          >
            <span className={tabLabelStyle}>Benchmark results</span>
          </CandidateTab>
          <CandidateTab
            id={suggestedTabId}
            panelId={panelId}
            current={current === "suggested"}
            onSelect={() => choose("suggested")}
          >
            <span className={tabLabelStyle}>Suggested candidates</span>
            <span className={tabCountStyle}>{BENCHMARK_CANDIDATES.length}</span>
          </CandidateTab>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            aria-disabled
            tabIndex={-1}
            className={tab({ current: false })}
          >
            <span className={tabLabelStyle}>Candidate search</span>
          </button>
        </div>
      </div>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabIds[current]}
        className={panelStyle}
      >
        <section className={summaryStyle}>
          <div className={summaryInnerStyle}>
            <div className={summaryTitleRowStyle}>
              <h3 id={countId} className={summaryTitleStyle}>
                {benchmarked.length} Candidates
              </h3>
              <OverflowTooltip
                label={statusLabel(status)}
                className={setStatus({
                  tone: status.kind === "balanced" ? "positive" : "caution",
                })}
              >
                {statusLabel(status)}
              </OverflowTooltip>
            </div>
            <div className={outcomeBarStyle} aria-hidden>
              {KNOWN_OUTCOMES.filter((outcome) => outcomes[outcome] > 0).map(
                (outcome) => (
                  <span
                    key={outcome}
                    className={cx(
                      outcomeBarSegmentStyle,
                      outcomeColor({ outcome }),
                    )}
                    style={{ flexGrow: outcomes[outcome] }}
                  />
                ),
              )}
              {shortfall > 0 && (
                <span
                  className={cx(outcomeBarSegmentStyle, shortfallStyle)}
                  style={{ flexGrow: shortfall }}
                />
              )}
            </div>
            <ul className={legendStyle}>
              {KNOWN_OUTCOMES.map((outcome) => (
                <li
                  key={outcome}
                  className={legendItem({ missing: outcomes[outcome] === 0 })}
                >
                  {outcomes[outcome] === 0 ? (
                    <MismatchIcon aria-hidden className={bannerIconStyle} />
                  ) : (
                    <span
                      aria-hidden
                      className={cx(legendDotStyle, outcomeColor({ outcome }))}
                    />
                  )}
                  {outcomes[outcome]} {OUTCOME_LABEL[outcome].join(" → ")}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className={toolbarStyle}>
          {selected.size > 0 && (
            <div
              role="group"
              aria-label="Selected candidates"
              className={selectionActionsStyle}
            >
              {toRemove.length > 0 && (
                <button
                  type="button"
                  className={cx(plainButtonStyle, selectionActionStyle)}
                  onClick={() => act(onRemoveCandidates, toRemove)}
                >
                  <span className={plainButtonLabelStyle}>Remove</span>
                </button>
              )}
              {toAdd.length > 0 && (
                <button
                  type="button"
                  className={cx(plainButtonStyle, selectionActionStyle)}
                  onClick={() => act(onAddCandidates, toAdd)}
                >
                  <span className={plainButtonLabelStyle}>Add</span>
                </button>
              )}
            </div>
          )}
          <span className={columnsControlStyle}>
            <span className={addColumnStyle}>
              <AddIcon aria-hidden />
              Add column
            </span>
            <SeparatorLine aria-hidden className={columnsSeparatorStyle} />
            <TableViewIcon aria-hidden />
          </span>
        </div>

        {current === "suggested" ? (
          <SuggestedCandidates
            labelledBy={countId}
            removed={removed}
            onToggle={(id) =>
              removed.has(id) ? onAddCandidates([id]) : onRemoveCandidates([id])
            }
            selectAll={selectAll}
            selected={selected}
            onSelect={select}
          />
        ) : (
          <ResultsTable labelledBy={countId} selectAll={selectAll}>
            {listed.map(({ candidate, result }, index) => (
              <ResultRow
                key={candidate.id}
                candidate={candidate}
                result={result}
                striped={index % 2 === 1}
                selected={selected.has(candidate.id)}
                onSelect={() => select(candidate.id)}
                unfolded={unfolded.has(candidate.id)}
                onToggle={() => toggle(candidate.id)}
                findingRef={
                  candidate.id === firstMismatch ? findingRef : undefined
                }
              />
            ))}
          </ResultsTable>
        )}
      </div>

      {/* The results' own: the suggested candidates are not a benchmark. */}
      {/* Nothing to say of no results at all. */}
      {current === "results" && (stale || total > 0) && (
        <footer className={footerStyle}>
          {stale || mismatches > 0 ? (
            <>
              <p className={banner({ tone: "caution" })}>
                <MismatchIcon aria-hidden className={bannerIconStyle} />
                {stale ? (
                  "These results are no longer valid. Retest the criteria for up to date results."
                ) : (
                  <>
                    {mismatches}/{total} results mismatch with their known
                    outcomes on {criteriaAtFault}{" "}
                    {criteriaAtFault === 1 ? "criterion" : "criteria"}
                  </>
                )}
              </p>
              <div className={actionsStyle}>
                <button
                  ref={reviewRef}
                  type="button"
                  className={reviewButtonStyle}
                  aria-describedby={
                    stale ? undefined : walkthrough.describe("review-rewrites")
                  }
                  onClick={stale ? onRetest : onReviewRewrites}
                >
                  {stale ? "Retest criteria" : "Review suggested rewrites"}
                </button>
                {/* The walkthrough's fourth step is done here, and points at
                    the finding it is about: over it, clear of the resume
                    quoted under it. */}
                {!stale && (
                  <WalkthroughTip
                    step="review-rewrites"
                    anchor={findingRef}
                    control={reviewRef}
                    side="above"
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <p className={banner({ tone: "positive" })}>
                <MatchIcon aria-hidden className={bannerIconStyle} />
                <span ref={matchRef}>
                  {total}/{total} results match with their known outcomes on all
                  criteria
                </span>
              </p>
              {/* The walkthrough's last step: nothing here to press, so its
                  Finish closes the results. */}
              <WalkthroughTip
                step="results-match"
                anchor={matchRef}
                side="above"
                finish={onClose}
              />
            </>
          )}
        </footer>
      )}
    </>
  );
}

function statusLabel(status: CandidateSetStatus) {
  switch (status.kind) {
    case "balanced":
      return "Balanced";
    case "too-few":
      return `Add at least ${MIN_BENCHMARK_CANDIDATES} candidates`;
    case "missing":
      return status.outcomes.length > 1
        ? "Missing multiple candidate types"
        : `Missing ${OUTCOME_LABEL[status.outcomes[0]].join(" → ")} candidates`;
  }
}

/** The results' table: its columns and their heads, over the rows given. */
export function ResultsTable({
  labelledBy,
  selectAll,
  children,
}: {
  labelledBy: string;
  selectAll: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={tableScrollStyle}>
      <table
        className={cx(tableStyle, resultsTableStyle)}
        aria-labelledby={labelledBy}
      >
        <colgroup>
          <col style={{ width: 36 }} />
          <col style={{ width: 200 }} />
          <col style={{ width: 88 }} />
          <col style={{ width: 96 }} />
          <col style={{ width: 100 }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th className={cx(headCellStyle, ruledStyle)}>{selectAll}</th>
            <th scope="col" className={cx(headCellStyle, ruledStyle)}>
              <span className={nameHeadStyle}>
                Name/known outcome
                <span aria-hidden className={sortStyle}>
                  <SortIcon />
                </span>
              </span>
            </th>
            <th scope="col" className={cx(headCellStyle, ruledBesideStyle)}>
              Avg. score
            </th>
            <th scope="col" className={cx(headCellStyle, ruledBesideStyle)}>
              Evaluations
            </th>
            <th scope="col" className={cx(headCellStyle, ruledBesideStyle)}>
              Result
            </th>
            <th scope="col" className={cx(headCellStyle, ruledBesideStyle)}>
              Finding
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

interface CandidateTabProps {
  id: string;
  panelId: string;
  current: boolean;
  onSelect: () => void;
  children: ReactNode;
}

function CandidateTab({
  id,
  panelId,
  current,
  onSelect,
  children,
}: CandidateTabProps) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={current}
      aria-controls={panelId}
      tabIndex={current ? 0 : -1}
      className={tab({ current })}
      onClick={onSelect}
    >
      {children}
      {current && (
        <>
          <TabCornerBefore
            aria-hidden
            className={cx(tabCornerStyle, tabCornerBeforeStyle)}
          />
          <TabCornerAfter
            aria-hidden
            className={cx(tabCornerStyle, tabCornerAfterStyle)}
          />
        </>
      )}
    </button>
  );
}

export interface ResultRowProps {
  candidate: Pick<BenchmarkRow, "id" | "name" | "knownOutcome" | "avgScore">;
  /** Their benchmark result: none for one added back since the last run. */
  result: BenchmarkRow | null;
  striped: boolean;
  selected: boolean;
  onSelect: () => void;
  unfolded: boolean;
  onToggle: () => void;
  /** Given the finding's title, for what points at it. */
  findingRef?: Ref<HTMLParagraphElement>;
}

export function ResultRow({
  candidate,
  result,
  striped,
  selected,
  onSelect,
  unfolded,
  onToggle,
  findingRef,
}: ResultRowProps) {
  const caution = result?.mismatch ? cautionStyle : undefined;
  return (
    <tr
      className={rowTone({
        tone: result?.mismatch ? "mismatch" : striped ? "striped" : "plain",
      })}
    >
      <td className={cx(cellStyle, checkboxCellStyle, ruledStyle)}>
        <Checkbox
          label={`Select ${candidate.name}`}
          checked={selected}
          onChange={onSelect}
        />
      </td>
      <th scope="row" className={cx(cellStyle, ruledStyle)}>
        <div className={nameCellStyle}>
          <span className={cx(nameStyle, caution)}>{candidate.name}</span>
          <OutcomeTag outcome={candidate.knownOutcome} />
        </div>
      </th>
      <td className={cx(cellStyle, ruledBesideStyle)}>
        <AvgScore value={candidate.avgScore} />
      </td>
      {result ? (
        <BenchmarkedCells
          row={result}
          caution={caution}
          unfolded={unfolded}
          onToggle={onToggle}
          findingRef={findingRef}
        />
      ) : (
        <>
          <td className={cx(cellStyle, ruledBesideStyle)} />
          <td className={cx(cellStyle, ruledBesideStyle)} />
          <td className={cx(cellStyle, ruledBesideStyle)} />
        </>
      )}
    </tr>
  );
}

/** What the benchmark said of a candidate: Evaluations, Result and Finding. */
function BenchmarkedCells({
  row,
  caution,
  unfolded,
  onToggle,
  findingRef,
}: {
  row: BenchmarkRow;
  caution: string | undefined;
  unfolded: boolean;
  onToggle: () => void;
  findingRef?: Ref<HTMLParagraphElement>;
}) {
  const detailsId = useId();
  return (
    <>
      <td className={cx(cellStyle, ruledBesideStyle)}>
        <div className={centredStyle}>
          <EvaluationRing
            evaluations={row.evaluations}
            met={row.met}
            className={caution}
          />
        </div>
      </td>
      <td className={cx(cellStyle, ruledBesideStyle, resultStyle, caution)}>
        {row.result === "included" ? "Included" : "Excluded"}
      </td>
      {row.finding ? (
        <td className={cx(cellStyle, ruledBesideStyle, findingCellStyle)}>
          <MismatchIcon aria-hidden className={findingIconStyle} />
          <div className={findingStyle}>
            <p ref={findingRef} className={findingTitleStyle}>
              <span className={criterionNameStyle}>
                {row.finding.criterion}
              </span>{" "}
              mismatch
            </p>
            <div id={detailsId} className={detailsStyle}>
              {unfolded && (
                <>
                  <div className={detailStyle}>
                    <p className={detailHeadingStyle}>Why?</p>
                    <p>{row.finding.why}</p>
                  </div>
                  <div className={detailStyle}>
                    <p className={detailHeadingStyle}>From the resume</p>
                    <div className={quoteStyle}>
                      <span aria-hidden className={quoteRuleStyle} />
                      <p>“{row.finding.resumeQuote}”</p>
                    </div>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              className={detailsToggleStyle}
              aria-expanded={unfolded}
              aria-controls={detailsId}
              onClick={onToggle}
            >
              {unfolded ? "Hide details" : "Show details"}
            </button>
          </div>
        </td>
      ) : (
        <td className={cx(cellStyle, ruledBesideStyle, noFindingStyle)}>-</td>
      )}
    </>
  );
}

function OutcomeTag({ outcome }: { outcome: KnownOutcome }) {
  const [first, ...rest] = OUTCOME_LABEL[outcome];
  return (
    <span className={outcomeTag({ outcome })}>
      {first}
      {rest.map((part) => (
        <span key={part} className={contentsStyle}>
          <span aria-hidden>→</span>
          <span>{part}</span>
        </span>
      ))}
    </span>
  );
}

export function EvaluationRing({
  evaluations,
  met,
  className,
  small = false,
  bare = false,
}: {
  evaluations: readonly Evaluation[];
  met: number;
  className?: string;
  small?: boolean;
  /** The ring alone, without the count in it (Figma 147:8677). */
  bare?: boolean;
}) {
  const size = small ? 24 : 32;
  return (
    <span
      role="img"
      aria-label={`${met} of ${evaluations.length} criteria met`}
      className={ring({ small })}
    >
      <svg
        aria-hidden
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className={ringArcsStyle}
      >
        {evaluations.map((evaluation, i) => {
          const share = 360 / evaluations.length;
          return (
            <path
              key={i}
              d={arcPath(i * share + RING.gap, (i + 1) * share - RING.gap)}
              className={arc({ evaluation })}
              stroke="currentColor"
              strokeWidth={RING.stroke}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      {!bare && (
        <span aria-hidden className={cx(ringLabel({ small }), className)}>
          {met}/{evaluations.length}
        </span>
      )}
    </span>
  );
}
