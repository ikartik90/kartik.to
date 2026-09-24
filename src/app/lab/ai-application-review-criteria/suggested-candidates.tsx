import type { ReactNode } from "react";
import { css, cva, cx } from "../../../../styled-system/css";
import { BENCHMARK_CANDIDATES, type KnownOutcome } from "./harness-data";
import {
  OUTCOME_LABEL,
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
import { plainButtonLabelStyle, plainButtonStyle } from "./parts";
import SortIcon from "./icons/sort-alphabetic-asc.svg";
import StageSeparator from "./icons/separator-stage.svg";
import { OverflowTooltip } from "./overflow-tooltip";
import { Checkbox } from "./checkbox";
import { AvgScore } from "./avg-score";

// ---------------------------------------------------------------------------
// The job's suggested candidates (Figma 57:846) — the same twelve the benchmark
// is run against, each with where they work now, their average score from the
// talent pool, and how their application to one of the company's past openings
// ended, and when.
//
// Remove takes a candidate out of the benchmark — they stay listed, to be
// added back.
// ---------------------------------------------------------------------------

// The name and average score columns are the results table's, so the two
// line up from tab to tab; the stage outcome takes what is left, and one too
// long for it is cut short (see `StageTag`). Past this the table scrolls, as
// the results' does.
const suggestedTableStyle = css({ minWidth: "760px" });

// Where the candidate works now, and when their application was decided.
const quietStyle = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  font: "var(--cashby-text-small)",
  color: "var(--cashby-slate-subtle)",
});

const stageCellStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "4px",
});

// The opening and how it ended, in one pill ruled down the middle in its own
// colour — a tint laid over white, outlined in the ink. One line of text, so
// that where the column is too narrow for it, it ends in an ellipsis; the
// whole of it is in a tooltip.
const stageTag = cva({
  base: {
    display: "inline-block",
    maxWidth: "100%",
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
    outcome: {
      hired: {
        backgroundColor: "var(--cashby-positive-tag)",
        boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-positive-ink)",
        color: "var(--cashby-positive-ink)",
      },
      "archived-interview": {
        backgroundColor: "var(--cashby-caution-tag)",
        boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-caution-ink)",
        color: "var(--cashby-caution-ink)",
      },
      "archived-application-review": {
        backgroundColor: "var(--cashby-hairline)",
        boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-slate)",
        color: "var(--cashby-slate)",
      },
    },
  },
});

// The rule runs the pill's full height, 4px clear either side; its own
// half-pixel stroke hangs either side of a line of no width. In a box of its
// own: the source's glyph is `display: block` inline, which would break the
// pill's one line in two.
const stageSeparatorStyle = css({
  display: "inline-block",
  verticalAlign: "top",
  width: 0,
  height: "24px",
  marginInline: "4px",
  "& svg": { marginBlock: "-0.25px", marginInline: "-0.25px" },
});

// Each later part of the outcome, 4px after the one before.
const stagePartStyle = css({ marginInlineStart: "4px" });

const removeStyle = css({ paddingInline: "8px" });

export interface SuggestedCandidatesProps {
  labelledBy: string;
  /** The candidates taken out of the benchmark. */
  removed: ReadonlySet<string>;
  /** Take a candidate out of the benchmark, or put them back. */
  onToggle: (id: string) => void;
  /** The header's checkbox, for every candidate listed. */
  selectAll: ReactNode;
  selected: ReadonlySet<string>;
  onSelect: (id: string) => void;
}

export function SuggestedCandidates({
  labelledBy,
  removed,
  onToggle,
  selectAll,
  selected,
  onSelect,
}: SuggestedCandidatesProps) {
  return (
    <div className={tableScrollStyle}>
      <table
        className={cx(tableStyle, suggestedTableStyle)}
        aria-labelledby={labelledBy}
      >
        <colgroup>
          <col style={{ width: 36 }} />
          <col style={{ width: 200 }} />
          <col style={{ width: 88 }} />
          <col />
          <col style={{ width: 120 }} />
        </colgroup>
        <thead>
          <tr>
            <th className={cx(headCellStyle, ruledStyle)}>{selectAll}</th>
            <th scope="col" className={cx(headCellStyle, ruledStyle)}>
              <span className={nameHeadStyle}>
                Name/Company
                <span aria-hidden className={sortStyle}>
                  <SortIcon />
                </span>
              </span>
            </th>
            <th scope="col" className={cx(headCellStyle, ruledBesideStyle)}>
              Avg. score
            </th>
            <th scope="col" className={cx(headCellStyle, ruledBesideStyle)}>
              Stage outcome
            </th>
            <th scope="col" className={cx(headCellStyle, ruledBesideStyle)}>
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {BENCHMARK_CANDIDATES.map((candidate, index) => (
            <tr
              key={candidate.id}
              className={rowTone({
                tone: index % 2 === 1 ? "striped" : "plain",
              })}
            >
              <td className={cx(cellStyle, checkboxCellStyle, ruledStyle)}>
                <Checkbox
                  label={`Select ${candidate.name}`}
                  checked={selected.has(candidate.id)}
                  onChange={() => onSelect(candidate.id)}
                />
              </td>
              <th scope="row" className={cx(cellStyle, ruledStyle)}>
                <div className={nameCellStyle}>
                  <span className={nameStyle}>{candidate.name}</span>
                  <span className={quietStyle}>{candidate.company}</span>
                </div>
              </th>
              <td className={cx(cellStyle, ruledBesideStyle)}>
                <AvgScore value={candidate.avgScore} />
              </td>
              <td className={cx(cellStyle, ruledBesideStyle)}>
                <div className={stageCellStyle}>
                  <StageTag
                    role={candidate.role}
                    outcome={candidate.knownOutcome}
                  />
                  <span className={quietStyle}>{candidate.decided}</span>
                </div>
              </td>
              <td className={cx(cellStyle, ruledBesideStyle)}>
                <button
                  type="button"
                  className={cx(plainButtonStyle, removeStyle)}
                  onClick={() => onToggle(candidate.id)}
                >
                  <span className={plainButtonLabelStyle}>
                    {removed.has(candidate.id) ? "Add" : "Remove"}
                  </span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StageTag({ role, outcome }: { role: string; outcome: KnownOutcome }) {
  const [first, ...rest] = OUTCOME_LABEL[outcome];
  return (
    <OverflowTooltip
      label={`${role} | ${OUTCOME_LABEL[outcome].join(" → ")}`}
      className={stageTag({ outcome })}
      data-stage-tag=""
    >
      <span>{role}</span>
      <span aria-hidden className={stageSeparatorStyle}>
        <StageSeparator />
      </span>
      <span>{first}</span>
      {rest.map((part) => (
        <span key={part}>
          <span aria-hidden className={stagePartStyle}>
            →
          </span>
          <span className={stagePartStyle}>{part}</span>
        </span>
      ))}
    </OverflowTooltip>
  );
}
