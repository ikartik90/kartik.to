"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { css, cx } from "../../styled-system/css";
import {
  buttonLinkClass,
  buttonLinkRowStyle,
  buttonLinkStickyRowStyle,
} from "@/components/button-link";
import type { ButtonLinkNode } from "@/domain/nodes";

const labelEditStyle = css({
  cursor: "text",
  _active: { transform: "none" },
  whiteSpace: "pre",
  focusVisibleRing: "none",
  outline: "none",
  "&[data-empty]::before": {
    content: "attr(data-placeholder)",
    color: "text.body/40",
    pointerEvents: "none",
  },
});

export interface EditableButtonLinkProps {
  block: ButtonLinkNode;
  blockIndex: number;
  onChange: (block: ButtonLinkNode) => void;
  onDelete: () => void;
  onArrowUp: () => void;
  onArrowDown: () => void;
  onArrowLeft: () => void;
  onArrowRight: () => void;
  onInsertParagraphAfter: () => void;
  elRef: (el: HTMLElement | null) => void;
}

function caretOffset(el: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;
  const before = document.createRange();
  before.selectNodeContents(el);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().length;
}

function focusAtEnd(el: HTMLElement) {
  el.focus();
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function EditableButtonLink({
  block,
  blockIndex,
  onChange,
  onDelete,
  onArrowUp,
  onArrowDown,
  onArrowLeft,
  onArrowRight,
  onInsertParagraphAfter,
  elRef,
}: EditableButtonLinkProps) {
  const labelRef = useRef<HTMLSpanElement>(null);

  // Follows the document except while being typed in; before paint so the button never shows empty.
  useLayoutEffect(() => {
    const label = labelRef.current;
    if (!label || document.activeElement === label) return;
    if (label.textContent !== block.text) label.textContent = block.text;
  }, [block.text]);

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const label = event.currentTarget;
    switch (event.key) {
      case "Enter":
        event.preventDefault();
        onInsertParagraphAfter();
        return;
      case "Backspace":
      case "Delete":
        if (label.textContent === "") {
          event.preventDefault();
          onDelete();
        }
        return;
      case "ArrowUp":
        if (event.shiftKey) return;
        event.preventDefault();
        onArrowUp();
        return;
      case "ArrowDown":
        if (event.shiftKey) return;
        event.preventDefault();
        onArrowDown();
        return;
      case "ArrowLeft":
        if (!event.shiftKey && caretOffset(label) === 0) {
          event.preventDefault();
          onArrowLeft();
        }
        return;
      case "ArrowRight":
        if (
          !event.shiftKey &&
          caretOffset(label) === (label.textContent ?? "").length
        ) {
          event.preventDefault();
          onArrowRight();
        }
        return;
      case "Tab":
        event.preventDefault();
        return;
    }
  };

  return (
    <div
      ref={elRef}
      tabIndex={-1}
      className={cx(
        buttonLinkRowStyle,
        block.sticky && buttonLinkStickyRowStyle,
      )}
      data-block-index={blockIndex}
      data-button-link-block=""
      data-sticky={block.sticky ? "" : undefined}
      onFocus={(event) => {
        if (event.target === event.currentTarget && labelRef.current) {
          focusAtEnd(labelRef.current);
        }
      }}
    >
      <span
        ref={labelRef}
        role="textbox"
        aria-label="Button text"
        aria-multiline="false"
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck
        data-button-label=""
        data-placeholder="Button text"
        data-empty={block.text === "" ? "" : undefined}
        className={cx(buttonLinkClass(block.color), labelEditStyle)}
        onInput={(event) =>
          onChange({ ...block, text: event.currentTarget.textContent ?? "" })
        }
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
