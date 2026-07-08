"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import {
  menuIcon,
  selectionToolbar,
  selectionToolbarDivider,
  selectionToolbarItem,
} from "../../styled-system/recipes";
import type { Mark } from "@/domain/nodes";
import LinkIcon from "@/assets/icons/link.svg";
import BoldIcon from "@/assets/icons/bold.svg";
import ItalicIcon from "@/assets/icons/italic.svg";
import CodeIcon from "@/assets/icons/code.svg";
import UnderlineSolidIcon from "@/assets/icons/underline-solid.svg";
import UnderlineSquiggleIcon from "@/assets/icons/underline-squiggle.svg";
import StrikethroughIcon from "@/assets/icons/strikethrough.svg";
import EditIcon from "@/assets/icons/edit.svg";
import GotoIcon from "@/assets/icons/goto.svg";
import TrashIcon from "@/assets/icons/trash.svg";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SelectionToolbarMode = "format" | "link-edit" | "link-view";

/** The togglable (non-link) marks exposed as formatting buttons. */
export type ToggleableMark = Exclude<Mark["type"], "link">;

interface SelectionToolbarProps {
  mode: SelectionToolbarMode;
  /** Mark types the current selection fully carries — drives the active state. */
  activeMarks: ReadonlySet<Mark["type"]>;
  /** Existing link href — prefilled in link-edit, opened by goto in link-view. */
  linkHref?: string;
  onToggleMark: (type: ToggleableMark) => void;
  onStartLink: () => void;
  onApplyLink: (href: string) => void;
  onRemoveLink: () => void;
  onGotoLink: () => void;
  onEditLink: () => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Format-mode button groups (Figma 422:833)
// ---------------------------------------------------------------------------

interface FormatButton {
  mark: ToggleableMark;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

const FORMAT_GROUPS: FormatButton[][] = [
  [
    { mark: "bold", label: "Bold", Icon: BoldIcon },
    { mark: "italic", label: "Italic", Icon: ItalicIcon },
    { mark: "code", label: "Code", Icon: CodeIcon },
    { mark: "underline", label: "Underline", Icon: UnderlineSolidIcon },
  ],
  [
    {
      mark: "wavy_underline",
      label: "Wavy underline",
      Icon: UnderlineSquiggleIcon,
    },
    { mark: "strikethrough", label: "Strikethrough", Icon: StrikethroughIcon },
  ],
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const toolbarStyle = selectionToolbar();
const itemStyle = selectionToolbarItem();
const dividerStyle = selectionToolbarDivider();
const iconStyle = menuIcon();

const linkRowStyle = css({
  display: "flex",
  flex: "1 0 0",
  minWidth: 0,
  alignItems: "center",
  gap: "md",
  height: "token(spacing.4xl)",
  paddingInline: "lg",
});

const linkInputStyle = css({
  flex: "1 0 0",
  minWidth: 0,
  background: "transparent",
  border: "none",
  color: "text.default",
  textStyle: "commandItem",
  focusVisibleRing: "none",
  _placeholder: { color: "text.default/40" },
});

const hotkeyHintStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "sm",
  flexShrink: 0,
});

const hotkeyKeyStyle = css({
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

const hotkeyLabelStyle = css({
  color: "text.default/50",
  textStyle: "commandLabel",
  whiteSpace: "nowrap",
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SelectionToolbar({
  mode,
  activeMarks,
  linkHref,
  onToggleMark,
  onStartLink,
  onApplyLink,
  onRemoveLink,
  onGotoLink,
  onEditLink,
  onDismiss,
}: SelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [href, setHref] = useState(linkHref ?? "");

  // Reset the draft href whenever we (re)enter link-edit for a different link.
  const [prevMode, setPrevMode] = useState(mode);
  if (mode !== prevMode) {
    setPrevMode(mode);
    if (mode === "link-edit") setHref(linkHref ?? "");
  }

  useEffect(() => {
    if (mode === "link-edit") {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [mode]);

  // Escape closes the toolbar from any mode (link-edit also handles it locally).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss();
      }
    }
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onDismiss]);

  // Dismiss when pointer goes down outside the toolbar.
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (toolbarRef.current && !toolbarRef.current.contains(target)) {
        onDismiss();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown);
  }, [onDismiss]);

  // Keep the editor selection intact when clicking formatting buttons.
  const preserveSelection = (e: React.MouseEvent) => e.preventDefault();

  if (mode === "link-edit") {
    return (
      <div ref={toolbarRef} className={toolbarStyle} role="toolbar" aria-label="Edit link">
        <div className={linkRowStyle}>
          <LinkIcon className={iconStyle} aria-hidden />
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            placeholder="https://..."
            aria-label="Link URL"
            className={linkInputStyle}
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const trimmed = href.trim();
                if (trimmed) onApplyLink(trimmed);
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onDismiss();
              }
            }}
          />
          <div className={hotkeyHintStyle} aria-hidden>
            <span className={hotkeyKeyStyle}>Esc</span>
            <span className={hotkeyLabelStyle}>to exit</span>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "link-view") {
    return (
      <div ref={toolbarRef} className={toolbarStyle} role="toolbar" aria-label="Link actions">
        <button
          type="button"
          className={itemStyle}
          aria-label="Edit link"
          onMouseDown={preserveSelection}
          onClick={onEditLink}
        >
          <EditIcon className={iconStyle} aria-hidden />
        </button>
        <button
          type="button"
          className={itemStyle}
          aria-label="Open link"
          onMouseDown={preserveSelection}
          onClick={onGotoLink}
        >
          <GotoIcon className={iconStyle} aria-hidden />
        </button>
        <button
          type="button"
          className={itemStyle}
          aria-label="Remove link"
          onMouseDown={preserveSelection}
          onClick={onRemoveLink}
        >
          <TrashIcon className={iconStyle} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div ref={toolbarRef} className={toolbarStyle} role="toolbar" aria-label="Format selection">
      <button
        type="button"
        className={itemStyle}
        aria-label="Add link"
        aria-pressed={activeMarks.has("link")}
        data-active={activeMarks.has("link") ? "true" : undefined}
        onMouseDown={preserveSelection}
        onClick={onStartLink}
      >
        <LinkIcon className={iconStyle} aria-hidden />
      </button>
      {FORMAT_GROUPS.map((group, groupIdx) => (
        <div key={groupIdx} className={css({ display: "contents" })}>
          <span className={dividerStyle} aria-hidden />
          {group.map(({ mark, label, Icon }) => {
            const active = activeMarks.has(mark);
            return (
              <button
                key={mark}
                type="button"
                className={itemStyle}
                aria-label={label}
                aria-pressed={active}
                data-active={active ? "true" : undefined}
                onMouseDown={preserveSelection}
                onClick={() => onToggleMark(mark)}
              >
                <Icon className={iconStyle} aria-hidden />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
