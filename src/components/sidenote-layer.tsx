"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { sidenoteCard } from "../../styled-system/recipes";
import type { SidenoteEntry } from "@/utils/sidenotes";

const cardClass = {
  side: sidenoteCard({ placement: "side" }),
  stacked: sidenoteCard({ placement: "stacked" }),
} as const;
const contentClass = css({
  display: "flex",
  gap: "xs",
  flex: "1 0 0",
  minWidth: 0,
  textStyle: "sidenote",
  color: "text.default",
});

const markerClass = css({
  fontWeight: "medium",
  background: "bg.brandedEmphasis",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
  userSelect: "none",
});

const bodyClass = css({
  // inline-block + a min width gives an EMPTY contentEditable a line
  // box, so the caret is placeable on click.
  display: "inline-block",
  minWidth: "token(spacing.md)",
  caretColor: "text.default",
  focusVisibleRing: "none",
  "& > * + *": { marginTop: "sm" },
  "&[data-placeholder]:empty::after": {
    content: "attr(data-placeholder)",
    color: "text.default/40",
  },
});

const hintStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "sm",
  userSelect: "none",
});
const hintKeyStyle = css({
  display: "flex",
  alignItems: "center",
  paddingInline: "sm",
  height: "token(spacing.xxl)",
  borderRadius: "sm",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  backgroundColor: "bg.itemHover",
  color: "text.default",
  textStyle: "caption",
  whiteSpace: "nowrap",
});
const hintLabelStyle = css({
  color: "text.default/50",
  textStyle: "caption",
  whiteSpace: "nowrap",
});

// Computed here, not anchored: WebKit fails a second named-anchor query.
const SIDE_OFFSET = 100; // sizes.sidenoteOffset
const CARD_WIDTH = 320; // sizes.sidenoteWidth
const SIDE_SAFE_GAP = 16; // room to keep before falling back to `stacked`.
const STACKED_INSET = 80; // sizes.sidenoteStackedInset
const STACKED_MIN_WIDTH = 320; // sizes.sidenoteMinWidth
const STACKED_MAX_WIDTH = 480; // sizes.sidenoteMaxWidth

type Placement = "side" | "stacked";

// `left` is in viewport px (the card is fixed); `stacked` centres via the recipe's translate.
interface CardGeometry {
  left: number;
  width: number;
}

interface SidenoteLayerProps {
  entries: SidenoteEntry[];
  /** Reveal model: caret (editor) or hover/click (reader). */
  trigger?: "caret" | "pointer";
  editable?: boolean;
  /** Editor: id of the note whose card is open for editing. */
  activeId?: string | null;
  /** Id of a card whose body should grab focus on mount (freshly added note). */
  autoFocusId?: string | null;
  onAutoFocused?: () => void;
  /** Editor: the editing card lost focus — the parent should close it. */
  onStopEditing?: () => void;
  /** Escape in the note body: close the card and return the caret to the annotated text. */
  onExitEdit?: (entry: SidenoteEntry) => void;
  onChangeText?: (entry: SidenoteEntry, text: string) => void;
}

