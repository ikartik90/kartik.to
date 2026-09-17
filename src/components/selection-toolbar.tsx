"use client";

import { Fragment } from "react";
import { selectionPopover, toolbar } from "../../styled-system/recipes";
import { cx } from "../../styled-system/css";
import { Popover, type PopoverRect } from "@/components/ui/popover";
import { OptionList } from "@/components/ui/input/option-list";
import { LinkActions, LinkEditRow } from "@/components/link-toolbar";
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

// The shared toolbar rail, floated: `toolbar` draws the box, `selectionPopover`
// adds the anchor, the hairline and the elevation that floating costs.
const toolbarClass = cx(toolbar(), selectionPopover());
// Pairs with the selectionPopover recipe's `position-anchor`.
const selectionAnchor = "--selection-popover";

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
        {/* Mounted on entering link-edit, so each edit starts from the
            link's own address. */}
        <LinkEditRow href={linkHref} onApply={onApplyLink} />
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
        <LinkActions
          onEdit={onEditLink}
          onOpen={onGotoLink}
          onRemove={onRemoveLink}
        />
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
