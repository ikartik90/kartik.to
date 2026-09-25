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

// Name and score column widths match the results table, so the tabs line up.
const suggestedTableStyle = css({ minWidth: "760px" });

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

const stageTag = cva({
  base: {
    display: "inline-block",
    maxWidth: "100%",
    height: "24px",
    paddingInline: "8px",
    borderRadius: "16px",
    font: "var(--cashby-text-small)",
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

// An inline-block box: the glyph is `display: block` and would break the line.
const stageSeparatorStyle = css({
  display: "inline-block",
  verticalAlign: "top",
  width: 0,
  height: "24px",
  marginInline: "4px",
  "& svg": { marginBlock: "-0.25px", marginInline: "-0.25px" },
});

const stagePartStyle = css({ marginInlineStart: "4px" });

const removeStyle = css({ paddingInline: "8px" });

export interface SuggestedCandidatesProps {
  labelledBy: string;
  removed: ReadonlySet<string>;
  onToggle: (id: string) => void;
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