export function SidenoteLayer({
  entries,
  trigger = "pointer",
  editable = false,
  activeId = null,
  autoFocusId,
  onAutoFocused,
  onStopEditing,
  onExitEdit,
  onChangeText,
}: SidenoteLayerProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [clickId, setClickId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement>("side");
  const [geometry, setGeometry] = useState<CardGeometry | null>(null);

  const triggered = trigger === "caret" ? activeId : (hoverId ?? clickId);
  const visibleId = triggered ?? focusedId ?? autoFocusId ?? null;

  // Reader: hover reveals, click pins (toggle), outside pointer-down clears.
  useEffect(() => {
    if (trigger !== "pointer") return;
    const annOf = (t: EventTarget | null) =>
      (t as Element | null)?.closest?.("[data-sidenote-id]") ?? null;
    function over(e: PointerEvent) {
      const el = annOf(e.target);
      if (el) setHoverId(el.getAttribute("data-sidenote-id"));
    }
    function out(e: PointerEvent) {
      if (annOf(e.target)) setHoverId(null);
    }
    function down(e: PointerEvent) {
      const el = annOf(e.target);
      if (el) {
        const id = el.getAttribute("data-sidenote-id");
        setClickId((cur) => (cur === id ? null : id));
      } else if (!(e.target as Element | null)?.closest?.("[data-sidenote-card]")) {
        setClickId(null);
      }
    }
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("pointerdown", down);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("pointerdown", down);
    };
  }, [trigger]);

  // Layout effect, so geometry lands before paint; scroll needs no recompute (fixed card, static column edges).
  useLayoutEffect(() => {
    if (!visibleId) return;
    function measure() {
      const rail = railRef.current;
      if (!rail) return;
      const rect = rail.getBoundingClientRect();
      const fits =
        rect.right + SIDE_OFFSET + CARD_WIDTH + SIDE_SAFE_GAP <=
        window.innerWidth;
      if (fits) {
        setPlacement("side");
        setGeometry({ left: rect.right + SIDE_OFFSET, width: CARD_WIDTH });
      } else {
        setPlacement("stacked");
        const width = Math.max(
          STACKED_MIN_WIDTH,
          Math.min(rect.width - STACKED_INSET, STACKED_MAX_WIDTH),
        );
        setGeometry({ left: rect.left + rect.width / 2, width });
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [visibleId]);

  return (
    <>
      <div ref={railRef} data-sidenote-rail aria-hidden />
      {entries.map((entry) => (
        <aside
          key={entry.id}
          data-sidenote-card
          data-active={visibleId === entry.id ? "true" : undefined}
          className={cardClass[placement]}
          style={
            {
              "--sn-anchor": entry.anchorName,
              ...(geometry && {
                left: `${geometry.left}px`,
                width: `${geometry.width}px`,
              }),
            } as React.CSSProperties
          }
          onPointerEnter={
            trigger === "pointer" ? () => setHoverId(entry.id) : undefined
          }
          onPointerLeave={
            trigger === "pointer" ? () => setHoverId(null) : undefined
          }
          onFocusCapture={() => setFocusedId(entry.id)}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setFocusedId((cur) => (cur === entry.id ? null : cur));
              onStopEditing?.();
            }
          }}
        >
          <div className={contentClass}>
            <span className={markerClass} aria-hidden>
              {entry.number}.
            </span>
            <SidenoteBody
              text={entry.text}
              editable={editable}
              ariaLabel={`Sidenote ${entry.number}`}
              autoFocus={editable && autoFocusId === entry.id}
              onAutoFocused={onAutoFocused}
              onExit={() => onExitEdit?.(entry)}
              onChange={(text) => onChangeText?.(entry, text)}
            />
          </div>
          {editable && (
            <div className={hintStyle} aria-hidden>
              <span className={hintKeyStyle}>Esc</span>
              <span className={hintLabelStyle}>to exit</span>
            </div>
          )}
        </aside>
      ))}
    </>
  );
}

// A note is newline-separated plain text, drawn as one <div> per paragraph so the gap is a real margin.
// An empty note keeps a childless body for the `:empty` placeholder.
const PARAGRAPH_TAGS = new Set(["DIV", "P"]);

/** Paragraph-aware text of a note body (or of a cloned range fragment). */
function readNoteText(root: Node): string {
  const lines: string[] = [];
  let pending: string | null = null;
  for (const node of Array.from(root.childNodes)) {
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : null;
    // A lone <br> is the browser's placeholder for an empty line box, not text.
    if (el?.tagName === "BR") continue;
    if (el && PARAGRAPH_TAGS.has(el.tagName)) {
      if (pending !== null) lines.push(pending);
      pending = null;
      lines.push(el.textContent ?? "");
      continue;
    }
    pending = (pending ?? "") + (node.textContent ?? "");
  }
  if (pending !== null) lines.push(pending);
  return lines.join("\n");
}

