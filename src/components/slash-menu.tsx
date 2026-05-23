"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { menuIcon, menuItem } from "../../styled-system/recipes";
import SubheadingIcon from "@/assets/icons/subheading.svg";
import ParagraphIcon from "@/assets/icons/paragraph.svg";
import MediaIcon from "@/assets/icons/media.svg";
import QuoteIcon from "@/assets/icons/quote.svg";
import CodeIcon from "@/assets/icons/code.svg";
import BorderIcon from "@/assets/icons/border.svg";

// ---------------------------------------------------------------------------
// Module-level mouse position tracker — updated before any menu mounts so the
// initial cursor position is always available synchronously on mount.
// ---------------------------------------------------------------------------
let _mouseX = -1;
let _mouseY = -1;
if (typeof document !== "undefined") {
  document.addEventListener(
    "mousemove",
    (e) => {
      _mouseX = e.clientX;
      _mouseY = e.clientY;
    },
    { passive: true },
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlashMenuBlockType =
  | "heading"
  | "paragraph"
  | "media"
  | "blockquote"
  | "code_block"
  | "horizontal_rule";

interface SlashMenuItem {
  type: SlashMenuBlockType;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

interface SlashMenuProps {
  anchor: HTMLElement | null;
  /** Characters typed after the "/" — used to filter menu items. */
  query?: string;
  /**
   * When provided, only items whose type is in this set are shown.
   * Used to hide non-text blocks (media, horizontal_rule) when the menu is
   * opened on an existing text block that needs type conversion.
   */
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>;
  /** The type of the block currently being edited — hidden from the list. */
  excludeType?: SlashMenuBlockType;
  onSelect: (type: SlashMenuBlockType) => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------------

const ITEMS: SlashMenuItem[] = [
  { type: "heading", label: "Sub-heading", Icon: SubheadingIcon },
  { type: "paragraph", label: "Paragraph", Icon: ParagraphIcon },
  { type: "media", label: "Media", Icon: MediaIcon },
  { type: "blockquote", label: "Quote", Icon: QuoteIcon },
  { type: "code_block", label: "Code Block", Icon: CodeIcon },
  { type: "horizontal_rule", label: "Horizontal Rule", Icon: BorderIcon },
];

/**
 * Pure filter helper — exported so parent components can check whether a given
 * query/context would produce any results without mounting <SlashMenu>.
 * This lets the parent dismiss the menu from the event handler instead of
 * reacting to it from an Effect inside SlashMenu.
 */
export function getFilteredSlashItems(
  query: string,
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>,
  excludeType?: SlashMenuBlockType,
) {
  return ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) &&
      (!allowedTypes || allowedTypes.includes(item.type)) &&
      item.type !== excludeType,
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const menuStyle = css({
  position: "fixed",
  zIndex: 50,
  backgroundColor: "bg.surface",
  borderRadius: "md",
  paddingBlock: "md",
  paddingInline: "sm",
  display: "flex",
  flexDirection: "column",
  gap: "xs",
  overflow: "hidden",
  width: "200px",
  boxShadow:
    "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
});

const itemStyle = menuItem();

const iconStyle = menuIcon();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlashMenu({ anchor, query = "", allowedTypes, excludeType, onSelect, onDismiss }: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredItems = getFilteredSlashItems(query, allowedTypes, excludeType);

  // Stable refs so the keydown handler avoids stale closures.
  const filteredItemsRef = useRef(filteredItems);
  filteredItemsRef.current = filteredItems;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  // Reset active item to the top whenever the query changes — done during
  // rendering (not in an Effect) so there is no extra render pass with a
  // stale activeIndex visible to children.
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  // Position below the caret (flips upward when space is tight).
  // Uses the selection's caret rect over the anchor rect to avoid multi-line block height skew.
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu || !anchor) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const caretRect = sel.getRangeAt(0).getBoundingClientRect();

    const menuHeight = menu.offsetHeight;
    const gap = 4;
    const spaceBelow = window.innerHeight - caretRect.bottom - gap;
    const spaceAbove = caretRect.top - gap;
    const opensUpward = spaceBelow < menuHeight && spaceAbove >= menuHeight;

    menu.style.top = opensUpward
      ? `${caretRect.top - gap - menuHeight}px`
      : `${caretRect.bottom + gap}px`;
    menu.style.left = `${caretRect.left}px`;

    const rafId = requestAnimationFrame(() => {
      const el = document.elementFromPoint(_mouseX, _mouseY);
      if (el && menu.contains(el)) {
        const items = menu.querySelectorAll<HTMLElement>('[role="menuitem"]');
        const idx = Array.from(items).findIndex(
          (item) => item === el || item.contains(el),
        );
        if (idx !== -1) setActiveIndex(idx);
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [anchor]);

  // Dismiss on outside click.
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onDismiss]);

  // Capture phase so this fires before the editor's React handlers.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape":
          e.stopPropagation();
          onDismiss();
          break;
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % filteredItemsRef.current.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex(
            (i) => (i - 1 + filteredItemsRef.current.length) % filteredItemsRef.current.length,
          );
          break;
        case "Enter": {
          e.preventDefault();
          e.stopPropagation();
          const item = filteredItemsRef.current[activeIndexRef.current];
          if (item) onSelect(item.type);
          break;
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onDismiss, onSelect]);

  return (
    <div ref={menuRef} className={menuStyle} role="menu" aria-label="Insert block">
      {filteredItems.map(({ type, label, Icon }, idx) => (
        <button
          key={type}
          role="menuitem"
          aria-selected={idx === activeIndex}
          className={itemStyle}
          onPointerEnter={() => setActiveIndex(idx)}
          onPointerDown={(e) => {
            // Prevent the outside-click handler from firing before onSelect.
            e.stopPropagation();
          }}
          onClick={() => onSelect(type)}
        >
          <Icon className={iconStyle} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
