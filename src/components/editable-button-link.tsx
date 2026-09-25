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
import { ButtonLinkHrefSchema, type ButtonLinkNode } from "@/domain/nodes";
import { normalizeLinkHref } from "@/utils/link-href";

// ---------------------------------------------------------------------------
// The `button_link` block, in the article editor: the page's own button, with
// its label typed straight into it and the link toolbar over it.
//
// The button is drawn with the reader's classes (`buttonLinkClass`), so the
// canvas is the page — but as a field rather than a link, because pressing a
// button you are editing must put the caret in it, not leave the editor.
//
// The toolbar is the one a link inside prose gets (`LinkActions`,
// `LinkEditRow`), on the same floating surface, anchored to the button rather
// than to a selection. It is up while the pointer is on the button or while the
// label has the focus; and for as long as an address is being typed, whatever
// the pointer does, since a half-typed address is work.
// ---------------------------------------------------------------------------

/**
 * How long the toolbar outlives the pointer leaving the button — long enough
 * to cross the gap between the two, which is on the way to every control.
 */
const HOVER_GRACE_MS = 150;

const toolbarClass = cx(toolbar(), selectionPopover());

const anchorStyle = css({ display: "inline-flex" });

const labelStyle = cx(
  buttonLinkClass,
  css({
    // A field, not a control: the caret, not the hand, and no press-in.
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
  }),
);

export interface EditableButtonLinkProps {
  block: ButtonLinkNode;
  blockIndex: number;
  onChange: (block: ButtonLinkNode) => void;
  /** Take the whole button out of the document. */
  onDelete: () => void;
  onArrowUp: () => void;
  onArrowDown: () => void;
  onArrowLeft: () => void;
  onArrowRight: () => void;
  /** Enter: the line after a button is where writing carries on. */
  onInsertParagraphAfter: () => void;
  /** The block's element, which the editor navigates to. */
  elRef: (el: HTMLElement | null) => void;
}

/**
 * `block` with a yes/no setting turned on or off. Off is no field at all, so a
 * button that never used a setting is saved exactly as before it existed.
 */
function withFlag(
  block: ButtonLinkNode,
  flag: "newTab" | "sticky",
  on: boolean,
): ButtonLinkNode {
  const { [flag]: _, ...rest } = block;
  return on ? { ...rest, [flag]: true } : rest;
}

/** Where the caret sits in `el`, in characters, or null if it is not there. */
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

/** Focus the label with the caret at its end. */
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
  // Escape puts the toolbar away until the button is next pointed at or
  // focused — a toolbar that came straight back would not have been dismissed.
  const [dismissed, setDismissed] = useState(false);

  // The toolbar floats on the page, so it finds the button by name. One name
  // per button: two buttons sharing an anchor would put both toolbars on one.
  const anchorName = `--button-link-${useId().replace(/[^\w-]/g, "")}`;

  const open = editing || (!dismissed && (hovered || focused));

  // The label is the DOM's while it is being typed in; outside of that it
  // follows the document — an undo, a restored snapshot. Before paint, so a
  // button never shows a frame without its words.
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
    // A finger has no hover; its tap focuses the label, which is enough.
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
        // Tab has no navigation role in the editor — swallow it.
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
        // The block is navigated TO as a whole; the label is where that lands.
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
          // Into the toolbar is still here.
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
          className={labelStyle}
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
