import { css } from "../../../../styled-system/css";
import type { SuggestedRewrite } from "./benchmark";
import type { DraftCriterion } from "./draft";
import { RewriteSuggestion } from "./rewrite-suggestion";
import ReorderIcon from "./icons/reorder.svg";
import TrashIcon from "./icons/trash.svg";

// ---------------------------------------------------------------------------
// One criterion in the edit drawer (Figma 94:5023): a handle, its short title
// and a trash can on one line, its prompt under them — as tall as its text —
// and under that any rewrite suggested for it. Reordering and deleting are
// drawn but not offered. The drawer holds the values and owns the field ids;
// the intro's third picture draws one too.
// ---------------------------------------------------------------------------

export type Field = "title" | "prompt";

/** The list the editors are stacked in, on the card's white body. */
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

// The source draws no focus state; the ring turns accent while the field is
// being typed in.
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

// A prompt is as tall as its text, one line or several, with no scrollbar and
// no measuring: the textarea shares a grid cell with an invisible copy of its
// own value, and the copy — ordinary wrapping text — sets the cell's height.
// The prompt, and under it any rewrite suggested for it.
const promptColumnStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  flex: 1,
  minWidth: 0,
});

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
  /** The ids of its two fields, which the drawer moves the focus by. */
  titleField: string;
  promptField: string;
  onEdit: (field: Field, value: string) => void;
  /** A rewrite suggested for its prompt, answered with Apply or Ignore. */
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
