"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { css, cx } from "../../styled-system/css";
import {
  horizontalRule,
  inlineCode,
  articleLink,
  articleUnderline,
  articleStrikethrough,
  articleHighlight,
  articleSidenote,
  articleSidenoteRef,
  articleBlockquote,
  articleBlockquoteBody,
  articleBlockquoteCite,
  articleBlockquoteMark,
  articleBlockquoteShell,
  articleHeadingShell,
  articleSubheadingCaption,
  articleListItemShell,
  listMarker,
  listBullet,
  listBulletIcon,
  listBulletCircle,
  articleListItemContent,
  articleMetric,
  articleMetricCaption,
  articleMetricValue,
  articleMetricLabel,
  codeBlock,
  articleShowcase,
  articleImg,
  menuIcon,
} from "../../styled-system/recipes";
import { useEditorStore } from "@/store/editor";
import {
  autosaveKey,
  clearAutosave,
  readAutosave,
  writeAutosave,
} from "@/utils/editor-autosave";
import { createDraft, saveDraft } from "@/app/actions/post";
import { getEditUrl } from "@/utils/post-urls";
import { notifyContentUpdated } from "@/utils/content-sync";
import {
  SlashMenu,
  slashMenuHasResults,
  type SlashMenuBlockType,
} from "@/components/slash-menu";
import {
  SelectionToolbar,
  type SelectionToolbarMode,
  type ToggleableMark,
} from "@/components/selection-toolbar";
import { DemoFrame } from "@/components/demo-frame";
import { DemoComponent } from "@/components/demo-component";
import { getDemoComponent } from "@/components/demo/registry";
import {
  ImageInsertDialog,
  type ImageDialogMode,
} from "@/components/image-insert-dialog";
import { ComponentInsertDialog } from "@/components/component-insert-dialog";
import { NumberToolbar } from "@/components/number-toolbar";
import { BulletToolbar, type BulletStyle } from "@/components/bullet-toolbar";
import {
  computeListNumbering,
  type ListMarkerStyle,
} from "@/utils/list-numbering";
import CheckSmallIcon from "@/assets/icons/check-small.svg";
import CrossSmallIcon from "@/assets/icons/cross-small.svg";
import { SidenoteLayer } from "@/components/sidenote-layer";
import {
  collectSidenotes,
  makeSidenoteId,
  sidenoteAnchorName,
  sidenoteBases,
  type SidenoteEntry,
} from "@/utils/sidenotes";
import { Button } from "@/components/ui/button";
import { typographyStyles } from "@/components/ui/typography";
import TrashIcon from "@/assets/icons/trash.svg";
import type { Post, Document, PostCategory } from "@/domain/post";
import type { BlockNode, InlineNode, Mark, CodeLanguage } from "@/domain/nodes";
import { CodeLanguageSchema } from "@/domain/nodes";
import { CODE_LANGUAGE_LABELS } from "@/utils/syntax-highlight";

// ---------------------------------------------------------------------------
// DOM ↔ AST serialisation helpers
// ---------------------------------------------------------------------------

// Pre-compute recipe classNames once so inlineNodesToHtml can embed them in
// the HTML strings it builds. This keeps edit-mode and read-only visually
// identical without re-invoking the CVA on every keystroke.
const inlineCodeClass = inlineCode();
const linkClass = articleLink();
const underlineClass = articleUnderline();
const strikethroughClass = articleStrikethrough();
const highlightClass = articleHighlight();
const sidenoteClass = articleSidenote();
const sidenoteRefClass = articleSidenoteRef();

function isHighlighted(node: InlineNode): boolean {
  return (node.marks ?? []).some((m) => m.type === "highlight");
}

/** Serialise a node's marks to nested HTML; `highlight` is applied at the run level. */
function styledTextToHtml(node: InlineNode): string {
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
      case "underline":
        html = `<u class="${underlineClass}">${html}</u>`;
        break;
      case "strikethrough":
        html = `<s class="${strikethroughClass}">${html}</s>`;
        break;
      case "link":
        html = `<a href="${mark.href}" class="${linkClass}">${html}</a>`;
        break;
    }
  }
  return html;
}

/**
 * Serialise an inline-nodes array to an HTML string for contentEditable.
 * Consecutive highlighted nodes coalesce into one <mark> so the gradient stays
 * continuous across a run (see self-improvement.md).
 */
/** The sidenote id a node carries, or null. Groups a note's contiguous runs. */
function sidenoteIdOf(node: InlineNode): string | null {
  const mark = (node.marks ?? []).find((m) => m.type === "sidenote");
  return mark?.type === "sidenote" ? mark.id : null;
}

function sidenoteTextOf(node: InlineNode): string {
  const mark = (node.marks ?? []).find((m) => m.type === "sidenote");
  return mark?.type === "sidenote" ? mark.text : "";
}

/** HTML-escape a string for use inside a double-quoted attribute value. */
function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

/** Serialise a run of non-sidenote nodes, coalescing consecutive highlights. */
function inlineRunToHtml(nodes: InlineNode[]): string {
  let out = "";
  let i = 0;
  while (i < nodes.length) {
    if (isHighlighted(nodes[i])) {
      let inner = "";
      while (i < nodes.length && isHighlighted(nodes[i])) {
        inner += styledTextToHtml(nodes[i]);
        i++;
      }
      out += `<mark class="${highlightClass}">${inner}</mark>`;
    } else {
      out += styledTextToHtml(nodes[i]);
      i++;
    }
  }
  return out;
}

/**
 * Serialise inline nodes to editor HTML. `base` is the count of distinct notes
 * appearing before this block (see sidenoteBases): each note's `<sup>` gets its
 * global ordinal in `data-sidenote-number` (rendered via `content: attr(...)`),
 * so numbering survives the block-content-sync re-serialisation and stays live
 * on add/remove — a CSS counter can't (Chromium doesn't re-resolve `counter()`
 * when a preceding counter element is removed).
 */
export function inlineNodesToHtml(nodes: InlineNode[], base = 0): string {
  let out = "";
  let i = 0;
  let noteIndex = 0;
  const numberById = new Map<string, number>();
  while (i < nodes.length) {
    const id = sidenoteIdOf(nodes[i]);
    if (id !== null) {
      // Wrap a note's contiguous runs in one dotted-underline span carrying the
      // note id/text (for round-tripping) and a per-note anchor-name (for the
      // aside card). The trailing <sup> shows the ordinal via data-sidenote-number.
      const start = i;
      while (i < nodes.length && sidenoteIdOf(nodes[i]) === id) i++;
      const group = nodes.slice(start, i);
      if (!numberById.has(id)) numberById.set(id, base + ++noteIndex);
      out +=
        `<span class="${sidenoteClass}" data-sidenote-id="${escapeAttr(id)}"` +
        ` data-sidenote-text="${escapeAttr(sidenoteTextOf(group[0]))}"` +
        ` style="anchor-name:${sidenoteAnchorName(id)}">` +
        `${inlineRunToHtml(group)}` +
        `<sup class="${sidenoteRefClass}" contenteditable="false" aria-hidden="true"` +
        ` data-sidenote-number="${numberById.get(id)}"></sup>` +
        `</span>`;
    } else {
      const start = i;
      while (i < nodes.length && sidenoteIdOf(nodes[i]) === null) i++;
      out += inlineRunToHtml(nodes.slice(start, i));
    }
  }
  return out;
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
      else if (el.tagName === "U") nextMarks.push({ type: "underline" });
      else if (
        el.tagName === "S" ||
        el.tagName === "STRIKE" ||
        el.tagName === "DEL"
      )
        nextMarks.push({ type: "strikethrough" });
      else if (el.tagName === "MARK") nextMarks.push({ type: "highlight" });
      else if (el.tagName === "A") {
        // The raw attribute, NOT `.href` — the latter is resolved against the
        // page URL, so a bare "google.com" would come back as
        // "http://localhost:3000/edit/google.com". Links are normalised to an
        // absolute URL on apply (see normalizeLinkHref), so this round-trips.
        const href = el.getAttribute("href");
        if (href) nextMarks.push({ type: "link", href });
      } else if (el.tagName === "SPAN" && el.hasAttribute("data-sidenote-id")) {
        nextMarks.push({
          type: "sidenote",
          id: el.getAttribute("data-sidenote-id") ?? "",
          text: el.getAttribute("data-sidenote-text") ?? "",
        });
      }
      // The decorative ordinal superscript holds no text — skip it entirely so
      // its (CSS-generated) digit never leaks into the AST.
      else if (el.tagName === "SUP") return;
      // BR tags produce a zero-width space we skip
      else if (el.tagName === "BR") return;

      el.childNodes.forEach((child) => walk(child, nextMarks));
    }
  }

  el.childNodes.forEach((child) => walk(child, []));
  return nodes;
}

/**
 * Remove sidenote wrappers left empty by deleting their annotated text. The
 * orphaned `<sup>` inside keeps incrementing the `sidenote` CSS counter, so the
 * ordinals never decrement until the wrapper is gone. Returns whether any were
 * removed. Empty wrappers hold no characters, so callers can restore the caret
 * by re-applying the pre-strip selection offsets.
 */
export function stripEmptySidenoteWrappers(el: HTMLElement): boolean {
  const orphans = Array.from(
    el.querySelectorAll<HTMLElement>("[data-sidenote-id]"),
  ).filter((w) => (w.textContent ?? "") === "");
  orphans.forEach((w) => w.remove());
  return orphans.length > 0;
}

/**
 * Renumber a block's sidenote superscripts in place from `base` (distinct notes
 * before the block). Used for the FOCUSED block, whose content-sync effect is
 * skipped to protect the caret — so add/remove within it can't rely on a
 * re-serialise to refresh `data-sidenote-number`. Setting the attribute alone
 * doesn't touch the editable text, so the caret is undisturbed.
 */
export function renumberSidenoteSups(el: HTMLElement, base = 0): void {
  const numberById = new Map<string, number>();
  let n = base;
  el.querySelectorAll<HTMLElement>("[data-sidenote-id]").forEach((wrapper) => {
    const id = wrapper.getAttribute("data-sidenote-id");
    if (!id) return;
    if (!numberById.has(id)) numberById.set(id, ++n);
    const sup = wrapper.querySelector<HTMLElement>(".article-sidenote-ref");
    if (sup) sup.setAttribute("data-sidenote-number", String(numberById.get(id)));
  });
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
      case "u":
        return `<u class="${underlineClass}">${inner}</u>`;
      case "s":
      case "strike":
      case "del":
        return `<s class="${strikethroughClass}">${inner}</s>`;
      case "mark":
        return `<mark class="${highlightClass}">${inner}</mark>`;
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
 * Top of an element's content box (border-box top plus top padding). Line
 * detection must measure against this, not getBoundingClientRect().top: blocks
 * with vertical padding larger than a line height (e.g. code blocks, padded
 * 3xl) would otherwise never register their first/last line as a boundary,
 * trapping the caret inside the block during ArrowUp/ArrowDown navigation.
 */
function contentBoxTop(el: HTMLElement): number {
  const paddingTop = parseFloat(getComputedStyle(el).paddingTop) || 0;
  return el.getBoundingClientRect().top + paddingTop;
}

/** Bottom of an element's content box (border-box bottom minus bottom padding). */
function contentBoxBottom(el: HTMLElement): number {
  const paddingBottom = parseFloat(getComputedStyle(el).paddingBottom) || 0;
  return el.getBoundingClientRect().bottom - paddingBottom;
}

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
  return caretRect.top < contentBoxTop(el) + caretRect.height;
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
  return caretRect.bottom > contentBoxBottom(el) - caretRect.height;
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
  return rect.top < contentBoxTop(el) + rect.height;
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
  const result = rect.height
    ? rect.bottom > contentBoxBottom(el) - rect.height
    : false;
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
  return (
    first !== null && range.startContainer === first && range.startOffset === 0
  );
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
  if (range.startContainer === el && range.startOffset === el.childNodes.length)
    return true;
  const last = lastTextNode(el);
  return (
    last !== null &&
    range.startContainer === last &&
    range.startOffset === last.length
  );
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
// Selection ↔ character-offset helpers (used by the selection toolbar)
// ---------------------------------------------------------------------------

/** Walk Text nodes in DOM order and resolve a character offset to a DOM position. */
function findTextPositionAtOffset(
  root: Node,
  offset: number,
): { node: Text; offset: number } | null {
  let remaining = offset;
  function find(node: Node): { node: Text; offset: number } | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node as Text;
      if (remaining <= t.length) return { node: t, offset: remaining };
      remaining -= t.length;
      return null;
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      const found = find(node.childNodes[i]);
      if (found) return found;
    }
    return null;
  }
  return find(root);
}

/**
 * Return the current selection as character offsets within `el`, or null when
 * there is no selection anchored inside `el`.
 */
function getSelectionOffsets(
  el: HTMLElement,
): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) {
    return null;
  }
  // Boundary nodes can be orphaned mid-edit; a stale range throws here.
  try {
    const pre = document.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const end = start + range.toString().length;
    return { start, end };
  } catch {
    return null;
  }
}