function renderNoteText(el: HTMLElement, text: string): void {
  if (text === "") {
    el.replaceChildren();
    return;
  }
  el.replaceChildren(
    ...text.split("\n").map((line) => {
      const paragraph = document.createElement("div");
      // An empty paragraph needs a <br> to keep its line box (and its caret).
      if (line) paragraph.textContent = line;
      else paragraph.appendChild(document.createElement("br"));
      return paragraph;
    }),
  );
}

/** Text offset of a DOM point in `el`, counting each paragraph break as one char. */
function offsetOf(el: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.setEnd(node, offset);
  return readNoteText(range.cloneContents()).length;
}

function selectionOffsets(el: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) {
    return null;
  }
  return {
    start: offsetOf(el, range.startContainer, range.startOffset),
    end: offsetOf(el, range.endContainer, range.endOffset),
  };
}

function placeCaret(el: HTMLElement, at: number): void {
  const lines = readNoteText(el).split("\n");
  let index = 0;
  let column = at;
  while (index < lines.length - 1 && column > lines[index].length) {
    column -= lines[index].length + 1;
    index++;
  }
  const paragraph = el.children[index];
  const textNode = paragraph?.firstChild;
  const range = document.createRange();
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    range.setStart(textNode, Math.min(column, (textNode as Text).length));
  } else {
    range.setStart(paragraph ?? el, 0);
  }
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** Shift+Enter: splits at the caret, rebuilding the uncontrolled body; null if the caret isn't in it. */
function splitParagraphAtCaret(el: HTMLElement): string | null {
  const offsets = selectionOffsets(el);
  if (!offsets) return null;
  const text = readNoteText(el);
  const next = `${text.slice(0, offsets.start)}\n${text.slice(offsets.end)}`;
  renderNoteText(el, next);
  placeCaret(el, offsets.start + 1);
  return next;
}

// Uncontrolled, so React never reconciles the contentEditable and steals the caret; re-seeded only while unfocused.
interface SidenoteBodyProps {
  text: string;
  editable: boolean;
  ariaLabel: string;
  autoFocus: boolean;
  onAutoFocused?: () => void;
  onExit?: () => void;
  onChange: (text: string) => void;
}

function SidenoteBody({
  text,
  editable,
  ariaLabel,
  autoFocus,
  onAutoFocused,
  onExit,
  onChange,
}: SidenoteBodyProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && readNoteText(el) !== text) {
      renderNoteText(el, text);
    }
  }, [text]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    // focus() is a no-op until the visibility transition reveals the card, so retry across frames.
    let raf = 0;
    let tries = 0;
    const attempt = () => {
      el.focus();
      if (document.activeElement !== el && tries++ < 10) {
        raf = requestAnimationFrame(attempt);
        return;
      }
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      onAutoFocused?.();
    };
    raf = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(raf);
  }, [autoFocus, onAutoFocused]);

  if (!editable) {
    return (
      <div className={bodyClass}>
        {text.split("\n").map((line, i) => (
          <div key={i}>{line || <br />}</div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={bodyClass}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={ariaLabel}
      data-placeholder="Add a note…"
      onInput={(e) => {
        const el = e.currentTarget;
        const next = readNoteText(el);
        // Drop the leftover empty paragraph so the `:empty` placeholder shows again.
        if (next === "" && el.childNodes.length > 0) {
          el.replaceChildren();
          if (document.activeElement === el) placeCaret(el, 0);
        }
        onChange(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onExit?.();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          if (!e.shiftKey) {
            onExit?.();
            return;
          }
          const next = splitParagraphAtCaret(e.currentTarget);
          if (next !== null) onChange(next);
        }
      }}
    />
  );
}
