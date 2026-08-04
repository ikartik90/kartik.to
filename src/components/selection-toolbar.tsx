"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { inlineEditRow, menuIcon } from "../../styled-system/recipes";
import { selectionPopover } from "../../styled-system/recipes";
import { Popover, type PopoverRect } from "@/components/ui/popover";
import { OptionList } from "@/components/ui/input/option-list";
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
  rect: PopoverRect;
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

const iconStyle = menuIcon();
const toolbarClass = selectionPopover();
// Pairs with the selectionPopover recipe's `position-anchor`.
const selectionAnchor = "--selection-popover";

// The link editor's row is the shared inline-edit shell — the collection's
// caption editor takes over its cell toolbar the same way.
const editRow = inlineEditRow();

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
      <Popover
        rect={rect}
        anchorName={selectionAnchor}
        className={toolbarClass}
        role="toolbar"
        ariaLabel="Edit link"
        onDismiss={onDismiss}
      >
        <div className={editRow.root}>
          <LinkIcon className={iconStyle} aria-hidden />
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            placeholder="https://..."
            aria-label="Link URL"
            className={editRow.input}
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
          <div className={editRow.hint} aria-hidden>
            <span className={editRow.hintKey}>Esc</span>
            <span className={editRow.hintLabel}>to exit</span>
          </div>
        </div>
      </Popover>
    );
  }

  if (mode === "link-view") {
    return (
      <Popover
        rect={rect}
        anchorName={selectionAnchor}
        className={toolbarClass}
        onDismiss={onDismiss}
      >
        <OptionList direction="inline">
          <OptionList.Toolbar aria-label="Link actions">
            <OptionList.Option aria-label="Edit link" onClick={onEditLink}>
              <EditIcon aria-hidden />
            </OptionList.Option>
            <OptionList.Option aria-label="Open link" onClick={onGotoLink}>
              <GotoIcon aria-hidden />
            </OptionList.Option>
            <OptionList.Option aria-label="Remove link" onClick={onRemoveLink}>
              <TrashIcon aria-hidden />
            </OptionList.Option>
          </OptionList.Toolbar>
        </OptionList>
      </Popover>
    );
  }

  if (mode === "sidenote-view") {
    return (
      <Popover
        rect={rect}
        anchorName={selectionAnchor}
        className={toolbarClass}
        onDismiss={onDismiss}
      >
        <OptionList direction="inline">
          <OptionList.Toolbar aria-label="Sidenote actions">
            <OptionList.Option aria-label="Edit sidenote" onClick={onEditSidenote}>
              <EditIcon aria-hidden />
            </OptionList.Option>
            <OptionList.Option
              aria-label="Delete sidenote"
              onClick={onDeleteSidenote}
            >
              <TrashIcon aria-hidden />
            </OptionList.Option>
          </OptionList.Toolbar>
        </OptionList>
      </Popover>
    );
  }

  return (
    <Popover
      rect={rect}
      anchorName={selectionAnchor}
      className={toolbarClass}
      onDismiss={onDismiss}
    >
      <OptionList direction="inline">
        <OptionList.Toolbar aria-label="Format selection">
          <OptionList.Option
            aria-label="Add link"
            pressed={activeMarks.has("link")}
            onClick={onStartLink}
          >
            <LinkIcon aria-hidden />
          </OptionList.Option>
          <OptionList.Option
            aria-label="Add sidenote"
            pressed={activeMarks.has("sidenote")}
            onClick={onAddSidenote}
          >
            <SidenoteIcon aria-hidden />
          </OptionList.Option>
          {FORMAT_GROUPS.map((group, groupIdx) => (
            <Fragment key={groupIdx}>
              <OptionList.Divider />
              {group.map(({ mark, label, Icon }) => (
                <OptionList.Option
                  key={mark}
                  aria-label={label}
                  pressed={activeMarks.has(mark)}
                  onClick={() => onToggleMark(mark)}
                >
                  <Icon aria-hidden />
                </OptionList.Option>
              ))}
            </Fragment>
          ))}
        </OptionList.Toolbar>
      </OptionList>
    </Popover>
  );
}
