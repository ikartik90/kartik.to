"use client";

import { useEffect, useRef } from "react";
import { css } from "../../../../styled-system/css";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/input/text-area";
import { Tooltip } from "@/components/ui/tooltip";
import AddIcon from "@/assets/icons/add.svg";
import CheckIcon from "@/assets/icons/check.svg";
import EditIcon from "@/assets/icons/edit.svg";
import { ValuesActions } from "./values-actions";
import { NO_EDITS, fromValues, toValues, type Edits, type Spot, type StepEdit } from "./comment-edits";
import { TOUR } from "./copy";
import { useCommentEditor, type StepId } from "./tour";

// Kartik's editor for the walk-through's comments, in the About sheet. Edit, delete or add comments, drag pins
// on the page, then copy the values: only what changed, for the comments' real update.

const editorStyle = css({ display: "flex", flexDirection: "column", gap: "xl" });

const headStyle = css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "md" });

const titleStyle = css({ textStyle: "subheading", color: "text.title" });

const actionsStyle = css({ display: "flex", alignItems: "center", gap: "xs" });

const addStyle = css({ display: "flex", alignItems: "center", gap: "md", flexWrap: "wrap" });

const noteStyle = css({ textStyle: "caption", color: "text.body" });

const listStyle = css({ display: "flex", flexDirection: "column", gap: "xl" });

const itemStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "sm",
  paddingInlineStart: "lg",
  boxShadow: "inset 1px 0 0 var(--colors-border-divider)",
  "&[aria-current]": { boxShadow: "inset 2px 0 0 var(--colors-text-highlight)" },
  "&[data-deleted] textarea": { textDecoration: "line-through" },
});

const rowStyle = css({ display: "flex", alignItems: "center", gap: "md", flexWrap: "wrap" });

/** Where a moved or added pin points, and the window it was placed in. */
function where(spot: Spot) {
  return `Points at ${spot.what} (placed at ${spot.viewport.width} × ${spot.viewport.height})`;
}

/** The About sheet's switch between the project story and the comment editor, in development only. */
export function EditCommentsToggle() {
  const { editing, setEditing, setPlacing } = useCommentEditor();
  if (process.env.NODE_ENV !== "development") return null;
  const label = editing ? "Done editing" : "Edit comments";
  return (
    <Button
      variant="icon"
      aria-label={label}
      aria-pressed={editing}
      onClick={() => {
        setPlacing(false);
        setEditing(!editing);
      }}
    >
      {editing ? <CheckIcon aria-hidden /> : <EditIcon aria-hidden />}
      <Button.Tooltip>
        <Tooltip.Text>{label}</Tooltip.Text>
      </Button.Tooltip>
    </Button>
  );
}

export function CommentEditor() {
  const { editing, edits, setEdits, at, shown, placing, setPlacing, added } = useCommentEditor();
  const fields = useRef(new Map<string, HTMLTextAreaElement>());
  const hint = useRef<HTMLDivElement>(null);

  // A new comment's field takes focus, ready for its text.
  useEffect(() => {
    if (added) fields.current.get(added)?.focus();
  }, [added]);

  // Escape stops waiting for a spot (the overlay passes it on as this event).
  useEffect(() => {
    const node = hint.current;
    if (!placing || !node) return;
    const cancel = () => setPlacing(false);
    node.addEventListener("escape-layer", cancel);
    return () => node.removeEventListener("escape-layer", cancel);
  }, [placing, setPlacing]);

  if (!editing) return null;

  const editStep = (id: StepId, change: (edit: StepEdit) => StepEdit) =>
    setEdits((now) => {
      const next = change(now.steps[id] ?? {});
      const kept = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined && value !== false));
      return { ...now, steps: { ...now.steps, [id]: kept } };
    });
  const editAdded = (id: string, change: Partial<Edits["added"][number]> | null) =>
    setEdits((now) => ({
      ...now,
      added: change
        ? now.added.map((comment) => (comment.id === id ? { ...comment, ...change } : comment))
        : now.added.filter((comment) => comment.id !== id),
    }));

  return (
    <div className={editorStyle}>
      <div className={headStyle}>
        <h2 className={titleStyle}>Comments</h2>
        <div className={actionsStyle}>
          <ValuesActions
            values={toValues(edits)}
            onPaste={(pasted) => {
              const next = fromValues(pasted);
              if (next) setEdits(() => next);
              return !!next;
            }}
            onReset={() => setEdits(() => NO_EDITS)}
          />
        </div>
      </div>

      <div ref={hint} className={addStyle} data-escape-layer={placing ? "" : undefined}>
        {placing ? (
          <>
            <span className={noteStyle}>Click a spot on the page to pin it</span>
            {/* Focus moves here from Add comment, which this replaces. */}
            <Button variant="link" autoFocus onClick={() => setPlacing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button emphasis="secondary" size="sm" onClick={() => setPlacing(true)}>
            <AddIcon aria-hidden />
            Add comment
          </Button>
        )}
      </div>

      <ol className={listStyle}>
        {TOUR.steps.map((step, index) => {
          const edit = edits.steps[step.id] ?? {};
          const label = `${index + 1}. ${step.title}`;
          return (
            <li key={step.id} className={listStyle}>
              <div
                className={itemStyle}
                aria-current={shown === index ? "step" : undefined}
                data-deleted={edit.deleted ? "" : undefined}
              >
                <TextArea
                  label={label}
                  size="sm"
                  rows={3}
                  value={edit.text ?? step.body}
                  disabled={edit.deleted}
                  hint={edit.spot ? where(edit.spot) : undefined}
                  onChange={(event) => {
                    const text = event.target.value;
                    editStep(step.id, (now) => ({ ...now, text: text === step.body ? undefined : text }));
                  }}
                />
                <div className={rowStyle}>
                  <Button variant="link" onClick={() => editStep(step.id, (now) => ({ ...now, deleted: !now.deleted }))}>
                    {edit.deleted ? "Restore" : "Delete"}
                  </Button>
                  {edit.text !== undefined && (
                    <Button variant="link" onClick={() => editStep(step.id, (now) => ({ ...now, text: undefined }))}>
                      Undo edit
                    </Button>
                  )}
                  {edit.spot && (
                    <Button variant="link" onClick={() => editStep(step.id, (now) => ({ ...now, spot: undefined }))}>
                      Reset spot
                    </Button>
                  )}
                </div>
              </div>
              {edits.added
                .filter((comment) => comment.step === step.id)
                .map((comment) => (
                  <div key={comment.id} className={itemStyle} aria-current={at === index ? "step" : undefined}>
                    <TextArea
                      ref={(node) => {
                        if (node) fields.current.set(comment.id, node);
                        else fields.current.delete(comment.id);
                      }}
                      label={`Added comment, with step ${index + 1}`}
                      size="sm"
                      rows={3}
                      value={comment.text}
                      hint={where(comment.spot)}
                      onChange={(event) => editAdded(comment.id, { text: event.target.value })}
                    />
                    <div className={rowStyle}>
                      <Button variant="link" onClick={() => editAdded(comment.id, null)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
