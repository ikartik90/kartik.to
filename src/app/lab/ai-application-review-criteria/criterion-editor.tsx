import { css } from "../../../../styled-system/css";
import type { SuggestedRewrite } from "./benchmark";
import type { DraftCriterion } from "./draft";
import { RewriteSuggestion } from "./rewrite-suggestion";
import ReorderIcon from "./icons/reorder.svg";
import TrashIcon from "./icons/trash.svg";

export type Field = "title" | "prompt";

export const criterionEditorsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "12px",
  backgroundColor: "var(--cashby-surface)",
});

const editorStyle = css({
  position: "relative",
  display: "flex",
  alignItems: "flex-start",
  overflow: "hidden",
  borderRadius: "8px",
  backgroundColor: "var(--cashby-surface)",
  _after: {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-border)",
    pointerEvents: "none",
  },
});

const handleStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  alignSelf: "stretch",
  flexShrink: 0,
  width: "28px",
  borderInlineEndWidth: "var(--cashby-rule)",
  borderInlineEndStyle: "solid",
  borderInlineEndColor: "var(--cashby-border)",
});

const fieldsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  flex: 1,
  minWidth: 0,
  padding: "8px",
});

const titleRowStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "4px",
});

const fieldRowStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "4px",
  minWidth: 0,
});

const labelStyle = css({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  width: "80px",
  height: "32px",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  font: "var(--cashby-text-small)",
  color: "var(--cashby-slate)",
});

const fieldFrame = {
  borderRadius: "4px",
  backgroundColor: "var(--cashby-surface)",
  boxShadow: "inset 0 0 0 1px var(--cashby-border)",
} as const;

const titleInputStyle = css({
  ...fieldFrame,
  flexShrink: 1,
  minWidth: 0,
  width: "240px",
  height: "32px",
  paddingInline: "6px",
  font: "var(--cashby-text-body)",
  color: "var(--cashby-ink)",
  outline: "none",
  _focus: { boxShadow: "inset 0 0 0 1px var(--cashby-accent)" },
});

const promptColumnStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  flex: 1,
  minWidth: 0,
});

// Auto-height: the textarea shares a grid cell with a hidden copy of its text, which sizes it.
const promptFieldStyle = css({
  ...fieldFrame,
  display: "grid",
  minWidth: 0,
  _focusWithin: { boxShadow: "inset 0 0 0 1px var(--cashby-accent)" },
});

const promptLayer = {
  gridArea: "1 / 1",
  paddingBlock: "4px",
  paddingInline: "6px",
  font: "var(--cashby-text-body)",
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
} as const;

const promptInputStyle = css({
  ...promptLayer,
  resize: "none",
  overflow: "hidden",
  backgroundColor: "transparent",
  color: "var(--cashby-ink)",
  outline: "none",
});

const promptCopyStyle = css({ ...promptLayer, visibility: "hidden" });

const trashStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "28px",
  height: "28px",
  borderRadius: "4px",
});

export interface CriterionEditorProps {
  row: DraftCriterion;
  titleField: string;
  promptField: string;
  onEdit: (field: Field, value: string) => void;
  rewrite?: SuggestedRewrite;
  onAnswerRewrite: (apply: boolean) => void;
}

export function CriterionEditor({
  row,
  titleField,
  promptField,
  onEdit,
  rewrite,
  onAnswerRewrite,
}: CriterionEditorProps) {
  return (
    <li className={editorStyle}>
      <span className={handleStyle} aria-hidden>
        <ReorderIcon />
      </span>
      <div className={fieldsStyle}>
        <div className={titleRowStyle}>
          <div className={fieldRowStyle}>
            <label htmlFor={titleField} className={labelStyle}>
              Short title
            </label>
            <input
              id={titleField}
              className={titleInputStyle}
              value={row.title}
              onChange={(event) => onEdit("title", event.target.value)}
            />
          </div>
          <span className={trashStyle} aria-hidden>
            <TrashIcon />
          </span>
        </div>
        <div className={fieldRowStyle}>
          <label htmlFor={promptField} className={labelStyle}>
            Prompt
          </label>
          <div className={promptColumnStyle}>
            <div className={promptFieldStyle}>
              <textarea
                id={promptField}
                rows={1}
                className={promptInputStyle}
                value={row.prompt}
                onChange={(event) => onEdit("prompt", event.target.value)}
              />
              {/* The trailing space holds a line open for a trailing newline. */}
              <span className={promptCopyStyle} aria-hidden>
                {`${row.prompt} `}
              </span>
            </div>
            {rewrite && (
              <RewriteSuggestion
                rewrite={rewrite}
                onApply={() => onAnswerRewrite(true)}
                onIgnore={() => onAnswerRewrite(false)}
              />
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
