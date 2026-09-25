"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { css, cx } from "../../styled-system/css";
import { selectionPopover, toolbar } from "../../styled-system/recipes";
import { Popover } from "@/components/ui/popover";
import {
  buttonLinkClass,
  buttonLinkRowStyle,
  buttonLinkStickyRowStyle,
} from "@/components/button-link";
import { LinkActions, LinkEditRow } from "@/components/link-toolbar";
import {
  ButtonLinkHrefSchema,
  type ButtonLinkColor,
  type ButtonLinkNode,
} from "@/domain/nodes";
import { normalizeLinkHref } from "@/utils/link-href";

/** Long enough to cross the gap from the button to its toolbar. */
const HOVER_GRACE_MS = 150;

const toolbarClass = cx(toolbar(), selectionPopover());

const anchorStyle = css({ display: "inline-flex" });

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

/** Off removes the field, so an untouched button saves exactly as before. */
function withFlag(
  block: ButtonLinkNode,
  flag: "newTab" | "sticky",
  on: boolean,
): ButtonLinkNode {
  const { [flag]: _, ...rest } = block;
  return on ? { ...rest, [flag]: true } : rest;
}

/** Neutral removes the field, as an off flag does. */
function withColor(
  block: ButtonLinkNode,
  color: ButtonLinkColor,
): ButtonLinkNode {
  const { color: _, ...rest } = block;
  return color === "neutral" ? rest : { ...rest, color };
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
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Unique per button, or two toolbars would share one anchor.
  const anchorName = `--button-link-${useId().replace(/[^\w-]/g, "")}`;

  const open = editing || (!dismissed && (hovered || focused));

  // Follows the document except while being typed in; before paint so the button never shows empty.
  useLayoutEffect(() => {
    const label = labelRef.current;
    if (!label || document.activeElement === label) return;
    if (label.textContent !== block.text) label.textContent = block.text;
  }, [block.text]);

  useEffect(
    () => () => {
      if (graceTimer.current !== null) clearTimeout(graceTimer.current);
    },
    [],
  );

  const cancelGrace = () => {
    if (graceTimer.current === null) return;
    clearTimeout(graceTimer.current);
    graceTimer.current = null;
  };

  const handlePointerEnter = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    cancelGrace();
    setDismissed(false);
    setHovered(true);
  };

  const handlePointerLeave = () => {
    cancelGrace();
    graceTimer.current = setTimeout(() => {
      graceTimer.current = null;
      setHovered(false);
    }, HOVER_GRACE_MS);
  };

  const backToLabel = () => {
    setEditing(false);
    setInvalid(false);
    const label = labelRef.current;
    if (label) focusAtEnd(label);
  };

  const applyHref = (typed: string, newTab: boolean) => {
    const href = normalizeLinkHref(typed);
    if (!ButtonLinkHrefSchema.safeParse(href).success) {
      setInvalid(true);
      return;
    }
    onChange(withFlag({ ...block, href }, "newTab", newTab));
    backToLabel();
  };

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
      <div
        className={anchorStyle}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={() => {
          setDismissed(false);
          setFocused(true);
        }}
        onBlur={(event) => {
          if (
            event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            return;
          }
          setFocused(false);
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
          style={{ anchorName } as CSSProperties}
          onInput={(event) =>
            onChange({ ...block, text: event.currentTarget.textContent ?? "" })
          }
          onKeyDown={handleKeyDown}
        />

        {open &&
          (editing ? (
            <Popover
              className={toolbarClass}
              style={{ positionAnchor: anchorName } as CSSProperties}
              role="toolbar"
              ariaLabel="Edit link"
              dismissOnOutsidePointer={false}
              onDismiss={backToLabel}
            >
              <LinkEditRow
                href={block.href}
                newTab={block.newTab}
                invalid={invalid}
                onInput={() => setInvalid(false)}
                onApply={applyHref}
              />
            </Popover>
          ) : (
            <Popover
              className={toolbarClass}
              style={{ positionAnchor: anchorName } as CSSProperties}
              dismissOnOutsidePointer={false}
              onDismiss={() => {
                cancelGrace();
                setDismissed(true);
              }}
            >
              <LinkActions
                canOpen={block.href !== ""}
                removeLabel="Delete button link"
                sticky={block.sticky}
                onToggleSticky={() =>
                  onChange(withFlag(block, "sticky", !block.sticky))
                }
                color={block.color}
                onColorChange={(color) => onChange(withColor(block, color))}
                onEdit={() => {
                  cancelGrace();
                  setEditing(true);
                }}
                onOpen={() =>
                  window.open(block.href, "_blank", "noopener,noreferrer")
                }
                onRemove={onDelete}
              />
            </Popover>
          ))}
      </div>
    </div>
  );
}