/** Focus `el` and set the DOM selection to the given character-offset range. */
function setSelectionRange(el: HTMLElement, start: number, end: number) {
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  try {
    const startPos = findTextPositionAtOffset(el, start);
    const endPos = findTextPositionAtOffset(el, end);
    if (startPos && endPos) {
      range.setStart(startPos.node, startPos.offset);
      range.setEnd(endPos.node, endPos.offset);
    } else {
      range.selectNodeContents(el);
      range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // Offsets can fall out of bounds if the DOM changed underneath us.
  }
}

// ---------------------------------------------------------------------------
// Mark manipulation over an inline-node array (pure — exported for tests)
// ---------------------------------------------------------------------------

/** Order-independent structural equality for two mark arrays. */
function marksEqual(a: Mark[] | undefined, b: Mark[] | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  const key = (m: Mark) => JSON.stringify(m);
  const sa = aa.map(key).sort();
  const sb = bb.map(key).sort();
  return sa.every((v, i) => v === sb[i]);
}

/** Merge consecutive text nodes that carry identical marks. */
export function mergeAdjacentInlineNodes(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const node of nodes) {
    if (node.text.length === 0) continue;
    const prev = out[out.length - 1];
    if (prev && marksEqual(prev.marks, node.marks)) {
      out[out.length - 1] = { ...prev, text: prev.text + node.text };
    } else {
      out.push(node);
    }
  }
  return out;
}

/**
 * True when every character in [start, end) already carries a mark of `type`.
 * Returns false for an empty range or when no covered text exists.
 */
export function rangeHasMark(
  nodes: InlineNode[],
  start: number,
  end: number,
  type: Mark["type"],
): boolean {
  if (start >= end) return false;
  let offset = 0;
  let sawCovered = false;
  for (const node of nodes) {
    const len = node.text.length;
    const nodeStart = offset;
    const nodeEnd = offset + len;
    offset = nodeEnd;
    if (len === 0 || nodeEnd <= start || nodeStart >= end) continue;
    sawCovered = true;
    if (!(node.marks ?? []).some((m) => m.type === type)) return false;
  }
  return sawCovered;
}

/**
 * Apply `transform` to the marks of every character in [start, end), splitting
 * nodes at the range boundaries. Returns a normalised inline-node array.
 */
export function transformMarksInRange(
  nodes: InlineNode[],
  start: number,
  end: number,
  transform: (marks: Mark[]) => Mark[],
): InlineNode[] {
  if (start >= end) return nodes;
  const result: InlineNode[] = [];
  let offset = 0;
  for (const node of nodes) {
    const len = node.text.length;
    const nodeStart = offset;
    const nodeEnd = offset + len;
    offset = nodeEnd;
    if (len === 0) continue;
    if (nodeEnd <= start || nodeStart >= end) {
      result.push(node);
      continue;
    }
    const marks = node.marks ?? [];
    const covStart = Math.max(start, nodeStart) - nodeStart;
    const covEnd = Math.min(end, nodeEnd) - nodeStart;
    if (covStart > 0) {
      result.push({
        type: "text",
        text: node.text.slice(0, covStart),
        ...(marks.length ? { marks } : {}),
      });
    }
    const nextMarks = transform(marks);
    result.push({
      type: "text",
      text: node.text.slice(covStart, covEnd),
      ...(nextMarks.length ? { marks: nextMarks } : {}),
    });
    if (covEnd < len) {
      result.push({
        type: "text",
        text: node.text.slice(covEnd),
        ...(marks.length ? { marks } : {}),
      });
    }
  }
  return mergeAdjacentInlineNodes(result);
}

/**
 * Normalise a user-typed link target. A bare host ("google.com") gets an
 * implicit "https://" so it isn't treated as a page-relative path. An explicit
 * scheme ("http://", "https://", "mailto:", "tel:", any "scheme://…"), a
 * root-relative path ("/writing/x"), a fragment ("#foo"), a query ("?q"), or a
 * protocol-relative URL ("//host") is left untouched. A "host:port" like
 * "google.com:8080" still gets "https://" — its dotted prefix marks it as a
 * host, not a scheme.
 */
