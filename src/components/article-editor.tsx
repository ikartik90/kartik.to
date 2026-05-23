"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { css, cx } from "../../styled-system/css";
import { horizontalRule, inlineCode, articleLink, codeBlock } from "../../styled-system/recipes";
import { useEditorStore } from "@/store/editor";
import { SlashMenu, getFilteredSlashItems, type SlashMenuBlockType } from "@/components/slash-menu";
import { typographyStyles } from "@/components/ui/typography";
import type { Post, Document } from "@/domain/post";
import type { BlockNode, InlineNode, Mark } from "@/domain/nodes";

// ---------------------------------------------------------------------------
// DOM ↔ AST serialisation helpers
// ---------------------------------------------------------------------------

// Pre-compute recipe classNames once so inlineNodesToHtml can embed them in
// the HTML strings it builds. This keeps edit-mode and read-only visually
// identical without re-invoking the CVA on every keystroke.
const inlineCodeClass = inlineCode();
const linkClass = articleLink();

/** Serialise an inline-nodes array to an HTML string for contentEditable. */
export function inlineNodesToHtml(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      let html = node.text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      for (const mark of node.marks ?? []) {
        switch (mark.type) {
          case "bold":
            html = `<strong>${html}</strong>`;
            break;
          case "italic":
            html = `<em>${html}</em>`;
            break;
          case "code":
            html = `<code class="${inlineCodeClass}">${html}</code>`;
            break;
          case "link":
            html = `<a href="${mark.href}" class="${linkClass}">${html}</a>`;
            break;
        }
      }
      return html;
    })
    .join("");
}

/** Walk a contentEditable DOM node and extract inline nodes. */
export function domToInlineNodes(el: Node): InlineNode[] {
  const nodes: InlineNode[] = [];

  function walk(node: Node, marks: Mark[]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) {
        nodes.push({
          type: "text",
          text,
          ...(marks.length > 0 ? { marks } : {}),
        });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const nextMarks = [...marks];

      if (el.tagName === "STRONG" || el.tagName === "B")
        nextMarks.push({ type: "bold" });
      else if (el.tagName === "EM" || el.tagName === "I")
        nextMarks.push({ type: "italic" });
      else if (el.tagName === "CODE") nextMarks.push({ type: "code" });
      else if (el.tagName === "A") {
        const href = (el as HTMLAnchorElement).href;
        if (href) nextMarks.push({ type: "link", href });
      }
      // BR tags produce a zero-width space we skip
      else if (el.tagName === "BR") return;

      el.childNodes.forEach((child) => walk(child, nextMarks));
    }
  }

  el.childNodes.forEach((child) => walk(child, []));
  return nodes;
}

// ---------------------------------------------------------------------------
// Shared DOM utilities (module-level — no component state)
// ---------------------------------------------------------------------------

/** HTML-escape a plain string so it is safe to inject into innerHTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Walk depth-first and return the first leaf Text node in `root`. */
function firstTextNode(root: Node): Text | null {
  if (root.nodeType === Node.TEXT_NODE) return root as Text;
  for (let i = 0; i < root.childNodes.length; i++) {
    const found = firstTextNode(root.childNodes[i]);
    if (found) return found;
  }
  return null;
}

/**
 * Returns the text content between the beginning of `el` and the current
 * cursor position. Used to detect a "/" typed at position 0 regardless of
 * how much text follows the caret.
 */
function getTextBeforeCursor(el: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  const range = sel.getRangeAt(0).cloneRange();
  range.setStart(el, 0);
  return range.toString();
}

/** Walk depth-first and return the last leaf Text node in `root`. */
function lastTextNode(root: Node): Text | null {
  if (root.nodeType === Node.TEXT_NODE) return root as Text;
  for (let i = root.childNodes.length - 1; i >= 0; i--) {
    const found = lastTextNode(root.childNodes[i]);
    if (found) return found;
  }
  return null;
}

/**
 * Return the innerHTML of `el` split at the current selection boundary.
 * `before` = everything up to (but not including) the selection start.
 * `after`  = everything from the selection end to the element end.
 * Any selected text is intentionally omitted (equivalent to Delete).
 */
function getCaretSplitHtml(el: HTMLElement): { before: string; after: string } {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { before: el.innerHTML, after: "" };

  const range = sel.getRangeAt(0);

  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(el);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  const beforeDiv = document.createElement("div");
  beforeDiv.appendChild(beforeRange.cloneContents());

  const afterRange = document.createRange();
  afterRange.selectNodeContents(el);
  afterRange.setStart(range.endContainer, range.endOffset);
  const afterDiv = document.createElement("div");
  afterDiv.appendChild(afterRange.cloneContents());

  return { before: beforeDiv.innerHTML, after: afterDiv.innerHTML };
}

// ---------------------------------------------------------------------------
// Clipboard sanitisation
// ---------------------------------------------------------------------------

/**
 * Parse clipboard HTML and return a sanitised HTML string suitable for
 * insertion into a contentEditable block. Only semantic inline marks
 * (<strong>, <em>, <code>) are preserved; all style/class attributes,
 * presentational elements, and wrapper tags are stripped. Block-level
 * elements are collapsed to <br> line-breaks.
 */
function sanitiseClipboardHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(walk).join("");

    switch (tag) {
      case "br":
        return "<br>";
      // Block elements — append a <br> after their content so paragraphs
      // and divs become line-separated instead of run together.
      case "p":
      case "div":
      case "li":
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        return inner ? inner + "<br>" : "";
      // Semantic inline marks — keep the tag, drop all attributes except the
      // design-system class so pasted content is immediately styled correctly.
      case "strong":
      case "b":
        return `<strong>${inner}</strong>`;
      case "em":
      case "i":
        return `<em>${inner}</em>`;
      case "code":
        return `<code class="${inlineCodeClass}">${inner}</code>`;
      // Links — strip the anchor entirely, keep only the visible text.
      case "a":
        return inner;
      // Everything else (span, font, table, …) — unwrap, keep content.
      default:
        return inner;
    }
  }

  const result = Array.from(doc.body.childNodes).map(walk).join("");
  // Trim a trailing <br> added by the outermost block element.
  return result.replace(/<br>$/, "");
}

// ---------------------------------------------------------------------------
// Caret-position helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the caret is on (or above) the first visual line of a
 * contentEditable element — i.e. pressing ArrowUp should leave the block.
 */
function isCaretAtFirstLine(el: HTMLElement): boolean {
  if (!el.textContent) return true;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const caretRect = sel.getRangeAt(0).getBoundingClientRect();
  if (!caretRect.height) return true; // degenerate rect (empty block)
  return caretRect.top < el.getBoundingClientRect().top + caretRect.height;
}

/**
 * Returns true when the caret is on (or below) the last visual line of a
 * contentEditable element — i.e. pressing ArrowDown should leave the block.
 */
function isCaretAtLastLine(el: HTMLElement): boolean {
  if (!el.textContent) return true;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const caretRect = sel.getRangeAt(0).getBoundingClientRect();
  // A zero-height rect means the caret is at an element boundary, not a text
  // node — don't treat this as the last line; let the browser handle it.
  if (!caretRect.height) return false;
  return (
    caretRect.bottom > el.getBoundingClientRect().bottom - caretRect.height
  );
}

/**
 * Like isCaretAtFirstLine but inspects the selection FOCUS rather than the
 * full selected range. Required for cross-block Shift+Arrow navigation because
 * getRangeAt(0).getBoundingClientRect() returns the bounding rect of the
 * entire multi-block selection, not just the focus line.
 */
function isFocusAtFirstLine(el: HTMLElement): boolean {
  if (!el.textContent) return true;
  const sel = window.getSelection();
  if (!sel || !sel.focusNode || !el.contains(sel.focusNode)) return false;
  const r = document.createRange();
  r.setStart(sel.focusNode, sel.focusOffset);
  r.collapse(true);
  const rect = r.getBoundingClientRect();
  if (!rect.height) return true;
  return rect.top < el.getBoundingClientRect().top + rect.height;
}

