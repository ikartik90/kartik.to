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

export type SelectionToolbarMode =
  | "format"
  | "link-edit"
  | "link-view"
  | "sidenote-view";

export type ToggleableMark = Exclude<Mark["type"], "link">;

interface SelectionToolbarProps {
  mode: SelectionToolbarMode;
  /** Viewport-relative rect the toolbar anchors to. */
  rect: PopoverRect;
  /** Marks the whole selection carries. */
  activeMarks: ReadonlySet<Mark["type"]>;
  linkHref?: string;
  linkNewTab?: boolean;
  onToggleMark: (type: ToggleableMark) => void;
  onStartLink: () => void;
  onApplyLink: (href: string, newTab: boolean) => void;
  onRemoveLink: () => void;
  onGotoLink: () => void;
  onEditLink: () => void;
  onAddSidenote: () => void;
  onEditSidenote: () => void;
  onDeleteSidenote: () => void;
  onDismiss: () => void;
}

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

const toolbarClass = cx(toolbar(), selectionPopover());
// Pairs with the selectionPopover recipe's `position-anchor`.
const selectionAnchor = "--selection-popover";

export function SelectionToolbar({
  mode,
  rect,
  activeMarks,
  linkHref,
  linkNewTab,
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
        <LinkEditRow
          href={linkHref}
          newTab={linkNewTab}
          onApply={onApplyLink}
        />
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
            <OptionList.Option
              aria-label="Edit sidenote"
              onClick={onEditSidenote}
            >
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
