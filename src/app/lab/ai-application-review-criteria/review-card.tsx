"use client";

import { useState } from "react";
import { css, cx } from "../../../../styled-system/css";
import { EditCriteria } from "./edit-criteria";
import { startingDraft, type DraftCriterion } from "./draft";
import {
  card,
  cardActionsStyle,
  cardHeaderStyle,
  cardTitleBoxStyle,
  cardTitleStyle,
  UpToDate,
} from "./parts";
import CriterionIcon from "./icons/document-check.svg";

const REVIEW_TITLE_ID = "ai-review-title";

const reviewActionsStyle = css({ gap: "12px" });

const criteriaStyle = css({
  display: "flex",
  flexDirection: "column",
  paddingInlineStart: "8px",
  backgroundColor: "var(--cashby-surface)",
});

const criterionStyle = css({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  paddingBlock: "8px",
  paddingInlineStart: "28px",
  paddingInlineEnd: "4px",
  borderBlockEndWidth: "var(--cashby-rule)",
  borderBlockEndStyle: "solid",
  borderBlockEndColor: "var(--cashby-border)",
  _last: { borderBlockEndWidth: 0 },
});

const criterionTitleStyle = css({ font: "var(--cashby-text-body)" });

const criterionPromptStyle = css({
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  font: "var(--cashby-text-small)",
  color: "var(--cashby-slate-subtle)",
});

const criterionIconStyle = css({
  position: "absolute",
  insetBlockStart: "10px",
  insetInlineStart: "4px",
});

export function ReviewCard() {
  const [running, setRunning] = useState<DraftCriterion[]>(startingDraft);

  return (
    <div className={card({ outline: "hairline" })}>
      <div className={cardHeaderStyle}>
        <div className={cardTitleBoxStyle}>
          <h3 id={REVIEW_TITLE_ID} className={cardTitleStyle}>
            AI-assisted application review
          </h3>
        </div>
        <div className={cx(cardActionsStyle, reviewActionsStyle)}>
          <UpToDate />
          <EditCriteria running={running} onSave={setRunning} />
        </div>
      </div>
      <ul className={criteriaStyle} aria-labelledby={REVIEW_TITLE_ID}>
        {running.map((criterion) => (
          <li key={criterion.id} className={criterionStyle}>
            <h4 className={criterionTitleStyle}>{criterion.title}</h4>
            <p className={criterionPromptStyle}>{criterion.prompt}</p>
            <CriterionIcon aria-hidden className={criterionIconStyle} />
          </li>
        ))}
      </ul>
    </div>
  );
}
