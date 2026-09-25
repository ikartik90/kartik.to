"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { css, cx } from "../../styled-system/css";
import {
  horizontalRule,
  inlineCode,
  articleLink,
  articleUnderline,
  articleStrikethrough,
  articleHighlight,
  articleSidenote,
  articleSidenoteText,
  articleSidenoteRef,
  articleBlockquote,
  articleBlockquoteBody,
  articleBlockquoteCite,
  articleBlockquoteMark,
  articleBlockquoteShell,
  articleHeadingShell,
  articleSubheadingCaption,
  articleListItemShell,
  listMarkerBox,
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
  mediaBlock,
  mediaObjectToolbar,
  toolbar,
  menuIcon,
} from "../../styled-system/recipes";
import { useEditorStore } from "@/store/editor";
import { normalizeLinkHref } from "@/utils/link-href";
import { useMetadataPanelStore } from "@/store/metadata-panel";
import { PostMetadataPanel } from "@/components/post-metadata-panel";
import { EditableButtonLink } from "@/components/editable-button-link";
import {
  autosaveKey,
  clearAutosave,
  readAutosave,
  writeAutosave,
} from "@/utils/editor-autosave";
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
import type { FurnitureSlots } from "@/components/article-renderer";
import {
  ImageInsertDialog,
  type ImageDialogMode,
} from "@/components/image-insert-dialog";
import type { ImageInsertPayload } from "@/hooks/use-image-insert";
import { CollectionGrid } from "@/components/collection-grid";
import { MediaObject } from "@/components/media-object";
import { MediaPropertiesPanel } from "@/components/media-properties-panel";
import { useMediaProperties } from "@/hooks/use-media-properties";
import {
  ComponentInsertDialog,
  type ComponentDialogMode,
} from "@/components/component-insert-dialog";
import { NumberToolbar } from "@/components/number-toolbar";
import { BulletToolbar, type BulletStyle } from "@/components/bullet-toolbar";
import {
  computeListNumbering,
  type ListMarkerStyle,
} from "@/utils/list-numbering";
import { SidenoteLayer } from "@/components/sidenote-layer";
import {
  collectSidenotes,
  makeSidenoteId,
  sidenoteAnchorName,
  sidenoteBases,
  type SidenoteEntry,
} from "@/utils/sidenotes";
import { Button } from "@/components/ui/button";
import { OptionList } from "@/components/ui/input/option-list";
import { typographyStyles } from "@/components/ui/typography";
import ReplaceIcon from "@/assets/icons/replace.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import type { Post, Document, PostCategory } from "@/domain/post";
import type {
  BlockNode,
  CollectionItem,
  InlineNode,
  Mark,
  CodeLanguage,
  MediaNode,
} from "@/domain/nodes";
import { CodeLanguageSchema, COLLECTION_MAX_ITEMS } from "@/domain/nodes";
import {
  appendItems,
  featureItem,
  removeItem,
  swapItems,
  replaceItem,
} from "@/utils/collection-items";
import { CODE_LANGUAGE_LABELS } from "@/utils/syntax-highlight";

const inlineCodeClass = inlineCode();
const linkClass = articleLink();
const underlineClass = articleUnderline();
const strikethroughClass = articleStrikethrough();
const highlightClass = articleHighlight();
const sidenoteClass = articleSidenote();
const sidenoteTextClass = articleSidenoteText();
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
        html = `<a href="${mark.href}"${mark.newTab ? ' target="_blank"' : ""} class="${linkClass}">${html}</a>`;
        break;
    }
  }
  return html;
}

function sidenoteIdOf(node: InlineNode): string | null {
  const mark = (node.marks ?? []).find((m) => m.type === "sidenote");
  return mark?.type === "sidenote" ? mark.id : null;
}

function sidenoteTextOf(node: InlineNode): string {
  const mark = (node.marks ?? []).find((m) => m.type === "sidenote");
  return mark?.type === "sidenote" ? mark.text : "";
}

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

/** `base` offsets note ordinals, written as `data-sidenote-number` since Chromium won't re-resolve a CSS counter on removal. */
export function inlineNodesToHtml(nodes: InlineNode[], base = 0): string {
  let out = "";
  let i = 0;
  let noteIndex = 0;
  const numberById = new Map<string, number>();
  while (i < nodes.length) {
    const id = sidenoteIdOf(nodes[i]);
    if (id !== null) {
      // One span per note (id, text, anchor); the <sup> sits outside the underline span, on the last word's line.
      const start = i;
      while (i < nodes.length && sidenoteIdOf(nodes[i]) === id) i++;
      const group = nodes.slice(start, i);
      if (!numberById.has(id)) numberById.set(id, base + ++noteIndex);
      out +=
        `<span class="${sidenoteClass}" data-sidenote-id="${escapeAttr(id)}"` +
        ` data-sidenote-text="${escapeAttr(sidenoteTextOf(group[0]))}"` +
        ` style="anchor-name:${sidenoteAnchorName(id)}">` +
        `<span class="${sidenoteTextClass}">${inlineRunToHtml(group)}</span>` +
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
        // The raw attribute, not `.href`, which resolves against the page URL.
        const href = el.getAttribute("href");
        if (href)
          nextMarks.push(
            el.getAttribute("target") === "_blank"
              ? { type: "link", href, newTab: true }
              : { type: "link", href },
          );
      } else if (el.tagName === "SPAN" && el.hasAttribute("data-sidenote-id")) {
        nextMarks.push({
          type: "sidenote",
          id: el.getAttribute("data-sidenote-id") ?? "",
          text: el.getAttribute("data-sidenote-text") ?? "",
        });
      }
      // The ordinal <sup> is decorative; its digit must not leak into the AST.
      else if (el.tagName === "SUP") return;
      else if (el.tagName === "BR") return;

      el.childNodes.forEach((child) => walk(child, nextMarks));
    }
  }

  el.childNodes.forEach((child) => walk(child, []));
  return nodes;
}

/** Removes sidenote wrappers left empty; they hold no characters, so pre-strip caret offsets stay valid. */
export function stripEmptySidenoteWrappers(el: HTMLElement): boolean {
  const orphans = Array.from(
    el.querySelectorAll<HTMLElement>("[data-sidenote-id]"),
  ).filter((w) => (w.textContent ?? "") === "");
  orphans.forEach((w) => w.remove());
  return orphans.length > 0;
}

/** Renumbers a focused block's sups in place, since its content sync is skipped to protect the caret. */
export function renumberSidenoteSups(el: HTMLElement, base = 0): void {
  const numberById = new Map<string, number>();
  let n = base;
  el.querySelectorAll<HTMLElement>("[data-sidenote-id]").forEach((wrapper) => {
    const id = wrapper.getAttribute("data-sidenote-id");
    if (!id) return;
    if (!numberById.has(id)) numberById.set(id, ++n);
    const sup = wrapper.querySelector<HTMLElement>(".article-sidenote-ref");
    if (sup)
      sup.setAttribute("data-sidenote-number", String(numberById.get(id)));
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function firstTextNode(root: Node): Text | null {
  if (root.nodeType === Node.TEXT_NODE) return root as Text;
  for (let i = 0; i < root.childNodes.length; i++) {
    const found = firstTextNode(root.childNodes[i]);
    if (found) return found;
  }
  return null;
}

function getTextBeforeCursor(el: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  const range = sel.getRangeAt(0).cloneRange();
  range.setStart(el, 0);
  return range.toString();
}

function lastTextNode(root: Node): Text | null {
  if (root.nodeType === Node.TEXT_NODE) return root as Text;
  for (let i = root.childNodes.length - 1; i >= 0; i--) {
    const found = lastTextNode(root.childNodes[i]);
    if (found) return found;
  }
  return null;
}

/** Splits `el`'s HTML at the selection; selected text is dropped, as Delete would. */
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

/** Keeps only semantic inline marks; strips attributes and wrappers, and collapses blocks to <br>. */
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
      case "a":
        return inner;
      default:
        return inner;
    }
  }

  const result = Array.from(doc.body.childNodes).map(walk).join("");
  return result.replace(/<br>$/, "");
}

/** Content-box top: line detection must use this, or padded blocks trap the caret on ArrowUp/Down. */
function contentBoxTop(el: HTMLElement): number {
  const paddingTop = parseFloat(getComputedStyle(el).paddingTop) || 0;
  return el.getBoundingClientRect().top + paddingTop;
}

