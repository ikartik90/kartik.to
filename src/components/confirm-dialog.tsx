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
// One component for all three because the question is the same shape every
// time: a name for what is about to happen, a sentence saying it plainly, and
// two buttons where the destructive one is on the right. What differs is only
// the wording, which is why all of it is props and none of it is a variant.
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
