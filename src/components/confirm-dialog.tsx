"use client";

import { useEffect, useRef } from "react";
import { css } from "../../styled-system/css";
import {
  dialogFooter,
  dialogHeader,
  dialogPanel,
  dialogTitle,
} from "../../styled-system/recipes";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";

// ---------------------------------------------------------------------------
// A yes/no question before something that cannot be undone with one click
// (Figma 979:2025) — unpublishing a component, unpublishing or deleting an
// article.
//
// One component for all of them because the question is the same shape every
// time: a name for what is about to happen, a sentence saying it plainly, and
// the answers as buttons. What differs is only the wording, which is why all of
// it is props and none of it is a variant.
//
// Usually two answers, with the destructive one on the right. `alternate` adds
// a THIRD, for the one question here that genuinely has three — leaving an
// editor with unsaved work, where "save and go", "throw it away" and "stay" are
// all real answers and none of them is a rewording of another. It sits in the
// middle so the outer two keep their meanings: cancel on the left, the button
// you most likely want on the right.
//
// Positioned and animated as the command palette is, rather than sliding up
// from the bottom edge: the app already has exactly one way a modal arrives,
// and a confirm that entered differently would read as coming from somewhere
// else in the system.
// ---------------------------------------------------------------------------

export interface ConfirmDialogProps {
  open: boolean;
  /** The action, named as it appears in the header — e.g. "Unpublish Component". */
  title: string;
  /** The question, in full. Ends with a question mark; the buttons answer it. */
  message: string;
  /** The affirmative button's label — the verb, never "OK". */
  confirmLabel: string;
  onConfirm: () => void;
  /**
   * A third answer, between Cancel and the affirmative. Absent for the ordinary
   * two-answer question; see the note above for the one that needs it.
   */
  alternate?: { label: string; onClick: () => void };
  onClose: () => void;
}

const bodyStyle = css({
  paddingInline: "lg",
  paddingBlock: "xl",
});

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  alternate,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <Dialog
      ref={dialogRef}
      align="top-center"
      justify="center"
      aria-label={title}
      className={dialogPanel({ size: "xs" })}
      onClose={onClose}
    >
      <header className={dialogHeader()}>
        <h2 className={dialogTitle()}>{title}</h2>
      </header>

      <div className={bodyStyle}>
        <Typography tag="p" type="bodySmall">
          {message}
        </Typography>
      </div>

      <footer className={dialogFooter()}>
        <Button type="button" emphasis="tertiary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        {alternate && (
          <Button
            type="button"
            emphasis="secondary"
            size="sm"
            onClick={() => {
              alternate.onClick();
              onClose();
            }}
          >
            {alternate.label}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </footer>
    </Dialog>
  );
}
