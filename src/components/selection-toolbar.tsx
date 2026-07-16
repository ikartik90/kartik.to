"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import {
  menuIcon,
  selectionPopoverDivider,
  selectionPopoverItem,
} from "../../styled-system/recipes";
import {
  SelectionPopover,
  preserveSelection,
  type SelectionPopoverRect,
} from "@/components/selection-popover";
import type { Mark } from "@/domain/nodes";
import LinkIcon from "@/assets/icons/link.svg";
import BoldIcon from "@/assets/icons/bold.svg";
import ItalicIcon from "@/assets/icons/italic.svg";
import CodeIcon from "@/assets/icons/code.svg";
import UnderlineSolidIcon from "@/assets/icons/underline-solid.svg";
import StrikethroughIcon from "@/assets/icons/strikethrough.svg";
import HighlightIcon from "@/assets/icons/highlight.svg";
import SidenoteIcon from "@/assets/icons/sidenote.svg";
import EditIcon from "@/assets/icons/edit.svg";
import GotoIcon from "@/assets/icons/goto.svg";
import TrashIcon from "@/assets/icons/trash.svg";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SelectionToolbarMode =
  | "format"
  | "link-edit"
  | "link-view"
  | "sidenote-view";

/** The togglable (non-link) marks exposed as formatting buttons. */
export type ToggleableMark = Exclude<Mark["type"], "link">;

interface SelectionToolbarProps {
  mode: SelectionToolbarMode;
  /** Viewport-relative rect the toolbar anchors to. */
  rect: SelectionPopoverRect;
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
  onAddSidenote: () => void;
  onEditSidenote: () => void;
  onDeleteSidenote: () => void;
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
    { mark: "underline", label: "Underline", Icon: UnderlineSolidIcon },
  ],
  [
    { mark: "strikethrough", label: "Strikethrough", Icon: StrikethroughIcon },
    { mark: "highlight", label: "Highlight", Icon: HighlightIcon },
    { mark: "code", label: "Code", Icon: CodeIcon },
  ],
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const itemStyle = selectionPopoverItem();
const dividerStyle = selectionPopoverDivider();
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
  rect,
  activeMarks,
  linkHref,
  onToggleMark,
  onStartLink,
  onApplyLink,
  onRemoveLink,
  onGotoLink,
  onEditLink,
  onAddSidenote,
  onEditSidenote,
  onDeleteSidenote,
  onDismiss,
}: SelectionToolbarProps) {
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

  if (mode === "link-edit") {
    return (
      <SelectionPopover rect={rect} ariaLabel="Edit link" onDismiss={onDismiss}>
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
              }
            }}
          />
          <div className={hotkeyHintStyle} aria-hidden>
            <span className={hotkeyKeyStyle}>Esc</span>
            <span className={hotkeyLabelStyle}>to exit</span>
          </div>
        </div>
      </SelectionPopover>
    );
  }

  if (mode === "link-view") {
    return (
      <SelectionPopover
        rect={rect}
        ariaLabel="Link actions"
        onDismiss={onDismiss}
      >
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
      </SelectionPopover>
    );
  }

  if (mode === "sidenote-view") {
    return (
      <SelectionPopover
        rect={rect}
        ariaLabel="Sidenote actions"
        onDismiss={onDismiss}
      >
        <button
          type="button"
          className={itemStyle}
          aria-label="Edit sidenote"
          onMouseDown={preserveSelection}
          onClick={onEditSidenote}
        >
          <EditIcon className={iconStyle} aria-hidden />
        </button>
        <button
          type="button"
          className={itemStyle}
          aria-label="Delete sidenote"
          onMouseDown={preserveSelection}
          onClick={onDeleteSidenote}
        >
          <TrashIcon className={iconStyle} aria-hidden />
        </button>
      </SelectionPopover>
    );
  }

  return (
    <SelectionPopover
      rect={rect}
      ariaLabel="Format selection"
      onDismiss={onDismiss}
    >
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
      <button
        type="button"
        className={itemStyle}
        aria-label="Add sidenote"
        aria-pressed={activeMarks.has("sidenote")}
        data-active={activeMarks.has("sidenote") ? "true" : undefined}
        onMouseDown={preserveSelection}
        onClick={onAddSidenote}
      >
        <SidenoteIcon className={iconStyle} aria-hidden />
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
    </SelectionPopover>
  );
}