/** Like isCaretAtLastLine but inspects the selection FOCUS position. */
function isFocusAtLastLine(el: HTMLElement): boolean {
  if (!el.textContent) return true;
  const sel = window.getSelection();
  const focusNode = sel?.focusNode ?? null;
  const contained = focusNode ? el.contains(focusNode) : false;
  if (!sel || !focusNode || !contained) {
    return false;
  }
  const r = document.createRange();
  r.setStart(focusNode, sel.focusOffset);
  r.collapse(true);
  const rect = r.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const result = rect.height ? rect.bottom > elRect.bottom - rect.height : false;
  return result;
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Caret boundary helpers (used by Backspace/Delete merge logic)
// ---------------------------------------------------------------------------

/**
 * True when the caret is collapsed and sitting at the very start of `el`
 * (before the first character). Returns false if there is an active selection
 * so the browser handles deletion of selected text normally.
 */
function isCaretAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  if (range.startContainer === el && range.startOffset === 0) return true;
  const first = firstTextNode(el);
  return first !== null && range.startContainer === first && range.startOffset === 0;
}

/**
 * True when the caret is collapsed and sitting at the very end of `el`
 * (after the last character).
 */
function isCaretAtEnd(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  if (range.startContainer === el && range.startOffset === el.childNodes.length) return true;
  const last = lastTextNode(el);
  return last !== null && range.startContainer === last && range.startOffset === last.length;
}

/**
 * Focus `el` and place the caret at the given character offset, measured
 * by walking Text nodes in DOM order. Used to restore the cursor to the
 * exact merge junction after two blocks are joined.
 */
function setCursorAtTextOffset(el: HTMLElement, offset: number) {
  el.focus();
  let remaining = offset;

  function findPos(node: Node): { node: Text; offset: number } | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node as Text;
      if (remaining <= t.length) return { node: t, offset: remaining };
      remaining -= t.length;
      return null;
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      const found = findPos(node.childNodes[i]);
      if (found) return found;
    }
    return null;
  }

  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const pos = findPos(el);
  if (pos) {
    range.setStart(pos.node, pos.offset);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ---------------------------------------------------------------------------

/** Return true if a block carries no text content. */
function isBlockEmpty(block: BlockNode): boolean {
  if (block.type === "horizontal_rule") return false;
  if (block.type === "image") return false;
  if (block.type === "code_block") {
    return block.children.every((c) => !c.text.trim());
  }
  return "children" in block && block.children.every((c) => !c.text.trim());
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// Editor-specific base — contentEditable mechanics only.
// Typography styles (size, color, weight) come from typographyStyles() below.
const editableBaseStyle = css({
  outline: "none",
  minHeight: "1.5em",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  "&:empty::before": {
    content: "attr(data-placeholder)",
    color: "text.default/40",
    pointerEvents: "none",
  },
});

// Editor-only affordance: left border visually marks blockquote blocks.
// The read-only renderer does not show this — it's intentionally editor-only.
const blockquoteBorderStyle = css({
  borderLeftWidth: "2px",
  borderLeftStyle: "solid",
  borderLeftColor: "border.divider",
  paddingInlineStart: "spacing.lg",
});

const editorCodeBlockStyle = codeBlock();

const editorHrStyle = horizontalRule();

const editorFigureStyle = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  paddingBlock: "md",
  outline: "none",
  cursor: "default",
});

// Wrapper for <hr> so it can receive keyboard focus (void elements can't).
const editorHrWrapperStyle = css({
  position: "relative",
  outline: "none",
  cursor: "default",
});

// Diagonal-line overlay rendered over a non-text block that has keyboard focus.
const nonTextFocusOverlayStyle = css({
  position: "absolute",
  inset: "0",
  backgroundImage:
    "repeating-linear-gradient(45deg, var(--colors-brand-pink) 0px, var(--colors-brand-pink) 1px, transparent 1px, transparent 8px)",
  pointerEvents: "none",
  opacity: "0.35",
});

// ---------------------------------------------------------------------------
// EditableBlock
// ---------------------------------------------------------------------------

interface EditableBlockProps {
  block: BlockNode;
  blockIndex: number;
  isFirst: boolean;
  isOnly: boolean;
  onChange: (block: BlockNode) => void;
  /** Called on Enter; receives the HTML for before and after the caret so the
   *  parent can split the current block at the cursor position. */
  onEnter: (beforeHtml: string, afterHtml: string) => void;
  onDelete: () => void;
  onSlash: (el: HTMLElement) => void;
  /**
   * Called on every input event while the slash menu is open for this block.
   * Receives the raw innerText so the parent can update the query or dismiss.
   */
  onSlashInput?: (text: string) => void;
  /** True while the slash menu is open for this block. */
  isSlashActive?: boolean;
  /** Called when ArrowUp is pressed on the first visual line. */
  onArrowUp?: () => void;
  /** Called when ArrowDown is pressed on the last visual line. */
  onArrowDown?: () => void;
  /** Called when ArrowLeft is pressed at the very start of the block. */
  onArrowLeft?: () => void;
  /** Called when ArrowRight is pressed at the very end of the block. */
  onArrowRight?: () => void;
  /**
   * Called when pasted content contains hard returns. Receives the HTML for
   * the current block (before-caret content + first pasted line) and an array
   * of HTML strings for the new blocks to insert after it (remaining lines
   * merged with after-caret content on the last entry).
   */
  onPasteBlocks?: (firstBlockHtml: string, newBlocksHtml: string[]) => void;
  /** Backspace at the start of a non-empty block — merge into the previous block. */
  onMergeWithPrev?: (currentHtml: string) => void;
  /** Delete at the end of a non-empty block — absorb the next block. */
  onMergeWithNext?: (currentHtml: string) => void;
  /** Called after a non-paragraph block is downgraded to paragraph so the
   *  parent can restore caret focus once the new element is mounted. */
  onConvertedToParagraph?: () => void;
  /** Shift+ArrowUp when the selection focus is on the first visual line. */
  onShiftArrowUp?: () => void;
  /** Shift+ArrowDown when the selection focus is on the last visual line. */
  onShiftArrowDown?: () => void;
  elRef: (el: HTMLElement | null) => void;
}

