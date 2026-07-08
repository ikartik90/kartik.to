"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { css, cx } from "../../styled-system/css";
import {
  menuIcon,
  menuItem,
  slashMenuPopover,
  slashMenuSubmenu,
} from "../../styled-system/recipes";
import { demoComponents } from "@/components/demo/registry";
import SubheadingIcon from "@/assets/icons/subheading.svg";
import ParagraphIcon from "@/assets/icons/paragraph.svg";
import MediaIcon from "@/assets/icons/media.svg";
import ComponentIcon from "@/assets/icons/component.svg";
import ChevronRightIcon from "@/assets/icons/chevron-right.svg";
import QuoteIcon from "@/assets/icons/quote.svg";
import CodeIcon from "@/assets/icons/code.svg";
import BorderIcon from "@/assets/icons/border.svg";
import NumberedListIcon from "@/assets/icons/numbered-list.svg";

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
  onSelectComponent: (componentId: string) => void;
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

function filterDemoComponents(query: string) {
  const q = query.toLowerCase();
  if (!q) return demoComponents;
  return demoComponents.filter((demo) => demo.label.toLowerCase().includes(q));
}

function shouldShowComponent(
  query: string,
  allowedTypes?: ReadonlyArray<SlashMenuBlockType>,
) {
  if (allowedTypes) return false;
  const q = query.toLowerCase();
  if (!q) return true;
  if (COMPONENT_ITEM.label.toLowerCase().includes(q)) return true;
  return filterDemoComponents(query).length > 0;
}

export interface SlashMenuFilterResult {
  entries: SlashMenuEntry[];
  filteredDemos: ReturnType<typeof filterDemoComponents>;
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
  const filteredDemos = showComponent ? filterDemoComponents(query) : [];
  const entries: SlashMenuEntry[] = showComponent
    ? [
        ...blocks.slice(0, 3),
        COMPONENT_ITEM,
        ...blocks.slice(3),
      ]
    : blocks;

  return { entries, filteredDemos, showComponent };
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
  const { entries, showComponent, filteredDemos } = getFilteredSlashMenu(
    query,
    allowedTypes,
    excludeType,
  );
  if (entries.length > 0) return true;
  return showComponent && filteredDemos.length > 0;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const popoverStyle = slashMenuPopover();
const submenuStyle = slashMenuSubmenu();
const itemStyle = menuItem();
const iconStyle = menuIcon();

const componentRowWrapperStyle = css({ position: "relative", width: "100%" });

const componentRowStyle = cx(
  itemStyle,
  css({ justifyContent: "space-between" }),
);

const componentLabelStyle = css({
  flex: "1 0 0",
  minWidth: 0,
  textAlign: "left",
});

const submenuEmptyStyle = css({
  color: "text.commandItem/50",
  cursor: "default",
});

const positionedSubmenuStyle = css({
  left: "calc(100% + token(spacing.xxs))",
});

const SUBMENU_CLOSE_DELAY_MS = 120;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlashMenu({
  query = "",
  allowedTypes,
  excludeType,
  onSelect,
  onSelectComponent,
  onDismiss,
}: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const componentRowRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const submenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const { entries, filteredDemos } = getFilteredSlashMenu(
    query,
    allowedTypes,
    excludeType,
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuActiveIndex, setSubmenuActiveIndex] = useState(0);
  const [submenuTop, setSubmenuTop] = useState(0);

  const componentEntryIndex = entries.findIndex(
    (entry) => entry.kind === "component",
  );

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const filteredDemosRef = useRef(filteredDemos);
  filteredDemosRef.current = filteredDemos;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const submenuOpenRef = useRef(submenuOpen);
  submenuOpenRef.current = submenuOpen;
  const submenuActiveIndexRef = useRef(submenuActiveIndex);
  submenuActiveIndexRef.current = submenuActiveIndex;
  const componentEntryIndexRef = useRef(componentEntryIndex);
  componentEntryIndexRef.current = componentEntryIndex;

  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
    setSubmenuOpen(false);
    setSubmenuActiveIndex(0);
  }

  function clearSubmenuCloseTimer() {
    if (submenuCloseTimerRef.current) {
      clearTimeout(submenuCloseTimerRef.current);
      submenuCloseTimerRef.current = null;
    }
  }

  function openSubmenu() {
    clearSubmenuCloseTimer();
    setSubmenuOpen(true);
    setSubmenuActiveIndex(0);
  }

  function scheduleSubmenuClose(relatedTarget: EventTarget | null = null) {
    if (
      relatedTarget instanceof Node &&
      (componentRowRef.current?.contains(relatedTarget) ||
        submenuRef.current?.contains(relatedTarget))
    ) {
      return;
    }
    clearSubmenuCloseTimer();
    submenuCloseTimerRef.current = setTimeout(() => {
      setSubmenuOpen(false);
    }, SUBMENU_CLOSE_DELAY_MS);
  }