function contentBoxBottom(el: HTMLElement): number {
  const paddingBottom = parseFloat(getComputedStyle(el).paddingBottom) || 0;
  return el.getBoundingClientRect().bottom - paddingBottom;
}

function isCaretAtFirstLine(el: HTMLElement): boolean {
  if (!el.textContent) return true;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const caretRect = sel.getRangeAt(0).getBoundingClientRect();
  if (!caretRect.height) return true; // degenerate rect (empty block)
  return caretRect.top < contentBoxTop(el) + caretRect.height;
}

function isCaretAtLastLine(el: HTMLElement): boolean {
  if (!el.textContent) return true;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const caretRect = sel.getRangeAt(0).getBoundingClientRect();
  // A zero-height rect is an element boundary, not the last line; leave it to the browser.
  if (!caretRect.height) return false;
  return caretRect.bottom > contentBoxBottom(el) - caretRect.height;
}

/** Checks the selection's focus, not its range: a multi-block range's rect spans every block. */
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

/** Collapsed caret at the very start; false with a selection, so the browser deletes it. */
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

/** Order-independent equality of two mark arrays. */
function marksEqual(a: Mark[] | undefined, b: Mark[] | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  const key = (m: Mark) => JSON.stringify(m);
  const sa = aa.map(key).sort();
  const sb = bb.map(key).sort();
  return sa.every((v, i) => v === sb[i]);
}

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

/** Every character in [start, end) carries a mark of `type`; false for an empty range. */
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

/** Applies `transform` to the marks in [start, end), splitting nodes at the bounds. */
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

/** The link run around `offset` (endpoints count as inside), or null. */
export function findLinkRangeAt(
  nodes: InlineNode[],
  offset: number,
): { start: number; end: number; href: string; newTab: boolean } | null {
  const spans = nodes.map((node) => {
    const link = (node.marks ?? []).find((m) => m.type === "link");
    return {
      len: node.text.length,
      href: link?.type === "link" ? link.href : null,
      newTab: link?.type === "link" && link.newTab === true,
    };
  });
  let pos = 0;
  const bounds = spans.map((s) => {
    const start = pos;
    pos += s.len;
    return { start, end: pos, href: s.href, newTab: s.newTab };
  });

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
  for (
    let i = hitIndex + 1;
    i < bounds.length && bounds[i].href === href;
    i++
  ) {
    end = bounds[i].end;
  }
  return { start, end, href, newTab: bounds[hitIndex].newTab };
}