function EditableBlock({
  block,
  blockIndex,
  isFirst,
  isOnly,
  onChange,
  onEnter,
  onDelete,
  onSlash,
  onSlashInput,
  isSlashActive,
  onArrowUp,
  onArrowDown,
  onArrowLeft,
  onArrowRight,
  onPasteBlocks,
  onMergeWithPrev,
  onMergeWithNext,
  onConvertedToParagraph,
  onShiftArrowUp,
  onShiftArrowDown,
  elRef,
}: EditableBlockProps) {
  const placeholder =
    isFirst && isOnly && block.type === "paragraph"
      ? "Tell your story..."
      : undefined;

  // Local ref to the DOM element — needed for the imperative innerHTML update.
  const contentRef = useRef<HTMLElement | null>(null);

  // Stable combined ref: forwards to both contentRef and the parent's elRef
  // callback without recreating on every render.
  const elRefRef = useRef(elRef);
  elRefRef.current = elRef;
  const combinedRef = useCallback((el: HTMLElement | null) => {
    contentRef.current = el;
    elRefRef.current(el);
  }, []);

  // Whether this non-text block currently has keyboard focus (drives overlay).
  const [isFocused, setIsFocused] = useState(false);

  // Keyboard handler for non-text (horizontal_rule, image) blocks.
  // These elements have no caret — arrow keys navigate between blocks and
  // Backspace/Delete deletes the block.
  const handleNonTextKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      switch (e.key) {
        case "ArrowUp":
          if (!e.shiftKey) {
            e.preventDefault();
            onArrowUp?.();
          }
          break;
        case "ArrowDown":
        case "Enter":
          if (!e.shiftKey) {
            e.preventDefault();
            onArrowDown?.();
          }
          break;
        case "ArrowLeft":
          if (!e.shiftKey) {
            e.preventDefault();
            onArrowLeft?.();
          }
          break;
        case "ArrowRight":
          if (!e.shiftKey) {
            e.preventDefault();
            onArrowRight?.();
          }
          break;
        case "Backspace":
        case "Delete":
          e.preventDefault();
          onDelete();
          break;
      }
    },
    [onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onDelete],
  );

  // Update innerHTML when block content changes externally (e.g. initial load
  // after store init, or a slash-menu type conversion that causes remount).
  // While the user is actively typing the element has focus — skip the update
  // so we never reset the cursor position.
  // Non-editable blocks (horizontal_rule, image) have no editable children —
  // skip innerHTML sync to avoid wiping their rendered content.
  useEffect(() => {
    if (block.type === "horizontal_rule" || block.type === "image") return;
    const el = contentRef.current;
    if (!el || document.activeElement === el) return;
    const html =
      block.type === "code_block"
        ? block.children.map((c) => c.text).join("")
        : "children" in block
          ? inlineNodesToHtml(block.children as InlineNode[])
          : "";
    el.innerHTML = html;
  }, [block]);

  // ---------------------------------------------------------------------------
  // Keyboard handling
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      // The cross-block delete handler runs in the document capture phase and
      // calls e.preventDefault() when it processes a multi-block deletion.
      // The React synthetic event still fires afterwards on the focused block.
      // Without this guard the merge-with-prev / merge-with-next checks below
      // would see a collapsed caret at position 0 and fire spuriously.
      if (e.nativeEvent.defaultPrevented) return;

      // While the slash menu is open, hand off Enter and arrow keys to the
      // menu's capture-phase listener — just preventDefault here so the browser
      // doesn't move the caret or insert a newline.
      if (isSlashActive) {
        if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          return;
        }
      }

      // Shift+ArrowUp: extend selection upward across blocks.
      if (e.key === "ArrowUp" && e.shiftKey) {
        const _sel = window.getSelection();
        const _focusInBlock = e.currentTarget.contains(_sel?.focusNode ?? null);
        const _atFirst = _focusInBlock ? isFocusAtFirstLine(e.currentTarget) : false;
        if (!_focusInBlock && _sel?.focusNode) {
          // Focus is in a different block. Use caretRangeFromPoint to compute the
          // position one visual line above the current focus — this is independent
          // of which contenteditable has DOM focus.
          e.preventDefault();
          const _r = document.createRange();
          _r.setStart(_sel.focusNode, _sel.focusOffset);
          _r.collapse(true);
          const _rect = _r.getBoundingClientRect();
          // Jump a full line-height upward (never just 1px — that stays in the
          // same line's hit-area and caretRangeFromPoint returns the same position).
          const _lineH = Math.max(_rect.height, 20);
          const _target = document.caretRangeFromPoint(_rect.left, _rect.top - _lineH);
          if (_target && !(_target.startContainer === _sel.focusNode && _target.startOffset === _sel.focusOffset)) {
            _sel.extend(_target.startContainer, _target.startOffset);
          }
          return;
        }
        if (onShiftArrowUp && _atFirst) {
          e.preventDefault();
          onShiftArrowUp();
          return;
        }
      }

      // Shift+ArrowDown: extend selection downward across blocks.
      if (e.key === "ArrowDown" && e.shiftKey) {
        const _sel = window.getSelection();
        const _focusInBlock = e.currentTarget.contains(_sel?.focusNode ?? null);
        const _atLast = _focusInBlock ? isFocusAtLastLine(e.currentTarget) : false;
        if (!_focusInBlock && _sel?.focusNode) {
          e.preventDefault();
          const _r = document.createRange();
          _r.setStart(_sel.focusNode, _sel.focusOffset);
          _r.collapse(true);
          const _rect = _r.getBoundingClientRect();
          const _lineH = Math.max(_rect.height, 20);
          const _target = document.caretRangeFromPoint(_rect.left, _rect.bottom + _lineH);
          if (_target && !(_target.startContainer === _sel.focusNode && _target.startOffset === _sel.focusOffset)) {
            _sel.extend(_target.startContainer, _target.startOffset);
          }
          return;
        }
        if (onShiftArrowDown && _atLast) {
          e.preventDefault();
          onShiftArrowDown();
          return;
        }
      }

      // ArrowUp at the first visual line → move to previous block.
      if (
        e.key === "ArrowUp" &&
        !e.shiftKey &&
        onArrowUp &&
        isCaretAtFirstLine(e.currentTarget)
      ) {
        e.preventDefault();
        onArrowUp();
        return;
      }

      // ArrowDown at the last visual line → move to next block.
      if (
        e.key === "ArrowDown" &&
        !e.shiftKey &&
        onArrowDown &&
        isCaretAtLastLine(e.currentTarget)
      ) {
        e.preventDefault();
        onArrowDown();
        return;
      }

      // ArrowLeft at the very start of a block → move to end of previous block.
      if (
        e.key === "ArrowLeft" &&
        !e.shiftKey &&
        onArrowLeft &&
        isCaretAtStart(e.currentTarget)
      ) {
        e.preventDefault();
        onArrowLeft();
        return;
      }

      // ArrowRight at the very end of a block → move to start of next block.
      if (
        e.key === "ArrowRight" &&
        !e.shiftKey &&
        onArrowRight &&
        isCaretAtEnd(e.currentTarget)
      ) {
        e.preventDefault();
        onArrowRight();
        return;
      }

      // Enter → insert new paragraph (not in code blocks where Enter is literal)
      if (e.key === "Enter" && !e.shiftKey && block.type !== "code_block") {
        e.preventDefault();
        const { before, after } = getCaretSplitHtml(e.currentTarget);
        // Trim the current block's DOM to the "before" portion immediately so
        // the useEffect won't fight us while the element still has focus.
        e.currentTarget.innerHTML = before;
        onEnter(before, after);
        return;
      }

      // Backspace/Delete on empty block → delete block
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        isBlockEmpty(block)
      ) {
        e.preventDefault();
        onDelete();
        return;
      }

      // Backspace at the start of a non-empty, non-paragraph block → downgrade to paragraph
      if (
        e.key === "Backspace" &&
        isCaretAtStart(e.currentTarget) &&
        (block.type === "heading" || block.type === "blockquote" || block.type === "code_block")
      ) {
        e.preventDefault();
        const children = "children" in block
          ? (block.children as InlineNode[])
          : [{ type: "text" as const, text: "" }];
        onChange({ type: "paragraph", children });
        onConvertedToParagraph?.();
        return;
      }

      // Backspace at the start of a non-empty block → merge into previous block
      if (
        e.key === "Backspace" &&
        onMergeWithPrev &&
        isCaretAtStart(e.currentTarget)
      ) {
        e.preventDefault();
        onMergeWithPrev(e.currentTarget.innerHTML);
        return;
      }

      // Delete at the end of a non-empty block → absorb the next block
      if (
        e.key === "Delete" &&
        onMergeWithNext &&
        isCaretAtEnd(e.currentTarget)
      ) {
        e.preventDefault();
        onMergeWithNext(e.currentTarget.innerHTML);
        return;
      }

      // ⌘B → bold
      if (e.metaKey && e.key === "b") {
        e.preventDefault();
        document.execCommand("bold");
        return;
      }

      // ⌘I → italic
      if (e.metaKey && e.key === "i") {
        e.preventDefault();
        document.execCommand("italic");
        return;
      }
    },
    [block, onChange, onEnter, onDelete, isSlashActive, onArrowUp, onArrowDown, onMergeWithPrev, onMergeWithNext, onConvertedToParagraph, onShiftArrowUp, onShiftArrowDown],
  );

  // ---------------------------------------------------------------------------
  // Input / change handling
  // ---------------------------------------------------------------------------

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLElement>) => {
      const el = e.currentTarget;

      // Detect backtick wrapping for inline code: `text`
      if (block.type !== "code_block") {
        const text = el.innerText ?? "";
        const match = text.match(/`([^`]+)`/);
        if (match) {
          const nodes = domToInlineNodes(el);
          // Replace backtick-wrapped text with a code mark
          const replaced: InlineNode[] = nodes.flatMap((n) => {
            if (!n.marks || n.marks.length === 0) {
              const parts: InlineNode[] = [];
              let remaining = n.text;
              let m: RegExpExecArray | null;
              const re = /`([^`]+)`/g;
              let lastIndex = 0;
              while ((m = re.exec(remaining)) !== null) {
                if (m.index > lastIndex) {
                  parts.push({
                    type: "text",
                    text: remaining.slice(lastIndex, m.index),
                  });
                }
                parts.push({
                  type: "text",
                  text: m[1],
                  marks: [{ type: "code" }],
                });
                lastIndex = m.index + m[0].length;
              }
              if (lastIndex < remaining.length) {
                parts.push({ type: "text", text: remaining.slice(lastIndex) });
              }
              return parts.length > 0 ? parts : [n];
            }
            return [n];
          });

          if (match && "children" in block) {
            onChange({
              ...(block as Extract<BlockNode, { children: InlineNode[] }>),
              children: replaced,
            } as BlockNode);
            // Rebuild HTML with code spans
            el.innerHTML = inlineNodesToHtml(replaced);
            // Move caret to end
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
            return;
          }
        }
      }

      if (block.type === "code_block") {
        const text = el.innerText ?? "";
        onChange({
          ...block,
          children: [{ type: "text", text }],
        });
        return;
      }

      if ("children" in block) {
        const nodes = domToInlineNodes(el);
        onChange({
          ...(block as Extract<BlockNode, { children: InlineNode[] }>),
          children: nodes,
        } as BlockNode);
      }

      // Notify parent about text changes while the slash menu is active so it
      // can update the filter query or dismiss the menu.
      onSlashInput?.(el.innerText ?? "");
    },
    [block, onChange, onSlashInput],
  );

  // ---------------------------------------------------------------------------
  // Paste — preserve semantic marks, strip visual styling, split on hard returns
  // ---------------------------------------------------------------------------

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLElement>) => {
      e.preventDefault();

      // Code blocks are plain text — no markup, no splitting.
      if (block.type === "code_block") {
        const text = e.clipboardData.getData("text/plain");
        if (text) document.execCommand("insertText", false, text);
        return;
      }

      const htmlData = e.clipboardData.getData("text/html");
      const textData = e.clipboardData.getData("text/plain") ?? "";

      // Build a normalised array of per-line HTML strings.
      const lines: string[] = htmlData
        ? sanitiseClipboardHtml(htmlData).split("<br>").filter(Boolean)
        : textData.split("\n").filter(Boolean).map(escapeHtml);

      if (lines.length === 0) return;

      // Single line (or no multi-block callback) — standard inline insert.
      if (lines.length === 1 || !onPasteBlocks) {
        document.execCommand(
          htmlData ? "insertHTML" : "insertText",
          false,
          lines[0],
        );
        return;
      }

      // Multi-line: split the current block at the caret and distribute lines.
      const el = contentRef.current;
      if (!el) return;

      const { before, after } = getCaretSplitHtml(el);

      // Current block gets: before-caret content + first pasted line.
      const firstBlockHtml = before + lines[0];
      // New blocks: middle lines as-is, last line merged with after-caret content.
      const newBlocksHtml = [
        ...lines.slice(1, -1),
        lines[lines.length - 1] + after,
      ];

      // Update the current block's DOM directly. The useEffect that normally
      // syncs innerHTML skips while the element has focus, so this persists.
      el.innerHTML = firstBlockHtml;

      // Single store update: rewrites current block + inserts all new ones.
      onPasteBlocks(firstBlockHtml, newBlocksHtml);
    },
    [block.type, onPasteBlocks],
  );

  // ---------------------------------------------------------------------------
  // Slash menu detection — fires on keyup so the "/" is already in the DOM
  // ---------------------------------------------------------------------------

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const isTextBlock =
        block.type === "paragraph" ||
        block.type === "heading" ||
        block.type === "blockquote" ||
        block.type === "code_block";
      if (e.key === "/" && isTextBlock) {
        // Open the slash menu whenever "/" is the first character typed —
        // i.e. the text from the element start up to the cursor is exactly "/".
        // This works for both empty blocks and blocks with existing content.
        if (getTextBeforeCursor(e.currentTarget) === "/") {
          onSlash(e.currentTarget);
        }
      }
    },
    [block, onSlash],
  );

  // ---------------------------------------------------------------------------
  // Horizontal rule (non-editable)
  // ---------------------------------------------------------------------------

  if (block.type === "horizontal_rule") {
    return (
      <div
        tabIndex={0}
        role="separator"
        ref={combinedRef as React.RefCallback<HTMLDivElement>}
        className={editorHrWrapperStyle}
        data-block-index={blockIndex}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleNonTextKeyDown}
      >
        <hr className={editorHrStyle} />
        {isFocused && <div className={nonTextFocusOverlayStyle} aria-hidden />}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Code block
  // ---------------------------------------------------------------------------

  if (block.type === "code_block") {
    return (
      <pre
        ref={combinedRef as React.RefCallback<HTMLPreElement>}
        className={editorCodeBlockStyle}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onInput={handleInput}
        onPaste={handlePaste}
        data-block-index={blockIndex}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Heading
  // ---------------------------------------------------------------------------

  if (block.type === "heading") {
    return (
      <h2
        ref={combinedRef as React.RefCallback<HTMLHeadingElement>}
        className={cx(
          editableBaseStyle,
          typographyStyles({ type: "subheading" }),
        )}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onKeyUp={handleKeyUp}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        data-block-index={blockIndex}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Blockquote
  // ---------------------------------------------------------------------------

  if (block.type === "blockquote") {
    return (
      <blockquote
        ref={combinedRef as React.RefCallback<HTMLElement>}
        className={cx(
          editableBaseStyle,
          typographyStyles({ type: "quote" }),
          blockquoteBorderStyle,
        )}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onKeyUp={handleKeyUp}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        data-block-index={blockIndex}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Image (non-editable placeholder — R2 upload wired in a follow-up)
  // ---------------------------------------------------------------------------

  if (block.type === "image") {
    return (
      <figure
        tabIndex={0}
        ref={combinedRef as React.RefCallback<HTMLElement>}
        className={editorFigureStyle}
        data-block-index={blockIndex}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleNonTextKeyDown}
      >
        {block.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={block.src} alt={block.alt ?? ""} />
        ) : (
          <span aria-label="Image placeholder">📷</span>
        )}
        {isFocused && <div className={nonTextFocusOverlayStyle} aria-hidden />}
      </figure>
    );
  }

  // ---------------------------------------------------------------------------
  // Paragraph (default)
  // ---------------------------------------------------------------------------

  return (
    <p
      ref={combinedRef as React.RefCallback<HTMLParagraphElement>}
      className={cx(editableBaseStyle, typographyStyles({ type: "paragraph" }))}
      contentEditable
      suppressContentEditableWarning
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      onKeyUp={handleKeyUp}
      onPaste={handlePaste}
      data-placeholder={placeholder}
      data-block-index={blockIndex}
    />
  );
}

// ---------------------------------------------------------------------------
// Ensure document always has at least one block and a trailing editable block
// ---------------------------------------------------------------------------

/**
 * Non-editable block types have no caret — always ensure an editable paragraph
 * follows them so the author can continue typing after inserting one.
 */
function withTrailingParagraph(blocks: BlockNode[]): BlockNode[] {
  if (blocks.length === 0) {
    return [{ type: "paragraph", children: [{ type: "text", text: "" }] }];
  }
  const last = blocks[blocks.length - 1];
  if (last.type === "horizontal_rule" || last.type === "image") {
    return [
      ...blocks,
      { type: "paragraph", children: [{ type: "text", text: "" }] },
    ];
  }
  return blocks;
}

function ensureBlocks(doc: Document): BlockNode[] {
  if (doc.content.length > 0) return doc.content;
  return [{ type: "paragraph", children: [{ type: "text", text: "" }] }];
}

// ---------------------------------------------------------------------------
// ArticleEditor
// ---------------------------------------------------------------------------

interface ArticleEditorProps {
  initialPost?: Post;
}

export function ArticleEditor({ initialPost }: ArticleEditorProps) {
  const {
    title,
    setTitle,
    document: doc,
    setDocument,
    setDraftId,
    setDirty,
    pushHistory,
  } = useEditorStore();

  // Populate store from initialPost on mount; reset on unmount.
  useEffect(() => {
    if (initialPost) {
      useEditorStore.setState({
        title: initialPost.title ?? "",
        draftId: initialPost.id,
        document: {
          ...initialPost.content,
          content: withTrailingParagraph(initialPost.content.content),
        },
        isDirty: false,
        history: [],
        historyIndex: -1,
      });
    } else {
      useEditorStore.getState().reset();
    }
    // Seed history with the initial state so Cmd+Z can undo back to it.
    const s = useEditorStore.getState();
    s.pushHistory({ title: s.title, document: s.document });
    return () => useEditorStore.getState().reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocks = ensureBlocks(doc);
  const blockRefs = useRef<(HTMLElement | null)[]>([]);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Index of the editing host where the current pointer-drag started.
  // -1 = title, 0+ = block index, null = no active drag.
  const dragAnchorIdx = useRef<number | null>(null);
  // Holds the latest cross-block keyboard handler so the document listener
  // registered once (empty dep array) always calls current logic.
  const crossBlockDeleteRef = useRef<(e: KeyboardEvent) => void>(() => {});
  // Timer for batching rapid text-input changes into a single history entry.
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Push the current store state as a new history snapshot immediately. */
  function pushHistoryNow() {
    const s = useEditorStore.getState();
    pushHistory({ title: s.title, document: s.document });
  }

  /** Push a history snapshot after a brief pause (batches consecutive keystrokes). */
  function pushHistoryDebounced() {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(pushHistoryNow, 500);
  }

  /** Cancel any pending debounced push (call before a structural operation). */
  function cancelHistoryDebounce() {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
  }

  // Cross-block mouse-drag selection.
  //
  // Chrome treats each `contentEditable` element as its own editing host and
  // clips a drag-selection at the host boundary. We intercept `pointermove`
  // while the left button is held and, whenever the pointer has crossed into a
  // different editing host, call `sel.extend(caretRangeFromPoint)` — the same
  // technique used for Shift+Arrow.
  useEffect(() => {
    function blockIdxForNode(node: Node | null): number | null {
      if (!node) return null;
      const el = node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;
      if (!el) return null;
      if (titleRef.current?.contains(el)) return -1;
      for (let i = 0; i < blockRefs.current.length; i++) {
        if (blockRefs.current[i]?.contains(el)) return i;
      }
      return null;
    }

    function onPointerDown(e: PointerEvent) {
      dragAnchorIdx.current = blockIdxForNode(e.target as Node | null);
    }

    function onPointerMove(e: PointerEvent) {
      if (e.buttons !== 1 || dragAnchorIdx.current === null) return;

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const currentIdx = blockIdxForNode(el);

      // Only intervene when the pointer has crossed into a different editing host.
      if (currentIdx === null || currentIdx === dragAnchorIdx.current) return;

      const sel = window.getSelection();
      if (!sel || !sel.anchorNode) return;

      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (
        range &&
        !(range.startContainer === sel.focusNode &&
          range.startOffset === sel.focusOffset)
      ) {
        sel.extend(range.startContainer, range.startOffset);
      }
    }

    function onPointerUp() {
      dragAnchorIdx.current = null;
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  // Cmd+A while any editor element is focused → select from title start to
  // last-block end. Implemented directly in the closure (not via a ref) so
  // there is no indirection — only titleRef / blockRefs are needed and both
  // are stable MutableRefObjects.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey && e.key === "a")) return;
      const focused = document.activeElement;
      const inTitle =
        focused === titleRef.current ||
        titleRef.current?.contains(focused) === true;
      const inBlock = blockRefs.current.some(
        (el) => el === focused || el?.contains(focused) === true,
      );
      if (!inTitle && !inBlock) return;

      e.preventDefault();

      const firstEl = titleRef.current;
      // Use findLast to skip stale null entries left behind after block deletions.
      const lastEl =
        blockRefs.current.findLast((el) => el != null) ?? titleRef.current;
      if (!firstEl || !lastEl) return;

      const startNode: Node = firstTextNode(firstEl) ?? firstEl;
      const endNode: Node = lastTextNode(lastEl) ?? lastEl;
      const endOffset =
        endNode.nodeType === Node.TEXT_NODE
          ? (endNode as Text).length
          : (endNode as Element).childNodes.length;

      window.getSelection()?.setBaseAndExtent(startNode, 0, endNode, endOffset);
    }

    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  // Delete / Backspace across editing hosts — dispatches to crossBlockDeleteRef
  // so the once-registered listener always calls the latest closure.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      crossBlockDeleteRef.current(e);
    }
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  // Cmd+Z (undo) and Cmd+Shift+Z (redo) while focus is in the editor.
  //
  // Blurs the focused element before calling undo/redo so that
  // EditableBlock's DOM-sync useEffect isn't blocked by the "skip if focused"
  // guard. After React re-renders with the restored snapshot, focus lands at
  // the same block index (capped to the new block count).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.metaKey || (e.key !== "z" && e.key !== "Z")) return;

      const focused = document.activeElement as HTMLElement | null;
      const inTitle =
        focused === titleRef.current ||
        titleRef.current?.contains(focused) === true;
      const focusedBlockIdx = blockRefs.current.findIndex(
        (el) => el === focused || el?.contains(focused) === true,
      );
      if (!inTitle && focusedBlockIdx === -1) return;

      e.preventDefault();

      const store = useEditorStore.getState();
      const isRedo = e.shiftKey;

      if (isRedo) {
        if (store.historyIndex >= store.history.length - 1) return;
      } else {
        if (store.historyIndex <= 0) return;
      }

      // Cancel any pending text-input debounce — we're about to restore a
      // snapshot, so the in-flight debounce would overwrite it on next fire.
      cancelHistoryDebounce();

      // Blur so EditableBlock's innerHTML sync useEffect isn't skipped.
      focused?.blur();

      if (isRedo) {
        store.redo();
      } else {
        store.undo();
      }

      // Re-focus after React re-renders (setTimeout puts us after the flush).
      const targetIdx = inTitle ? -1 : focusedBlockIdx;
      setTimeout(() => {
        if (targetIdx === -1) {
          titleRef.current?.focus();
          return;
        }
        // Use the same block index, capped to whatever blocks still exist.
        const currentBlocks = blockRefs.current.filter(Boolean);
        const idx = Math.min(targetIdx, Math.max(0, currentBlocks.length - 1));
        const el = blockRefs.current.find((e, i) => e != null && i === idx) ??
          blockRefs.current.find((e) => e != null);
        if (el) {
          el.focus();
          if (el.isContentEditable) {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
          }
        }
      }, 0);
    }

    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  // Update the title DOM imperatively when the store title changes, but skip
  // while the user has focus there (typing) so we never reset their cursor.
  useEffect(() => {
    if (titleRef.current && document.activeElement !== titleRef.current) {
      titleRef.current.innerHTML = title;
    }
  }, [title]);

  // Slash menu state
  const [slashAnchor, setSlashAnchor] = useState<{
    el: HTMLElement;
    index: number;
    /** True when the menu was opened on a block that already had text content
     *  beyond the triggering "/". Suppresses content-as-query behaviour. */
    hasExistingContent: boolean;
  } | null>(null);
  const [slashQuery, setSlashQuery] = useState("");

  // -------------------------------------------------------------------------
  // Focus helpers
  // -------------------------------------------------------------------------

  function focusBlockAtEnd(el: HTMLElement) {
    el.focus();
    // Non-text blocks (HR wrapper, image figure) are not contentEditable —
    // just calling focus() is enough; no caret range is needed.
    if (!el.isContentEditable) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    const node = lastTextNode(el);
    if (node) {
      range.setStart(node, node.length);
    } else {
      range.selectNodeContents(el);
    }
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function focusBlockAtStart(el: HTMLElement) {
    el.focus();
    // Non-text blocks (HR wrapper, image figure) are not contentEditable —
    // just calling focus() is enough; no caret range is needed.
    if (!el.isContentEditable) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    const node = firstTextNode(el);
    if (node) {
      range.setStart(node, 0);
    } else {
      range.setStart(el, 0);
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /**
   * Shift+ArrowUp at the first line of block[index]:
   * extend the selection from the current anchor into the previous block,
   * placing the focus at the end of that block.
   */
  function shiftArrowUp(blockIndex: number) {
    const sel = window.getSelection();
    if (!sel) return;

    if (blockIndex === 0) {
      const el = titleRef.current;
      if (!el) return;
      const focus = lastTextNode(el) ?? el;
      const offset = focus.nodeType === Node.TEXT_NODE ? (focus as Text).length : 0;
      // Use extend() — does NOT change document.activeElement, avoids Chrome's
      // "refocus to anchor element" behaviour that setBaseAndExtent triggers.
      sel.extend(focus, offset);
      return;
    }

    const prevEl = blockRefs.current[blockIndex - 1];
    if (!prevEl) return;
    const focus = lastTextNode(prevEl) ?? prevEl;
    const offset = focus.nodeType === Node.TEXT_NODE ? (focus as Text).length : 0;
    sel.extend(focus, offset);
  }

  /**
   * Shift+ArrowDown at the last line of block[index]:
   * extend the selection from the current anchor into the next block,
   * placing the focus at the start of that block.
   */
  function shiftArrowDown(blockIndex: number) {
    const sel = window.getSelection();
    if (!sel) return;

    const nextEl = blockRefs.current[blockIndex + 1];
    if (!nextEl) return;
    const focus = firstTextNode(nextEl) ?? nextEl;
    // Use extend() — does NOT change document.activeElement.
    sel.extend(focus, 0);
  }

  // -------------------------------------------------------------------------
  // Block mutations
  // -------------------------------------------------------------------------

  function updateBlocks(next: BlockNode[]) {
    setDocument({ ...doc, content: withTrailingParagraph(next) });
  }

  function updateBlock(index: number, block: BlockNode) {
    const next = [...blocks];
    next[index] = block;
    updateBlocks(next);
    pushHistoryDebounced();
  }

  function splitBlock(index: number, beforeHtml: string, afterHtml: string) {
    const current = blocks[index];
    // Update the current block to contain only the before-caret content.
    const updatedCurrent: BlockNode =
      "children" in current && current.type !== "code_block"
        ? ({ ...current, children: htmlToNodes(beforeHtml) } as BlockNode)
        : current;

    // The new block inherits the current block's type so Enter mid-heading
    // stays a heading, Enter mid-blockquote stays a blockquote, etc.
    const newBlock: BlockNode = (() => {
      const afterNodes = htmlToNodes(afterHtml);
      if (current.type === "heading") {
        return { type: "heading", level: current.level, children: afterNodes };
      }
      if (current.type === "blockquote") {
        return { type: "blockquote", children: afterNodes };
      }
      return { type: "paragraph", children: afterNodes };
    })();

    updateBlocks([
      ...blocks.slice(0, index),
      updatedCurrent,
      newBlock,
      ...blocks.slice(index + 1),
    ]);
    cancelHistoryDebounce();
    pushHistoryNow();

    setTimeout(() => {
      const el = blockRefs.current[index + 1];
      if (el) focusBlockAtStart(el);
    }, 0);
  }

  /** Shared: parse an HTML string into InlineNode[], with a non-empty fallback. */
  function htmlToNodes(html: string): InlineNode[] {
    const div = document.createElement("div");
    div.innerHTML = html;
    const nodes = domToInlineNodes(div);
    return nodes.length > 0 ? nodes : [{ type: "text", text: "" }];
  }

  /**
   * Backspace at the start of block[index]: append its content to block[index-1],
   * then remove block[index]. Cursor lands at the original end of block[index-1].
   */
  function mergeWithPrev(index: number, currentHtml: string) {
    if (index === 0) {
      // First block — back up to the title instead
      const el = titleRef.current;
      if (el) focusBlockAtEnd(el);
      return;
    }

    const prevBlock = blocks[index - 1];

    // Non-text predecessor (HR, image) — just delete it, keep current block
    if (prevBlock.type === "horizontal_rule" || prevBlock.type === "image") {
      updateBlocks([...blocks.slice(0, index - 1), ...blocks.slice(index)]);
      cancelHistoryDebounce();
      pushHistoryNow();
      setTimeout(() => {
        const el = blockRefs.current[index - 1];
        if (el) focusBlockAtStart(el);
      }, 0);
      return;
    }

    const prevEl = blockRefs.current[index - 1];
    const prevTextLength = prevEl?.textContent?.length ?? 0;
    const prevHtml = prevEl?.innerHTML ?? "";

    const updatedPrev: BlockNode = {
      ...(prevBlock as Extract<BlockNode, { children: InlineNode[] }>),
      children: htmlToNodes(prevHtml + currentHtml),
    } as BlockNode;

    updateBlocks([
      ...blocks.slice(0, index - 1),
      updatedPrev,
      ...blocks.slice(index + 1),
    ]);
    cancelHistoryDebounce();
    pushHistoryNow();

    // Place cursor at the original end of the previous block (the join point)
    setTimeout(() => {
      const el = blockRefs.current[index - 1];
      if (el) setCursorAtTextOffset(el, prevTextLength);
    }, 0);
  }

  /**
   * Delete at the end of block[index]: absorb block[index+1]'s content,
   * then remove block[index+1]. Cursor stays at the join point.
   */
  function mergeWithNext(index: number, currentHtml: string) {
    if (index >= blocks.length - 1) return;

    const nextBlock = blocks[index + 1];

    // Non-text successor (HR, image) — just delete it, keep current block
    if (nextBlock.type === "horizontal_rule" || nextBlock.type === "image") {
      updateBlocks([...blocks.slice(0, index + 1), ...blocks.slice(index + 2)]);
      cancelHistoryDebounce();
      pushHistoryNow();
      return;
    }

    const currentEl = blockRefs.current[index];
    const currentTextLength = currentEl?.textContent?.length ?? 0;
    const nextEl = blockRefs.current[index + 1];
    const nextHtml = nextEl?.innerHTML ?? "";
    const mergedHtml = currentHtml + nextHtml;

    const currentBlock = blocks[index];
    const updatedCurrent: BlockNode = {
      ...(currentBlock as Extract<BlockNode, { children: InlineNode[] }>),
      children: htmlToNodes(mergedHtml),
    } as BlockNode;

    // Update DOM directly — current block stays focused so useEffect would skip it
    if (currentEl) currentEl.innerHTML = mergedHtml;

    updateBlocks([
      ...blocks.slice(0, index),
      updatedCurrent,
      ...blocks.slice(index + 2),
    ]);
    cancelHistoryDebounce();
    pushHistoryNow();

    setTimeout(() => {
      const el = blockRefs.current[index];
      if (el) setCursorAtTextOffset(el, currentTextLength);
    }, 0);
  }

  function deleteBlock(index: number) {
    if (blocks.length === 1) {
      titleRef.current?.focus();
      return;
    }
    const next = [...blocks.slice(0, index), ...blocks.slice(index + 1)];
    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();
    const focusIndex = Math.max(0, index - 1);
    setTimeout(() => {
      const el = blockRefs.current[focusIndex];
      if (el) {
        el.focus();
        if (el.isContentEditable) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
        }
      }
    }, 0);
  }

  /**
   * Called by a block's paste handler when the pasted content contains hard
   * returns. `firstBlockHtml` is the HTML that should replace the current
   * block (before-caret content merged with the first pasted line).
   * `newBlocksHtml` is an array of HTML strings for the paragraph blocks to
   * insert after it; the last entry already has the after-caret content
   * appended. All store mutations are batched into one `updateBlocks` call.
   */
  function pasteBlocks(
    blockIndex: number,
    firstBlockHtml: string,
    newBlocksHtml: string[],
  ) {
    const current = blocks[blockIndex];
    const updatedCurrent: BlockNode =
      "children" in current && current.type !== "code_block"
        ? ({ ...current, children: htmlToNodes(firstBlockHtml) } as BlockNode)
        : current;

    const inserted: BlockNode[] = newBlocksHtml.map((html) => ({
      type: "paragraph" as const,
      children: htmlToNodes(html),
    }));

    updateBlocks([
      ...blocks.slice(0, blockIndex),
      updatedCurrent,
      ...inserted,
      ...blocks.slice(blockIndex + 1),
    ]);
    cancelHistoryDebounce();
    pushHistoryNow();

    // Move the caret to the end of the last pasted block.
    const lastIndex = blockIndex + newBlocksHtml.length;
    setTimeout(() => {
      const el = blockRefs.current[lastIndex];
      if (el) focusBlockAtEnd(el);
    }, 0);
  }

  // -------------------------------------------------------------------------
  // Slash menu
  // -------------------------------------------------------------------------

  function handleSlash(el: HTMLElement, index: number) {
    // innerText after the "/" is already in the DOM at this point.
    const hasExistingContent = (el.innerText ?? "").trim().length > 1;
    setSlashAnchor({ el, index, hasExistingContent });
    setSlashQuery("");
  }

  /**
   * Called by the active block on every input event while the slash menu is
   * open. Derives the query (text after the leading "/") or dismisses the menu
   * if the slash has been deleted, replaced, or the query matches nothing.
   *
   * The empty-results check lives here (in the event handler) rather than in
   * a SlashMenu Effect so dismissal happens synchronously in response to the
   * user's keystroke, avoiding an extra render pass with a stale open menu.
   */
  function handleSlashInput(text: string) {
    const trimmed = text.trim();
    if (!trimmed.startsWith("/")) {
      setSlashAnchor(null);
      setSlashQuery("");
      return;
    }
    // When the menu was opened on a block with pre-existing content, that
    // content sits after the "/" and must not be treated as a filter query.
    if (slashAnchor?.hasExistingContent) {
      setSlashQuery("");
      return;
    }
    const newQuery = trimmed.slice(1);
    // Dismiss immediately when the query matches no items — checked here in
    // the event handler so no Effect is needed inside SlashMenu.
    const excludeType = slashAnchor
      ? (blocks[slashAnchor.index]?.type as SlashMenuBlockType | undefined)
      : undefined;
    if (getFilteredSlashItems(newQuery, undefined, excludeType).length === 0) {
      handleSlashDismiss();
      return;
    }
    setSlashQuery(newQuery);
  }

  function handleSlashSelect(type: SlashMenuBlockType) {
    if (!slashAnchor) return;
    const { index } = slashAnchor;
    setSlashAnchor(null);
    setSlashQuery("");

    if (type === "media") {
      console.log("media selected");
      return;
    }

    // Derive the children to carry into the new block. If the source block had
    // existing content the current AST has a leading "/" in the first text node
    // (from the slash the user typed). Strip it so the converted block is clean.
    const sourceBlock = blocks[index];
    const sourceChildren =
      "children" in sourceBlock && Array.isArray(sourceBlock.children)
        ? (sourceBlock.children as InlineNode[])
        : [];

    const strippedChildren: InlineNode[] =
      sourceChildren.length > 0 && sourceChildren[0].type === "text" && sourceChildren[0].text.startsWith("/")
        ? [{ ...sourceChildren[0], text: sourceChildren[0].text.slice(1) }, ...sourceChildren.slice(1)]
        : sourceChildren;

    const hasContent = strippedChildren.some((n) => n.text.trim() !== "");
    const keptChildren = hasContent ? strippedChildren : [{ type: "text" as const, text: "" }];

    let newBlock: BlockNode;
    if (type === "heading") {
      newBlock = { type: "heading", level: 2, children: keptChildren };
    } else if (type === "paragraph") {
      newBlock = { type: "paragraph", children: keptChildren };
    } else if (type === "blockquote") {
      newBlock = { type: "blockquote", children: keptChildren };
    } else if (type === "code_block") {
      // Code blocks store plain text only — flatten marks away.
      const plainText = keptChildren.map((n) => n.text).join("");
      newBlock = { type: "code_block", children: [{ type: "text", text: plainText }] };
    } else {
      newBlock = { type: "horizontal_rule" };
    }

    const next = [...blocks];
    next[index] = newBlock;
    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();

    // Non-editable blocks can't receive a caret — focus the paragraph that
    // withTrailingParagraph guarantees exists immediately after them.
    const isNonEditable = type === "horizontal_rule";
    setTimeout(() => {
      if (isNonEditable) {
        const el = blockRefs.current[index + 1];
        if (el) focusBlockAtStart(el);
      } else {
        blockRefs.current[index]?.focus();
      }
    }, 0);
  }

  function handleSlashDismiss() {
    setSlashAnchor(null);
    setSlashQuery("");
  }

  // ── Cross-block Delete / Backspace handler (assigned every render via ref) ──
  //
  // Handles Delete / Backspace when the selection spans multiple editing hosts.
  // Assigned to crossBlockDeleteRef every render so the once-registered
  // document listener always calls the latest closure (needs current blocks).
  crossBlockDeleteRef.current = (e: KeyboardEvent) => {
    // Resolve the block index (-1 = title) for any DOM node.
    function resolveBlockIdx(node: Node | null): number | null {
      if (!node) return null;
      const el =
        node.nodeType === Node.ELEMENT_NODE
          ? (node as Element)
          : node.parentElement;
      if (!el) return null;
      if (el === titleRef.current || titleRef.current?.contains(el)) return -1;
      for (let i = 0; i < blockRefs.current.length; i++) {
        const ref = blockRefs.current[i];
        if (ref === el || ref?.contains(el)) return i;
      }
      return null;
    }

    // ── Delete / Backspace on a cross-block selection ─────────────────────────
    if (e.key !== "Backspace" && e.key !== "Delete") return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const startIdx = resolveBlockIdx(range.startContainer);
    const endIdx = resolveBlockIdx(range.endContainer);

    if (startIdx === null || endIdx === null) return;
    if (startIdx === endIdx) return; // same editing host — browser handles it

    e.preventDefault();
    sel.removeAllRanges();

    const startEl =
      startIdx === -1 ? titleRef.current! : blockRefs.current[startIdx]!;
    const endEl =
      endIdx === -1 ? titleRef.current! : blockRefs.current[endIdx]!;

    // Fragment before the selection start (inside the start element).
    const beforeRange = document.createRange();
    beforeRange.setStart(startEl, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);

    // Fragment after the selection end (inside the end element).
    const afterRange = document.createRange();
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEnd(endEl, endEl.childNodes.length);

    const tempDiv = document.createElement("div");

    if (startIdx === -1) {
      // ── Selection starts inside the title ────────────────────────────────────
      const newTitleText = beforeRange.toString();

      // Update end block to contain only the content after the selection.
      tempDiv.appendChild(afterRange.cloneContents());
      const afterHtml = tempDiv.innerHTML;
      const endBlock = blocks[endIdx];
      const mergedBlock: BlockNode =
        "children" in endBlock
          ? ({ ...endBlock, children: htmlToNodes(afterHtml) } as BlockNode)
          : { type: "paragraph", children: [{ type: "text", text: "" }] };

      // Remove all blocks before and including endIdx; prepend merged block.
      updateBlocks([mergedBlock, ...blocks.slice(endIdx + 1)]);

      // Commit title change imperatively so the store and DOM stay in sync.
      setTitle(newTitleText);
      titleRef.current!.innerText = newTitleText;
      cancelHistoryDebounce();
      pushHistoryNow();

      setTimeout(() => {
        const el = blockRefs.current[0];
        if (el) focusBlockAtStart(el);
      }, 0);
    } else {
      // ── Selection starts inside a block ──────────────────────────────────────
      tempDiv.appendChild(beforeRange.cloneContents());
      const beforeHtml = tempDiv.innerHTML;

      tempDiv.innerHTML = "";
      tempDiv.appendChild(afterRange.cloneContents());
      const afterHtml = tempDiv.innerHTML;

      const mergedHtml = beforeHtml + afterHtml;
      const startBlock = blocks[startIdx];
      const mergedBlock: BlockNode =
        "children" in startBlock
          ? ({ ...startBlock, children: htmlToNodes(mergedHtml) } as BlockNode)
          : startBlock;

      const newBlocks = [
        ...blocks.slice(0, startIdx),
        mergedBlock,
        ...blocks.slice(endIdx + 1),
      ];

      // Measure caret offset BEFORE mutating innerHTML.
      // startEl.innerHTML destroys the child nodes that beforeRange references;
      // calling beforeRange.toString() after that returns "" (orphaned node).
      const targetCaretLength = beforeRange.toString().length;

      // Write the merged HTML directly into the DOM before React re-renders.
      // EditableBlock's sync useEffect skips updates while the element has
      // focus, so this persists across the state-driven re-render.
      startEl.innerHTML = mergedHtml;
      startEl.focus();

      // Place caret at the junction between before and after content.
      let charCount = 0;
      function findCaretPos(
        node: Node,
      ): { node: Node; offset: number } | null {
        if (node.nodeType === Node.TEXT_NODE) {
          const len = (node.textContent ?? "").length;
          if (charCount + len >= targetCaretLength) {
            return { node, offset: targetCaretLength - charCount };
          }
          charCount += len;
          return null;
        }
        for (const child of Array.from(node.childNodes)) {
          const res = findCaretPos(child);
          if (res) return res;
        }
        return null;
      }
      const pos = findCaretPos(startEl);
      const r = document.createRange();
      if (pos) {
        r.setStart(pos.node, pos.offset);
      } else {
        r.setStart(startEl, startEl.childNodes.length);
      }
      r.collapse(true);
      // focus() may have set an implicit range at position 0; clear it first.
      sel.removeAllRanges();
      sel.addRange(r);

      updateBlocks(newBlocks);
      cancelHistoryDebounce();
      pushHistoryNow();
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <h1
        ref={titleRef}
        id="article-title"
        aria-label="Title"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Title"
        className={cx(editableBaseStyle, typographyStyles({ type: "title" }))}
        onInput={(e) => {
          setTitle(e.currentTarget.innerText);
          pushHistoryDebounced();
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          if (text) document.execCommand("insertText", false, text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const el = blockRefs.current[0];
            if (el) focusBlockAtStart(el);
          }
          if (
            e.key === "ArrowDown" &&
            !e.shiftKey &&
            isCaretAtLastLine(e.currentTarget)
          ) {
            e.preventDefault();
            const el = blockRefs.current[0];
            if (el) focusBlockAtStart(el);
          }
          if (
            e.key === "ArrowDown" &&
            e.shiftKey &&
            isFocusAtLastLine(e.currentTarget)
          ) {
            e.preventDefault();
            const sel = window.getSelection();
            if (!sel?.anchorNode) return;
            const { anchorNode, anchorOffset } = sel;
            const nextEl = blockRefs.current[0];
            if (nextEl) {
              const focus = firstTextNode(nextEl) ?? nextEl;
              nextEl.focus();
              sel.setBaseAndExtent(anchorNode, anchorOffset, focus, 0);
            }
          }
          if (
            e.key === "ArrowRight" &&
            !e.shiftKey &&
            isCaretAtEnd(e.currentTarget)
          ) {
            e.preventDefault();
            const el = blockRefs.current[0];
            if (el) focusBlockAtStart(el);
          }
        }}
      />

      {blocks.map((block, i) => (
        <EditableBlock
          key={`${i}-${block.type}`}
          block={block}
          blockIndex={i}
          isFirst={i === 0}
          isOnly={blocks.length === 1}
          onChange={(updated) => updateBlock(i, updated)}
            onEnter={(before, after) => splitBlock(i, before, after)}
          onDelete={() => deleteBlock(i)}
          onSlash={(el) => handleSlash(el, i)}
          isSlashActive={slashAnchor?.index === i}
          onSlashInput={slashAnchor?.index === i ? handleSlashInput : undefined}
          onArrowUp={() => {
            if (i === 0) {
              const el = titleRef.current;
              if (el) focusBlockAtEnd(el);
            } else {
              const el = blockRefs.current[i - 1];
              if (el) focusBlockAtEnd(el);
            }
          }}
          onArrowDown={() => {
            const el = blockRefs.current[i + 1];
            if (el) focusBlockAtStart(el);
          }}
          onArrowLeft={() => {
            if (i === 0) {
              const el = titleRef.current;
              if (el) focusBlockAtEnd(el);
            } else {
              const el = blockRefs.current[i - 1];
              if (el) focusBlockAtEnd(el);
            }
          }}
          onArrowRight={() => {
            const el = blockRefs.current[i + 1];
            if (el) focusBlockAtStart(el);
          }}
            onPasteBlocks={(firstHtml, restHtmls) =>
              pasteBlocks(i, firstHtml, restHtmls)
            }
            onMergeWithPrev={(html) => mergeWithPrev(i, html)}
            onMergeWithNext={(html) => mergeWithNext(i, html)}
            onConvertedToParagraph={() => {
              setTimeout(() => {
                const el = blockRefs.current[i];
                if (el) focusBlockAtStart(el);
              }, 0);
            }}
            onShiftArrowUp={() => shiftArrowUp(i)}
            onShiftArrowDown={() => shiftArrowDown(i)}
          elRef={(el) => {
            blockRefs.current[i] = el;
          }}
        />
      ))}

      {slashAnchor && (
        <SlashMenu
          anchor={slashAnchor.el}
          query={slashQuery}
          allowedTypes={
            slashAnchor.hasExistingContent
              ? ["heading", "paragraph", "blockquote", "code_block"]
              : undefined
          }
          excludeType={blocks[slashAnchor.index]?.type as SlashMenuBlockType | undefined}
          onSelect={handleSlashSelect}
          onDismiss={handleSlashDismiss}
        />
      )}
    </>
  );
}
