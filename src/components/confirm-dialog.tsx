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

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** The verb, never "OK". */
  confirmLabel: string;
  confirmIcon: Icon;
  onConfirm: () => void;
  /** A third answer, between the affirmative and Cancel. */
  alternate?: { label: string; icon: Icon; onClick: () => void };
  onClose: () => void;
}

const CONFIRM_KEY = "1";
const ALTERNATE_KEY = "0";

// The root holds focus but the rows show it, so the root draws no ring.
const rootStyle = css({
  display: "flex",
  flexDirection: "column",
  outline: "none",
});

const messageStyle = css({
  paddingInline: "lg",
  paddingBlockStart: "md",
  textStyle: "bodySmall",
  color: "text.body/50",
  textWrap: "pretty",
});

const itemStyle = menuItem();
const iconStyle = menuIcon();

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
  const hasCursor = useHasCursor();

  /** Null means the affirmative: a captured label would highlight nothing on the next question. */
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      rootRef.current?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Every way out lands here, so `onClose` runs once per question.
  function answer(run?: () => void) {
    run?.();
    dialogRef.current?.close();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Prevented, not ignored: cmdk skips a prevented key, so Enter and the arrows do nothing.
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