/** The sidenote run around `offset`, as `findLinkRangeAt`. */
export function findSidenoteRangeAt(
  nodes: InlineNode[],
  offset: number,
): { start: number; end: number; id: string } | null {
  const spans = nodes.map((node) => {
    const mark = (node.marks ?? []).find((m) => m.type === "sidenote");
    return {
      len: node.text.length,
      id: mark?.type === "sidenote" ? mark.id : null,
    };
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

/** A library payload as a media node; an empty `alt` is dropped, not stored. */
function mediaNodeFrom(payload: ImageInsertPayload): MediaNode {
  return {
    type: "media",
    kind: payload.kind,
    src: payload.src,
    ...(payload.alt ? { alt: payload.alt } : {}),
    ...(payload.width && payload.height
      ? { width: payload.width, height: payload.height }
      : {}),
  };
}

function isBlockEmpty(block: BlockNode): boolean {
  if (block.type === "horizontal_rule") return false;
  if (block.type === "media") return false;
  if (block.type === "collection") return false;
  if (block.type === "component") return false;
  if (block.type === "project_grid") return false;
  if (block.type === "social_links") return false;
  if (block.type === "code_block") {
    return block.children.every((c) => !c.text.trim());
  }
  return "children" in block && block.children.every((c) => !c.text.trim());
}

// Empty blocks keep a line box so they stay clickable; caret room is reserved only on focus.
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
  color: "text.body",
  backgroundColor: "bg.surface",
  "--colors-field-bg-default": "var(--colors-field-bg-default-on-surface)",
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

const CODE_LANGUAGE_OPTIONS: Array<{
  value: CodeLanguage | "";
  label: string;
}> = [
  { value: "", label: "Plain text" },
  ...CodeLanguageSchema.options.map((language) => ({
    value: language,
    label: CODE_LANGUAGE_LABELS[language],
  })),
];

const editorHrStyle = cx(horizontalRule(), css({ marginBlock: "0" }));

const editorShowcaseStyle = articleShowcase();

const editorHrShellStyle = css({
  position: "relative",
  width: "token(spacing.full)",
  paddingBlock: "3xl",
});

const editorShowcaseMediaStyle = css({
  alignSelf: "stretch",
  width: "token(spacing.full)",
  focusVisibleRing: "none",
  cursor: "default",
});

const editorDemoPreviewStyle = css({
  width: "token(spacing.full)",
  height: "token(spacing.full)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  userSelect: "none",
});

const mediaBlockStyles = mediaBlock();

// Lives in `mediaBlockStyles.root`, which doesn't clip, so the rail can hang above the frame.
const editorObjectToolbarStyle = cx(toolbar(), mediaObjectToolbar());

const editorImgStyle = cx(mediaBlockStyles.image, editorShowcaseMediaStyle);

const editorImagePlaceholderStyle = cx(
  editorShowcaseMediaStyle,
  css({
    width: "token(spacing.full)",
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
    width: "token(spacing.full)",
    minHeight: "1.5em",
    "&:empty::before, &[data-empty]::before": {
      content: "attr(data-placeholder)",
      color: "text.default/40",
      pointerEvents: "none",
    },
  }),
);

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

const editorMetricValueStyle = cx(
  editableBaseStyle,
  articleMetricValue(),
  css({
    minHeight: "1.5em",
    // Reserve a caret's width, or an empty fit-content value collapses to 0.
    minWidth: "token(spacing.xxs)",
  }),
);

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

const editorFurnitureWrapperStyle = css({
  position: "relative",
  outline: "none",
  borderRadius: "lg",
  _focusVisible: {
    outlineWidth: "token(spacing.xs)",
    outlineStyle: "solid",
    outlineColor: "field.border.active",
    outlineOffset: "token(spacing.sm)",
  },
});

const editorHrWrapperStyle = css({
  focusVisibleRing: "none",
  cursor: "default",
});

const editorListItemContentStyle = cx(
  editableBaseStyle,
  articleListItemContent(),
);
// Markers are buttons here; re-enable the pointer events the read-only recipes disable.
const bulletButtonReset = css({
  appearance: "none",
  border: "none",
  background: "transparent",
  padding: 0,
  pointerEvents: "auto",
  cursor: "pointer",
});
const editorListMarkerButtonStyle = cx(listMarkerBox(), bulletButtonReset);
const editorListMarkerPillStyle = listMarker();
const editorListBulletButtonStyle = cx(listBullet(), bulletButtonReset);
const editorListBulletIconButtonStyle = cx(listBulletIcon(), bulletButtonReset);
// Resolved statically: Panda only extracts literal call sites.
const editorBulletCircleClass = {
  check: listBulletCircle({ glyph: "check" }),
  cross: listBulletCircle({ glyph: "cross" }),
} as const;
const editorListItemShellStyle = articleListItemShell();

type ListItemType = "list_item" | "bullet_list_item";
function isListItemType(type: BlockNode["type"]): type is ListItemType {
  return type === "list_item" || type === "bullet_list_item";
}

interface EditableBlockProps {
  block: BlockNode;
  slots?: FurnitureSlots;
  blockIndex: number;
  /** Distinct sidenotes before this block, offsetting its note ordinals. */
  sidenoteBase: number;
  isFirst: boolean;
  isOnly: boolean;
  onChange: (block: BlockNode) => void;
  /** Receives the HTML before and after the caret, to split the block. */
  onEnter: (beforeHtml: string, afterHtml: string) => void;
  onDelete: () => void;
  onSlash: (el: HTMLElement) => void;
  onSlashInput?: (text: string) => void;
  isSlashActive?: boolean;
  /** Called when ArrowUp is pressed on the first visual line. */
  onArrowUp?: () => void;
  /** Called when ArrowDown is pressed on the last visual line. */
  onArrowDown?: () => void;
  /** Called when ArrowLeft is pressed at the very start of the block. */
  onArrowLeft?: () => void;
  /** Called when ArrowRight is pressed at the very end of the block. */
  onArrowRight?: () => void;
  /** For a paste with hard returns: the current block's new HTML, and the blocks to insert after it. */
  onPasteBlocks?: (firstBlockHtml: string, newBlocksHtml: string[]) => void;
  /** Backspace at the start of a non-empty block — merge into the previous block. */
  onMergeWithPrev?: (currentHtml: string) => void;
  /** Delete at the end of a non-empty block — absorb the next block. */
  onMergeWithNext?: (currentHtml: string) => void;
  /** After a downgrade to paragraph, so the parent can refocus the new element. */
  onConvertedToParagraph?: () => void;
  /** Toggle an inline mark over the current selection (⌘B / ⌘I / ⌘U). */
  onToggleMark?: (type: ToggleableMark) => void;
  /** Shift+ArrowUp when the selection focus is on the first visual line. */
  onShiftArrowUp?: () => void;
  /** Shift+ArrowDown when the selection focus is on the last visual line. */
  onShiftArrowDown?: () => void;
  onChangeImage?: () => void;
  onCollectionAdd?: () => void;
  onCollectionReplace?: (itemIndex: number) => void;
  /** Move a collection item to the front, making it the featured image. */
  onCollectionFeature?: (itemIndex: number) => void;
  onCollectionRemove?: (itemIndex: number) => void;
  /** Swaps two collection slots. */
  onCollectionReorder?: (from: number, to: number) => void;
  onChangeComponent?: () => void;
  onInsertParagraphBefore?: () => void;
  /** Insert an empty paragraph after this block, or focus the trailing one. */
  onInsertParagraphAfter?: () => void;
  onInsertListItemBefore?: () => void;
  onInsertListItemAfter?: () => void;
  /** Precomputed marker text for this numbered-list item (zero-padded or a→z). */
  listLabel?: string;
  onMarkerClick?: (rect: DOMRect) => void;
  elRef: (el: HTMLElement | null) => void;
}

function EditableBlock({
  block,
  slots,
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
  onCollectionAdd,
  onCollectionReplace,
  onCollectionFeature,
  onCollectionRemove,
  onCollectionReorder,
  onChangeComponent,
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

  const contentRef = useRef<HTMLElement | null>(null);
  const captionRef = useRef<HTMLElement | null>(null);
  const subtextRef = useRef<HTMLElement | null>(null);
  const showcaseMediaRef = useRef<HTMLElement | null>(null);

  // elRef is mirrored into a ref after commit, so combinedRef stays identity-stable.
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

  const [isFocused, setIsFocused] = useState(false);

  // A media block is a collection of one. A hook, so it runs for every block type; the rest pass [].
  const mediaItems = useMemo(
    () => (block.type === "media" ? [block] : []),
    [block],
  );
  const mediaProperties = useMediaProperties(mediaItems, ([next]) => {
    // Debounced via onChange: a slider emits a value per frame.
    if (next) onChange(next);
  });

  const handleNonTextKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      // Only keys aimed at the block itself: a furniture slot's own fields must not delete the block.
      if (e.target !== e.currentTarget) return;

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
          e.preventDefault();
          break;
        case "Backspace":
        case "Delete":
          e.preventDefault();
          onDelete();
          break;
      }
    },
    [
      onArrowUp,
      onArrowDown,
      onArrowLeft,
      onArrowRight,
      onDelete,
      onInsertParagraphBefore,
    ],
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
      // Only when the figure itself has focus: a collection's cell toolbars bubble Enter/Backspace here.
      if (e.target !== e.currentTarget) return;
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

  // Syncs external content changes; skipped while focused (it would reset the caret) and for non-editable blocks.
  useEffect(() => {
    if (
      block.type === "horizontal_rule" ||
      block.type === "media" ||
      block.type === "collection" ||
      block.type === "component" ||
      block.type === "button_link" ||
      block.type === "project_grid" ||
      block.type === "social_links"
    )
      return;
    const el = contentRef.current;
    if (!el || document.activeElement === el) return;
    const html =
      block.type === "code_block"
        ? block.children.map((c) => c.text).join("")
        : "children" in block
          ? inlineNodesToHtml(block.children as InlineNode[], sidenoteBase)
          : "";
    el.innerHTML = html;
    // `sidenoteBase`: a note added or removed in an earlier block renumbers this one.
  }, [block, sidenoteBase]);

  useEffect(() => {
    if (
      block.type !== "media" &&
      block.type !== "collection" &&
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

  useEffect(() => {
    if (block.type !== "metric") return;
    const el = subtextRef.current;
    if (!el || document.activeElement === el) return;
    el.innerText = block.subtext ?? "";
  }, [block]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      // The cross-block delete handler already prevented this; the merge checks below would misfire.
      if (e.nativeEvent.defaultPrevented) return;

      // The slash menu's capture listener handles these; just stop the caret moving.
      if (isSlashActive) {
        if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          return;
        }
      }

      // Tab only toggles indentation and never moves the caret.
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

      if (e.key === "ArrowUp" && e.shiftKey) {
        const _sel = window.getSelection();
        const _focusInBlock = e.currentTarget.contains(_sel?.focusNode ?? null);
        const _atFirst = _focusInBlock
          ? isFocusAtFirstLine(e.currentTarget)
          : false;
        if (!_focusInBlock && _sel?.focusNode) {
          // Focus is in another block: find the position one line up with caretRangeFromPoint.
          e.preventDefault();
          const _r = document.createRange();
          _r.setStart(_sel.focusNode, _sel.focusOffset);
          _r.collapse(true);
          const _rect = _r.getBoundingClientRect();
          // A full line up: 1px stays in the same line's hit area.
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

      if (e.key === "Enter" && !e.shiftKey && isListItemType(block.type)) {
        e.preventDefault();
        if (isBlockEmpty(block)) {
          onChange({
            type: "paragraph",
            children: [{ type: "text", text: "" }],
          });
          onConvertedToParagraph?.();
          return;
        }
        if (isCaretAtStart(e.currentTarget) && onInsertListItemBefore) {
          // The index-based key reuses this element as the new empty item; clear it, since the focus guard skips the sync.
          e.currentTarget.innerHTML = "";
          onInsertListItemBefore();
          return;
        }
        if (isCaretAtEnd(e.currentTarget) && onInsertListItemAfter) {
          onInsertListItemAfter();
          return;
        }
        const { before, after } = getCaretSplitHtml(e.currentTarget);
        e.currentTarget.innerHTML = before;
        onEnter(before, after);
        return;
      }

      if (e.key === "Enter" && !e.shiftKey && block.type !== "code_block") {
        e.preventDefault();
        if (isCaretAtStart(e.currentTarget) && onInsertParagraphBefore) {
          // The index-based key reuses this element as the new empty block; clear its stale text now.
          e.currentTarget.innerHTML = "";
          onInsertParagraphBefore();
          return;
        }
        const { before, after } = getCaretSplitHtml(e.currentTarget);
        // Trim the DOM now, since the focus-guarded sync won't.
        e.currentTarget.innerHTML = before;
        onEnter(before, after);
        return;
      }

      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        isBlockEmpty(block)
      ) {
        e.preventDefault();
        onDelete();
        return;
      }

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

      if (
        e.key === "Backspace" &&
        onMergeWithPrev &&
        isCaretAtStart(e.currentTarget)
      ) {
        e.preventDefault();
        onMergeWithPrev(e.currentTarget.innerHTML);
        return;
      }

      if (
        e.key === "Delete" &&
        onMergeWithNext &&
        isCaretAtEnd(e.currentTarget)
      ) {
        e.preventDefault();
        onMergeWithNext(e.currentTarget.innerHTML);
        return;
      }

      // Through the AST toggle, not execCommand, so a second press reliably removes the mark.
      if (
        e.metaKey &&
        !e.shiftKey &&
        (e.key === "b" || e.key === "i" || e.key === "u")
      ) {
        e.preventDefault();
        if (onToggleMark && block.type !== "code_block") {
          const markForKey = {
            b: "bold",
            i: "italic",
            u: "underline",
          } as const;
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

  const handleInput = useCallback(
    (e: React.InputEvent<HTMLElement>) => {
      const el = e.currentTarget;

      if (block.type !== "code_block") {
        const text = el.innerText ?? "";
        const match = text.match(/`([^`]+)`/);
        if (match) {
          const nodes = domToInlineNodes(el);
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
            el.innerHTML = inlineNodesToHtml(replaced, sidenoteBase);
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
        // Deleting an annotation's text orphans its wrapper; stripping it leaves the offsets unchanged.
        const off = getSelectionOffsets(el);
        if (stripEmptySidenoteWrappers(el) && off) {
          setSelectionRange(el, off.start, off.end);
        }
        // Focused, so the content sync won't renumber it; refresh its superscripts here.
        renumberSidenoteSups(el, sidenoteBase);
        onChange({
          ...(block as Extract<BlockNode, { children: InlineNode[] }>),
          children: nodes,
        } as BlockNode);
      }

      onSlashInput?.(el.innerText ?? "");
    },
    [block, sidenoteBase, onChange, onSlashInput],
  );

  const handleCaptionInput = useCallback(
    (e: React.FormEvent<HTMLElement>) => {
      if (
        block.type !== "media" &&
        block.type !== "collection" &&
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

  const handleHeadingCaptionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.stopPropagation();
        return;
      }
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
      if (
        e.key === "ArrowUp" &&
        !e.shiftKey &&
        isCaretAtStart(e.currentTarget)
      ) {
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

      if (block.type === "code_block") {
        const text = e.clipboardData.getData("text/plain");
        if (text) document.execCommand("insertText", false, text);
        return;
      }

      const htmlData = e.clipboardData.getData("text/html");
      const textData = e.clipboardData.getData("text/plain") ?? "";

      const lines: string[] = htmlData
        ? sanitiseClipboardHtml(htmlData).split("<br>").filter(Boolean)
        : textData.split("\n").filter(Boolean).map(escapeHtml);

      if (lines.length === 0) return;

      if (lines.length === 1 || !onPasteBlocks) {
        document.execCommand(
          htmlData ? "insertHTML" : "insertText",
          false,
          lines[0],
        );
        return;
      }

      const el = contentRef.current;
      if (!el) return;

      const { before, after } = getCaretSplitHtml(el);

      const firstBlockHtml = before + lines[0];
      const newBlocksHtml = [
        ...lines.slice(1, -1),
        lines[lines.length - 1] + after,
      ];

      // Written directly: the content sync skips a focused block.
      el.innerHTML = firstBlockHtml;

      onPasteBlocks(firstBlockHtml, newBlocksHtml);
    },
    [block.type, onPasteBlocks],
  );

  // On keyup, so the "/" is already in the DOM.
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
        if (getTextBeforeCursor(e.currentTarget) === "/") {
          onSlash(e.currentTarget);
        }
      }
    },
    [block, onSlash],
  );

  if (block.type === "button_link") {
    return (
      <EditableButtonLink
        block={block}
        blockIndex={blockIndex}
        onChange={onChange}
        onDelete={onDelete}
        onArrowUp={() => onArrowUp?.()}
        onArrowDown={() => onArrowDown?.()}
        onArrowLeft={() => onArrowLeft?.()}
        onArrowRight={() => onArrowRight?.()}
        onInsertParagraphAfter={() => onInsertParagraphAfter?.()}
        elRef={combinedRef}
      />
    );
  }

  if (block.type === "project_grid" || block.type === "social_links") {
    return (
      <div
        tabIndex={0}
        ref={combinedRef as React.RefCallback<HTMLDivElement>}
        className={editorFurnitureWrapperStyle}
        data-block-index={blockIndex}
        data-furniture={block.type}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleNonTextKeyDown}
      >
        {slots?.[block.type] ?? null}
      </div>
    );
  }

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

  if (block.type === "code_block") {
    return (
      <div className={cx(editorCodeBlockWrapperStyle, "code-block-wrapper")}>
        <label
          className={css({ srOnly: true })}
          htmlFor={`code-language-${blockIndex}`}
        >
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
                value === "" ? undefined : CodeLanguageSchema.parse(value),
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

  if (block.type === "media") {
    // `showcaseMediaCallbackRef` must stay a stable callback, or a clip remounts and loses its playhead.
    const showcaseMediaContract = {
      tabIndex: 0 as const,
      "data-showcase-media": "",
      onKeyDown: handleShowcaseMediaKeyDown,
    };

    return (
      <figure
        ref={combinedRef as React.RefCallback<HTMLElement>}
        className={editorShowcaseStyle}
        data-block-index={blockIndex}
        data-showcase-block=""
      >
        <MediaObject
          item={block}
          classes={{
            root: mediaBlockStyles.root,
            frame: mediaBlockStyles.frame,
            image: editorImgStyle,
            backgroundEffect: mediaBlockStyles.backgroundEffect,
          }}
          label="Image"
          propertiesOpen={mediaProperties.isOpen(0)}
          onToggleProperties={() => mediaProperties.toggle(0)}
          onReplace={() => onChangeImage?.()}
          onRemove={() => onDelete?.()}
          removeLabel="Delete image"
          mediaProps={{
            autoPlay: false,
            // The media element is the block's tab stop; `focusBlockAtStart` finds it via `[data-showcase-media]`.
            elementRef: showcaseMediaCallbackRef,
            ...showcaseMediaContract,
          }}
          placeholder={
            <span
              aria-label="Image placeholder"
              className={editorImagePlaceholderStyle}
              ref={showcaseMediaCallbackRef}
              {...showcaseMediaContract}
            >
              📷
            </span>
          }
        />
        {mediaProperties.panel && (
          // Outside the figure, whose showcase-media key handler would otherwise take the panel's keystrokes.
          <MediaPropertiesPanel
            key={mediaProperties.panel.key}
            {...mediaProperties.panel.props}
          />
        )}
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

  // The grid root takes the showcase-media contract, so a collection navigates like a single image.
  if (block.type === "collection") {
    const showcaseMediaProps = {
      tabIndex: 0 as const,
      "data-showcase-media": "",
      ref: showcaseMediaCallbackRef as React.Ref<HTMLDivElement>,
      onKeyDown: handleShowcaseMediaKeyDown,
    };

    return (
      <figure
        ref={combinedRef as React.RefCallback<HTMLElement>}
        className={editorShowcaseStyle}
        data-block-index={blockIndex}
        data-showcase-block=""
      >
        <CollectionGrid
          items={block.items}
          rootProps={showcaseMediaProps}
          onFeature={(i) => onCollectionFeature?.(i)}
          onReplace={(i) => onCollectionReplace?.(i)}
          onRemove={(i) => onCollectionRemove?.(i)}
          onReorder={(from, to) => onCollectionReorder?.(from, to)}
          onAddImage={() => onCollectionAdd?.()}
          onItemsChange={(items) => onChange({ ...block, items })}
        />
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

  if (block.type === "component") {
    const demo = getDemoComponent(block.componentId);
    const showcaseMediaProps = {
      tabIndex: 0 as const,
      "data-showcase-media": "",
      ref: showcaseMediaCallbackRef,
      onKeyDown: handleShowcaseMediaKeyDown,
    };

    return (
      <figure
        ref={combinedRef as React.RefCallback<HTMLElement>}
        className={editorShowcaseStyle}
        data-block-index={blockIndex}
        data-showcase-block=""
      >
        <div className={mediaBlockStyles.root}>
          <DemoFrame
            aspectRatio={demo?.aspectRatio}
            logger={demo?.logger}
            fill={demo?.fill}
            interactive={false}
            className={editorShowcaseMediaStyle}
            // The hook the rail reveals itself off, shared with a picture's frame.
            data-media-cell=""
            {...showcaseMediaProps}
          >
            <div inert className={editorDemoPreviewStyle}>
              {demo ? (
                <DemoComponent entry={demo} aspect={demo.aspectRatio} />
              ) : (
                <span>Unknown component: {block.componentId}</span>
              )}
            </div>
          </DemoFrame>
          <div className={editorObjectToolbarStyle}>
            <OptionList direction="inline">
              <OptionList.Toolbar aria-label="Component actions">
                <OptionList.Option
                  aria-label="Replace component"
                  onClick={() => onChangeComponent?.()}
                >
                  <ReplaceIcon aria-hidden />
                </OptionList.Option>
                <OptionList.Option
                  aria-label="Delete component"
                  onClick={onDelete}
                >
                  <TrashIcon aria-hidden />
                </OptionList.Option>
              </OptionList.Toolbar>
            </OptionList>
          </div>
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

  if (isListItemType(block.type)) {
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
            <span className={editorListMarkerPillStyle}>{markerLabel}</span>
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
              <span className={editorBulletCircleClass[block.marker]} />
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

  const align = (block as { align?: "center" }).align;

  return (
    <p
      ref={combinedRef as React.RefCallback<HTMLParagraphElement>}
      className={cx(
        editableBaseStyle,
        // `wrap` must come through the recipe: a base-layer `data-align` rule loses to the atomic `text-wrap`.
        typographyStyles({
          type: "bodyLarge",
          wrap: align === "center" ? "balance" : undefined,
        }),
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
      data-indented={(block as { indent?: boolean }).indent ? "" : undefined}
      data-align={align}
      {...slashAnchorProps}
    />
  );
}

/** Adds a trailing paragraph after blocks with nowhere below to type: caret-less blocks, lists, code, buttons. */
function withTrailingParagraph(blocks: BlockNode[]): BlockNode[] {
  if (blocks.length === 0) {
    return [{ type: "paragraph", children: [{ type: "text", text: "" }] }];
  }
  const last = blocks[blocks.length - 1];
  if (
    last.type === "horizontal_rule" ||
    last.type === "media" ||
    last.type === "collection" ||
    last.type === "component" ||
    last.type === "code_block" ||
    last.type === "button_link" ||
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

/** The indent and centring a paragraph made off `source` keeps; only the fields that are set. */
function inheritedLayout(
  source: BlockNode | undefined,
): { indent?: true; align?: "center" } {
  const { indent, align } = (source ?? {}) as {
    indent?: boolean;
    align?: "center";
  };
  return {
    ...(indent ? { indent: true } : {}),
    ...(align === "center" ? { align } : {}),
  };
}

/** True when the figure is second-to-last and followed by a synthetic trailing paragraph. */
function hasSyntheticTrailingParagraph(
  blocks: BlockNode[],
  index: number,
): boolean {
  const block = blocks[index];
  if (
    block.type !== "media" &&
    block.type !== "collection" &&
    block.type !== "component" &&
    block.type !== "button_link"
  )
    return false;
  if (index !== blocks.length - 2) return false;
  return isBlockEmpty(blocks[index + 1]);
}

/** What the slash menu offers on a page with no slots: everything but furniture. */
const NON_FURNITURE_TYPES: SlashMenuBlockType[] = [
  "heading",
  "paragraph",
  "media",
  "collection",
  "component",
  "blockquote",
  "list_item",
  "bullet_list_item",
  "metric",
  "button_link",
  "code_block",
  "horizontal_rule",
];

interface ArticleEditorProps {
  initialPost?: Post;
  category?: PostCategory;
  slots?: FurnitureSlots;
  /** False for the homepage, which has no title. */
  showTitle?: boolean;
}

interface ToolbarRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ToolbarState {
  mode: SelectionToolbarMode;
  index: number;
  rect: ToolbarRect;
  range: { start: number; end: number };
  href?: string;
  newTab?: boolean;
  sidenoteId?: string;
  /** Marks the whole selection carries. */
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

export function ArticleEditor({
  initialPost,
  category,
  slots,
  showTitle = true,
}: ArticleEditorProps) {
  const {
    title,
    setTitle,
    document: doc,
    setDocument,
    pushHistory,
  } = useEditorStore();
  const metadataOpen = useMetadataPanelStore((state) => state.open);

  useEffect(() => {
    const sessionCategory = category ?? initialPost?.category ?? "ARTICLE";
    // A local autosave wins over the DB copy: it holds edits made since the last save.
    const restored = readAutosave(
      autosaveKey(initialPost?.id ?? null, sessionCategory),
    );

    const savedAddress = initialPost
      ? { category: initialPost.category, slug: initialPost.slug }
      : null;

    if (restored) {
      useEditorStore.setState({
        title: restored.title,
        draftId: restored.draftId,
        category: restored.category,
        slug:
          restored.slug !== undefined
            ? restored.slug
            : (initialPost?.slug ?? null),
        description:
          restored.description !== undefined
            ? restored.description
            : (initialPost?.description ?? null),
        savedAddress,
        isPublished: initialPost?.publishedAt != null,
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
        slug: initialPost.slug,
        description: initialPost.description ?? null,
        savedAddress,
        isPublished: initialPost.publishedAt !== null,
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
    return () => {
      useEditorStore.getState().reset();
      useMetadataPanelStore.getState().setOpen(false);
    };
    // Keyed on the id: re-seeding on every new prop reference would wipe in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPost?.id, category]);

  // Debounced autosave of dirty state; saving, publishing or discarding clears it (use-command-palette.ts).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    // The key names the category, which can change, so a snapshot is moved, not copied.
    let lastKey: string | null = null;
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (!state.isDirty) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // Re-read at fire time: a save in between must not resurrect the autosave.
        const s = useEditorStore.getState();
        if (!s.isDirty) return;
        const key = autosaveKey(s.draftId, s.category);
        if (lastKey && lastKey !== key) clearAutosave(lastKey);
        lastKey = key;
        writeAutosave(key, {
          title: s.title,
          draftId: s.draftId,
          category: s.category,
          slug: s.slug,
          description: s.description,
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

  // ⌘S belongs to the command palette; handling it here too would save twice.
  const blocks = ensureBlocks(doc);
  const sidenoteBaseList = sidenoteBases(blocks);
  const blockRefs = useRef<(HTMLElement | null)[]>([]);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // The editing host where a drag started: -1 title, 0+ block, null none.
  const dragAnchorIdx = useRef<number | null>(null);
  const crossBlockDeleteRef = useRef<(e: KeyboardEvent) => void>(() => {});
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushHistoryNow() {
    const s = useEditorStore.getState();
    pushHistory({ title: s.title, document: s.document });
  }

  function pushHistoryDebounced() {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(pushHistoryNow, 500);
  }

  /** Call before a structural operation. */
  function cancelHistoryDebounce() {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
  }

  // Chrome clips a drag selection at each contentEditable host, so extend it across hosts by hand.
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

  // ⌘A selects from the title to the last block.
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
      // findLast skips null entries left by deleted blocks.
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      crossBlockDeleteRef.current(e);
    }
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  // Undo/redo blur first, so the blocks' focus-guarded sync applies the snapshot, then refocus by index.
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

      // A pending debounce would overwrite the restored snapshot.
      cancelHistoryDebounce();

      focused?.blur();

      if (isRedo) {
        store.redo();
      } else {
        store.undo();
      }

      const targetIdx = inTitle ? -1 : focusedBlockIdx;
      setTimeout(() => {
        if (targetIdx === -1) {
          titleRef.current?.focus();
          return;
        }
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

  // Skipped while the title has focus, so typing never loses the caret.
  useEffect(() => {
    if (titleRef.current && document.activeElement !== titleRef.current) {
      titleRef.current.innerHTML = title;
    }
  }, [title]);

  const [slashAnchor, setSlashAnchor] = useState<{
    el: HTMLElement;
    index: number;
    /** The block had text beyond the "/", so its content isn't the query. */
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
  const [componentDialogMode, setComponentDialogMode] =
    useState<ComponentDialogMode>("insert");
  const [componentDialogBlockIndex, setComponentDialogBlockIndex] = useState<
    number | null
  >(null);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [collectionDialogBlockIndex, setCollectionDialogBlockIndex] = useState<
    number | null
  >(null);
  // null adds to the end; a number replaces that slot.
  const [collectionDialogTarget, setCollectionDialogTarget] = useState<
    number | null
  >(null);

  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [pendingSidenoteFocusId, setPendingSidenoteFocusId] = useState<
    string | null
  >(null);
  // The card opens only on Edit; the caret merely surfaces the popover.
  const [editingSidenoteId, setEditingSidenoteId] = useState<string | null>(
    null,
  );
  const [numbering, setNumbering] = useState<{
    index: number;
    rect: ToolbarRect;
  } | null>(null);
  const [bullet, setBullet] = useState<{
    index: number;
    rect: ToolbarRect;
  } | null>(null);
  const trackSelectionRef = useRef<(force?: boolean) => void>(() => {});

  function isShowcaseFigure(el: HTMLElement): boolean {
    return el.hasAttribute("data-showcase-block");
  }

  /** A button block's label — where the caret goes when the block is reached. */
  function buttonLabelOf(el: HTMLElement): HTMLElement | null {
    return el.hasAttribute("data-button-link-block")
      ? el.querySelector<HTMLElement>("[data-button-label]")
      : null;
  }

  function focusBlockAtEnd(el: HTMLElement) {
    const buttonLabel = buttonLabelOf(el);
    if (buttonLabel) el = buttonLabel;

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
    // Non-text blocks aren't contentEditable; focus() is enough.
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
    const buttonLabel = buttonLabelOf(el);
    if (buttonLabel) el = buttonLabel;

    if (isShowcaseFigure(el)) {
      const host = el.querySelector(
        "[data-showcase-media]",
      ) as HTMLElement | null;
      host?.focus();
      return;
    }

    el.focus();
    // Non-text blocks aren't contentEditable; focus() is enough.
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

  function shiftArrowUp(blockIndex: number) {
    const sel = window.getSelection();
    if (!sel) return;

    if (blockIndex === 0) {
      const el = titleRef.current;
      if (!el) return;
      const focus = lastTextNode(el) ?? el;
      const offset =
        focus.nodeType === Node.TEXT_NODE ? (focus as Text).length : 0;
      // extend(), not setBaseAndExtent, which makes Chrome refocus the anchor element.
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

  function shiftArrowDown(blockIndex: number) {
    const sel = window.getSelection();
    if (!sel) return;

    const nextEl = blockRefs.current[blockIndex + 1];
    if (!nextEl) return;
    const focus = firstTextNode(nextEl) ?? nextEl;
    sel.extend(focus, 0);
  }

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
    const updatedCurrent: BlockNode =
      "children" in current && current.type !== "code_block"
        ? ({ ...current, children: htmlToNodes(beforeHtml) } as BlockNode)
        : current;

    // Only list items continue their type; anything else splits into a paragraph keeping indent and centring.
    const newBlock: BlockNode = (() => {
      const afterNodes = htmlToNodes(afterHtml);
      if (isListItemType(current.type)) {
        // Carry the bullet glyph forward; a numbered item ignores `marker` off-head.
        const marker = (current as { marker?: string }).marker;
        return {
          type: current.type,
          children: afterNodes,
          ...(marker ? { marker } : {}),
        } as BlockNode;
      }
      return {
        type: "paragraph",
        children: afterNodes,
        ...inheritedLayout(current),
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

  function emptyParagraphInheriting(source: BlockNode | undefined): BlockNode {
    return { ...emptyParagraphBlock(), ...inheritedLayout(source) } as BlockNode;
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

  function insertListItemBefore(index: number) {
    const source = blocks[index];
    const type = source.type as ListItemType;
    // A new item before the run's head becomes the head, so it takes the run-level marker and continue settings.
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
    updateBlocks([...blocks.slice(0, index), newItem, ...blocks.slice(index)]);
    cancelHistoryDebounce();
    pushHistoryNow();

    setTimeout(() => {
      const el = blockRefs.current[index + 1];
      if (el) focusBlockAtStart(el);
    }, 0);
  }

  function listRunStart(index: number): number {
    let start = index;
    while (start > 0 && blocks[start - 1].type === "list_item") start--;
    return start;
  }

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

  /** Restarts the count at the clicked item by toggling an explicit start of 1. */
  function resetNumbering(index: number) {
    const item = blocks[index];
    if (item.type !== "list_item") return;
    const next = [...blocks];
    next[index] = { ...item, start: item.start != null ? undefined : 1 };
    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();
  }

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

  function bulletStyleOf(index: number): BulletStyle {
    const item = blocks[index];
    if (item?.type !== "bullet_list_item") return "dot";
    return item.marker ?? "dot";
  }

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

  function bulletRunBounds(index: number): { start: number; end: number } {
    let start = index;
    while (start > 0 && blocks[start - 1].type === "bullet_list_item") start--;
    let end = index;
    while (end < blocks.length && blocks[end].type === "bullet_list_item")
      end++;
    return { start, end };
  }

  /** The glyph of the nearest bulleted list before `runStart`, or null; mirrors "continue numbering". */
  function prevBulletRunStyle(runStart: number): BulletStyle | null {
    let last = runStart - 1;
    while (last >= 0 && blocks[last].type !== "bullet_list_item") last--;
    if (last < 0) return null;
    let head = last;
    while (head > 0 && blocks[head - 1].type === "bullet_list_item") head--;
    const item = blocks[head];
    return item.type === "bullet_list_item" ? item.marker ?? "dot" : null;
  }

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

  function continueBulleting(index: number) {
    const { start } = bulletRunBounds(index);
    const style = prevBulletRunStyle(start);
    if (style === null) return;
    setBulletRunStyle(index, style);
  }

  function resetBulleting(index: number) {
    setBulletRunStyle(index, "dot");
  }

  function handleMarkerClick(index: number, rect: DOMRect) {
    const b = blocks[index];
    // Article-relative, so the anchor rides the scrolling article (see toArticleRect).
    const rel = toArticleRect(rect, blockRefs.current[index]);
    if (b?.type === "list_item") setNumbering({ index, rect: rel });
    else if (b?.type === "bullet_list_item") setBullet({ index, rect: rel });
  }

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

  /** Parses HTML into InlineNode[], with a non-empty fallback. */
  function htmlToNodes(html: string): InlineNode[] {
    const div = document.createElement("div");
    div.innerHTML = html;
    const nodes = domToInlineNodes(div);
    return nodes.length > 0 ? nodes : [{ type: "text", text: "" }];
  }

  function mergeWithPrev(index: number, currentHtml: string) {
    if (index === 0) {
      const el = titleRef.current;
      if (el) focusBlockAtEnd(el);
      return;
    }

    // Blur first: React reuses this focused node for the next block, and the focus-guarded sync would leave stale text.
    (document.activeElement as HTMLElement | null)?.blur();

    const prevBlock = blocks[index - 1];

    if (
      prevBlock.type === "horizontal_rule" ||
      prevBlock.type === "media" ||
      prevBlock.type === "collection" ||
      prevBlock.type === "component"
    ) {
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

    setTimeout(() => {
      const el = blockRefs.current[index - 1];
      if (el) setCursorAtTextOffset(el, prevTextLength);
    }, 0);
  }

  function mergeWithNext(index: number, currentHtml: string) {
    if (index >= blocks.length - 1) return;

    const nextBlock = blocks[index + 1];

    if (
      nextBlock.type === "horizontal_rule" ||
      nextBlock.type === "media" ||
      nextBlock.type === "collection" ||
      nextBlock.type === "component"
    ) {
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

    // Written directly: the focused block's sync would skip it.
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
    // Blur first, so the focus-guarded sync refreshes the node React reuses for the next block.
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

    const lastIndex = blockIndex + newBlocksHtml.length;
    setTimeout(() => {
      const el = blockRefs.current[lastIndex];
      if (el) focusBlockAtEnd(el);
    }, 0);
  }

  function handleSlash(el: HTMLElement, index: number) {
    const hasExistingContent = (el.innerText ?? "").trim().length > 1;
    setSlashAnchor({ el, index, hasExistingContent });
    setSlashQuery("");
  }

  /** Derives the slash query or dismisses the menu, in the handler rather than an Effect so dismissal is synchronous. */
  function handleSlashInput(text: string) {
    const trimmed = text.trim();
    if (!trimmed.startsWith("/")) {
      setSlashAnchor(null);
      setSlashQuery("");
      return;
    }
    // Pre-existing content sits after the "/" and is not a query.
    if (slashAnchor?.hasExistingContent) {
      setSlashQuery("");
      return;
    }
    const newQuery = trimmed.slice(1);
    const excludeType = slashAnchor
      ? (blocks[slashAnchor.index]?.type as SlashMenuBlockType | undefined)
      : undefined;
    if (!slashMenuHasResults(newQuery, undefined, excludeType)) {
      handleSlashDismiss();
      return;
    }
    setSlashQuery(newQuery);
  }

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

  /** Writes content into a focused block, whose own sync skips while focused. */
  function syncFocusedBlockDom(
    el: HTMLElement,
    children: InlineNode[],
    blockType: SlashMenuBlockType,
    base = 0,
  ) {
    if (
      blockType === "horizontal_rule" ||
      blockType === "button_link" ||
      blockType === "project_grid" ||
      blockType === "social_links"
    )
      return;
    if (blockType === "code_block") {
      el.innerHTML = children.map((n) => n.text).join("");
      return;
    }
    el.innerHTML = inlineNodesToHtml(children, base);
  }

  function handleComponentInsert(componentId: string) {
    if (componentDialogBlockIndex === null) return;
    const index = componentDialogBlockIndex;
    const existing = blocks[index];

    const next = [...blocks];
    next[index] = {
      type: "component",
      componentId,
      // The caption belongs to the block's position, not the demo in it.
      ...(existing?.type === "component" && existing.caption
        ? { caption: existing.caption }
        : {}),
    };
    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();

    const wasChange = componentDialogMode === "change";
    setComponentDialogOpen(false);
    setComponentDialogBlockIndex(null);
    setComponentDialogMode("insert");

    setTimeout(() => {
      if (wasChange) {
        const figure = blockRefs.current[index];
        const frame = figure?.querySelector(
          "[data-showcase-media]",
        ) as HTMLElement | null;
        frame?.focus();
        return;
      }
      const trailing = blockRefs.current[index + 1];
      if (trailing) focusBlockAtStart(trailing);
    }, 0);
  }

  function componentDialogCurrentId(): string | null {
    if (componentDialogBlockIndex === null) return null;
    const block = blocks[componentDialogBlockIndex];
    return block?.type === "component" ? block.componentId : null;
  }

  function handleChangeComponent(blockIndex: number) {
    setComponentDialogMode("change");
    setComponentDialogBlockIndex(blockIndex);
    setComponentDialogOpen(true);
  }

  function handleComponentDialogClose() {
    setComponentDialogOpen(false);
    setComponentDialogBlockIndex(null);
    setComponentDialogMode("insert");
  }

  // Feature, remove and replace bypass the debounced `updateBlock`, so each is one clean undo step.
  function collectionCapacity(index: number | null): number {
    if (index === null) return COLLECTION_MAX_ITEMS;
    const block = blocks[index];
    return block?.type === "collection"
      ? COLLECTION_MAX_ITEMS - block.items.length
      : COLLECTION_MAX_ITEMS;
  }

  function updateCollection(blockIndex: number, items: CollectionItem[]) {
    const block = blocks[blockIndex];
    if (block?.type !== "collection") return;
    const next = [...blocks];
    next[blockIndex] = { ...block, items };
    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();
  }

  function openCollectionPicker(blockIndex: number, target: number | null) {
    setCollectionDialogBlockIndex(blockIndex);
    setCollectionDialogTarget(target);
    setCollectionDialogOpen(true);
  }

  function handleCollectionDialogClose() {
    setCollectionDialogOpen(false);
    setCollectionDialogBlockIndex(null);
    setCollectionDialogTarget(null);
  }

  function handleCollectionInsert(payloads: ImageInsertPayload[]) {
    const blockIndex = collectionDialogBlockIndex;
    if (blockIndex === null || payloads.length === 0) return;

    const existing = blocks[blockIndex];
    const next = [...blocks];

    if (existing?.type !== "collection") {
      next[blockIndex] = {
        type: "collection",
        items: payloads.slice(0, COLLECTION_MAX_ITEMS).map(mediaNodeFrom),
      };
    } else if (collectionDialogTarget === null) {
      next[blockIndex] = {
        ...existing,
        items: appendItems(existing.items, payloads.map(mediaNodeFrom)),
      };
    } else {
      next[blockIndex] = {
        ...existing,
        items: replaceItem(
          existing.items,
          collectionDialogTarget,
          mediaNodeFrom(payloads[0]),
        ),
      };
    }

    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();

    const wasNew = existing?.type !== "collection";
    handleCollectionDialogClose();

    setTimeout(() => {
      if (wasNew) {
        const el = blockRefs.current[blockIndex + 1];
        if (el) focusBlockAtStart(el);
        return;
      }
      const figure = blockRefs.current[blockIndex];
      const media = figure?.querySelector(
        "[data-showcase-media]",
      ) as HTMLElement | null;
      media?.focus();
    }, 0);
  }

  function handleSlashSelect(type: SlashMenuBlockType) {
    if (!slashAnchor) return;
    const { index, el } = slashAnchor;
    setSlashAnchor(null);
    setSlashQuery("");

    // Read from the DOM — it is authoritative while the block is focused.
    const keptChildren = stripSlashTrigger(domToInlineNodes(el));
    syncFocusedBlockDom(el, keptChildren, type, sidenoteBaseList[index]);

    // Media, collection and component are deferred: a placeholder paragraph holds the spot until a dialog fills it.
    if (type === "media") {
      const next = [...blocks];
      next[index] = { type: "paragraph", children: keptChildren };
      updateBlocks(next);

      setImageDialogMode("insert");
      setImageDialogBlockIndex(index);
      setImageDialogOpen(true);
      return;
    }

    if (type === "collection") {
      const next = [...blocks];
      next[index] = { type: "paragraph", children: keptChildren };
      updateBlocks(next);

      setCollectionDialogBlockIndex(index);
      setCollectionDialogTarget(null);
      setCollectionDialogOpen(true);
      return;
    }

    if (type === "component") {
      const next = [...blocks];
      next[index] = { type: "paragraph", children: keptChildren };
      updateBlocks(next);

      setComponentDialogMode("insert");
      setComponentDialogBlockIndex(index);
      setComponentDialogOpen(true);
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
      const plainText = keptChildren.map((n) => n.text).join("");
      newBlock = {
        type: "code_block",
        children: [{ type: "text", text: plainText }],
      };
    } else if (type === "button_link") {
      newBlock = {
        type: "button_link",
        text: keptChildren.map((n) => n.text).join(""),
        href: "",
      };
    } else if (type === "project_grid" || type === "social_links") {
      newBlock = { type };
    } else {
      newBlock = { type: "horizontal_rule" };
    }

    const next = [...blocks];
    next[index] = newBlock;
    updateBlocks(next);
    cancelHistoryDebounce();
    pushHistoryNow();

    // A rule can't take a caret, so focus the trailing paragraph after it.
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

  function handleImageInsert(payload: ImageInsertPayload) {
    if (imageDialogBlockIndex === null) return;

    const existing = blocks[imageDialogBlockIndex];
    const next = [...blocks];
    next[imageDialogBlockIndex] = {
      ...mediaNodeFrom(payload),
      // The caption belongs to the block's position, not the file in it.
      ...(existing.type === "media" && existing.caption
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

  // Article-relative coordinates, so the absolute anchor rides the content and needs no scroll handling.
  function toArticleRect(
    r: { left: number; top: number; width: number; height: number },
    within: Node | null,
  ): ToolbarRect {
    const el =
      within?.nodeType === 1 ? (within as Element) : within?.parentElement;
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
    // The first line's rect, not the bounding box, which spans the column for a wrapped run.
    // jsdom's Range has neither method.
    const rects =
      typeof range.getClientRects === "function"
        ? Array.from(range.getClientRects())
        : [];
    // Skip an empty leading fragment at a soft wrap; a collapsed caret is zero-width anyway.
    const r =
      rects.find((rect) => rect.width > 0) ??
      rects[0] ??
      (typeof range.getBoundingClientRect === "function"
        ? range.getBoundingClientRect()
        : { left: 0, top: 0, width: 0, height: 0 });
    return toArticleRect(r, range.startContainer);
  }

  /** Measured from the first visible glyph: leading whitespace can sit on the line above. */
  function selectionAnchorRect(
    el: HTMLElement,
    range: Range,
    offsets: { start: number; end: number },
  ): ToolbarRect {
    const text = range.toString();
    const lead = text.length - text.trimStart().length;
    if (lead > 0 && lead < text.length) {
      const trimmed = domRangeForOffsets(el, offsets.start + lead, offsets.end);
      if (trimmed) return rectFromRange(trimmed);
    }
    return rectFromRange(range);
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

  // `forceRect` re-measures an unchanged selection; otherwise the rect is kept, so a mark toggle doesn't shift the toolbar.
  function trackSelection(forceRect = false) {
    if (slashAnchor) {
      setToolbar(null);
      return;
    }
    // The link editor's input holds focus, so the editor selection is momentarily gone.
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

    // Sidenote actions win over format and link; anchored to the live selection, acting on the whole annotation.
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
        rect: selectionAnchorRect(el, range, offsets),
        range: { start: sidenote.start, end: sidenote.end },
        sidenoteId: sidenote.id,
        activeMarks: new Set(),
      });
      return;
    }

    // Link actions win over format; anchored to the live selection, acting on the whole link.
    const link = findLinkRangeAt(nodes, offsets.start);
    if (link && offsets.start >= link.start && offsets.end <= link.end) {
      setToolbar({
        mode: "link-view",
        index,
        rect: selectionAnchorRect(el, range, offsets),
        range: { start: link.start, end: link.end },
        href: link.href,
        newTab: link.newTab,
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
      const sameSelection =
        !forceRect &&
        toolbar?.mode === "format" &&
        toolbar.index === index &&
        toolbar.range.start === offsets.start &&
        toolbar.range.end === offsets.end;
      setToolbar({
        mode: "format",
        index,
        rect: sameSelection
          ? toolbar.rect
          : selectionAnchorRect(el, range, offsets),
        range: offsets,
        activeMarks,
      });
      return;
    }
    setToolbar(null);
  }

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
    const next = transformMarksInRange(
      nodes,
      range.start,
      range.end,
      (marks) =>
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
      newTab: existing?.newTab,
      activeMarks: new Set(),
    });
  }

  function handleApplyLink(href: string, newTab: boolean) {
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
    const next = transformMarksInRange(
      nodes,
      range.start,
      range.end,
      (marks) => [
        ...marks.filter((m) => m.type !== "link"),
        (newTab
          ? { type: "link", href: normalized, newTab: true }
          : { type: "link", href: normalized }) as Mark,
      ],
    );
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

  // Adds an empty note or removes the one the range carries; ordinals are derived at render.
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
    const next = transformMarksInRange(
      nodes,
      range.start,
      range.end,
      (marks) =>
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
    if (id) {
      setEditingSidenoteId(id);
      setPendingSidenoteFocusId(id);
    }
  }

  // Suppressing the popover for the edited id (see trackSelection) stops it reappearing before the card focuses.
  function handleEditSidenote() {
    if (!toolbar?.sidenoteId) return;
    setEditingSidenoteId(toolbar.sidenoteId);
    setPendingSidenoteFocusId(toolbar.sidenoteId);
    setToolbar(null);
  }

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

  // Also syncs the prose DOM's `data-sidenote-text`, so a re-serialise keeps the note.
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

  // Focusing the prose blurs the card, whose onStopEditing clears editingSidenoteId.
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
    // Escape fires no selectionchange, so clearing keeps it hidden.
    setToolbar(null);
  }

  // No scroll listener: the article-relative anchor rides the content. Resize re-measures, since text reflows.
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

  // Delete/Backspace across editing hosts, reached through crossBlockDeleteRef.
  function crossBlockDelete(e: KeyboardEvent) {
    // -1 is the title.
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

    const beforeRange = document.createRange();
    beforeRange.setStart(startEl, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);

    const afterRange = document.createRange();
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEnd(endEl, endEl.childNodes.length);

    const tempDiv = document.createElement("div");

    if (startIdx === -1) {
      const newTitleText = beforeRange.toString();

      tempDiv.appendChild(afterRange.cloneContents());
      const afterHtml = tempDiv.innerHTML;
      const endBlock = blocks[endIdx];
      const mergedBlock: BlockNode =
        "children" in endBlock
          ? ({ ...endBlock, children: htmlToNodes(afterHtml) } as BlockNode)
          : { type: "paragraph", children: [{ type: "text", text: "" }] };

      updateBlocks([mergedBlock, ...blocks.slice(endIdx + 1)]);

      setTitle(newTitleText);
      titleRef.current!.innerText = newTitleText;
      cancelHistoryDebounce();
      pushHistoryNow();

      setTimeout(() => {
        const el = blockRefs.current[0];
        if (el) focusBlockAtStart(el);
      }, 0);
    } else {
      // A non-text start block has no editable host; writing its innerHTML would wipe it for good.
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

      // Measure before writing innerHTML, which orphans the nodes beforeRange points at.
      const targetCaretLength = beforeRange.toString().length;

      // Written directly: the focused block's sync skips it.
      startEl.innerHTML = mergedHtml;
      startEl.focus();

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
      // focus() may have set a range at position 0.
      sel.removeAllRanges();
      sel.addRange(r);

      updateBlocks(newBlocks);
      cancelHistoryDebounce();
      pushHistoryNow();
    }
  }

  // Synced after commit: writing refs during render is unsafe.
  useEffect(() => {
    trackSelectionRef.current = trackSelection;
    crossBlockDeleteRef.current = crossBlockDelete;
  });

  const listNumbering = computeListNumbering(blocks);

  return (
    <>
      {showTitle && (
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
      )}

      {blocks.map((block, i) => (
        <EditableBlock
          key={`${i}-${block.type}`}
          block={block}
          slots={slots}
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
            block.type === "media" ? () => handleChangeImage(i) : undefined
          }
          onCollectionAdd={
            block.type === "collection"
              ? () => openCollectionPicker(i, null)
              : undefined
          }
          onCollectionReplace={
            block.type === "collection"
              ? (itemIndex) => openCollectionPicker(i, itemIndex)
              : undefined
          }
          onCollectionFeature={
            block.type === "collection"
              ? (itemIndex) =>
                  updateCollection(i, featureItem(block.items, itemIndex))
              : undefined
          }
          onCollectionRemove={
            block.type === "collection"
              ? (itemIndex) =>
                  updateCollection(i, removeItem(block.items, itemIndex))
              : undefined
          }
          onCollectionReorder={
            block.type === "collection"
              ? (from, to) =>
                  updateCollection(i, swapItems(block.items, from, to))
              : undefined
          }
          onChangeComponent={
            block.type === "component"
              ? () => handleChangeComponent(i)
              : undefined
          }
          onInsertParagraphBefore={() => insertParagraphBefore(i)}
          onInsertParagraphAfter={
            block.type === "media" ||
            block.type === "collection" ||
            block.type === "component" ||
            block.type === "metric" ||
            block.type === "blockquote" ||
            block.type === "button_link" ||
            block.type === "project_grid" ||
            block.type === "social_links"
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
          // Text on the line limits the menu to types that can hold it; furniture needs `slots` to render.
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
              : slots
                ? undefined
                : NON_FURNITURE_TYPES
          }
          excludeType={
            blocks[slashAnchor.index]?.type as SlashMenuBlockType | undefined
          }
          onSelect={handleSlashSelect}
          onDismiss={handleSlashDismiss}
        />
      )}

      {toolbar && (
        <SelectionToolbar
          mode={toolbar.mode}
          rect={toolbar.rect}
          activeMarks={toolbar.activeMarks}
          linkHref={toolbar.href}
          linkNewTab={toolbar.newTab}
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

      {metadataOpen && (
        <PostMetadataPanel
          onDismiss={() => useMetadataPanelStore.getState().setOpen(false)}
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

      {/* A second instance: selection mode and payload differ, and a closed one never fetches. */}
      <ImageInsertDialog
        open={collectionDialogOpen}
        mode={collectionDialogTarget === null ? "insert" : "change"}
        initialPhase="library"
        selectionMode="multiple"
        maxSelection={
          collectionDialogTarget === null
            ? collectionCapacity(collectionDialogBlockIndex)
            : 1
        }
        onClose={handleCollectionDialogClose}
        onInsert={handleCollectionInsert}
      />

      <ComponentInsertDialog
        open={componentDialogOpen}
        mode={componentDialogMode}
        currentComponentId={componentDialogCurrentId()}
        onClose={handleComponentDialogClose}
        onInsert={handleComponentInsert}
      />
    </>
  );
}
