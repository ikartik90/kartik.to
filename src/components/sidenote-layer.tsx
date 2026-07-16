"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import {
  sidenoteCard,
  sidenoteCardContent,
  sidenoteCardMarker,
  sidenoteCardBody,
} from "../../styled-system/recipes";
import type { SidenoteEntry } from "@/utils/sidenotes";

// ---------------------------------------------------------------------------
// SidenoteLayer — the margin notes.
//
// A note's card is CSS-anchored (see the sidenoteCard recipe) and revealed only
// when its annotation is "active": in the editor (`trigger="caret"`) that means
// the caret sits on the annotated text (or the card is being edited); in the
// reader (`trigger="pointer"`) it means the annotation is hovered or clicked.
//
// Placement is chosen per active note: `side` (100px right of the text-content
// column, 2px above the line) when the viewport has room, else `stacked`
// (centred on the column, 4px below/above the line — like the slash menu).
// ---------------------------------------------------------------------------

const cardClass = {
  side: sidenoteCard({ placement: "side" }),
  stacked: sidenoteCard({ placement: "stacked" }),
} as const;
const contentClass = sidenoteCardContent();
const markerClass = sidenoteCardMarker();
const bodyClass = sidenoteCardBody();

// "Esc to exit" hint below the note body — mirrors the link-input hint in the
// selection toolbar (an Esc key-cap followed by a muted label).
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
  textStyle: "commandLabel",
  whiteSpace: "nowrap",
});
const hintLabelStyle = css({
  color: "text.default/50",
  textStyle: "commandLabel",
  whiteSpace: "nowrap",
});

// Horizontal geometry (mirrors the sidenote size tokens in panda.config.ts).
// The `left`/`width` of a card are computed here from the rail's measured rect
// and applied inline, rather than via CSS `anchor(--sidenote-rail …)`: WebKit
// resolves only an element's default `position-anchor` (here the annotation,
// used for the vertical axis), so a second named-anchor query for the
// horizontal axis silently fails in Safari. Doing it in JS is safe because the
// content column's x-edges are scroll-invariant.
const SIDE_OFFSET = 100; // sizes.sidenoteOffset — 100px right of the column.
const CARD_WIDTH = 320; // sizes.sidenoteWidth
const SIDE_SAFE_GAP = 16; // room to keep before falling back to `stacked`.
const STACKED_INSET = 80; // sizes.sidenoteStackedInset
const STACKED_MIN_WIDTH = 320; // sizes.sidenoteMinWidth
const STACKED_MAX_WIDTH = 480; // sizes.sidenoteMaxWidth

type Placement = "side" | "stacked";

// Inline horizontal geometry for the active card. `left` is a viewport px value
// (the card is position:fixed); `stacked` is centred on the column via the
// recipe's `translate: -50%`.
interface CardGeometry {
  left: number;
  width: number;
}

interface SidenoteLayerProps {
  entries: SidenoteEntry[];
  /** Reveal model: caret (editor) or hover/click (reader). */
  trigger?: "caret" | "pointer";
  /** Editor mode — the note body is contentEditable. */
  editable?: boolean;
  /** Editor: id of the note whose card is open for editing. */
  activeId?: string | null;
  /** Id of a card whose body should grab focus on mount (freshly added note). */
  autoFocusId?: string | null;
  onAutoFocused?: () => void;
  /** Editor: the editing card lost focus — the parent should close it. */
  onStopEditing?: () => void;
  /** Editor: Escape pressed in the note body — close the card and return the
   *  caret to the annotated text. */
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
  // Reader: annotation hovered / clicked. Both surfaces: card being edited.
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

  // Choose side vs stacked for the visible note and compute its horizontal
  // geometry from the rail's rect. Layout effect so the inline left/width is set
  // before paint (no flash at a stale position as the card reveals). Runs on
  // mount + resize; horizontal geometry is scroll-invariant so scroll needs no
  // recompute (the card is position:fixed and the column's x-edges don't move).
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
        // Centred on the column — the recipe applies translate: -50%.
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
              // Editing this note is over once its card loses focus.
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

// ---------------------------------------------------------------------------
// SidenoteBody — the note text. Editable bodies are uncontrolled (seeded via a
// ref) so React never reconciles the contentEditable children and steals the
// caret; external changes (undo, another card) re-seed only while unfocused.
// ---------------------------------------------------------------------------

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
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && el.textContent !== text) {
      el.textContent = text;
    }
  }, [text]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    // The card reveals via a visibility transition (hidden → visible), so it
    // isn't focusable the instant its annotation becomes active: focus() on a
    // still-hidden element is a silent no-op. Retry across a few frames until
    // focus actually lands (fresh cards mount visible and land on the first
    // try; a re-opened card takes a frame for `visibility` to compute visible).
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
    return <span className={bodyClass}>{text}</span>;
  }

  return (
    <span
      ref={ref}
      className={bodyClass}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={ariaLabel}
      data-placeholder="Add a note…"
      onInput={(e) => onChange(e.currentTarget.textContent ?? "")}
      onKeyDown={(e) => {
        // Esc exits the card (mirrors the link input) — hand back to the parent
        // to close it and restore the caret to the annotated text.
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onExit?.();
        }
      }}
    />
  );
}
