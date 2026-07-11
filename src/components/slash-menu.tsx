"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { menuIcon, menuItem, slashMenuPopover } from "../../styled-system/recipes";
import SubheadingIcon from "@/assets/icons/subheading.svg";
import ParagraphIcon from "@/assets/icons/paragraph.svg";
import MediaIcon from "@/assets/icons/media.svg";
import ComponentIcon from "@/assets/icons/component.svg";
import QuoteIcon from "@/assets/icons/quote.svg";
import CodeIcon from "@/assets/icons/code.svg";
import BorderIcon from "@/assets/icons/border.svg";
import NumberedListIcon from "@/assets/icons/numbered-list.svg";
import BulletedListIcon from "@/assets/icons/bulleted-list.svg";
import MetricIcon from "@/assets/icons/metric.svg";

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
  | "list_item"
  | "bullet_list_item"
  | "metric"
  | "code_block"
  | "horizontal_rule";

interface SlashMenuBlockItem {
  kind: "block";
  type: SlashMenuBlockType;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

interface SlashMenuComponentItem {
  kind: "component";
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

export type SlashMenuEntry = SlashMenuBlockItem | SlashMenuComponentItem;

interface SlashMenuProps {
  /** Characters typed after the "/" — used to filter menu items. */
  query?: string;
  /**
   * When provided, only items whose type is in this set are shown.
   * Used to hide non-text blocks (media, horizontal_rule, component) when the
   * menu is opened on an existing text block that needs type conversion.
   */
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>;
  /** The type of the block currently being edited — hidden from the list. */
  excludeType?: SlashMenuBlockType;
  onSelect: (type: SlashMenuBlockType) => void;
  /**
   * Invoked when the Component item is chosen. The picker (Insert Component
   * overlay) is responsible for choosing which component to insert, so no id
   * is passed here — this simply opens it, mirroring how Media opens the image
   * dialog.
   */
  onOpenComponentPicker: () => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------------

const BLOCK_ITEMS: SlashMenuBlockItem[] = [
  { kind: "block", type: "heading", label: "Sub-heading", Icon: SubheadingIcon },
  { kind: "block", type: "paragraph", label: "Paragraph", Icon: ParagraphIcon },
  { kind: "block", type: "media", label: "Media", Icon: MediaIcon },
  { kind: "block", type: "blockquote", label: "Quote", Icon: QuoteIcon },
  {
    kind: "block",
    type: "list_item",
    label: "Numbered List",
    Icon: NumberedListIcon,
  },
  {
    kind: "block",
    type: "bullet_list_item",
    label: "Bulleted List",
    Icon: BulletedListIcon,
  },
  { kind: "block", type: "metric", label: "Metric", Icon: MetricIcon },
  { kind: "block", type: "code_block", label: "Code Block", Icon: CodeIcon },
  {
    kind: "block",
    type: "horizontal_rule",
    label: "Horizontal Rule",
    Icon: BorderIcon,
  },
];

const COMPONENT_ITEM: SlashMenuComponentItem = {
  kind: "component",
  label: "Component",
  Icon: ComponentIcon,
};

/**
 * The Component item behaves like any other menu item: the query only decides
 * whether it appears in the list (matched against its own label), never which
 * components are available — that lives entirely in the Insert Component
 * overlay.
 */
function shouldShowComponent(
  query: string,
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>,
) {
  if (allowedTypes) return false;
  return COMPONENT_ITEM.label.toLowerCase().includes(query.toLowerCase());
}

export interface SlashMenuFilterResult {
  entries: SlashMenuEntry[];
  showComponent: boolean;
}

/**
 * Pure filter helper — exported so parent components can check whether a given
 * query/context would produce any results without mounting <SlashMenu>.
 */
export function getFilteredSlashMenu(
  query: string,
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>,
  excludeType?: SlashMenuBlockType,
): SlashMenuFilterResult {
  const q = query.toLowerCase();
  const blocks = BLOCK_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) &&
      (!allowedTypes || allowedTypes.includes(item.type)) &&
      item.type !== excludeType,
  );

  const showComponent = shouldShowComponent(query, allowedTypes);
  const entries: SlashMenuEntry[] = showComponent
    ? [...blocks.slice(0, 3), COMPONENT_ITEM, ...blocks.slice(3)]
    : blocks;

  return { entries, showComponent };
}

/** @deprecated Use getFilteredSlashMenu — kept for call-site compatibility. */
export function getFilteredSlashItems(
  query: string,
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>,
  excludeType?: SlashMenuBlockType,
) {
  return getFilteredSlashMenu(query, allowedTypes, excludeType).entries.filter(
    (entry): entry is SlashMenuBlockItem => entry.kind === "block",
  );
}

export function slashMenuHasResults(
  query: string,
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>,
  excludeType?: SlashMenuBlockType,
) {
  return (
    getFilteredSlashMenu(query, allowedTypes, excludeType).entries.length > 0
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const popoverStyle = slashMenuPopover();
const itemStyle = menuItem();
const iconStyle = menuIcon();

const componentLabelStyle = css({
  flex: "1 0 0",
  minWidth: 0,
  textAlign: "left",
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlashMenu({
  query = "",
  allowedTypes,
  excludeType,
  onSelect,
  onOpenComponentPicker,
  onDismiss,
}: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const { entries } = getFilteredSlashMenu(query, allowedTypes, excludeType);

  const [activeIndex, setActiveIndex] = useState(0);

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

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
  }, []);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onDismiss]);

  useEffect(() => {
    function selectEntry(entry: SlashMenuEntry | undefined) {
      if (!entry) return;
      if (entry.kind === "component") {
        onOpenComponentPicker();
      } else {
        onSelect(entry.type);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape":
          e.stopPropagation();
          onDismiss();
          break;
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex(
            (i) => (i + 1) % Math.max(entriesRef.current.length, 1),
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex(
            (i) =>
              (i - 1 + entriesRef.current.length) %
              Math.max(entriesRef.current.length, 1),
          );
          break;
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          selectEntry(entriesRef.current[activeIndexRef.current]);
          break;
      }
    }
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onDismiss, onSelect, onOpenComponentPicker]);

  return (
    <div
      ref={menuRef}
      className={popoverStyle}
      role="menu"
      aria-label="Insert block"
    >
      {entries.map((entry, idx) => {
        if (entry.kind === "component") {
          return (
            <button
              key="component"
              type="button"
              role="menuitem"
              aria-selected={idx === activeIndex}
              className={itemStyle}
              onPointerEnter={() => setActiveIndex(idx)}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onOpenComponentPicker()}
            >
              <entry.Icon className={iconStyle} aria-hidden />
              <span className={componentLabelStyle}>{entry.label}</span>
            </button>
          );
        }

        const { type, label, Icon } = entry;
        return (
          <button
            key={type}
            role="menuitem"
            aria-selected={idx === activeIndex}
            className={itemStyle}
            onPointerEnter={() => {
              setActiveIndex(idx);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onSelect(type)}
          >
            <Icon className={iconStyle} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