  // Open the submenu whenever the Component row is highlighted.
  useEffect(() => {
    if (activeIndex === componentEntryIndex && componentEntryIndex !== -1) {
      openSubmenu();
    } else if (submenuOpen) {
      setSubmenuOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to highlight changes
  }, [activeIndex, componentEntryIndex]);

  useLayoutEffect(() => {
    if (!submenuOpen || !componentRowRef.current || !submenuRef.current) return;
    const rowTop = componentRowRef.current.offsetTop;
    const paddingTop = parseFloat(
      getComputedStyle(submenuRef.current).paddingTop,
    );
    setSubmenuTop(rowTop - paddingTop);
  }, [submenuOpen, entries, componentEntryIndex]);

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
    return () => clearSubmenuCloseTimer();
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
    function handleKeyDown(e: KeyboardEvent) {
      const demos = filteredDemosRef.current;
      const inSubmenu = submenuOpenRef.current && demos.length > 0;
      const componentIdx = componentEntryIndexRef.current;

      switch (e.key) {
        case "Escape":
          if (inSubmenu) {
            e.preventDefault();
            e.stopPropagation();
            setSubmenuOpen(false);
            return;
          }
          e.stopPropagation();
          onDismiss();
          break;
        case "ArrowRight":
          if (
            !inSubmenu &&
            activeIndexRef.current === componentIdx &&
            componentIdx !== -1
          ) {
            e.preventDefault();
            openSubmenu();
          }
          break;
        case "ArrowLeft":
          if (inSubmenu) {
            e.preventDefault();
            setSubmenuOpen(false);
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (inSubmenu) {
            if (demos.length === 0) return;
            setSubmenuActiveIndex(
              (i) => (i + 1) % demos.length,
            );
          } else {
            setActiveIndex(
              (i) => (i + 1) % Math.max(entriesRef.current.length, 1),
            );
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (inSubmenu) {
            if (demos.length === 0) return;
            setSubmenuActiveIndex(
              (i) => (i - 1 + demos.length) % demos.length,
            );
          } else {
            setActiveIndex(
              (i) =>
                (i - 1 + entriesRef.current.length) %
                Math.max(entriesRef.current.length, 1),
            );
          }
          break;
        case "Enter": {
          e.preventDefault();
          e.stopPropagation();
          if (inSubmenu) {
            const demo = demos[submenuActiveIndexRef.current];
            if (demo) onSelectComponent(demo.id);
            return;
          }
          const entry = entriesRef.current[activeIndexRef.current];
          if (!entry) return;
          if (entry.kind === "component") {
            if (demos.length === 1) {
              onSelectComponent(demos[0].id);
            } else {
              openSubmenu();
            }
            return;
          }
          onSelect(entry.type);
          break;
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onDismiss, onSelect, onSelectComponent]);

  return (
    <div ref={menuRef} className={popoverStyle} role="menu" aria-label="Insert block">
      {entries.map((entry, idx) => {
        if (entry.kind === "component") {
          const isActive = idx === activeIndex;
          return (
            <div
              key="component"
              ref={componentRowRef}
              className={componentRowWrapperStyle}
              onPointerEnter={() => {
                clearSubmenuCloseTimer();
                setActiveIndex(idx);
              }}
              onPointerLeave={(e) => scheduleSubmenuClose(e.relatedTarget)}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={submenuOpen}
                aria-selected={isActive}
                className={componentRowStyle}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  if (filteredDemos.length === 1) {
                    onSelectComponent(filteredDemos[0].id);
                  } else {
                    openSubmenu();
                  }
                }}
              >
                <entry.Icon className={iconStyle} aria-hidden />
                <span className={componentLabelStyle}>{entry.label}</span>
                <ChevronRightIcon className={iconStyle} aria-hidden />
              </button>
            </div>
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
      {submenuOpen && componentEntryIndex !== -1 && (
        <div
          ref={submenuRef}
          className={cx(submenuStyle, positionedSubmenuStyle)}
          style={{ top: submenuTop }}
          role="menu"
          aria-label="Insert component"
          onPointerEnter={clearSubmenuCloseTimer}
          onPointerLeave={(e) => scheduleSubmenuClose(e.relatedTarget)}
        >
          {filteredDemos.length > 0 ? (
            filteredDemos.map((demo, demoIdx) => (
              <button
                key={demo.id}
                type="button"
                role="menuitem"
                aria-selected={demoIdx === submenuActiveIndex}
                className={itemStyle}
                onPointerEnter={() => setSubmenuActiveIndex(demoIdx)}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onSelectComponent(demo.id)}
              >
                {demo.label}
              </button>
            ))
          ) : (
            <div className={cx(itemStyle, submenuEmptyStyle)}>No components</div>
          )}
        </div>
      )}
    </div>
  );
}