export function normalizeLinkHref(raw: string): string {
  const href = raw.trim();
  if (!href) return href;
  if (/^(\/|#|\?)/.test(href)) return href;
  const scheme = href.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !scheme[1].includes(".")) return href;
  return `https://${href}`;
}

/**
 * Locate the contiguous run of link-marked text surrounding character `offset`.
 * Returns the run's [start, end) bounds and href, or null when `offset` is not
 * inside a link.
 */
export function findLinkRangeAt(
  nodes: InlineNode[],
  offset: number,
): { start: number; end: number; href: string } | null {
  // Precompute each node's [start, end) bounds and link href (if any).
  const spans = nodes.map((node) => {
    const link = (node.marks ?? []).find((m) => m.type === "link");
    return { len: node.text.length, href: link?.type === "link" ? link.href : null };
  });
  let pos = 0;
  const bounds = spans.map((s) => {
    const start = pos;
    pos += s.len;
    return { start, end: pos, href: s.href };
  });

  // Locate the link-bearing node the caret sits in (endpoints count as inside).
  const hitIndex = bounds.findIndex(
    (b) => b.href !== null && offset >= b.start && offset <= b.end,
  );
  if (hitIndex === -1) return null;

  const href = bounds[hitIndex].href as string;
  let start = bounds[hitIndex].start;
  let end = bounds[hitIndex].end;
  for (let i = hitIndex - 1; i >= 0 && bounds[i].href === href; i--) {
    start = bounds[i].start;
  }
  for (let i = hitIndex + 1; i < bounds.length && bounds[i].href === href; i++) {
    end = bounds[i].end;
  }
  return { start, end, href };
}

/**
 * Locate the contiguous run of one sidenote surrounding character `offset`.
 * Returns the note's [start, end) bounds and id, or null when `offset` is not
 * inside a sidenote. Mirrors findLinkRangeAt (endpoints count as inside).
 */
export function findSidenoteRangeAt(
  nodes: InlineNode[],
  offset: number,
): { start: number; end: number; id: string } | null {
  const spans = nodes.map((node) => {
    const mark = (node.marks ?? []).find((m) => m.type === "sidenote");
    return { len: node.text.length, id: mark?.type === "sidenote" ? mark.id : null };
  });
  let pos = 0;
  const bounds = spans.map((s) => {
    const start = pos;
    pos += s.len;
    return { start, end: pos, id: s.id };
  });

  const hitIndex = bounds.findIndex(
    (b) => b.id !== null && offset >= b.start && offset <= b.end,
  );
  if (hitIndex === -1) return null;

  const id = bounds[hitIndex].id as string;
  let start = bounds[hitIndex].start;
  let end = bounds[hitIndex].end;
  for (let i = hitIndex - 1; i >= 0 && bounds[i].id === id; i--) {
    start = bounds[i].start;
  }
  for (let i = hitIndex + 1; i < bounds.length && bounds[i].id === id; i++) {
    end = bounds[i].end;
  }
  return { start, end, id };
}

// ---------------------------------------------------------------------------

/** Return true if a block carries no text content. */
function isBlockEmpty(block: BlockNode): boolean {
  if (block.type === "horizontal_rule") return false;
  if (block.type === "image") return false;
  if (block.type === "component") return false;
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
// Empty blocks keep their natural single-line height (via the :empty::before
// line box) so they stay clickable to focus; only reserve caret room on focus.
const editableBaseStyle = css({
  focusVisibleRing: "none",
  minHeight: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  "&:focus": {
    minHeight: "1.5em",
  },
  "&:empty::before": {
    content: "attr(data-placeholder)",
    color: "text.default/40",
    pointerEvents: "none",
  },
});

const editorCodeBlockStyle = codeBlock();

const editorCodeBlockWrapperStyle = css({
  position: "relative",
});

const editorCodeLanguageSelectStyle = css({
  position: "absolute",
  top: "md",
  right: "md",
  zIndex: 1,
  textStyle: "caption",
  color: "text.commandItem",
  backgroundColor: "bg.surface",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  borderRadius: "sm",
  paddingInline: "sm",
  paddingBlock: "xs",
  opacity: 0,
  pointerEvents: "none",
  transition: "opacity 150ms ease",
  ".code-block-wrapper:focus-within &": {
    opacity: 1,
    pointerEvents: "auto",
  },
});

const CODE_LANGUAGE_OPTIONS: Array<{ value: CodeLanguage | ""; label: string }> =
  [
    { value: "", label: "Plain text" },
    ...CodeLanguageSchema.options.map((language) => ({
      value: language,
      label: CODE_LANGUAGE_LABELS[language],
    })),
  ];

const editorHrStyle = cx(
  horizontalRule(),
  css({ marginBlock: "0" }),
);

const editorShowcaseStyle = articleShowcase();

const editorShowcaseMediaShellStyle = css({
  position: "relative",
  alignSelf: "stretch",
  width: "full",
  display: "grid",
  "& > *": {
    gridArea: "1 / 1",
  },
});

const editorHrShellStyle = css({
  position: "relative",
  width: "full",
  paddingBlock: "3xl",
});

const editorShowcaseMediaStyle = css({
  alignSelf: "stretch",
  width: "full",
  focusVisibleRing: "none",
  cursor: "default",
});

const editorDemoPreviewStyle = css({
  width: "full",
  height: "full",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  userSelect: "none",
});

const editorImgStyle = cx(
  articleImg(),
  editorShowcaseMediaStyle,
);

const editorImagePlaceholderStyle = cx(
  editorShowcaseMediaStyle,
  css({
    width: "full",
  }),
);

const editorImageOverlayStyle = css({
  position: "absolute",
  inset: "0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "auto",
});

const editorImageOverlayTintStyle = css({
  position: "absolute",
  inset: "0",
  backgroundColor: "bg.canvas",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  borderRadius: "xl",
  pointerEvents: "none",
  opacity: "0.85",
});

const editorImageOverlayActionsStyle = css({
  position: "relative",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "md",
});

const editorOverlayIconStyle = menuIcon();

const editorCaptionStyle = cx(
  editableBaseStyle,
  typographyStyles({ type: "caption" }),
  css({
    width: "full",
    textAlign: "center",
    minHeight: "1.5em",
    "&:empty::before, &[data-empty]::before": {
      content: "attr(data-placeholder)",
      color: "text.default/40",
      pointerEvents: "none",
    },
  }),
);

// Blockquote citation — left-aligned beneath the quote text (unlike the
// centered media/component captions).
const editorBlockquoteCaptionStyle = cx(
  editableBaseStyle,
  articleBlockquoteCite(),
  css({
    minHeight: "1.5em",
    "&:empty::before, &[data-empty]::before": {
      content: "attr(data-placeholder)",
      color: "text.default/40",
      pointerEvents: "none",
    },
  }),
);

// Subheading eyebrow — above the heading. The recipe reveals the brand gradient
// once populated; while empty it falls back to the placeholder colour.
const editorSubheadingCaptionStyle = cx(
  editableBaseStyle,
  articleSubheadingCaption(),
  css({
    minHeight: "1.5em",
    "&:empty::before, &[data-empty]::before": {
      content: "attr(data-placeholder)",
      color: "text.default/40",
      pointerEvents: "none",
    },
  }),
);

// Metric value — the gradient display line. The recipe clips the brand gradient
// into the glyphs once populated; while empty it shows the placeholder colour.
const editorMetricValueStyle = cx(
  editableBaseStyle,
  articleMetricValue(),
  css({
    minHeight: "1.5em",
    // The value hugs its text (width: fit-content) so the gradient clips
    // tightly — but an empty value would then collapse to 0 width, leaving
    // the caret no room to render. Reserve a caret's width while empty.
    minWidth: "token(spacing.xxs)",
  }),
);

// Metric caption — the optional eyebrow above the value (image-caption style,
// left-aligned).
const editorMetricCaptionStyle = cx(
  editableBaseStyle,
  articleMetricCaption(),
  css({
    minHeight: "1.5em",
    "&:empty::before, &[data-empty]::before": {
      content: "attr(data-placeholder)",
      color: "text.default/40",
      pointerEvents: "none",
    },
  }),
);

// Metric label — the descriptive subtext line beneath the value.
const editorMetricLabelStyle = cx(
  editableBaseStyle,
  articleMetricLabel(),
  css({
    minHeight: "1.5em",
    "&:empty::before, &[data-empty]::before": {
      content: "attr(data-placeholder)",
      color: "text.default/40",
      pointerEvents: "none",
    },
  }),
);

// Wrapper for <hr> so it can receive keyboard focus (void elements can't).
const editorHrWrapperStyle = css({
  focusVisibleRing: "none",
  cursor: "default",
});

// List item content — contentEditable mechanics + shared prose recipe.
const editorListItemContentStyle = cx(editableBaseStyle, articleListItemContent());
// The ordinal badge is a real button in the editor so it can open the numbering
// popover — reset the native button chrome and re-enable pointer events (the
// read-only `listMarker` recipe disables them).
const editorListMarkerButtonStyle = cx(
  listMarker(),
  css({
    appearance: "none",
    border: "none",
    pointerEvents: "auto",
    cursor: "pointer",
  }),
);
// The bullet marker is also a button (opens the bullet-style popover). The dot
// variant reuses `listBullet`; the check/cross variants reuse `listBulletIcon`
// (the 24px alignment box). Both are transparent buttons — the gradient lives
// on the inner `listBulletCircle`, not the button.
const bulletButtonReset = css({
  appearance: "none",
  border: "none",
  background: "transparent",
  padding: 0,
  pointerEvents: "auto",
  cursor: "pointer",
});
const editorListBulletButtonStyle = cx(listBullet(), bulletButtonReset);
const editorListBulletIconButtonStyle = cx(listBulletIcon(), bulletButtonReset);
const editorListBulletCircleStyle = listBulletCircle();
const editorBulletGlyphStyle = menuIcon();
const editorListItemShellStyle = articleListItemShell();

/** Numbered (`list_item`) and bulleted (`bullet_list_item`) list entries share
 *  identical editing behaviour — only their marker differs. */
type ListItemType = "list_item" | "bullet_list_item";
function isListItemType(type: BlockNode["type"]): type is ListItemType {
  return type === "list_item" || type === "bullet_list_item";
}

// ---------------------------------------------------------------------------
// EditableBlock
// ---------------------------------------------------------------------------

interface EditableBlockProps {
  block: BlockNode;
  blockIndex: number;
  /** Count of distinct sidenotes before this block — offsets the block's own
   *  note ordinals to their global values (see inlineNodesToHtml / sidenoteBases). */
  sidenoteBase: number;
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
  /** Toggle an inline mark over the current selection (⌘B / ⌘I / ⌘U). */
  onToggleMark?: (type: ToggleableMark) => void;
  /** Shift+ArrowUp when the selection focus is on the first visual line. */
  onShiftArrowUp?: () => void;
  /** Shift+ArrowDown when the selection focus is on the last visual line. */
  onShiftArrowDown?: () => void;
  /** Open the image library to replace the current image. */
  onChangeImage?: () => void;
  /** Insert an empty paragraph immediately before this block. */
  onInsertParagraphBefore?: () => void;
  /** Insert an empty paragraph after this block, or focus the trailing one. */
  onInsertParagraphAfter?: () => void;
  /** Insert an empty numbered-list item immediately before this list item. */
  onInsertListItemBefore?: () => void;
  /** Insert an empty numbered-list item immediately after this list item. */
  onInsertListItemAfter?: () => void;
  /** Precomputed marker text for this numbered-list item (zero-padded or a→z). */
  listLabel?: string;
  /** Open the numbering popover anchored to this item's marker badge. */
  onMarkerClick?: (rect: DOMRect) => void;
  elRef: (el: HTMLElement | null) => void;
}

function EditableBlock({
  block,
  blockIndex,
  sidenoteBase,
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
  onToggleMark,
  onShiftArrowUp,
  onShiftArrowDown,
  onChangeImage,
  onInsertParagraphBefore,
  onInsertParagraphAfter,
  onInsertListItemBefore,
  onInsertListItemAfter,
  listLabel,
  onMarkerClick,
  elRef,
}: EditableBlockProps) {
  const placeholder =
    isFirst && isOnly && block.type === "paragraph"
      ? "Tell your story..."
      : undefined;

  const slashAnchorProps = isSlashActive ? { "data-slash-anchor": "" } : {};

  // Local ref to the DOM element — needed for the imperative innerHTML update.
  const contentRef = useRef<HTMLElement | null>(null);
  const captionRef = useRef<HTMLElement | null>(null);
  // Metric-only: the subtext line below the value (the value uses contentRef and
  // the eyebrow caption above reuses captionRef).
  const subtextRef = useRef<HTMLElement | null>(null);
  const showcaseMediaRef = useRef<HTMLElement | null>(null);

  // Stable combined ref: forwards to both contentRef and the parent's elRef
  // callback without recreating on every render. elRef is mirrored into a ref,
  // synced after commit (writing a ref during render is unsafe), so combinedRef
  // can stay identity-stable while always calling the latest elRef.
  const elRefRef = useRef(elRef);
  useEffect(() => {
    elRefRef.current = elRef;
  }, [elRef]);
  const combinedRef = useCallback((el: HTMLElement | null) => {
    contentRef.current = el;
    elRefRef.current(el);
  }, []);
  const showcaseMediaCallbackRef = useCallback((el: HTMLElement | null) => {
    showcaseMediaRef.current = el;
  }, []);

  // Whether this non-text block currently has keyboard focus (drives overlay).
  const [isFocused, setIsFocused] = useState(false);
  const [isShowcaseMediaFocused, setIsShowcaseMediaFocused] = useState(false);

  // Keyboard handler for the horizontal rule block (no caret): arrow keys
  // navigate between blocks, Backspace/Delete removes the rule, and Enter
  // inserts an empty paragraph above it (matching showcase media).
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
          if (!e.shiftKey) {
            e.preventDefault();
            onArrowDown?.();
          }
          break;
        case "Enter":
          if (!e.shiftKey) {
            e.preventDefault();
            onInsertParagraphBefore?.();
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
        case "Tab":
          // Tab has no navigation role in the editor — swallow it.
          e.preventDefault();
          break;
        case "Backspace":
        case "Delete":
          e.preventDefault();
          onDelete();
          break;
      }
    },
    [onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onDelete, onInsertParagraphBefore],
  );

  const focusCaption = useCallback((position: "start" | "end") => {
    const caption = captionRef.current;
    if (!caption) return;
    caption.focus();
    if (!caption.isContentEditable) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    const node =
      position === "end" ? lastTextNode(caption) : firstTextNode(caption);
    if (node) {
      range.setStart(node, position === "end" ? node.length : 0);
    } else {
      range.setStart(caption, 0);
    }
    range.collapse(position === "end" ? false : true);
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  // Metric-only: move the caret into the subtext line below the value (mirrors
  // focusCaption, which targets the eyebrow caption above).
  const focusSubtext = useCallback((position: "start" | "end") => {
    const subtext = subtextRef.current;
    if (!subtext) return;
    subtext.focus();
    if (!subtext.isContentEditable) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    const node =
      position === "end" ? lastTextNode(subtext) : firstTextNode(subtext);
    if (node) {
      range.setStart(node, position === "end" ? node.length : 0);
    } else {
      range.setStart(subtext, 0);
    }
    range.collapse(position === "end" ? false : true);
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  // From a caption, move focus back to the element it captions: the showcase
  // media (image/component) when present, otherwise the blockquote text.
  const focusCaptionOrigin = useCallback(() => {
    const media = showcaseMediaRef.current;
    if (media) {
      media.focus();
      return;
    }
    const content = contentRef.current;
    if (!content) return;
    content.focus();
    if (!content.isContentEditable) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    const node = lastTextNode(content);
    if (node) {
      range.setStart(node, node.length);
    } else {
      range.selectNodeContents(content);
    }
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const handleShowcaseMediaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      switch (e.key) {
        case "ArrowUp":
          if (!e.shiftKey) {
            e.preventDefault();
            onArrowUp?.();
          }
          break;
        case "ArrowDown":
          if (!e.shiftKey) {
            e.preventDefault();
            focusCaption("start");
          }
          break;
        case "Enter":
          if (!e.shiftKey) {
            e.preventDefault();
            onInsertParagraphBefore?.();
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
            focusCaption("start");
          }
          break;
        case "Tab":
          // Tab never navigates in the editor — swallow it (ArrowDown/Right
          // still move into the caption).
          e.preventDefault();
          break;
        case "Backspace":
        case "Delete":
          e.preventDefault();
          onDelete();
          break;
      }
    },
    [onArrowUp, onArrowLeft, onDelete, focusCaption, onInsertParagraphBefore],
  );

  // Update innerHTML when block content changes externally (e.g. initial load
  // after store init, or a slash-menu type conversion that causes remount).
  // While the user is actively typing the element has focus — skip the update
  // so we never reset the cursor position.
  // Non-editable blocks (horizontal_rule, image) have no editable children —
  // skip innerHTML sync to avoid wiping their rendered content.
  useEffect(() => {
    if (block.type === "horizontal_rule" || block.type === "image" || block.type === "component") return;
    const el = contentRef.current;
    if (!el || document.activeElement === el) return;
    const html =
      block.type === "code_block"
        ? block.children.map((c) => c.text).join("")
        : "children" in block
          ? inlineNodesToHtml(block.children as InlineNode[], sidenoteBase)
          : "";
    el.innerHTML = html;
    // `sidenoteBase` is a dep so a note added/removed in an EARLIER block
    // re-serialises this (non-focused) block with its new ordinals.
  }, [block, sidenoteBase]);

  useEffect(() => {
    if (
      block.type !== "image" &&
      block.type !== "component" &&
      block.type !== "blockquote" &&
      block.type !== "heading" &&
      block.type !== "metric"
    )
      return;
    const el = captionRef.current;
    if (!el || document.activeElement === el) return;
    el.innerText = block.caption ?? "";
  }, [block]);

  // Metric-only: keep the subtext line in sync (mirrors the caption effect
  // above; the eyebrow caption uses captionRef, the subtext uses subtextRef).
  useEffect(() => {
    if (block.type !== "metric") return;
    const el = subtextRef.current;
    if (!el || document.activeElement === el) return;
    el.innerText = block.subtext ?? "";
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

      // Tab never navigates between blocks in the editor — its only role is
      // one-step indentation. For indentable blocks it toggles the indent
      // (anywhere in the block); for every other block type it's a deliberate
      // no-op. Either way preventDefault so the caret never jumps.
      if (e.key === "Tab") {
        e.preventDefault();
        if (
          block.type === "paragraph" ||
          block.type === "heading" ||
          block.type === "blockquote" ||
          block.type === "metric"
        ) {
          const isIndented = (block as { indent?: boolean }).indent === true;
          if (!e.shiftKey && !isIndented) {
            onChange({ ...block, indent: true });
          } else if (e.shiftKey && isIndented) {
            onChange({ ...block, indent: undefined });
          }
        }
        return;
      }

      // Shift+ArrowUp: extend selection upward across blocks.
      if (e.key === "ArrowUp" && e.shiftKey) {
        const _sel = window.getSelection();
        const _focusInBlock = e.currentTarget.contains(_sel?.focusNode ?? null);
        const _atFirst = _focusInBlock
          ? isFocusAtFirstLine(e.currentTarget)
          : false;
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
          const _target = document.caretRangeFromPoint(
            _rect.left,
            _rect.top - _lineH,
          );
          if (
            _target &&
            !(
              _target.startContainer === _sel.focusNode &&
              _target.startOffset === _sel.focusOffset
            )
          ) {
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
        const _atLast = _focusInBlock
          ? isFocusAtLastLine(e.currentTarget)
          : false;
        if (!_focusInBlock && _sel?.focusNode) {
          e.preventDefault();
          const _r = document.createRange();
          _r.setStart(_sel.focusNode, _sel.focusOffset);
          _r.collapse(true);
          const _rect = _r.getBoundingClientRect();
          const _lineH = Math.max(_rect.height, 20);
          const _target = document.caretRangeFromPoint(
            _rect.left,
            _rect.bottom + _lineH,
          );
          if (
            _target &&
            !(
              _target.startContainer === _sel.focusNode &&
              _target.startOffset === _sel.focusOffset
            )
          ) {
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

      // ArrowUp from a subheading's / metric's first line → its eyebrow caption.
      if (
        e.key === "ArrowUp" &&
        !e.shiftKey &&
        (block.type === "heading" || block.type === "metric") &&
        isCaretAtFirstLine(e.currentTarget)
      ) {
        e.preventDefault();
        focusCaption("end");
        return;
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

      // ArrowDown from a blockquote's last line → its citation; from a metric's
      // last line → its subtext line below the value.
      if (
        e.key === "ArrowDown" &&
        !e.shiftKey &&
        (block.type === "blockquote" || block.type === "metric") &&
        isCaretAtLastLine(e.currentTarget)
      ) {
        e.preventDefault();
        if (block.type === "metric") focusSubtext("start");
        else focusCaption("start");
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

      // ArrowLeft at the start of a subheading / metric value → its eyebrow caption.
      if (
        e.key === "ArrowLeft" &&
        !e.shiftKey &&
        (block.type === "heading" || block.type === "metric") &&
        isCaretAtStart(e.currentTarget)
      ) {
        e.preventDefault();
        focusCaption("end");
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

      // ArrowRight at the end of a blockquote value → its citation; at the end
      // of a metric value → its subtext line below.
      if (
        e.key === "ArrowRight" &&
        !e.shiftKey &&
        (block.type === "blockquote" || block.type === "metric") &&
        isCaretAtEnd(e.currentTarget)
      ) {
        e.preventDefault();
        if (block.type === "metric") focusSubtext("start");
        else focusCaption("start");
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

      // List Enter behaviour (numbered + bulleted; caret-position dependent).
      if (e.key === "Enter" && !e.shiftKey && isListItemType(block.type)) {
        e.preventDefault();
        // Empty item → exit the list, converting to a paragraph.
        if (isBlockEmpty(block)) {
          onChange({ type: "paragraph", children: [{ type: "text", text: "" }] });
          onConvertedToParagraph?.();
          return;
        }
        // Caret at start → add an empty item before; keep editing this one.
        if (isCaretAtStart(e.currentTarget) && onInsertListItemBefore) {
          // This element is reused (index-based key) as the new empty item;
          // its text lives on in the store on the block that shifts down, so
          // clear the DOM now — the focus guard would otherwise skip the sync.
          e.currentTarget.innerHTML = "";
          onInsertListItemBefore();
          return;
        }
        // Caret at end → add a fresh empty item after.
        if (isCaretAtEnd(e.currentTarget) && onInsertListItemAfter) {
          onInsertListItemAfter();
          return;
        }
        // Caret in the middle → split into two items at the caret.
        const { before, after } = getCaretSplitHtml(e.currentTarget);
        e.currentTarget.innerHTML = before;
        onEnter(before, after);
        return;
      }

      // Enter → insert paragraph above at caret start; otherwise split at caret.
      // Code blocks keep Enter as a literal newline.
      if (e.key === "Enter" && !e.shiftKey && block.type !== "code_block") {
        e.preventDefault();
        if (isCaretAtStart(e.currentTarget) && onInsertParagraphBefore) {
          // For a same-type block (paragraph) the index-based key reuses this
          // element as the new empty block; its content survives in the store
          // on the block that shifts down. Clear the DOM now so the reused
          // element doesn't keep stale text the focus-guarded sync won't wipe.
          e.currentTarget.innerHTML = "";
          onInsertParagraphBefore();
          return;
        }
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
        (block.type === "heading" ||
          block.type === "blockquote" ||
          block.type === "metric" ||
          isListItemType(block.type) ||
          block.type === "code_block")
      ) {
        e.preventDefault();
        const children =
          "children" in block
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

      // ⌘B / ⌘I / ⌘U → toggle bold / italic / underline over the selection.
      // Routed through the AST-based toggle (same path as the selection toolbar)
      // so a second press reliably removes the mark, unlike execCommand.
      if (
        e.metaKey &&
        !e.shiftKey &&
        (e.key === "b" || e.key === "i" || e.key === "u")
      ) {
        e.preventDefault();
        if (onToggleMark && block.type !== "code_block") {
          const markForKey = { b: "bold", i: "italic", u: "underline" } as const;
          onToggleMark(markForKey[e.key as "b" | "i" | "u"]);
        }
        return;
      }
    },
    [
      block,
      onChange,
      onEnter,
      onDelete,
      isSlashActive,
      onArrowUp,
      onArrowDown,
      onArrowLeft,
      onArrowRight,
      onMergeWithPrev,
      onMergeWithNext,
      onConvertedToParagraph,
      onToggleMark,
      onShiftArrowUp,
      onShiftArrowDown,
      onInsertParagraphBefore,
      onInsertListItemBefore,
      onInsertListItemAfter,
      focusCaption,
      focusSubtext,
    ],
  );

  // ---------------------------------------------------------------------------
  // Input / change handling
  // ---------------------------------------------------------------------------

  const handleInput = useCallback(
    (e: React.InputEvent<HTMLElement>) => {
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
              const remaining = n.text;
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
            el.innerHTML = inlineNodesToHtml(replaced, sidenoteBase);
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
        // Deleting an annotation's text leaves its empty `.article-sidenote`
        // wrapper (and the contenteditable=false <sup> inside it) orphaned in the
        // DOM. domToInlineNodes already drops it from the AST, but the orphaned
        // <sup> keeps incrementing the `sidenote` CSS counter, so the visible
        // ordinals never decrement. Strip empty sidenote wrappers here; they hold
        // no characters, so removing them leaves selection offsets unchanged.
        const off = getSelectionOffsets(el);
        if (stripEmptySidenoteWrappers(el) && off) {
          setSelectionRange(el, off.start, off.end);
        }
        // This block is focused, so its content-sync effect won't re-serialise
        // it — refresh its own superscripts directly (e.g. after deleting an
        // annotation, the ones after it decrement).
        renumberSidenoteSups(el, sidenoteBase);
        onChange({
          ...(block as Extract<BlockNode, { children: InlineNode[] }>),
          children: nodes,
        } as BlockNode);
      }

      // Notify parent about text changes while the slash menu is active so it
      // can update the filter query or dismiss the menu.
      onSlashInput?.(el.innerText ?? "");
    },
    [block, sidenoteBase, onChange, onSlashInput],
  );

  const handleCaptionInput = useCallback(
    (e: React.FormEvent<HTMLElement>) => {
      if (
        block.type !== "image" &&
        block.type !== "component" &&
        block.type !== "blockquote" &&
        block.type !== "heading" &&
        block.type !== "metric"
      )
        return;
      const el = e.currentTarget;
      const text = (el.innerText || el.textContent || "").replace(/\n$/, "");
      if (text.trim().length === 0) {
        el.innerHTML = "";
      }
      onChange({
        ...block,
        caption: text.trim().length > 0 ? text : undefined,
      });
    },
    [block, onChange],
  );

  // Metric-only: persist the subtext line (mirrors handleCaptionInput, which
  // writes the eyebrow caption).
  const handleSubtextInput = useCallback(
    (e: React.FormEvent<HTMLElement>) => {
      if (block.type !== "metric") return;
      const el = e.currentTarget;
      const text = (el.innerText || el.textContent || "").replace(/\n$/, "");
      if (text.trim().length === 0) {
        el.innerHTML = "";
      }
      onChange({
        ...block,
        subtext: text.trim().length > 0 ? text : undefined,
      });
    },
    [block, onChange],
  );

  const handleCaptionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.stopPropagation();
        return;
      }
      // Tab has no navigation role in the editor — swallow it so the caret
      // never jumps out of the caption.
      if (e.key === "Tab") {
        e.preventDefault();
        return;
      }
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        document.execCommand("insertLineBreak");
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onInsertParagraphAfter?.();
        return;
      }
      if (
        e.key === "ArrowUp" &&
        !e.shiftKey &&
        isCaretAtStart(e.currentTarget)
      ) {
        e.preventDefault();
        focusCaptionOrigin();
        return;
      }
      if (
        e.key === "ArrowDown" &&
        !e.shiftKey &&
        isCaretAtEnd(e.currentTarget)
      ) {
        e.preventDefault();
        onArrowDown?.();
        return;
      }
      if (
        e.key === "ArrowLeft" &&
        !e.shiftKey &&
        isCaretAtStart(e.currentTarget)
      ) {
        e.preventDefault();
        focusCaptionOrigin();
        return;
      }
      if (
        e.key === "ArrowRight" &&
        !e.shiftKey &&
        isCaretAtEnd(e.currentTarget)
      ) {
        e.preventDefault();
        onArrowRight?.();
        return;
      }
    },
    [onArrowDown, onArrowRight, onInsertParagraphAfter, focusCaptionOrigin],
  );

  // Move the caret to the start of the block's own editable content (used by
  // the subheading eyebrow, which sits *above* the heading text).
  const focusContentStart = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    content.focus();
    if (!content.isContentEditable) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    const node = firstTextNode(content);
    if (node) {
      range.setStart(node, 0);
    } else {
      range.setStart(content, 0);
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  // Keydown handler for a caption that sits *above* its block (the subheading
  // eyebrow). Down/Right/Enter descend into the heading; Up/Left at the start
  // leave for the previous block.
  const handleHeadingCaptionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.stopPropagation();
        return;
      }
      // Tab has no navigation role in the editor — swallow it.
      if (e.key === "Tab") {
        e.preventDefault();
        return;
      }
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        document.execCommand("insertLineBreak");
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        focusContentStart();
        return;
      }
      if (
        (e.key === "ArrowDown" || e.key === "ArrowRight") &&
        !e.shiftKey &&
        isCaretAtEnd(e.currentTarget)
      ) {
        e.preventDefault();
        focusContentStart();
        return;
      }
      if (e.key === "ArrowUp" && !e.shiftKey && isCaretAtStart(e.currentTarget)) {
        e.preventDefault();
        onArrowUp?.();
        return;
      }
      if (
        e.key === "ArrowLeft" &&
        !e.shiftKey &&
        isCaretAtStart(e.currentTarget)
      ) {
        e.preventDefault();
        onArrowUp?.();
        return;
      }
    },
    [onArrowUp, focusContentStart],
  );

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
        block.type === "metric" ||
        isListItemType(block.type) ||
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
        <div className={editorHrShellStyle}>
          <hr className={editorHrStyle} />
          {isFocused && (
            <div
              className={editorImageOverlayStyle}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className={editorImageOverlayTintStyle} aria-hidden />
              <div className={editorImageOverlayActionsStyle}>
                <Button
                  type="button"
                  variant="icon"
                  tabIndex={-1}
                  aria-label="Delete horizontal rule"
                  onClick={onDelete}
                >
                  <TrashIcon className={editorOverlayIconStyle} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Code block
  // ---------------------------------------------------------------------------

  if (block.type === "code_block") {
    return (
      <div className={cx(editorCodeBlockWrapperStyle, "code-block-wrapper")}>
        <label className={css({ srOnly: true })} htmlFor={`code-language-${blockIndex}`}>
          Code language
        </label>
        <select
          id={`code-language-${blockIndex}`}
          className={editorCodeLanguageSelectStyle}
          value={block.language ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            onChange({
              ...block,
              language:
                value === ""
                  ? undefined
                  : CodeLanguageSchema.parse(value),
            });
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {CODE_LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value || "plain"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
          {...slashAnchorProps}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Heading
  // ---------------------------------------------------------------------------

  if (block.type === "heading") {
    return (
      <div
        className={articleHeadingShell()}
        data-indented={block.indent ? "" : undefined}
      >
        <span
          ref={captionRef}
          className={editorSubheadingCaptionStyle}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Add caption..."
          data-empty={!block.caption?.trim() ? "" : undefined}
          onInput={handleCaptionInput}
          onKeyDown={handleHeadingCaptionKeyDown}
        />
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
          data-empty={isBlockEmpty(block) ? "" : undefined}
          {...slashAnchorProps}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Blockquote
  // ---------------------------------------------------------------------------

  if (block.type === "blockquote") {
    return (
      <div
        className={articleBlockquoteShell()}
        data-indented={block.indent ? "" : undefined}
      >
        <span className={articleBlockquoteMark()} aria-hidden />
        <div className={articleBlockquoteBody()}>
          <blockquote
            ref={combinedRef as React.RefCallback<HTMLElement>}
            className={cx(editableBaseStyle, articleBlockquote())}
            contentEditable
            suppressContentEditableWarning
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onKeyUp={handleKeyUp}
            onPaste={handlePaste}
            data-placeholder={placeholder}
            data-block-index={blockIndex}
            data-empty={isBlockEmpty(block) ? "" : undefined}
            {...slashAnchorProps}
          />
          <cite
            ref={captionRef}
            className={editorBlockquoteCaptionStyle}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Add citation..."
            data-block-index={blockIndex}
            data-empty={!block.caption?.trim() ? "" : undefined}
            onInput={handleCaptionInput}
            onKeyDown={handleCaptionKeyDown}
          />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Image block — img with editable caption
  // ---------------------------------------------------------------------------

  if (block.type === "image") {
    const showcaseMediaProps = {
      tabIndex: 0 as const,
      "data-showcase-media": "",
      ref: showcaseMediaCallbackRef,
      onFocus: () => setIsShowcaseMediaFocused(true),
      onBlur: () => setIsShowcaseMediaFocused(false),
      onKeyDown: handleShowcaseMediaKeyDown,
    };

    return (
      <figure
        ref={combinedRef as React.RefCallback<HTMLElement>}
        className={editorShowcaseStyle}
        data-block-index={blockIndex}
        data-showcase-block=""
      >
        <div className={editorShowcaseMediaShellStyle}>
          {block.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.src}
              alt={block.alt ?? ""}
              className={editorImgStyle}
              {...showcaseMediaProps}
            />
          ) : (
            <span
              aria-label="Image placeholder"
              className={editorImagePlaceholderStyle}
              {...showcaseMediaProps}
            >
              📷
            </span>
          )}
          {isShowcaseMediaFocused && (
            <div
              className={editorImageOverlayStyle}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className={editorImageOverlayTintStyle} aria-hidden />
              <div className={editorImageOverlayActionsStyle}>
                <Button
                  type="button"
                  variant="secondary"
                  tabIndex={-1}
                  onClick={() => onChangeImage?.()}
                >
                  Change Image...
                </Button>
                <Button
                  type="button"
                  variant="icon"
                  tabIndex={-1}
                  aria-label="Delete image"
                  onClick={onDelete}
                >
                  <TrashIcon className={editorOverlayIconStyle} />
                </Button>
              </div>
            </div>
          )}
        </div>
        <figcaption
          ref={captionRef}
          className={editorCaptionStyle}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Add caption..."
          data-block-index={blockIndex}
          data-empty={!block.caption?.trim() ? "" : undefined}
          onInput={handleCaptionInput}
          onKeyDown={handleCaptionKeyDown}
        />
      </figure>
    );
  }

  // ---------------------------------------------------------------------------
  // Component block
  // ---------------------------------------------------------------------------

  if (block.type === "component") {
    const demo = getDemoComponent(block.componentId);
    const showcaseMediaProps = {
      tabIndex: 0 as const,
      "data-showcase-media": "",
      ref: showcaseMediaCallbackRef,
      onFocus: () => setIsShowcaseMediaFocused(true),
      onBlur: () => setIsShowcaseMediaFocused(false),
      onKeyDown: handleShowcaseMediaKeyDown,
    };

    return (
      <figure
        ref={combinedRef as React.RefCallback<HTMLElement>}
        className={editorShowcaseStyle}
        data-block-index={blockIndex}
        data-showcase-block=""
      >
        <div className={editorShowcaseMediaShellStyle}>
          <DemoFrame
            aspectRatio={demo?.aspectRatio}
            logger={demo?.logger}
            interactive={false}
            className={editorShowcaseMediaStyle}
            {...showcaseMediaProps}
          >
            <div inert className={editorDemoPreviewStyle}>
              {demo ? (
                <DemoComponent entry={demo} />
              ) : (
                <span>Unknown component: {block.componentId}</span>
              )}
            </div>
          </DemoFrame>
          {isShowcaseMediaFocused && (
            <div
              className={editorImageOverlayStyle}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className={editorImageOverlayTintStyle} aria-hidden />
              <div className={editorImageOverlayActionsStyle}>
                <Button
                  type="button"
                  variant="icon"
                  tabIndex={-1}
                  aria-label="Delete component"
                  onClick={onDelete}
                >
                  <TrashIcon className={editorOverlayIconStyle} />
                </Button>
              </div>
            </div>
          )}
        </div>
        <figcaption
          ref={captionRef}
          className={editorCaptionStyle}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Add caption..."
          data-block-index={blockIndex}
          data-empty={!block.caption?.trim() ? "" : undefined}
          onInput={handleCaptionInput}
          onKeyDown={handleCaptionKeyDown}
        />
      </figure>
    );
  }

  // ---------------------------------------------------------------------------
  // List item (numbered or bulleted)
  // ---------------------------------------------------------------------------

  if (isListItemType(block.type)) {
    // The marker text is precomputed by computeListNumbering (zero-padded
    // decimal or a→z), so continue/reset/alpha all resolve in one place.
    const markerLabel = listLabel ?? "1";

    return (
      <div className={editorListItemShellStyle} data-list-item="">
        {block.type === "list_item" ? (
          <button
            type="button"
            className={editorListMarkerButtonStyle}
            data-numbering-marker=""
            aria-label="List numbering options"
            // Keep the caret in the editor when opening the popover.
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) =>
              onMarkerClick?.(e.currentTarget.getBoundingClientRect())
            }
          >
            {markerLabel}
          </button>
        ) : (
          <button
            type="button"
            className={
              block.type === "bullet_list_item" && block.marker
                ? editorListBulletIconButtonStyle
                : editorListBulletButtonStyle
            }
            data-bullet-marker=""
            aria-label="List bullet options"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) =>
              onMarkerClick?.(e.currentTarget.getBoundingClientRect())
            }
          >
            {block.type === "bullet_list_item" && block.marker && (
              <span className={editorListBulletCircleStyle}>
                {block.marker === "check" ? (
                  <CheckSmallIcon className={editorBulletGlyphStyle} aria-hidden />
                ) : (
                  <CrossSmallIcon className={editorBulletGlyphStyle} aria-hidden />
                )}
              </span>
            )}
          </button>
        )}
        <p
          ref={combinedRef as React.RefCallback<HTMLParagraphElement>}
          className={editorListItemContentStyle}
          contentEditable
          suppressContentEditableWarning
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onKeyUp={handleKeyUp}
          onPaste={handlePaste}
          data-block-index={blockIndex}
          data-empty={isBlockEmpty(block) ? "" : undefined}
          {...slashAnchorProps}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Metric — an optional eyebrow caption above a gradient value, with an
  // optional descriptive subtext line beneath it.
  // ---------------------------------------------------------------------------

  if (block.type === "metric") {
    return (
      <div
        className={articleMetric()}
        data-indented={block.indent ? "" : undefined}
      >
        <span
          ref={captionRef}
          className={editorMetricCaptionStyle}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Add caption..."
          data-empty={!block.caption?.trim() ? "" : undefined}
          onInput={handleCaptionInput}
          onKeyDown={handleHeadingCaptionKeyDown}
        />
        <div
          ref={combinedRef as React.RefCallback<HTMLDivElement>}
          className={editorMetricValueStyle}
          contentEditable
          suppressContentEditableWarning
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onKeyUp={handleKeyUp}
          onPaste={handlePaste}
          data-block-index={blockIndex}
          data-empty={isBlockEmpty(block) ? "" : undefined}
          {...slashAnchorProps}
        />
        <span
          ref={subtextRef}
          className={editorMetricLabelStyle}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Add subtext..."
          data-block-index={blockIndex}
          data-empty={!block.subtext?.trim() ? "" : undefined}
          onInput={handleSubtextInput}
          onKeyDown={handleCaptionKeyDown}
        />
      </div>
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
      data-empty={isBlockEmpty(block) ? "" : undefined}
      data-indented={
        (block as { indent?: boolean }).indent ? "" : undefined
      }
      {...slashAnchorProps}
    />
  );
}

// ---------------------------------------------------------------------------
// Ensure document always has at least one block and a trailing editable block
// ---------------------------------------------------------------------------

/**
 * Ensure an editable paragraph trails certain terminal blocks so the author can
 * always continue typing after them. This covers caret-less blocks
 * (horizontal_rule, image, component), lists — a list item last block would
 * otherwise trap the author in the list with no plain block to click into below
 * it — and code blocks, where Enter inserts a literal newline rather than a new
 * block, leaving no way to escape downward.
 */
function withTrailingParagraph(blocks: BlockNode[]): BlockNode[] {
  if (blocks.length === 0) {
    return [{ type: "paragraph", children: [{ type: "text", text: "" }] }];
  }
  const last = blocks[blocks.length - 1];
  if (
    last.type === "horizontal_rule" ||
    last.type === "image" ||
    last.type === "component" ||
    last.type === "code_block" ||
    isListItemType(last.type)
  ) {
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

function emptyParagraphBlock(): BlockNode {
  return { type: "paragraph", children: [{ type: "text", text: "" }] };
}

/** True when the figure is second-to-last and followed by a synthetic trailing paragraph. */
function hasSyntheticTrailingParagraph(
  blocks: BlockNode[],
  index: number,
): boolean {
  const block = blocks[index];
  if (block.type !== "image" && block.type !== "component") return false;
  if (index !== blocks.length - 2) return false;
  return isBlockEmpty(blocks[index + 1]);
}

// ---------------------------------------------------------------------------
// ArticleEditor
// ---------------------------------------------------------------------------

interface ArticleEditorProps {
  initialPost?: Post;
  category?: PostCategory;
}

/** Viewport-relative rect used to anchor the floating selection toolbar. */
interface ToolbarRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ToolbarState {
  mode: SelectionToolbarMode;
  /** Index of the block the toolbar operates on. */
  index: number;
  /** Anchor rect in viewport coordinates. */
  rect: ToolbarRect;
  /** Character range within the block the toolbar targets. */
  range: { start: number; end: number };
  /** Existing link href (link-view / link-edit). */
  href?: string;
  /** Target sidenote id (sidenote-view). */
  sidenoteId?: string;
  /** Mark types the selection fully carries (drives active button state). */
  activeMarks: Set<Mark["type"]>;
}

const TOOLBAR_MARK_TYPES: Mark["type"][] = [
  "bold",
  "italic",
  "code",
  "underline",
  "strikethrough",
  "highlight",
  "link",
  "sidenote",
];

export function ArticleEditor({ initialPost, category }: ArticleEditorProps) {
  const {
    title,
    setTitle,
    document: doc,
    setDocument,
    pushHistory,
  } = useEditorStore();

  const router = useRouter();
  // Guards against overlapping saves while a ⌘S request is in flight.
  const savingRef = useRef(false);

  // Populate store from initialPost on mount; reset on unmount.
  useEffect(() => {
    const sessionCategory = category ?? initialPost?.category ?? "ARTICLE";
    // Prefer a local autosave over the DB copy — it holds edits made after the
    // last save that a refresh / tab-close would otherwise have lost.
    const restored = readAutosave(
      autosaveKey(initialPost?.id ?? null, sessionCategory),
    );

    if (restored) {
      useEditorStore.setState({
        title: restored.title,
        draftId: restored.draftId,
        category: restored.category,
        document: {
          ...restored.document,
          content: withTrailingParagraph(restored.document.content),
        },
        isDirty: true,
        history: [],
        historyIndex: -1,
      });
    } else if (initialPost) {
      useEditorStore.setState({
        title: initialPost.title ?? "",
        draftId: initialPost.id,
        category: initialPost.category,
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
      if (category) {
        useEditorStore.setState({ category });
      }
    }
    // Seed history with the initial state so Cmd+Z can undo back to it.
    const s = useEditorStore.getState();
    s.pushHistory({ title: s.title, document: s.document });
    return () => useEditorStore.getState().reset();
    // Intentionally keyed on identity (id), not the whole `initialPost` object:
    // re-seeding on every new prop reference would wipe in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPost?.id, category]);

  // Autosave to localStorage (debounced) so an accidental refresh or tab close
  // never loses unsaved edits. Only dirty state is persisted; an explicit
  // save / publish / discard clears the entry (see use-command-palette.ts).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (!state.isDirty) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // Re-read at fire time: a save between scheduling and firing clears the
        // dirty flag, and this pending write must not resurrect the autosave.
        const s = useEditorStore.getState();
        if (!s.isDirty) return;
        writeAutosave(autosaveKey(s.draftId, s.category), {
          title: s.title,
          draftId: s.draftId,
          category: s.category,
          document: s.document,
          savedAt: Date.now(),
        });
      }, 500);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // ⌘S / Ctrl+S → persist the draft to the DB without leaving the editor.
  // Creating a first-time draft swaps the URL to /edit/<slug> (via replace, so
  // the editor stays mounted for existing drafts and only remounts for the
  // brand-new case) so a later refresh reloads the saved draft, not a blank
  // /edit/new. On success the local autosave is dropped and the dirty flag
  // cleared; other tabs refresh via the content-sync broadcast.
  useEffect(() => {
    async function saveInPlace() {
      if (savingRef.current) return;
      const { draftId, title, document, category, isDirty } =
        useEditorStore.getState();
      // Nothing unsaved — every edit sets isDirty, so this is a true no-op.
      if (!isDirty) return;

      savingRef.current = true;
      try {
        if (!draftId) {
          const created = await createDraft({
            title: title || undefined,
            document,
            category,
          });
          useEditorStore.getState().setDraftId(created.id);
          router.replace(getEditUrl(created.category, created.slug));
        } else {
          await saveDraft({ id: draftId, title: title || undefined, document });
        }
        useEditorStore.getState().setDirty(false);
        // Clear both the pre-save "new:<category>" key and any post-createDraft
        // id key so a refresh reloads the DB copy rather than a stale autosave.
        clearAutosave(autosaveKey(draftId, category));
        const after = useEditorStore.getState();
        clearAutosave(autosaveKey(after.draftId, after.category));
        notifyContentUpdated();
      } catch (err) {
        console.error("Failed to save draft:", err);
      } finally {
        savingRef.current = false;
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (e.key !== "s" && e.key !== "S") return;
      e.preventDefault();
      void saveInPlace();
    }

    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [router]);

  const blocks = ensureBlocks(doc);
  // Distinct-note count before each block — offsets each block's own sidenote
  // ordinals to their global values when serialising it independently.
  const sidenoteBaseList = sidenoteBases(blocks);
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
      const el =
        node.nodeType === Node.ELEMENT_NODE
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
        !(
          range.startContainer === sel.focusNode &&
          range.startOffset === sel.focusOffset
        )
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
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  // Delete / Backspace across editing hosts — dispatches to crossBlockDeleteRef
  // so the once-registered listener always calls the latest closure.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      crossBlockDeleteRef.current(e);
    }
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
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
        const el =
          blockRefs.current.find((e, i) => e != null && i === idx) ??
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
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
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
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageDialogMode, setImageDialogMode] =
    useState<ImageDialogMode>("insert");
  const [imageDialogBlockIndex, setImageDialogBlockIndex] = useState<
    number | null
  >(null);
  const [componentDialogOpen, setComponentDialogOpen] = useState(false);
  const [componentDialogBlockIndex, setComponentDialogBlockIndex] = useState<
    number | null
  >(null);

  // Floating selection toolbar (formatting / link editing / link actions).
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  // Id of a just-added sidenote whose aside card should grab focus so the note
  // can be typed straight away; cleared once the card focuses.
  const [pendingSidenoteFocusId, setPendingSidenoteFocusId] = useState<
    string | null
  >(null);
  // Id of the sidenote whose card is open for editing (set from the sidenote
  // popover's Edit action / on add). The caret merely surfaces the popover; the
  // card only appears once you choose Edit.
  const [editingSidenoteId, setEditingSidenoteId] = useState<string | null>(
    null,
  );
  // Numbered-list marker popover (continue / reset / swap style). Anchored to
  // the clicked marker's rect.
  const [numbering, setNumbering] = useState<{
    index: number;
    rect: ToolbarRect;
  } | null>(null);
  // Bulleted-list marker popover (dot / check / cross), anchored the same way.
  const [bullet, setBullet] = useState<{
    index: number;
    rect: ToolbarRect;
  } | null>(null);
  // Latest selection tracker — assigned every render so the once-registered
  // document listener always calls the current closure (needs live blocks).
  const trackSelectionRef = useRef<(force?: boolean) => void>(() => {});

  // -------------------------------------------------------------------------
  // Focus helpers
  // -------------------------------------------------------------------------

  function isShowcaseFigure(el: HTMLElement): boolean {
    return el.hasAttribute("data-showcase-block");
  }

  function focusBlockAtEnd(el: HTMLElement) {
    if (isShowcaseFigure(el)) {
      const caption = el.querySelector(
        "figcaption[contenteditable]",
      ) as HTMLElement | null;
      if (!caption) return;
      caption.focus();
      if (!caption.isContentEditable) return;
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      const node = lastTextNode(caption);
      if (node) {
        range.setStart(node, node.length);
      } else {
        range.selectNodeContents(caption);
      }
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }

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
    if (isShowcaseFigure(el)) {
      const host = el.querySelector("[data-showcase-media]") as HTMLElement | null;
      host?.focus();
      return;
    }

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
      const offset =
        focus.nodeType === Node.TEXT_NODE ? (focus as Text).length : 0;
      // Use extend() — does NOT change document.activeElement, avoids Chrome's
      // "refocus to anchor element" behaviour that setBaseAndExtent triggers.
      sel.extend(focus, offset);
      return;
    }

    const prevEl = blockRefs.current[blockIndex - 1];
    if (!prevEl) return;
    const focus = lastTextNode(prevEl) ?? prevEl;
    const offset =
      focus.nodeType === Node.TEXT_NODE ? (focus as Text).length : 0;
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

    // The new block inherits the current block's type for list items only, so
    // pressing Enter continues the list. Every other block type (headings,
    // blockquotes, metrics, …) splits into a default paragraph — which carries
    // the indent forward so splitting an indented block keeps both halves indented.
    const newBlock: BlockNode = (() => {
      const afterNodes = htmlToNodes(afterHtml);
      if (isListItemType(current.type)) {
        // Carry the item's bullet glyph forward so splitting keeps the style.
        // (On numbered items `marker` is a run-head field the numbering algo
        // ignores off-head, so copying it here is harmless.)
        const marker = (current as { marker?: string }).marker;
        return {
          type: current.type,
          children: afterNodes,
          ...(marker ? { marker } : {}),
        } as BlockNode;
      }
      const indent = (current as { indent?: boolean }).indent;
      return {
        type: "paragraph",
        children: afterNodes,
        ...(indent ? { indent: true } : {}),
      };
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

  // A fresh empty paragraph that inherits `indent` from `source` — so a new
  // node created off an indented block (Enter at its start/end) stays indented.
  function emptyParagraphInheriting(source: BlockNode | undefined): BlockNode {
    const base = emptyParagraphBlock();
    return (source as { indent?: boolean } | undefined)?.indent
      ? ({ ...base, indent: true } as BlockNode)
      : base;
  }

  function insertParagraphBefore(index: number) {
    updateBlocks([
      ...blocks.slice(0, index),
      emptyParagraphInheriting(blocks[index]),
      ...blocks.slice(index),
    ]);
    cancelHistoryDebounce();
    pushHistoryNow();

    setTimeout(() => {
      const el = blockRefs.current[index];
      if (el) focusBlockAtStart(el);
    }, 0);
  }

  function insertParagraphAfter(index: number) {
    if (hasSyntheticTrailingParagraph(blocks, index)) {
      setTimeout(() => {
        const el = blockRefs.current[index + 1];
        if (el) focusBlockAtStart(el);
      }, 0);
      return;
    }

    updateBlocks([
      ...blocks.slice(0, index + 1),
      emptyParagraphInheriting(blocks[index]),
      ...blocks.slice(index + 1),
    ]);
    cancelHistoryDebounce();
    pushHistoryNow();

    setTimeout(() => {
      const el = blockRefs.current[index + 1];
      if (el) focusBlockAtStart(el);
    }, 0);
  }

  function emptyListItemBlock(type: ListItemType): BlockNode {
    return { type, children: [{ type: "text", text: "" }] };
  }

  /** A fresh empty item that inherits `source`'s bullet glyph, so adding an
   *  item to a checked/crossed list keeps that style. Numbered items carry no
   *  per-item glyph, so they fall through to a plain empty item. */
  function emptyListItemInheriting(source: BlockNode): BlockNode {
    if (source.type === "bullet_list_item" && source.marker) {
      return {
        type: "bullet_list_item",
        children: [{ type: "text", text: "" }],
        marker: source.marker,
      };
    }
    return emptyListItemBlock(source.type as ListItemType);
  }

  /** Enter at the start of a list item: prepend an empty item of the same list
   *  type (numbered or bulleted), keeping the caret on the current item. */
  function insertListItemBefore(index: number) {
    const source = blocks[index];
    const type = source.type as ListItemType;
    // Prepending before a numbered run's first item makes the new item the run
    // head — carry the run-level marker/continue settings so the list keeps its
    // style. (These fields are ignored on non-head items, so leaving copies on
    // the old head is harmless.)
    const atRunStart =
      type === "list_item" &&
      (index === 0 || blocks[index - 1].type !== "list_item");
    const newItem: BlockNode =
      atRunStart && source.type === "list_item"
        ? {
            type: "list_item",
            children: [{ type: "text", text: "" }],
            marker: source.marker,
            continued: source.continued,
          }
        : emptyListItemInheriting(source);
    updateBlocks([
      ...blocks.slice(0, index),
      newItem,
      ...blocks.slice(index),
    ]);
    cancelHistoryDebounce();
    pushHistoryNow();

    setTimeout(() => {
      // The original (content) item shifted down to index + 1.
      const el = blockRefs.current[index + 1];
      if (el) focusBlockAtStart(el);
    }, 0);
  }

  // -------------------------------------------------------------------------
  // Numbered-list numbering controls (the marker popover)
  // -------------------------------------------------------------------------

  /** First index of the contiguous list_item run containing `index`. */
  function listRunStart(index: number): number {
    let start = index;
    while (start > 0 && blocks[start - 1].type === "list_item") start--;
    return start;
  }

  /** True when a numbered-list run exists before the run containing `index`. */
  function hasPrecedingList(index: number): boolean {
    const start = listRunStart(index);
    for (let k = 0; k < start; k++) {
      if (blocks[k].type === "list_item") return true;
    }
    return false;
  }

  function isContinueActive(index: number): boolean {
    const first = blocks[listRunStart(index)];
    return first?.type === "list_item" && first.continued === true;
  }

  /** Toggle "continue numbering" on the run head. No-op with no preceding list. */
  function toggleContinueNumbering(index: number) {
    const start = listRunStart(index);
    const first = blocks[start];
    if (first.type !== "list_item") return;
    const turningOn = first.continued !== true;
    if (turningOn && !hasPrecedingList(index)) return;
    const next = [...blocks];
    next[start] = { ...first, continued: turningOn ? true : undefined };
    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();
  }

  /** Restart the counter at the clicked item (toggle an explicit start of 1). */
  function resetNumbering(index: number) {
    const item = blocks[index];
    if (item.type !== "list_item") return;
    const next = [...blocks];
    next[index] = { ...item, start: item.start != null ? undefined : 1 };
    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();
  }

  /** Swap the whole run between decimal (1,2,3…) and alpha (a,b,c…) markers. */
  function swapListStyle(index: number) {
    const start = listRunStart(index);
    const first = blocks[start];
    if (first.type !== "list_item") return;
    const nextMarker: ListMarkerStyle | undefined =
      first.marker === "alpha" ? undefined : "alpha";
    const next = [...blocks];
    next[start] = { ...first, marker: nextMarker };
    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();
  }

  // -------------------------------------------------------------------------
  // Bulleted-list marker controls (the bullet popover)
  // -------------------------------------------------------------------------

  /** The clicked bullet item's current style ("dot" when unset). */
  function bulletStyleOf(index: number): BulletStyle {
    const item = blocks[index];
    if (item?.type !== "bullet_list_item") return "dot";
    return item.marker ?? "dot";
  }

  /** Set (or clear, for "dot") the clicked bullet item's glyph. */
  function setBulletStyle(index: number, style: BulletStyle) {
    const item = blocks[index];
    if (item?.type !== "bullet_list_item") return;
    const next = [...blocks];
    next[index] = {
      ...item,
      marker: style === "dot" ? undefined : style,
    };
    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();
  }

  /** Bounds [start, end) of the contiguous bullet run containing `index`. */
  function bulletRunBounds(index: number): { start: number; end: number } {
    let start = index;
    while (start > 0 && blocks[start - 1].type === "bullet_list_item") start--;
    let end = index;
    while (end < blocks.length && blocks[end].type === "bullet_list_item") end++;
    return { start, end };
  }

  /** The representative glyph of the nearest bulleted list ending before
   *  `runStart` (its head item's style), or null when none precedes it.
   *  Mirrors how "continue numbering" reaches back across intervening blocks. */
  function prevBulletRunStyle(runStart: number): BulletStyle | null {
    let last = runStart - 1;
    while (last >= 0 && blocks[last].type !== "bullet_list_item") last--;
    if (last < 0) return null;
    let head = last;
    while (head > 0 && blocks[head - 1].type === "bullet_list_item") head--;
    const item = blocks[head];
    return item.type === "bullet_list_item" ? item.marker ?? "dot" : null;
  }

  /** Apply `style` to every item in the bullet run containing `index`. */
  function setBulletRunStyle(index: number, style: BulletStyle) {
    const { start, end } = bulletRunBounds(index);
    const marker = style === "dot" ? undefined : style;
    const next = [...blocks];
    for (let k = start; k < end; k++) {
      const item = next[k];
      if (item.type === "bullet_list_item") next[k] = { ...item, marker };
    }
    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();
  }

  /** Carry the previous bulleted list's style onto this run. No-op when no
   *  bulleted list precedes it — mirrors "continue numbering". */
  function continueBulleting(index: number) {
    const { start } = bulletRunBounds(index);
    const style = prevBulletRunStyle(start);
    if (style === null) return;
    setBulletRunStyle(index, style);
  }

  /** Reset this run back to the default dot bullet — mirrors "reset numbering". */
  function resetBulleting(index: number) {
    setBulletRunStyle(index, "dot");
  }

  /** Open the numbering or bullet popover for the clicked list marker. */
  function handleMarkerClick(index: number, rect: DOMRect) {
    const b = blocks[index];
    // <article>-relative so the popover anchor rides the scrolling article (see
    // Popover / toArticleRect).
    const rel = toArticleRect(rect, blockRefs.current[index]);
    if (b?.type === "list_item") setNumbering({ index, rect: rel });
    else if (b?.type === "bullet_list_item") setBullet({ index, rect: rel });
  }

  /** Enter at the end of a list item: append a fresh empty item of the same
   *  list type and focus it. */
  function insertListItemAfter(index: number) {
    updateBlocks([
      ...blocks.slice(0, index + 1),
      emptyListItemInheriting(blocks[index]),
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

    // The current (focused) block merges away. With index+type keys React
    // reuses its DOM node for whatever block now occupies this slot — the
    // shifted-up successor, or the synthetic trailing paragraph appended when
    // the merge target is a list item / code block. EditableBlock's innerHTML
    // sync skips focused nodes, so without blurring the old text lingers in
    // that reused node (duplicated) until an unrelated re-render. Blur first so
    // the sync runs; focus is restored to the merge join below. (Mirrors
    // deleteBlock.)
    (document.activeElement as HTMLElement | null)?.blur();

    const prevBlock = blocks[index - 1];

    // Non-text predecessor (HR, image) — just delete it, keep current block
    if (prevBlock.type === "horizontal_rule" || prevBlock.type === "image" || prevBlock.type === "component") {
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
    if (nextBlock.type === "horizontal_rule" || nextBlock.type === "image" || nextBlock.type === "component") {
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
    // The block being deleted is focused. With index-based keys React reuses its
    // DOM node for the block that shifts up into this slot, and EditableBlock's
    // innerHTML-sync useEffect skips focused nodes — leaving the following block
    // visually empty. Blur first so that sync runs (mirrors the undo/redo path).
    (document.activeElement as HTMLElement | null)?.blur();
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
    if (!slashMenuHasResults(newQuery, undefined, excludeType)) {
      handleSlashDismiss();
      return;
    }
    setSlashQuery(newQuery);
  }

  /** Remove the slash-menu trigger "/" from inline children. */
  function stripSlashTrigger(children: InlineNode[]): InlineNode[] {
    const stripped: InlineNode[] =
      children.length > 0 &&
      children[0].type === "text" &&
      children[0].text.startsWith("/")
        ? [
            { ...children[0], text: children[0].text.slice(1) },
            ...children.slice(1),
          ]
        : children;
    const hasContent = stripped.some((n) => n.text.trim() !== "");
    return hasContent ? stripped : [{ type: "text" as const, text: "" }];
  }

  /**
   * Write stripped inline content back into a focused block. EditableBlock's
   * innerHTML sync useEffect skips updates while the element has focus.
   */
  function syncFocusedBlockDom(
    el: HTMLElement,
    children: InlineNode[],
    blockType: SlashMenuBlockType,
    base = 0,
  ) {
    if (blockType === "horizontal_rule") return;
    if (blockType === "code_block") {
      el.innerHTML = children.map((n) => n.text).join("");
      return;
    }
    el.innerHTML = inlineNodesToHtml(children, base);
  }

  /**
   * The slash menu no longer picks a component itself — it opens the Insert
   * Component overlay. Strip the trigger, leave a paragraph in place, and defer
   * the actual component insertion until the overlay confirms (mirrors Media).
   */
  function handleSlashOpenComponentPicker() {
    if (!slashAnchor) return;
    const { index, el } = slashAnchor;
    setSlashAnchor(null);
    setSlashQuery("");

    const keptChildren = stripSlashTrigger(domToInlineNodes(el));
    syncFocusedBlockDom(el, keptChildren, "paragraph", sidenoteBaseList[index]);

    const next = [...blocks];
    next[index] = { type: "paragraph", children: keptChildren };
    updateBlocks(next);

    setComponentDialogBlockIndex(index);
    setComponentDialogOpen(true);
  }

  function handleComponentInsert(componentId: string) {
    if (componentDialogBlockIndex === null) return;
    const index = componentDialogBlockIndex;

    const next = [...blocks];
    next[index] = { type: "component", componentId };
    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();

    setComponentDialogOpen(false);
    setComponentDialogBlockIndex(null);

    setTimeout(() => {
      const trailing = blockRefs.current[index + 1];
      if (trailing) focusBlockAtStart(trailing);
    }, 0);
  }

  function handleComponentDialogClose() {
    setComponentDialogOpen(false);
    setComponentDialogBlockIndex(null);
  }

  function handleSlashSelect(type: SlashMenuBlockType) {
    if (!slashAnchor) return;
    const { index, el } = slashAnchor;
    setSlashAnchor(null);
    setSlashQuery("");

    // Read from the DOM — it is authoritative while the block is focused.
    const keptChildren = stripSlashTrigger(domToInlineNodes(el));
    syncFocusedBlockDom(el, keptChildren, type, sidenoteBaseList[index]);

    if (type === "media") {
      const next = [...blocks];
      next[index] = { type: "paragraph", children: keptChildren };
      updateBlocks(next);

      setImageDialogMode("insert");
      setImageDialogBlockIndex(index);
      setImageDialogOpen(true);
      return;
    }

    let newBlock: BlockNode;
    if (type === "heading") {
      newBlock = { type: "heading", level: 2, children: keptChildren };
    } else if (type === "paragraph") {
      newBlock = { type: "paragraph", children: keptChildren };
    } else if (type === "blockquote") {
      newBlock = { type: "blockquote", children: keptChildren };
    } else if (type === "list_item") {
      newBlock = { type: "list_item", children: keptChildren };
    } else if (type === "bullet_list_item") {
      newBlock = { type: "bullet_list_item", children: keptChildren };
    } else if (type === "metric") {
      newBlock = { type: "metric", children: keptChildren };
    } else if (type === "code_block") {
      // Code blocks store plain text only — flatten marks away.
      const plainText = keptChildren.map((n) => n.text).join("");
      newBlock = {
        type: "code_block",
        children: [{ type: "text", text: plainText }],
      };
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

  function handleChangeImage(blockIndex: number) {
    setImageDialogMode("change");
    setImageDialogBlockIndex(blockIndex);
    setImageDialogOpen(true);
  }

  function handleImageInsert(payload: { src: string; alt?: string }) {
    if (imageDialogBlockIndex === null) return;

    const existing = blocks[imageDialogBlockIndex];
    const next = [...blocks];
    next[imageDialogBlockIndex] = {
      type: "image",
      src: payload.src,
      ...(payload.alt ? { alt: payload.alt } : {}),
      ...(existing.type === "image" && existing.caption
        ? { caption: existing.caption }
        : {}),
    };
    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();

    const changedBlockIndex = imageDialogBlockIndex;
    const wasChange = imageDialogMode === "change";
    setImageDialogOpen(false);
    setImageDialogBlockIndex(null);
    setImageDialogMode("insert");

    setTimeout(() => {
      if (wasChange) {
        const figure = blockRefs.current[changedBlockIndex];
        const media = figure?.querySelector(
          "[data-showcase-media]",
        ) as HTMLElement | null;
        media?.focus();
        return;
      }
      const el = blockRefs.current[changedBlockIndex + 1];
      if (el) focusBlockAtStart(el);
    }, 0);
  }

  function handleImageDialogClose() {
    setImageDialogOpen(false);
    setImageDialogBlockIndex(null);
    setImageDialogMode("insert");
  }

  function handleSlashDismiss() {
    setSlashAnchor(null);
    setSlashQuery("");
  }

  // -------------------------------------------------------------------------
  // Selection toolbar
  // -------------------------------------------------------------------------

  /** Resolve the block index (>= 0) whose element contains `node`, else null. */
  function toolbarBlockIndex(node: Node | null): number | null {
    if (!node) return null;
    const el =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;
    if (!el) return null;
    for (let i = 0; i < blockRefs.current.length; i++) {
      if (blockRefs.current[i]?.contains(el)) return i;
    }
    return null;
  }

  // Viewport-space → <article>-relative. The toolbar's anchor is an absolute
  // child of the `position: relative` <article>, so article-relative coordinates
  // (which don't change as the page scrolls) let it ride the article content and
  // the browser tracks / auto-hides the popover natively — no per-scroll JS.
  function toArticleRect(
    r: { left: number; top: number; width: number; height: number },
    within: Node | null,
  ): ToolbarRect {
    const el = within?.nodeType === 1 ? (within as Element) : within?.parentElement;
    const article = el?.closest("article") ?? null;
    const base =
      article && typeof article.getBoundingClientRect === "function"
        ? article.getBoundingClientRect()
        : { left: 0, top: 0 };
    return {
      left: r.left - base.left,
      top: r.top - base.top,
      width: r.width,
      height: r.height,
    };
  }

  function rectFromRange(range: Range): ToolbarRect {
    // Anchor to the FIRST line's rect, not the whole-range bounding box. A run
    // that wraps across lines (common for sidenote annotations, rarer for links
    // or a short text selection) has a bounding box spanning the full column —
    // line 1 ends at the right edge, line 2 starts at the left — so its centre
    // falls between the fragments rather than over the text, and the centred
    // popover drifts to the column middle. The first client rect keeps the
    // popover above the start of the run for every mode alike.
    // jsdom's Range has neither getClientRects nor getBoundingClientRect.
    const rects =
      typeof range.getClientRects === "function"
        ? Array.from(range.getClientRects())
        : [];
    const r =
      rects[0] ??
      (typeof range.getBoundingClientRect === "function"
        ? range.getBoundingClientRect()
        : { left: 0, top: 0, width: 0, height: 0 });
    return toArticleRect(r, range.startContainer);
  }

  function domRangeForOffsets(
    el: HTMLElement,
    start: number,
    end: number,
  ): Range | null {
    const s = findTextPositionAtOffset(el, start);
    const e = findTextPositionAtOffset(el, end);
    if (!s || !e) return null;
    const range = document.createRange();
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset);
    return range;
  }

  // Recomputes the toolbar from the live selection. Called on selectionchange
  // and resize (scroll needs no JS — the <article>-relative anchor rides the
  // content and the browser tracks it). Skipped while the slash menu or the
  // link editor is open.
  // `forceRect` re-measures the anchor even when the selection is unchanged
  // (resize/reflow); otherwise a same-selection update keeps the existing rect
  // so toggling a mark — which fires selectionchange after rewriting the run —
  // doesn't shift the toolbar as the glyphs change width.
  function trackSelection(forceRect = false) {
    if (slashAnchor) {
      setToolbar(null);
      return;
    }
    // Keep the link editor open — its input holds focus, so the editor
    // selection is momentarily gone.
    if (toolbar?.mode === "link-edit") return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setToolbar(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const index = toolbarBlockIndex(range.startContainer);
    if (index === null) {
      setToolbar(null);
      return;
    }
    const el = blockRefs.current[index];
    const block = blocks[index];
    if (
      !el ||
      !block ||
      !("children" in block) ||
      block.type === "code_block" ||
      !el.contains(range.endContainer)
    ) {
      setToolbar(null);
      return;
    }
    const offsets = getSelectionOffsets(el);
    if (!offsets) {
      setToolbar(null);
      return;
    }
    const nodes = domToInlineNodes(el);

    // Caret on — or a selection wholly within — an annotated run shows the
    // sidenote actions (Edit / Delete), taking priority over the format toolbar
    // and link view. Suppressed while that note's card is already being edited.
    // Anchored to the live selection (`range`), not the whole annotation: a
    // collapsed caret centres the toolbar on the caret; a multi-char selection
    // positions it exactly like the format toolbar. The `range` field stays the
    // full annotation bounds — that's what Edit / Delete act on.
    const sidenote = findSidenoteRangeAt(nodes, offsets.start);
    if (
      sidenote &&
      offsets.start >= sidenote.start &&
      offsets.end <= sidenote.end &&
      editingSidenoteId !== sidenote.id
    ) {
      setToolbar({
        mode: "sidenote-view",
        index,
        rect: rectFromRange(range),
        range: { start: sidenote.start, end: sidenote.end },
        sidenoteId: sidenote.id,
        activeMarks: new Set(),
      });
      return;
    }

    // A caret on — or a selection wholly within — a link shows the link actions
    // (Edit / Open / Remove), taking priority over the format toolbar (mirrors
    // the sidenote branch above). Anchored to the live selection (`range`): a
    // collapsed caret centres on the caret, a multi-char selection positions
    // like the format toolbar. The `range` field stays the full link bounds —
    // that's what Edit / Remove act on.
    const link = findLinkRangeAt(nodes, offsets.start);
    if (link && offsets.start >= link.start && offsets.end <= link.end) {
      setToolbar({
        mode: "link-view",
        index,
        rect: rectFromRange(range),
        range: { start: link.start, end: link.end },
        href: link.href,
        activeMarks: new Set(),
      });
      return;
    }

    if (offsets.start !== offsets.end) {
      const activeMarks = new Set(
        TOOLBAR_MARK_TYPES.filter((m) =>
          rangeHasMark(nodes, offsets.start, offsets.end, m),
        ),
      );
      // Keep the anchor fixed for the lifetime of a selection: only re-measure
      // when the selection itself moves (or a reflow forces it). A mark toggle
      // leaves start/end untouched, so it reuses the original rect and the
      // toolbar stays put instead of re-centering on the now-wider run.
      const sameSelection =
        !forceRect &&
        toolbar?.mode === "format" &&
        toolbar.index === index &&
        toolbar.range.start === offsets.start &&
        toolbar.range.end === offsets.end;
      setToolbar({
        mode: "format",
        index,
        rect: sameSelection ? toolbar.rect : rectFromRange(range),
        range: offsets,
        activeMarks,
      });
      return;
    }
    setToolbar(null);
  }

  // Toggle an inline mark over a character range within block `index`. Shared
  // by the selection toolbar and the ⌘B/⌘I/⌘U keyboard shortcuts.
  function toggleMarkInRange(
    index: number,
    type: ToggleableMark,
    range: { start: number; end: number },
  ) {
    const el = blockRefs.current[index];
    const block = blocks[index];
    if (!el || !block || !("children" in block)) return;
    if (range.start === range.end) return;
    const nodes = domToInlineNodes(el);
    const has = rangeHasMark(nodes, range.start, range.end, type);
    const next = transformMarksInRange(nodes, range.start, range.end, (marks) =>
      has
        ? marks.filter((m) => m.type !== type)
        : [...marks.filter((m) => m.type !== type), { type } as Mark],
    );
    el.innerHTML = inlineNodesToHtml(next, sidenoteBaseList[index]);
    updateBlock(index, { ...block, children: next });
    setSelectionRange(el, range.start, range.end);
  }

  function handleToggleMark(type: ToggleableMark) {
    if (!toolbar) return;
    const { index } = toolbar;
    const el = blockRefs.current[index];
    if (!el) return;
    const off = getSelectionOffsets(el) ?? toolbar.range;
    toggleMarkInRange(index, type, off);
  }

  // ⌘B / ⌘I / ⌘U from within a block: toggle the mark over the live selection.
  function toggleMarkFromKeyboard(index: number, type: ToggleableMark) {
    const el = blockRefs.current[index];
    if (!el) return;
    const off = getSelectionOffsets(el);
    if (!off) return;
    toggleMarkInRange(index, type, off);
  }

  function handleStartLink() {
    if (!toolbar) return;
    const { index } = toolbar;
    const el = blockRefs.current[index];
    if (!el) return;
    const off = getSelectionOffsets(el) ?? toolbar.range;
    if (off.start === off.end) return;
    const linkRange = domRangeForOffsets(el, off.start, off.end);
    const nodes = domToInlineNodes(el);
    const existing = findLinkRangeAt(nodes, off.start);
    setToolbar({
      mode: "link-edit",
      index,
      rect: linkRange ? rectFromRange(linkRange) : toolbar.rect,
      range: off,
      href: existing?.href,
      activeMarks: new Set(),
    });
  }

  function handleApplyLink(href: string) {
    if (!toolbar) return;
    const { index, range } = toolbar;
    const el = blockRefs.current[index];
    const block = blocks[index];
    if (!el || !block || !("children" in block) || range.start === range.end) {
      setToolbar(null);
      return;
    }
    const normalized = normalizeLinkHref(href);
    const nodes = domToInlineNodes(el);
    const next = transformMarksInRange(nodes, range.start, range.end, (marks) => [
      ...marks.filter((m) => m.type !== "link"),
      { type: "link", href: normalized } as Mark,
    ]);
    el.innerHTML = inlineNodesToHtml(next, sidenoteBaseList[index]);
    updateBlock(index, { ...block, children: next });
    // Collapse into the link so the link-view popover surfaces next.
    setSelectionRange(el, range.end, range.end);
  }

  function handleRemoveLink() {
    if (!toolbar) return;
    const { index, range } = toolbar;
    const el = blockRefs.current[index];
    const block = blocks[index];
    if (!el || !block || !("children" in block)) {
      setToolbar(null);
      return;
    }
    const nodes = domToInlineNodes(el);
    const next = transformMarksInRange(nodes, range.start, range.end, (marks) =>
      marks.filter((m) => m.type !== "link"),
    );
    el.innerHTML = inlineNodesToHtml(next, sidenoteBaseList[index]);
    updateBlock(index, { ...block, children: next });
    setSelectionRange(el, range.end, range.end);
    setToolbar(null);
  }

  function handleGotoLink() {
    if (!toolbar?.href) return;
    window.open(toolbar.href, "_blank", "noopener,noreferrer");
  }

  // Toggle a sidenote annotation over the current selection. Adds an empty note
  // (whose text is typed into the aside card) or removes it if the range already
  // carries one. The ordinal is derived at render, so no numbering happens here.
  function handleAddSidenote() {
    if (!toolbar) return;
    const { index, range } = toolbar;
    const el = blockRefs.current[index];
    const block = blocks[index];
    if (!el || !block || !("children" in block) || range.start === range.end) {
      return;
    }
    const nodes = domToInlineNodes(el);
    const has = rangeHasMark(nodes, range.start, range.end, "sidenote");
    const id = has ? null : makeSidenoteId();
    const next = transformMarksInRange(nodes, range.start, range.end, (marks) =>
      has
        ? marks.filter((m) => m.type !== "sidenote")
        : [
            ...marks.filter((m) => m.type !== "sidenote"),
            { type: "sidenote", id: id as string, text: "" } as Mark,
          ],
    );
    el.innerHTML = inlineNodesToHtml(next, sidenoteBaseList[index]);
    updateBlock(index, { ...block, children: next });
    setSelectionRange(el, range.start, range.end);
    // A freshly added note opens straight into its card for editing.
    if (id) {
      setEditingSidenoteId(id);
      setPendingSidenoteFocusId(id);
    }
  }

  // Sidenote popover (Edit): reveal this note's card and focus it. The caret is
  // still on the annotation; suppressing the popover for the edited id (see
  // trackSelection) keeps it from reappearing before the card takes focus.
  function handleEditSidenote() {
    if (!toolbar?.sidenoteId) return;
    setEditingSidenoteId(toolbar.sidenoteId);
    setPendingSidenoteFocusId(toolbar.sidenoteId);
    setToolbar(null);
  }

  // Sidenote popover (Delete): strip the note's mark over its run (removing the
  // annotation, its superscript, and its aside card).
  function handleDeleteSidenote() {
    if (!toolbar?.sidenoteId) return;
    const { index, range, sidenoteId } = toolbar;
    const el = blockRefs.current[index];
    const block = blocks[index];
    if (!el || !block || !("children" in block)) {
      setToolbar(null);
      return;
    }
    const nodes = domToInlineNodes(el);
    const next = transformMarksInRange(nodes, range.start, range.end, (marks) =>
      marks.filter((m) => !(m.type === "sidenote" && m.id === sidenoteId)),
    );
    el.innerHTML = inlineNodesToHtml(next, sidenoteBaseList[index]);
    updateBlock(index, { ...block, children: next });
    if (editingSidenoteId === sidenoteId) setEditingSidenoteId(null);
    setSelectionRange(el, range.end, range.end);
    setToolbar(null);
  }

  // Persist an aside-card edit back into every run of that note: update the AST
  // and keep the prose DOM's data-sidenote-text in sync so a later re-serialise
  // of the block (domToInlineNodes) preserves the note text.
  function handleSidenoteTextChange(entry: SidenoteEntry, text: string) {
    const block = blocks[entry.blockIndex];
    if (!block || !("children" in block)) return;
    const children = block.children.map((node) => {
      const marks = node.marks ?? [];
      if (!marks.some((m) => m.type === "sidenote" && m.id === entry.id)) {
        return node;
      }
      return {
        ...node,
        marks: marks.map((m) =>
          m.type === "sidenote" && m.id === entry.id ? { ...m, text } : m,
        ),
      };
    });
    updateBlock(entry.blockIndex, { ...block, children });
    blockRefs.current[entry.blockIndex]
      ?.querySelectorAll(`[data-sidenote-id="${CSS.escape(entry.id)}"]`)
      .forEach((el) => el.setAttribute("data-sidenote-text", text));
  }

  // Sidenote card (Esc): close the card and return the caret to the annotated
  // text. Moving focus into the prose block blurs the card, which fires its
  // onStopEditing (clearing editingSidenoteId) via onBlurCapture.
  function handleExitSidenoteEdit(entry: SidenoteEntry) {
    const el = blockRefs.current[entry.blockIndex];
    if (!el) {
      setEditingSidenoteId(null);
      return;
    }
    const span = el.querySelector<HTMLElement>(
      `[data-sidenote-id="${CSS.escape(entry.id)}"]`,
    );
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    const target = span ? lastTextNode(span) : null;
    if (target) {
      range.setStart(target, target.length);
    } else {
      range.selectNodeContents(el);
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function handleEditLink() {
    if (!toolbar) return;
    setToolbar({ ...toolbar, mode: "link-edit" });
  }

  function handleToolbarDismiss() {
    // Escape fires no selectionchange, so simply clearing keeps it hidden;
    // an outside pointerdown moves the caret and the tracker recomputes.
    setToolbar(null);
  }

  // Register selection tracking once — the ref always holds the latest closure.
  // No scroll listener: the toolbar's <article>-relative anchor rides the
  // scrolling article and the browser tracks/auto-hides the popover natively
  // (like the slash menu and sidenote cards), so re-measuring on scroll — which
  // lagged a frame behind and made the toolbar flutter — is gone. Resize forces
  // a re-measure since the text column can reflow under a stable selection.
  useEffect(() => {
    function onSelectionChange() {
      trackSelectionRef.current(false);
    }
    function onResize() {
      trackSelectionRef.current(true);
    }
    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // ── Cross-block Delete / Backspace handler (assigned every render via ref) ──
  //
  // Handles Delete / Backspace when the selection spans multiple editing hosts.
  // The once-registered document listener always calls the latest closure
  // (needs current blocks) via crossBlockDeleteRef, synced after commit below.
  function crossBlockDelete(e: KeyboardEvent) {
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

      // A non-text start block (horizontal_rule / image / component) has no
      // editable host — the selection boundary merely landed on it. Preserve it
      // untouched and rebuild only the trailing (after-selection) content.
      // Writing to startEl.innerHTML here would wipe the rendered <hr>/figure,
      // which never re-syncs (its useEffect skips non-text blocks), so the block
      // would visually vanish even though it stays in the model.
      if (!("children" in blocks[startIdx])) {
        tempDiv.appendChild(afterRange.cloneContents());
        const afterNodes = htmlToNodes(tempDiv.innerHTML);
        const hasTail = afterNodes.some((n) => n.text.trim() !== "");
        const endBlock = blocks[endIdx];
        const tail: BlockNode[] = hasTail
          ? [
              "children" in endBlock
                ? ({ ...endBlock, children: afterNodes } as BlockNode)
                : { type: "paragraph", children: afterNodes },
            ]
          : [];
        const newBlocks = [
          ...blocks.slice(0, startIdx + 1),
          ...tail,
          ...blocks.slice(endIdx + 1),
        ];
        updateBlocks(newBlocks);
        cancelHistoryDebounce();
        pushHistoryNow();
        setTimeout(() => {
          const el = blockRefs.current[startIdx + 1];
          if (el) focusBlockAtStart(el);
        }, 0);
        return;
      }

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
      function findCaretPos(node: Node): { node: Node; offset: number } | null {
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
  }

  // Keep the latest closures reachable from the once-registered document
  // listeners without re-subscribing. Synced after commit — writing refs
  // during render is unsafe (react-hooks/refs).
  useEffect(() => {
    trackSelectionRef.current = trackSelection;
    crossBlockDeleteRef.current = crossBlockDelete;
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Resolved marker text + style for every numbered-list item. Honours
  // continue/reset/alpha via the same helper the read-only renderer uses.
  const listNumbering = computeListNumbering(blocks);

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
          // Tab has no navigation role in the editor — swallow it so the caret
          // never jumps from the title into the body.
          if (e.key === "Tab") {
            e.preventDefault();
            return;
          }
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
          sidenoteBase={sidenoteBaseList[i]}
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
          onToggleMark={(type) => toggleMarkFromKeyboard(i, type)}
          onShiftArrowUp={() => shiftArrowUp(i)}
          onShiftArrowDown={() => shiftArrowDown(i)}
          onChangeImage={
            block.type === "image" ? () => handleChangeImage(i) : undefined
          }
          onInsertParagraphBefore={() => insertParagraphBefore(i)}
          onInsertParagraphAfter={
            block.type === "image" ||
            block.type === "component" ||
            block.type === "metric" ||
            block.type === "blockquote"
              ? () => insertParagraphAfter(i)
              : undefined
          }
          onInsertListItemBefore={() => insertListItemBefore(i)}
          onInsertListItemAfter={() => insertListItemAfter(i)}
          listLabel={listNumbering[i]?.label}
          onMarkerClick={(rect) => handleMarkerClick(i, rect)}
          elRef={(el) => {
            blockRefs.current[i] = el;
          }}
        />
      ))}

      {slashAnchor && (
        <SlashMenu
          query={slashQuery}
          allowedTypes={
            slashAnchor.hasExistingContent
              ? [
                  "heading",
                  "paragraph",
                  "blockquote",
                  "list_item",
                  "bullet_list_item",
                  "metric",
                  "code_block",
                ]
              : undefined
          }
          excludeType={
            blocks[slashAnchor.index]?.type as SlashMenuBlockType | undefined
          }
          onSelect={handleSlashSelect}
          onOpenComponentPicker={handleSlashOpenComponentPicker}
          onDismiss={handleSlashDismiss}
        />
      )}

      {toolbar && (
        <SelectionToolbar
          mode={toolbar.mode}
          rect={toolbar.rect}
          activeMarks={toolbar.activeMarks}
          linkHref={toolbar.href}
          onToggleMark={handleToggleMark}
          onStartLink={handleStartLink}
          onApplyLink={handleApplyLink}
          onRemoveLink={handleRemoveLink}
          onGotoLink={handleGotoLink}
          onEditLink={handleEditLink}
          onAddSidenote={handleAddSidenote}
          onEditSidenote={handleEditSidenote}
          onDeleteSidenote={handleDeleteSidenote}
          onDismiss={handleToolbarDismiss}
        />
      )}

      <SidenoteLayer
        entries={collectSidenotes(blocks)}
        trigger="caret"
        editable
        activeId={editingSidenoteId}
        autoFocusId={pendingSidenoteFocusId}
        onAutoFocused={() => setPendingSidenoteFocusId(null)}
        onStopEditing={() => setEditingSidenoteId(null)}
        onExitEdit={handleExitSidenoteEdit}
        onChangeText={handleSidenoteTextChange}
      />

      {numbering && (
        <NumberToolbar
          rect={numbering.rect}
          marker={listNumbering[numbering.index]?.marker ?? "decimal"}
          continueActive={isContinueActive(numbering.index)}
          onContinue={() => {
            toggleContinueNumbering(numbering.index);
            setNumbering(null);
          }}
          onReset={() => {
            resetNumbering(numbering.index);
            setNumbering(null);
          }}
          onSwapStyle={() => {
            swapListStyle(numbering.index);
            setNumbering(null);
          }}
          onDismiss={() => setNumbering(null)}
        />
      )}

      {bullet && (
        <BulletToolbar
          rect={bullet.rect}
          style={bulletStyleOf(bullet.index)}
          onSelect={(style) => {
            setBulletStyle(bullet.index, style);
            setBullet(null);
          }}
          onContinue={() => {
            continueBulleting(bullet.index);
            setBullet(null);
          }}
          onReset={() => {
            resetBulleting(bullet.index);
            setBullet(null);
          }}
          onDismiss={() => setBullet(null)}
        />
      )}

      <ImageInsertDialog
        open={imageDialogOpen}
        mode={imageDialogMode}
        initialPhase={imageDialogMode === "change" ? "library" : "upload"}
        onClose={handleImageDialogClose}
        onInsert={handleImageInsert}
      />

      <ComponentInsertDialog
        open={componentDialogOpen}
        onClose={handleComponentDialogClose}
        onInsert={handleComponentInsert}
      />
    </>
  );
}
