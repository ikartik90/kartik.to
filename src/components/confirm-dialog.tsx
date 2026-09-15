"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type SVGProps,
} from "react";
import { Command } from "cmdk";
import { css, cx } from "../../styled-system/css";
import {
  commandGroup,
  commandHeader,
  commandList,
  dialogPanel,
  dialogTitle,
  hotkey,
  menuIcon,
  menuItem,
} from "../../styled-system/recipes";
import { Dialog } from "@/components/ui/dialog";
import { useHasCursor } from "@/hooks/use-has-cursor";
import CrossIcon from "@/assets/icons/cross.svg";

// ---------------------------------------------------------------------------
// A question before something that cannot be undone with one click —
// unpublishing a component, unpublishing or deleting an article, deleting a
// preset or an icon, leaving an editor with unsaved work.
//
// Asked in the command palette's shape rather than as a card of buttons: the
// title where the palette's field is, the question under it, and the answers
// as the palette's rows. The palette is how this app offers a choice, and the
// confirms mostly open as it closes — the same panel, in the same place,
// changing what it says. A footer of three buttons also had nowhere to go at
// 320px but onto two lines each.
//
// The rows run from the answer you most likely want to the one that does
// nothing, each with its key: the affirmative on 1, the alternate on 0, Cancel
// on Esc. The affirmative is highlighted on open, so Enter takes it too — as
// Enter takes the top row of the palette.
//
// Usually two answers. `alternate` adds a THIRD, for the one question here that
// genuinely has three — leaving an editor with unsaved work, where "save and
// go", "throw it away" and "stay" are all real answers and none of them is a
// rewording of another.
// ---------------------------------------------------------------------------

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export interface ConfirmDialogProps {
  open: boolean;
  /** The action, named as it appears in the header — e.g. "Unpublish Component". */
  title: string;
  /** The question, in full. Ends with a question mark; the rows answer it. */
  message: string;
  /** The affirmative row's label — the verb, never "OK". */
  confirmLabel: string;
  /** The affirmative row's glyph — the one the command that asked wears. */
  confirmIcon: Icon;
  onConfirm: () => void;
  /**
   * A third answer, between the affirmative and Cancel. Absent for the ordinary
   * two-answer question; see the note above for the one that needs it.
   */
  alternate?: { label: string; icon: Icon; onClick: () => void };
  onClose: () => void;
}

/** The keys that answer, as `KeyboardEvent.key` reports them. */
const CONFIRM_KEY = "1";
const ALTERNATE_KEY = "0";

// The root is the thing that holds the focus — there is no field to hold it —
// and the rows are what show where it is, so the root draws no ring of its own.
const rootStyle = css({
  display: "flex",
  flexDirection: "column",
  outline: "none",
});

// Inset to the header's 12px, so the title, the question and the row icons
// stand on one line; the list's own padding spaces it from the rows.
const messageStyle = css({
  paddingInline: "lg",
  paddingBlockStart: "md",
  textStyle: "bodySmall",
  color: "text.body/50",
  textWrap: "pretty",
});

const itemStyle = menuItem();
const iconStyle = menuIcon();

// The row's key, held against the far end of it — the palette's chip.
const itemHotkeyStyle = cx(
  hotkey({ surface: "menu" }),
  css({ marginInlineStart: "auto" }),
);

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmIcon: ConfirmIcon,
  onConfirm,
  alternate,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const messageId = useId();
  // Chips name keys; a device without a keyboard is shown none, as in the palette.
  const hasCursor = useHasCursor();

  /**
   * The highlighted row, or null for "the affirmative".
   *
   * Null rather than `confirmLabel` because the wording is a prop that changes
   * between questions — the palette's one confirm asks "Unpublish" and "Delete"
   * — and a label captured on one question would highlight nothing on the next.
   * Reset on every close, so each question opens on its affirmative.
   */
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Into the rows, where cmdk listens for the arrows and Enter, and this
      // for the digits. Nothing in here is otherwise focusable.
      rootRef.current?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Every way out — an answer, Cancel, Esc, the backdrop — closes the dialog
  // and arrives here, so `onClose` is called exactly once per question.
  function answer(run?: () => void) {
    run?.();
    dialogRef.current?.close();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // A question already answered answers nothing more. Prevented rather than
    // ignored, because cmdk skips a prevented key — otherwise Enter would
    // still take the highlighted row, and an arrow would move the highlight
    // the next question opens on.
    if (!dialogRef.current?.open) {
      e.preventDefault();
      return;
    }
    // ⌘1 / Ctrl 1 switch browser tabs, and are not an answer.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === CONFIRM_KEY) {
      e.preventDefault();
      answer(onConfirm);
    } else if (e.key === ALTERNATE_KEY && alternate) {
      e.preventDefault();
      answer(alternate.onClick);
    }
  }

  return (
    <Dialog
      ref={dialogRef}
      align="top-center"
      justify="center"
      aria-label={title}
      aria-describedby={messageId}
      className={dialogPanel({ size: "sm" })}
      onClose={() => {
        // Safari leaves the focus on the rows of a closed dialog, where the
        // keys would still reach them. Chromium has already handed it back.
        if (rootRef.current?.contains(document.activeElement)) {
          (document.activeElement as HTMLElement).blur();
        }
        setSelected(null);
        onClose();
      }}
    >
      <Command
        ref={rootRef}
        label={title}
        tabIndex={-1}
        loop
        shouldFilter={false}
        value={selected ?? confirmLabel}
        onValueChange={setSelected}
        onKeyDown={handleKeyDown}
        className={rootStyle}
      >
        <header className={commandHeader()}>
          <h2 className={dialogTitle()}>{title}</h2>
        </header>

        <p id={messageId} className={messageStyle}>
          {message}
        </p>

        <Command.List className={commandList()}>
          <Command.Group className={commandGroup()}>
            <Command.Item
              value={confirmLabel}
              aria-keyshortcuts={CONFIRM_KEY}
              className={itemStyle}
              onSelect={() => answer(onConfirm)}
            >
              <ConfirmIcon className={iconStyle} />
              {confirmLabel}
              {hasCursor && (
                <kbd aria-hidden className={itemHotkeyStyle}>
                  {CONFIRM_KEY}
                </kbd>
              )}
            </Command.Item>
            {alternate && (
              <Command.Item
                value={alternate.label}
                aria-keyshortcuts={ALTERNATE_KEY}
                className={itemStyle}
                onSelect={() => answer(alternate.onClick)}
              >
                <alternate.icon className={iconStyle} />
                {alternate.label}
                {hasCursor && (
                  <kbd aria-hidden className={itemHotkeyStyle}>
                    {ALTERNATE_KEY}
                  </kbd>
                )}
              </Command.Item>
            )}
            {/* Esc is the Dialog's own — it closes, which is all Cancel does. */}
            <Command.Item
              value="Cancel"
              aria-keyshortcuts="Escape"
              className={itemStyle}
              onSelect={() => answer()}
            >
              <CrossIcon className={iconStyle} />
              Cancel
              {hasCursor && (
                <kbd aria-hidden className={itemHotkeyStyle}>
                  Esc
                </kbd>
              )}
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </Dialog>
  );
}
